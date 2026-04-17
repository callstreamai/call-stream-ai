const { Pool } = require('pg');

// Build connection string from available env vars
function getConnectionString() {
  // Prefer explicit DATABASE_URL
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Construct from Supabase env vars
  if (process.env.DB_PASSWORD && process.env.SUPABASE_URL) {
    const match = process.env.SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
    const ref = match ? match[1] : '';
    if (ref) {
      return `postgresql://postgres.${ref}:${encodeURIComponent(process.env.DB_PASSWORD)}@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`;
    }
  }

  // Fallback: construct from known Supabase project ref
  // The project ref is already embedded in SUPABASE_URL and SUPABASE_ANON_KEY
  if (process.env.SUPABASE_URL) {
    const match = process.env.SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
    const ref = match ? match[1] : '';
    if (ref) {
      // Use the connection pooler with the project password
      // This is set via SUPABASE_DB_PASSWORD or falls back to the configured password
      const pw = process.env.SUPABASE_DB_PASSWORD || 'CsAi2026$ecure!Pwd';
      return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`;
    }
  }

  console.warn('[DB] No database connection configured.');
  return null;
}

const connectionString = getConnectionString();

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('[DB] Pool error:', err.message);
  });

  // Warm the pool on startup
  pool.query('SELECT 1').then(() => {
    console.log('[DB] Postgres pool ready (direct connection)');
  }).catch(err => {
    console.error('[DB] Pool warmup failed:', err.message);
  });
} else {
  console.warn('[DB] Postgres pool NOT initialized');
}

async function query(text, params) {
  if (!pool) throw new Error('Database pool not initialized');
  const result = await pool.query(text, params);
  return result;
}

async function queryOne(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

async function queryRows(text, params) {
  const result = await query(text, params);
  return result.rows;
}

module.exports = { pool, query, queryOne, queryRows };
