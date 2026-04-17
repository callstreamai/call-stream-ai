const express = require('express');
const router = express.Router();
const { runtimeAuth } = require('../../middleware/auth');
const db = require('../../config/db');
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
    const binding = await db.queryOne(
      `SELECT * FROM deployment_bindings
       WHERE brainbase_deployment_id = $1 AND is_active = true
       LIMIT 1`,
      [deploymentId]
    );

    if (!binding) {
      return res.status(404).json({ error: { code: 'BINDING_NOT_FOUND', message: 'No deployment binding found' } });
    }

    const clientId = binding.client_id;

    // Fetch routing + KB + overrides in parallel
    const [rules, kbItems, channelOverrides] = await Promise.all([
      db.queryRows(
        `SELECT department_code, intent_key, condition_type, action_type,
                action_label, action_value, priority, is_fallback
         FROM routing_rules
         WHERE client_id = $1 AND is_active = true
         ORDER BY priority DESC`,
        [clientId]
      ),
      db.queryRows(
        `SELECT question, answer, category FROM kb_items
         WHERE client_id = $1 AND is_active = true
         ${intent ? 'AND intent_key = $2' : department ? 'AND department_code = $2' : ''}
         ORDER BY priority DESC LIMIT 5`,
        intent ? [clientId, intent] : department ? [clientId, department] : [clientId]
      ),
      db.queryRows(
        `SELECT * FROM channel_overrides
         WHERE client_id = $1 AND channel = $2 AND is_active = true`,
        [clientId, effectiveChannel]
      )
    ]);

    // Route matching
    let matchedRule = null;
    if (department && intent) matchedRule = rules.find(r => r.department_code === department && r.intent_key === intent && !r.is_fallback);
    if (!matchedRule && department) matchedRule = rules.find(r => r.department_code === department && !r.intent_key && !r.is_fallback);
    if (!matchedRule && intent) matchedRule = rules.find(r => r.intent_key === intent && !r.department_code && !r.is_fallback);
    if (!matchedRule) matchedRule = rules.find(r => r.is_fallback);

    const action = matchedRule ? {
      type: matchedRule.action_type,
      label: matchedRule.action_label || '',
      value: matchedRule.action_value || ''
    } : { type: 'info_response', label: 'Default', value: 'How can I help you?' };

    res.json({
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
    });
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
      db.queryRows(
        `SELECT name, code, is_default FROM departments
         WHERE client_id = $1 AND is_active = true ORDER BY display_order`,
        [clientId]
      ),
      db.queryRows(
        `SELECT intent_key, label, department_code FROM intents
         WHERE client_id = $1 AND is_active = true ORDER BY priority DESC`,
        [clientId]
      )
    ]);

    res.json({
      clientId,
      channel,
      departments: depts,
      intents,
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
