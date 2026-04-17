const { supabaseAdmin } = require('../../config/supabase');
const { cacheService } = require('../../services/cache');
const { isCurrentlyOpen } = require('../../utils/hours');

const SAFE_FALLBACK = {
  type: 'transfer',
  value: 'operator_transfer',
  label: 'General Operator'
};

async function resolve(req, res) {
  const startTime = Date.now();

  try {
    const { workerId, deploymentId, channel, intent, department, timestamp } = req.body;

    if (!deploymentId) {
      return res.status(400).json({
        error: { code: 'MISSING_DEPLOYMENT_ID', message: 'deploymentId is required', safeFallback: SAFE_FALLBACK }
      });
    }

    // 1. Resolve deployment binding (cached)
    const bindingKey = cacheService.buildKey(['binding', deploymentId, channel || 'voice']);
    let binding = cacheService.get(bindingKey);

    if (!binding) {
      const { data, error } = await supabaseAdmin
        .from('deployment_bindings')
        .select('*')
        .eq('brainbase_deployment_id', deploymentId)
        .eq('channel', channel || 'voice')
        .eq('is_active', true)
        .single();

      if (error || !data) {
        // Try without channel filter
        const { data: fallbackData } = await supabaseAdmin
          .from('deployment_bindings')
          .select('*')
          .eq('brainbase_deployment_id', deploymentId)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (!fallbackData) {
          return res.status(404).json({
            error: { code: 'BINDING_NOT_FOUND', message: 'No deployment binding found', safeFallback: SAFE_FALLBACK }
          });
        }
        binding = fallbackData;
      } else {
        binding = data;
      }
      cacheService.set(bindingKey, binding, 300);
    }

    const clientId = binding.client_id;

    // 2. Check deployment overrides (cached)
    const overridesKey = cacheService.buildKey(['overrides', binding.id]);
    let overrides = cacheService.get(overridesKey);

    if (!overrides) {
      const { data: overrideData } = await supabaseAdmin
        .from('deployment_overrides')
        .select('*')
        .eq('deployment_binding_id', binding.id)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      overrides = overrideData || [];
      cacheService.set(overridesKey, overrides, 120);
    }

    // 3. Resolve routing (cached)
    const routingKey = cacheService.buildKey(['routing', clientId, department, intent]);
    let routingResult = cacheService.get(routingKey);

    if (!routingResult) {
      // Fetch routing rules for this client
      let query = supabaseAdmin
        .from('routing_rules')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      const { data: rules } = await query;

      // Find matching rule
      let matchedRule = null;

      if (rules && rules.length > 0) {
        // Priority: exact dept+intent > dept only > intent only > fallback
        if (department && intent) {
          matchedRule = rules.find(r => r.department_code === department && r.intent_key === intent && !r.is_fallback);
        }
        if (!matchedRule && department) {
          matchedRule = rules.find(r => r.department_code === department && !r.intent_key && !r.is_fallback);
        }
        if (!matchedRule && intent) {
          matchedRule = rules.find(r => r.intent_key === intent && !r.department_code && !r.is_fallback);
        }
        if (!matchedRule) {
          matchedRule = rules.find(r => r.is_fallback);
        }
      }

      routingResult = matchedRule;
      cacheService.set(routingKey, routingResult || { empty: true }, 120);
    }

    // 4. Check hours (cached)
    let hoursStatus = { isOpen: true, reason: 'default' };

    if (department) {
      const hoursKey = cacheService.buildKey(['hours', clientId, department, timestamp || 'now']);
      let cachedHours = cacheService.get(hoursKey);

      if (!cachedHours) {
        // Get department
        const { data: dept } = await supabaseAdmin
          .from('departments')
          .select('id')
          .eq('client_id', clientId)
          .eq('code', department)
          .eq('is_active', true)
          .single();

        if (dept) {
          const { data: hours } = await supabaseAdmin
            .from('hours_of_operation')
            .select('*')
            .eq('client_id', clientId)
            .eq('department_id', dept.id);

          const { data: holidays } = await supabaseAdmin
            .from('holiday_exceptions')
            .select('*')
            .eq('client_id', clientId)
            .or(`department_id.eq.${dept.id},department_id.is.null`);

          const tz = hours?.[0]?.timezone || 'America/New_York';
          cachedHours = isCurrentlyOpen(hours || [], holidays || [], timestamp, tz);
        } else {
          cachedHours = { isOpen: true, reason: 'department_not_found' };
        }
        cacheService.set(hoursKey, cachedHours, 60);
      }
      hoursStatus = cachedHours;
    }

    // 5. Apply deployment overrides
    let action = null;
    let fallback = SAFE_FALLBACK;
    let promptHints = {};

    // Check routing override
    const routingOverride = overrides.find(o => o.override_type === 'routing');
    if (routingOverride && routingOverride.override_data) {
      const od = routingOverride.override_data;
      if (od.action_type) {
        action = { type: od.action_type, label: od.action_label || '', value: od.action_value || '' };
      }
    }

    // Check prompt hints override
    const hintsOverride = overrides.find(o => o.override_type === 'prompt_hints');
    if (hintsOverride && hintsOverride.override_data) {
      promptHints = { ...promptHints, ...hintsOverride.override_data };
    }

    // Use routing rule if no override
    if (!action && routingResult && !routingResult.empty) {
      // If closed, check for closed-specific routing
      if (!hoursStatus.isOpen) {
        const closedRule = (await (async () => {
          const { data } = await supabaseAdmin
            .from('routing_rules')
            .select('*')
            .eq('client_id', clientId)
            .eq('condition_type', 'closed')
            .eq('is_active', true)
            .or(department ? `department_code.eq.${department},department_code.is.null` : 'department_code.is.null')
            .order('priority', { ascending: false })
            .limit(1);
          return data?.[0];
        })());

        if (closedRule) {
          action = { type: closedRule.action_type, label: closedRule.action_label || '', value: closedRule.action_value || '' };
        }
      }

      if (!action) {
        action = {
          type: routingResult.action_type,
          label: routingResult.action_label || '',
          value: routingResult.action_value || ''
        };
      }

      if (routingResult.is_fallback) {
        fallback = { type: routingResult.action_type, label: routingResult.action_label || '', value: routingResult.action_value || '' };
      }
    }

    // Default action if nothing matched
    if (!action) {
      action = SAFE_FALLBACK;
    }

    // 6. Build response
    const response = {
      clientId,
      resolvedBy: 'deployment_binding',
      channel: channel || 'voice',
      intent: intent || null,
      department: department || null,
      isOpen: hoursStatus.isOpen,
      hoursDetail: hoursStatus.reason !== 'default' ? hoursStatus : undefined,
      action,
      fallback,
      promptHints: {
        speakBriefly: channel === 'voice',
        confirmationStyle: 'single_confirmation_only',
        ...promptHints
      },
      _meta: {
        responseTime: Date.now() - startTime,
        cached: false,
        version: binding.metadata?.version || null
      }
    };

    res.json(response);
  } catch (err) {
    console.error('[RUNTIME] deployment-resolve error:', err);
    res.status(500).json({
      error: {
        code: 'RESOLVE_ERROR',
        message: 'Failed to resolve deployment',
        safeFallback: SAFE_FALLBACK
      }
    });
  }
}

module.exports = { resolve };
