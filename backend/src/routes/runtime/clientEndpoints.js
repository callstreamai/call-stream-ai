const { supabaseAdmin } = require('../../config/supabase');
const { cacheService } = require('../../services/cache');
const { isCurrentlyOpen } = require('../../utils/hours');

const SAFE_FALLBACK = { type: 'transfer', value: 'operator_transfer', label: 'General Operator' };

async function getDirectory(req, res) {
  try {
    const { clientId } = req.params;
    const { department } = req.query;

    const cacheKey = cacheService.buildKey(['directory', clientId, department]);
    let data = cacheService.get(cacheKey);

    if (!data) {
      let query = supabaseAdmin
        .from('directory_entries')
        .select('name, phone_number, extension, email, entry_type, metadata')
        .eq('client_id', clientId)
        .eq('is_active', true);

      if (department) {
        const { data: dept } = await supabaseAdmin
          .from('departments')
          .select('id')
          .eq('client_id', clientId)
          .eq('code', department)
          .single();
        if (dept) query = query.eq('department_id', dept.id);
      }

      const { data: entries, error } = await query;
      if (error) throw error;
      data = entries || [];
      cacheService.set(cacheKey, data, 120);
    }

    res.json({ clientId, directory: data, count: data.length });
  } catch (err) {
    console.error('[RUNTIME] directory error:', err);
    res.status(500).json({ error: { code: 'DIRECTORY_ERROR', message: 'Failed to fetch directory', safeFallback: SAFE_FALLBACK } });
  }
}

async function getHours(req, res) {
  try {
    const { clientId } = req.params;
    const { department, timestamp } = req.query;

    const cacheKey = cacheService.buildKey(['hours', clientId, department, timestamp]);
    let data = cacheService.get(cacheKey);

    if (!data) {
      let hoursQuery = supabaseAdmin
        .from('hours_of_operation')
        .select('day_of_week, open_time, close_time, is_closed, timezone')
        .eq('client_id', clientId);

      if (department) {
        const { data: dept } = await supabaseAdmin.from('departments').select('id').eq('client_id', clientId).eq('code', department).single();
        if (dept) hoursQuery = hoursQuery.eq('department_id', dept.id);
      }

      const { data: hours } = await hoursQuery;

      const { data: holidays } = await supabaseAdmin
        .from('holiday_exceptions')
        .select('name, date, is_closed, open_time, close_time')
        .eq('client_id', clientId);

      const tz = hours?.[0]?.timezone || 'America/New_York';
      const status = isCurrentlyOpen(hours || [], holidays || [], timestamp, tz);

      data = { hours: hours || [], holidays: holidays || [], currentStatus: status };
      cacheService.set(cacheKey, data, 60);
    }

    res.json({ clientId, ...data });
  } catch (err) {
    console.error('[RUNTIME] hours error:', err);
    res.status(500).json({ error: { code: 'HOURS_ERROR', message: 'Failed to fetch hours', safeFallback: SAFE_FALLBACK } });
  }
}

async function getRouting(req, res) {
  try {
    const { clientId } = req.params;
    const { department, intent } = req.query;

    const cacheKey = cacheService.buildKey(['routing', clientId, department, intent]);
    let data = cacheService.get(cacheKey);

    if (!data) {
      let query = supabaseAdmin
        .from('routing_rules')
        .select('department_code, intent_key, condition_type, action_type, action_label, action_value, priority, is_fallback')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (department) query = query.eq('department_code', department);
      if (intent) query = query.eq('intent_key', intent);

      const { data: rules, error } = await query;
      if (error) throw error;
      data = rules || [];
      cacheService.set(cacheKey, data, 120);
    }

    res.json({ clientId, rules: data, count: data.length });
  } catch (err) {
    console.error('[RUNTIME] routing error:', err);
    res.status(500).json({ error: { code: 'ROUTING_ERROR', message: 'Failed to fetch routing', safeFallback: SAFE_FALLBACK } });
  }
}

async function getContext(req, res) {
  try {
    const { clientId } = req.params;

    const cacheKey = cacheService.buildKey(['context', clientId]);
    let data = cacheService.get(cacheKey);

    if (!data) {
      const [deptRes, intentRes] = await Promise.all([
        supabaseAdmin.from('departments').select('name, code, is_default').eq('client_id', clientId).eq('is_active', true).order('display_order'),
        supabaseAdmin.from('intents').select('intent_key, label, department_code, priority').eq('client_id', clientId).eq('is_active', true).order('priority', { ascending: false })
      ]);

      data = {
        departments: deptRes.data || [],
        intents: intentRes.data || [],
      };
      cacheService.set(cacheKey, data, 120);
    }

    res.json({ clientId, ...data });
  } catch (err) {
    console.error('[RUNTIME] context error:', err);
    res.status(500).json({ error: { code: 'CONTEXT_ERROR', message: 'Failed to fetch context', safeFallback: SAFE_FALLBACK } });
  }
}

async function getFaq(req, res) {
  try {
    const { clientId } = req.params;
    const { category, department, intent, q } = req.query;

    const cacheKey = cacheService.buildKey(['faq', clientId, category, department, intent, q]);
    let data = cacheService.get(cacheKey);

    if (!data) {
      let query = supabaseAdmin
        .from('kb_items')
        .select('category, question, answer, department_code, intent_key, tags, priority')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (category) query = query.eq('category', category);
      if (department) query = query.eq('department_code', department);
      if (intent) query = query.eq('intent_key', intent);
      if (q) query = query.or(`question.ilike.%${q}%,answer.ilike.%${q}%`);

      const { data: items, error } = await query;
      if (error) throw error;
      data = items || [];
      cacheService.set(cacheKey, data, 120);
    }

    res.json({ clientId, items: data, count: data.length });
  } catch (err) {
    console.error('[RUNTIME] faq error:', err);
    res.status(500).json({ error: { code: 'FAQ_ERROR', message: 'Failed to fetch FAQ', safeFallback: SAFE_FALLBACK } });
  }
}

module.exports = { getDirectory, getHours, getRouting, getContext, getFaq };
