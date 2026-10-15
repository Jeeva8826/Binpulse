const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./db');
const { setupWebSocket } = require('./websocket');
const arduinoSerialService = require('./services/arduinoSerialService');

// Initialize database & tables
db.initDb();

const app = express();
app.use(cors());
app.use(express.json());

// Request logger for API calls
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.url}`);
  }
  next();
});

// Mount Routes
app.use('/api/device', require('./routes/device'));
app.use('/api/yard', require('./routes/yard'));
app.use('/api/areas', require('./routes/areas'));
app.use('/api/trucks', require('./routes/trucks'));
app.use('/api/dispatch', require('./routes/dispatch'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/classify', require('./routes/classify'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/simulate', require('./routes/simulate'));
app.use('/api/demo', require('./routes/demo'));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    system: 'BinPulse / EcoRoute Autonomous Yard Network',
    timestamp: new Date().toISOString()
  });
});

// Legacy Drop-in Compatibility Routes
app.post('/api/reading/', (req, res) => {
  const suppliedKey = req.headers['x-api-key'];
  if (config.NODE_ENV !== 'development' && suppliedKey !== config.DEVICE_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing x-api-key' });
  }
  const { bin_id, fill, distance_cm, timestamp } = req.body || {};
  if (!bin_id || !Number.isFinite(Number(fill))) {
    return res.status(400).json({ error: 'bin_id and numeric fill (0-100) are required' });
  }
  const reading = require('./services/binService').recordReading({
    binId: String(bin_id), fill, distanceCm: distance_cm,
    volumeL: req.body.volume_l, capacityL: req.body.capacity_l, timestamp
  });
  require('./websocket').broadcast({ type: 'BIN_TELEMETRY', data: reading });
  res.json({ ok: true, reading });
});

app.get('/api/bins/', (req, res) => {
  res.json(require('./services/binService').getReadings());
});

// In production, serve static files from frontend build
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/ws')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(200).send('BinPulse API Server Running. Start frontend with npm run dev.');
  });
});

// Create HTTP server & bind WebSocket
const server = http.createServer(app);
setupWebSocket(server);
arduinoSerialService.start();

server.listen(config.PORT, config.HOST, () => {
  console.log(`=======================================================`);
  console.log(`  BinPulse Consolidated Server running on port ${config.PORT}`);
  console.log(`  REST API:      http://${config.HOST}:${config.PORT}/api/health`);
  console.log(`  WebSocket:     ws://${config.HOST}:${config.PORT}/ws`);
  console.log(`  Mode:          ${config.NODE_ENV}`);
  console.log(`=======================================================`);
});

module.exports = server;
