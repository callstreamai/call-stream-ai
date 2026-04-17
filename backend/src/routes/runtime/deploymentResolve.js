const db = require('../../config/db');
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
    const effectiveChannel = channel || 'voice';
    const bindingKey = cacheService.buildKey(['binding', deploymentId, effectiveChannel]);
    let binding = cacheService.get(bindingKey);

    if (!binding) {
      // Try with channel filter first
      binding = await db.queryOne(
        `SELECT * FROM deployment_bindings
         WHERE brainbase_deployment_id = $1 AND channel = $2 AND is_active = true
         LIMIT 1`,
        [deploymentId, effectiveChannel]
      );

      if (!binding) {
        // Try without channel filter
        binding = await db.queryOne(
          `SELECT * FROM deployment_bindings
           WHERE brainbase_deployment_id = $1 AND is_active = true
           LIMIT 1`,
          [deploymentId]
        );
      }

      if (!binding) {
        return res.status(404).json({
          error: { code: 'BINDING_NOT_FOUND', message: 'No deployment binding found', safeFallback: SAFE_FALLBACK }
        });
      }

      cacheService.set(bindingKey, binding, 300);
    }

    const clientId = binding.client_id;

    // 2. Fetch all needed data in parallel (single round-trip each)
    const configKey = cacheService.buildKey(['resolve-config', clientId, effectiveChannel]);
    let config = cacheService.get(configKey);

    if (!config) {
      const [client, rules, hours, holidays, kbItems, channelOverrides] = await Promise.all([
        db.queryOne(
          `SELECT id, name, slug, vertical, status, timezone, settings FROM clients WHERE id = $1`,
          [clientId]
        ),
        db.queryRows(
          `SELECT department_code, intent_key, condition_type, action_type,
                  action_label, action_value, priority, is_fallback
           FROM routing_rules
           WHERE client_id = $1 AND is_active = true
           ORDER BY priority DESC`,
          [clientId]
        ),
        db.queryRows(
          `SELECT day_of_week, open_time, close_time, is_closed, timezone
           FROM hours_of_operation WHERE client_id = $1`,
          [clientId]
        ),
        db.queryRows(
          `SELECT name, date, is_closed, open_time, close_time
           FROM holiday_exceptions WHERE client_id = $1`,
          [clientId]
        ),
        db.queryRows(
          `SELECT category, question, answer, department_code, intent_key
           FROM kb_items WHERE client_id = $1 AND is_active = true
           ORDER BY priority DESC LIMIT 20`,
          [clientId]
        ),
        db.queryRows(
          `SELECT * FROM channel_overrides
           WHERE client_id = $1 AND channel = $2 AND is_active = true`,
          [clientId, effectiveChannel]
        )
      ]);

      config = { client, rules, hours, holidays, kbItems, channelOverrides };
      cacheService.set(configKey, config, 120);
    }

    const { client, rules, hours, holidays, kbItems, channelOverrides } = config;

    if (!client) {
      return res.status(404).json({
        error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found', safeFallback: SAFE_FALLBACK }
      });
    }

    // 3. Route matching
    let matchedRule = null;
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

    // 4. Check hours
    const tz = client.timezone || hours[0]?.timezone || 'America/New_York';
    const hoursStatus = isCurrentlyOpen(hours, holidays, timestamp, tz);

    // 5. Filter relevant FAQ
    let relevantFaq = kbItems;
    if (intent) relevantFaq = kbItems.filter(k => k.intent_key === intent);
    else if (department) relevantFaq = kbItems.filter(k => k.department_code === department);
    relevantFaq = relevantFaq.slice(0, 5);

    // 6. Build action
    const action = matchedRule
      ? { type: matchedRule.action_type, label: matchedRule.action_label || '', value: matchedRule.action_value || '' }
      : { type: 'info_response', label: 'Default', value: 'How can I help you?' };

    // Apply channel overrides
    const override = channelOverrides.find(o =>
      (!o.department_code || o.department_code === department) &&
      (!o.intent_key || o.intent_key === intent)
    );
    if (override) {
      if (override.greeting_override) action.greeting = override.greeting_override;
      if (override.response_override) action.value = override.response_override;
    }

    const responseTime = Date.now() - startTime;

    res.json({
      client: { id: client.id, name: client.name, slug: client.slug },
      channel: effectiveChannel,
      department,
      intent,
      action,
      fallback: SAFE_FALLBACK,
      context: {
        isOpen: hoursStatus.isOpen,
        currentHours: hoursStatus,
        directory: [] // fetched separately via /:clientId/directory
      },
      faq: relevantFaq,
      channelOverrides: channelOverrides.length > 0,
      _meta: {
        responseTime,
        cached: !!cacheService.get(cacheService.buildKey(['resolve-config', clientId, effectiveChannel])),
        deploymentId,
        workerId: workerId || null
      }
    });
  } catch (err) {
    console.error('[RUNTIME] deployment-resolve error:', err);
    res.status(500).json({
      error: { code: 'RESOLVE_ERROR', message: 'Failed to resolve deployment', safeFallback: SAFE_FALLBACK }
    });
  }
}

module.exports = { resolve };
