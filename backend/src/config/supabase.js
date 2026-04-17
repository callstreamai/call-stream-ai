const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'placeholder-key';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';

// Service role client (for runtime API - bypasses RLS)
let supabaseAdmin;
try {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
} catch (err) {
  console.warn('Failed to create Supabase admin client:', err.message);
  supabaseAdmin = null;
}

// Anon client (for authenticated user requests)
let supabaseAnon;
try {
  supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
} catch (err) {
  console.warn('Failed to create Supabase anon client:', err.message);
  supabaseAnon = null;
}

module.exports = { supabaseAdmin, supabaseAnon, supabaseUrl, supabaseAnonKey };
