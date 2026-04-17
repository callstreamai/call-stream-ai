const { Pool } = require('pg');

function getConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.SUPABASE_URL) {
    const match = process.env.SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
    const ref = match ? match[1] : '';
    if (ref) {
      const pw = process.env.DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD || 'CsAi2026$ecure!Pwd';
      // Use session-mode pooler (port 5432) for pg library compatibility
      return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-1-us-east-1.pooler.supabase.com:5432/postgres`;
    }
  }

  console.warn('[DB] No database connection configured.');
  return null;
}

const connectionString = getConnectionString();

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
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
    console.log('[DB] Postgres pool ready (direct connection via pooler)');
  }).catch(err => {
    console.error('[DB] Pool warmup failed:', err.message);
  });
} else {
  console.warn('[DB] Postgres pool NOT initialized');
}

async function query(text, params) {
  if (!pool) throw new Error('Database pool not initialized');
  return pool.query(text, params);
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
