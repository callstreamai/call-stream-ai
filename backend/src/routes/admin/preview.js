const { supabaseAdmin } = require('../../config/supabase');
const { isCurrentlyOpen } = require('../../utils/hours');

async function simulate(req, res) {
  try {
    const { clientId, workerId, deploymentId, channel, intent, department, timestamp } = req.body;

    if (!clientId) return res.status(400).json({ error: { message: 'clientId is required' } });

    const results = { steps: [], finalResponse: null };

    // Step 1: Resolve binding (if deploymentId provided)
    let resolvedClientId = clientId;
    if (deploymentId) {
      const { data: binding } = await supabaseAdmin
        .from('deployment_bindings')
        .select('*')
        .eq('brainbase_deployment_id', deploymentId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (binding) {
        resolvedClientId = binding.client_id;
        results.steps.push({ step: 'Deployment Binding', status: 'found', data: { clientId: binding.client_id, channel: binding.channel } });
      } else {
        results.steps.push({ step: 'Deployment Binding', status: 'not_found', data: null });
      }
    }

    // Step 2: Check hours
    let hoursStatus = { isOpen: true, reason: 'default' };
    if (department) {
      const { data: dept } = await supabaseAdmin
        .from('departments')
        .select('id')
        .eq('client_id', resolvedClientId)
        .eq('code', department)
        .single();

      if (dept) {
        const { data: hours } = await supabaseAdmin
          .from('hours_of_operation')
          .select('*')
          .eq('client_id', resolvedClientId)
          .eq('department_id', dept.id);

        const { data: holidays } = await supabaseAdmin
          .from('holiday_exceptions')
          .select('*')
          .eq('client_id', resolvedClientId);

        const tz = hours?.[0]?.timezone || 'America/New_York';
        hoursStatus = isCurrentlyOpen(hours || [], holidays || [], timestamp, tz);
      }
      results.steps.push({ step: 'Hours Check', status: hoursStatus.isOpen ? 'open' : 'closed', data: hoursStatus });
    }

    // Step 3: Find routing rule
    let matchedRule = null;
    const { data: rules } = await supabaseAdmin
      .from('routing_rules')
      .select('*')
      .eq('client_id', resolvedClientId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rules) {
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
    results.steps.push({ step: 'Routing Rule Match', status: matchedRule ? 'matched' : 'no_match', data: matchedRule });

    // Step 4: Check for closed override
    if (!hoursStatus.isOpen && rules) {
      const closedRule = rules.find(r => r.condition_type === 'closed' && 
        (!r.department_code || r.department_code === department));
      if (closedRule) {
        results.steps.push({ step: 'Closed Override', status: 'applied', data: closedRule });
        matchedRule = closedRule;
      }
    }

    // Step 5: Build final response
    const action = matchedRule ? {
      type: matchedRule.action_type,
      label: matchedRule.action_label || '',
      value: matchedRule.action_value || ''
    } : { type: 'transfer', label: 'General Operator', value: 'operator_transfer' };

    const fallback = { type: 'transfer', label: 'General Operator', value: 'operator_transfer' };

    results.finalResponse = {
      clientId: resolvedClientId,
      resolvedBy: deploymentId ? 'deployment_binding' : 'direct',
      channel: channel || 'voice',
      intent: intent || null,
      department: department || null,
      isOpen: hoursStatus.isOpen,
      action,
      fallback,
      promptHints: {
        speakBriefly: (channel || 'voice') === 'voice',
        confirmationStyle: 'single_confirmation_only'
      }
    };

    res.json(results);
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
}

module.exports = { simulate };
