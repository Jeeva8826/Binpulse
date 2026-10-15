const express = require('express');
const router = express.Router();
const config = require('../config');
const yardService = require('../services/yardService');
const arduinoSerialService = require('../services/arduinoSerialService');
const { broadcast } = require('../websocket');

// In-memory sliding window rate limiter and timestamp deduplication
const recentTimestamps = new Map(); // key -> expireTime
const rateLimitMap = new Map(); // ip/deviceId -> { count, windowStart }

router.get('/serial', (_req, res) => {
  res.json(arduinoSerialService.getStatus());
});

function checkRateLimitAndDuplicates(req, res, next) {
  const clientKey = req.headers['x-api-key'] || req.ip || 'unknown';
  const now = Date.now();

  // 1. Sliding window rate limiting: max 120 requests/minute
  const record = rateLimitMap.get(clientKey) || { count: 0, windowStart: now };
  if (now - record.windowStart > 60000) {
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count++;
  }
  rateLimitMap.set(clientKey, record);

  if (record.count > 120) {
    return res.status(429).json({ error: 'Too Many Requests: Rate limit exceeded (max 120/min)' });
  }

  // Clean old timestamp cache (> 2 minutes old)
  if (recentTimestamps.size > 500) {
    for (const [key, exp] of recentTimestamps.entries()) {
      if (now > exp) recentTimestamps.delete(key);
    }
  }

  next();
}

// Middleware for API key authentication on hardware endpoint
function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  // Allow requests if no key is enforced in local dev or if key matches
  if (config.NODE_ENV === 'development' && !apiKey) {
    return next();
  }
  if (apiKey && apiKey === config.DEVICE_API_KEY) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: Invalid or missing x-api-key header' });
}

// POST /api/device/readings (Yard node ultrasonic ingestion)
router.post('/readings', verifyApiKey, checkRateLimitAndDuplicates, (req, res) => {
  try {
    const payload = req.body;

    // Handle batched readings or single reading
    const readings = Array.isArray(payload) ? payload : [payload];
    const results = [];

    for (const item of readings) {
      if (item.distance_cm === undefined && item.distanceCm === undefined) {
        continue;
      }

      const deviceId = item.device_id || item.deviceId || 'ESP32_YARD_01';
      const ts = item.timestamp || new Date().toISOString();
      const dedupKey = `${deviceId}_${ts}`;

      // Duplicate timestamp protection
      if (recentTimestamps.has(dedupKey)) {
        continue; // Skip duplicate reading
      }
      recentTimestamps.set(dedupKey, Date.now() + 120000); // 2 minute TTL

      const readingData = {
        deviceId: item.device_id || item.deviceId || 'ESP32_YARD_01',
        distanceCm: item.distance_cm !== undefined ? item.distance_cm : item.distanceCm,
        rawDistanceCm: item.raw_distance_cm !== undefined ? item.raw_distance_cm : item.rawDistanceCm,
        ipAddress: req.ip || req.connection.remoteAddress,
        rssi: item.rssi,
        uptimeS: item.uptime_s || item.uptimeS,
        timestamp: item.timestamp || new Date().toISOString()
      };

      const result = yardService.processSensorReading(readingData);
      results.push(result);

      // Broadcast telemetry to connected dashboard clients
      broadcast({
        type: 'YARD_TELEMETRY',
        data: result
      });

      if (result.completedVisit) {
        broadcast({
          type: 'TRUCK_VISIT_COMPLETED',
          data: result.completedVisit
        });
      }
    }

    res.status(200).json({
      ok: true,
      processed: results.length,
      latest: results[results.length - 1]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
