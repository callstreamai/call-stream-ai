require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const runtimeRoutes = require('./routes/runtime');
const adminRoutes = require('./routes/admin');
const channelRoutes = require('./routes/channel');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
// Skip body parsing for MCP messages endpoint (SSE transport reads raw body)
app.use((req, res, next) => {
  if (req.path === '/mcp/messages') return next();
  express.json({ limit: '10mb' })(req, res, next);
});
app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'call-stream-ai', timestamp: new Date().toISOString() });
});


// DB health check
app.get('/health/db', async (req, res) => {
  try {
    const db = require('./config/db');
    if (!db.pool) {
      return res.json({ status: 'error', message: 'Pool not initialized', env: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasDbPassword: !!process.env.DB_PASSWORD,
        nodeEnv: process.env.NODE_ENV
      }});
    }
    const start = Date.now();
    const result = await db.pool.query('SELECT 1 as ok');
    const duration = Date.now() - start;
    res.json({ status: 'ok', queryTime: duration, result: result.rows[0] });
  } catch (err) {
    res.json({ status: 'error', message: err.message, stack: err.stack?.substring(0, 500) });
  }
});

// API Routes
app.use('/api/runtime', runtimeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/channel', channelRoutes);


// MCP (Model Context Protocol) server — SSE transport
import('./mcp/sse.mjs').then(({ mountMcp }) => {
  mountMcp(app);
}).catch(err => {
  console.warn('[MCP] Failed to mount MCP server:', err.message);
});

// Error handling
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Call Stream AI backend running on port ${PORT}`);
});

module.exports = app;
