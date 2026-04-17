const { supabaseAdmin } = require('../../config/supabase');
const { v4: uuid } = require('uuid');

async function list(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ clients: data });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function get(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function create(req, res) {
  try {
    const { name, vertical, slug } = req.body;

    if (!name || !vertical) {
      return res.status(400).json({ error: { message: 'name and vertical are required' } });
    }

    const clientSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // 1. Create client
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({ name, vertical, slug: clientSlug, status: 'draft' })
      .select()
      .single();

    if (clientError) throw clientError;

    // 2. Clone vertical template
    const { data: template } = await supabaseAdmin
      .from('vertical_templates')
      .select('id')
      .eq('vertical', vertical)
      .single();

    if (template) {
      await cloneTemplate(template.id, client.id);
    }

    res.status(201).json(client);
  } catch (err) {
    console.error('Client creation error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
}

async function cloneTemplate(templateId, clientId) {
  // Clone departments
  const { data: tmplDepts } = await supabaseAdmin
    .from('vertical_template_departments')
    .select('*')
    .eq('template_id', templateId);

  const deptMapping = {};

  if (tmplDepts && tmplDepts.length > 0) {
    for (const dept of tmplDepts) {
      const newId = uuid();
      deptMapping[dept.code] = newId;
      await supabaseAdmin.from('departments').insert({
        id: newId,
        client_id: clientId,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        display_order: dept.display_order,
        is_default: dept.is_default,
        is_active: true
      });
    }
  }

  // Clone intents
  const { data: tmplIntents } = await supabaseAdmin
    .from('vertical_template_intents')
    .select('*')
    .eq('template_id', templateId);

  if (tmplIntents && tmplIntents.length > 0) {
    const intents = tmplIntents.map(i => ({
      client_id: clientId,
      department_id: deptMapping[i.department_code] || null,
      department_code: i.department_code,
      intent_key: i.intent_key,
      label: i.label,
      description: i.description,
      priority: i.priority,
      is_active: true
    }));
    await supabaseAdmin.from('intents').insert(intents);
  }

  // Clone routing rules
  const { data: tmplRules } = await supabaseAdmin
    .from('vertical_template_routing_rules')
    .select('*')
    .eq('template_id', templateId);

  if (tmplRules && tmplRules.length > 0) {
    const rules = tmplRules.map(r => ({
      client_id: clientId,
      department_id: deptMapping[r.department_code] || null,
      department_code: r.department_code,
      intent_key: r.intent_key,
      condition_type: r.condition_type,
      action_type: r.action_type,
      action_label: r.action_label,
      action_value: r.action_value,
      priority: r.priority,
      is_fallback: r.is_fallback,
      is_active: true
    }));
    await supabaseAdmin.from('routing_rules').insert(rules);
  }

  // Clone KB items
  const { data: tmplKb } = await supabaseAdmin
    .from('vertical_template_kb_items')
    .select('*')
    .eq('template_id', templateId);

  if (tmplKb && tmplKb.length > 0) {
    const kbItems = tmplKb.map(k => ({
      client_id: clientId,
      category: k.category,
      question: k.question,
      answer: k.answer,
      department_code: k.department_code,
      intent_key: k.intent_key,
      tags: k.tags,
      priority: k.priority,
      is_active: true
    }));
    await supabaseAdmin.from('kb_items').insert(kbItems);
  }

  // Clone hours
  const { data: tmplHours } = await supabaseAdmin
    .from('vertical_template_hours')
    .select('*')
    .eq('template_id', templateId);

  if (tmplHours && tmplHours.length > 0) {
    const hours = tmplHours.map(h => ({
      client_id: clientId,
      department_id: deptMapping[h.department_code] || null,
      day_of_week: h.day_of_week,
      open_time: h.open_time,
      close_time: h.close_time,
      is_closed: h.is_closed,
      timezone: 'America/New_York'
    }));
    await supabaseAdmin.from('hours_of_operation').insert(hours);
  }
}

async function update(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function remove(req, res) {
  try {
    const { error } = await supabaseAdmin
      .from('clients')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function listVerticals(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('vertical_templates')
      .select('vertical, name, description')
      .order('name');
    if (error) throw error;
    res.json({ verticals: data });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

module.exports = { list, get, create, update, remove, listVerticals };
