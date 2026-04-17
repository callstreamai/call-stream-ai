const { supabaseAdmin } = require('../../config/supabase');
const { cacheService } = require('../../services/cache');

async function list(req, res) {
  try {
    const { clientId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('intents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ items: data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function create(req, res) {
  try {
    const { clientId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('intents')
      .insert({ ...req.body, client_id: clientId })
      .select()
      .single();
    if (error) throw error;
    cacheService.invalidateClient(clientId);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function update(req, res) {
  try {
    const { clientId, id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('intents')
      .update(req.body)
      .eq('id', id)
      .eq('client_id', clientId)
      .select()
      .single();
    if (error) throw error;
    cacheService.invalidateClient(clientId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function remove(req, res) {
  try {
    const { clientId, id } = req.params;
    const { error } = await supabaseAdmin
      .from('intents')
      .delete()
      .eq('id', id)
      .eq('client_id', clientId);
    if (error) throw error;
    cacheService.invalidateClient(clientId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

module.exports = { list, create, update, remove };
