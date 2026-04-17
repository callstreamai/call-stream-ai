const { supabaseAdmin } = require('../../config/supabase');
const { cacheService } = require('../../services/cache');

async function list(req, res) {
  try {
    const { clientId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('hours_of_operation')
      .select('*, departments(name, code)')
      .eq('client_id', clientId)
      .order('day_of_week');
    if (error) throw error;
    res.json({ items: data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function upsert(req, res) {
  try {
    const { clientId } = req.params;
    const entries = Array.isArray(req.body) ? req.body : [req.body];
    const withClient = entries.map(e => ({ ...e, client_id: clientId }));
    
    const { data, error } = await supabaseAdmin
      .from('hours_of_operation')
      .upsert(withClient)
      .select();
    if (error) throw error;
    cacheService.invalidateClient(clientId);
    res.json({ items: data });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

async function remove(req, res) {
  try {
    const { clientId, id } = req.params;
    const { error } = await supabaseAdmin
      .from('hours_of_operation')
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

module.exports = { list, upsert, remove };
