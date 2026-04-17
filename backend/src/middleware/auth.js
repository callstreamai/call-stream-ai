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

// Admin API auth - Supabase JWT validation
async function adminAuth(req, res, next) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  // Demo mode bypass
  if (process.env.DEMO_MODE === 'true') {
    req.user = { id: 'demo-user', email: 'demo@callstream.ai' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } });
  }

  const token = authHeader.replace('Bearer ', '');

  if (!supabaseUrl || !anonKey) {
    req.user = { id: 'dev-user', email: 'dev@callstream.ai' };
    return next();
  }

  try {
    // Create a client with the user's JWT to validate it
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }

    // Enforce domain
    if (!user.email || !user.email.endsWith('@callstreamai.com')) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only @callstreamai.com accounts are allowed' } });
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
