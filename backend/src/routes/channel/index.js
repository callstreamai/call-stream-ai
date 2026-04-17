const express = require('express');
const router = express.Router();
const { runtimeAuth } = require('../../middleware/auth');
const { supabaseAdmin } = require('../../config/supabase');
const { cacheService } = require('../../services/cache');
const { isCurrentlyOpen } = require('../../utils/hours');

router.use(runtimeAuth);

// Channel-aware resolve endpoint (richer than runtime for non-voice)
router.post('/resolve', async (req, res) => {
  const startTime = Date.now();

  try {
    const { workerId, deploymentId, channel, intent, department, timestamp, sessionId } = req.body;
    const effectiveChannel = channel || 'chat';

    if (!deploymentId) {
      return res.status(400).json({ error: { code: 'MISSING_DEPLOYMENT_ID', message: 'deploymentId is required' } });
    }

    // Resolve binding
    const { data: binding } = await supabaseAdmin
      .from('deployment_bindings')
      .select('*')
      .eq('brainbase_deployment_id', deploymentId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!binding) {
      return res.status(404).json({ error: { code: 'BINDING_NOT_FOUND', message: 'No deployment binding found' } });
    }

    const clientId = binding.client_id;

    // Get routing
    const { data: rules } = await supabaseAdmin
      .from('routing_rules')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    let matchedRule = null;
    if (rules) {
      if (department && intent) matchedRule = rules.find(r => r.department_code === department && r.intent_key === intent && !r.is_fallback);
      if (!matchedRule && department) matchedRule = rules.find(r => r.department_code === department && !r.intent_key && !r.is_fallback);
      if (!matchedRule && intent) matchedRule = rules.find(r => r.intent_key === intent && !r.department_code && !r.is_fallback);
      if (!matchedRule) matchedRule = rules.find(r => r.is_fallback);
    }

    // Get relevant KB items for richer responses
    let kbItems = [];
    if (intent || department) {
      let kbQuery = supabaseAdmin.from('kb_items').select('question, answer, category').eq('client_id', clientId).eq('is_active', true);
      if (intent) kbQuery = kbQuery.eq('intent_key', intent);
      else if (department) kbQuery = kbQuery.eq('department_code', department);
      const { data } = await kbQuery.limit(5);
      kbItems = data || [];
    }

    // Check channel overrides
    const { data: channelOverrides } = await supabaseAdmin
      .from('channel_overrides')
      .select('*')
      .eq('client_id', clientId)
      .eq('channel', effectiveChannel)
      .eq('is_active', true);

    const action = matchedRule ? {
      type: matchedRule.action_type,
      label: matchedRule.action_label || '',
      value: matchedRule.action_value || ''
    } : { type: 'info_response', label: 'Default', value: 'How can I help you?' };

    // Channel-enriched response
    const response = {
      clientId,
      channel: effectiveChannel,
      intent,
      department,
      action,
      fallback: { type: 'info_response', value: 'Let me connect you with someone who can help.' },
      relatedFaq: kbItems,
      channelOverrides: channelOverrides || [],
      promptHints: {
        speakBriefly: false,
        useRichFormatting: effectiveChannel !== 'sms',
        includeLinks: true,
        maxResponseLength: effectiveChannel === 'sms' ? 160 : 2000
      },
      _meta: { responseTime: Date.now() - startTime }
    };

    res.json(response);
  } catch (err) {
    console.error('[CHANNEL] resolve error:', err);
    res.status(500).json({ error: { code: 'CHANNEL_ERROR', message: 'Failed to resolve channel request' } });
  }
});

// Get full context for chat widget initialization
router.get('/:clientId/init', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { channel = 'chat' } = req.query;

    const [depts, intents] = await Promise.all([
      supabaseAdmin.from('departments').select('name, code, is_default').eq('client_id', clientId).eq('is_active', true).order('display_order'),
      supabaseAdmin.from('intents').select('intent_key, label, department_code').eq('client_id', clientId).eq('is_active', true).order('priority', { ascending: false })
    ]);

    res.json({
      clientId,
      channel,
      departments: depts.data || [],
      intents: intents.data || [],
      config: {
        welcomeMessage: 'Hi! How can I help you today?',
        inputPlaceholder: 'Type your message...'
      }
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'INIT_ERROR', message: 'Failed to initialize channel' } });
  }
});

module.exports = router;
