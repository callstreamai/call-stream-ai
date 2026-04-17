const { supabaseAdmin } = require('../../config/supabase');

async function list(req, res) {
  try {
    const { clientId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const { data, error, count } = await supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (error) throw error;
    res.json({ logs: data, total: count });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

module.exports = { list };
