const { supabaseAdmin } = require('../../config/supabase');
const { cacheService } = require('../../services/cache');

async function publishVersion(req, res) {
  try {
    const { clientId } = req.params;
    const { notes } = req.body;

    // Get current max version
    const { data: versions } = await supabaseAdmin
      .from('published_versions')
      .select('version_number')
      .eq('client_id', clientId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (versions?.[0]?.version_number || 0) + 1;

    // Take snapshot of current state
    const [depts, directory, hours, holidays, routing, intents, kb, deployments] = await Promise.all([
      supabaseAdmin.from('departments').select('*').eq('client_id', clientId),
      supabaseAdmin.from('directory_entries').select('*').eq('client_id', clientId),
      supabaseAdmin.from('hours_of_operation').select('*').eq('client_id', clientId),
      supabaseAdmin.from('holiday_exceptions').select('*').eq('client_id', clientId),
      supabaseAdmin.from('routing_rules').select('*').eq('client_id', clientId),
      supabaseAdmin.from('intents').select('*').eq('client_id', clientId),
      supabaseAdmin.from('kb_items').select('*').eq('client_id', clientId),
      supabaseAdmin.from('deployment_bindings').select('*').eq('client_id', clientId)
    ]);

    const snapshot = {
      departments: depts.data,
      directory: directory.data,
      hours: hours.data,
      holidays: holidays.data,
      routing: routing.data,
      intents: intents.data,
      kb: kb.data,
      deployments: deployments.data
    };

    // Deactivate previous versions
    await supabaseAdmin
      .from('published_versions')
      .update({ is_active: false })
      .eq('client_id', clientId);

    // Create new version
    const { data: version, error } = await supabaseAdmin
      .from('published_versions')
      .insert({
        client_id: clientId,
        version_number: nextVersion,
        snapshot,
        notes: notes || `Version ${nextVersion}`,
        is_active: true,
        published_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update client status
    await supabaseAdmin.from('clients').update({ status: 'active' }).eq('id', clientId);

    // Invalidate cache
    cacheService.invalidateClient(clientId);

    // Log cache invalidation event
    await supabaseAdmin.from('cache_invalidation_events').insert({
      client_id: clientId,
      event_type: 'publish',
      affected_keys: ['all'],
    });

    res.json({ version: { id: version.id, version_number: nextVersion }, published: true });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
}

async function listVersions(req, res) {
  try {
    const { clientId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('published_versions')
      .select('id, version_number, notes, is_active, published_at, created_at')
      .eq('client_id', clientId)
      .order('version_number', { ascending: false });
    if (error) throw error;
    res.json({ versions: data });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
}

module.exports = { publishVersion, listVersions };
