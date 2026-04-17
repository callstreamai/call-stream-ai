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
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'call-stream-ai', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/runtime', runtimeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/channel', channelRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Call Stream AI backend running on port ${PORT}`);
});

module.exports = app;
