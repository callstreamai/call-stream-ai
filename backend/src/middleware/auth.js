const { supabaseAnon, supabaseAnonKey } = require('../config/supabase');
const { createClient } = require('@supabase/supabase-js');

// Runtime API auth - token-based for Brainbase
function runtimeAuth(req, res, next) {
  const token = req.headers['x-api-token'] || req.headers.authorization?.replace('Bearer ', '');
  const expectedToken = process.env.RUNTIME_API_TOKEN;

  if (!expectedToken) {
    return next();
  }

  if (!token || token !== expectedToken) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing API token',
        safeFallback: { type: 'transfer', value: 'operator_transfer' }
      }
    });
  }
  next();
}

// Admin API auth - Supabase JWT
async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  // Check if Supabase is properly configured
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  
  // Dev mode: skip auth if Supabase keys are placeholders or missing
  if (!supabaseUrl || !anonKey || anonKey === 'PLACEHOLDER_ANON_KEY' || anonKey.startsWith('PLACEHOLDER')) {
    req.user = { id: 'dev-user', email: 'dev@callstream.ai' };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }

    req.user = user;
    req.supabase = supabase;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: { code: 'AUTH_ERROR', message: 'Authentication failed' } });
  }
}

module.exports = { runtimeAuth, adminAuth };
