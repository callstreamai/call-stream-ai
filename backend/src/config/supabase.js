const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('WARNING: Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
}

// Service role client (for runtime API - bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey || 'placeholder', {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Anon client (for authenticated user requests)
const supabaseAnon = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

module.exports = { supabaseAdmin, supabaseAnon, supabaseUrl, supabaseAnonKey };
