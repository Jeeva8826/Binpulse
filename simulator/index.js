/**
 * BinPulse ESP32 Yard Node Simulator
 * Emulates the physical ESP32 + HC-SR04 ultrasonic sensor over HTTP JSON POST
 * Contract matches firmware/binpulse_yard_node exactly
 */
const http = require('http');
const config = require('../backend/src/config');

const BACKEND_URL = `http://${config.HOST === '0.0.0.0' ? '127.0.0.1' : config.HOST}:${config.PORT}/api/device/readings`;
const DEVICE_ID = 'ESP32_YARD_SIM';
const SEND_INTERVAL_MS = 2000;

// State machine for realistic stream:
// 1. IDLE (empty yard entrance, distance ~230-250 cm)
// 2. APPROACHING (distance decreasing: 200 -> 140 -> 80 cm)
// 3. DWELLING (truck parked for inspection/unloading, distance steady ~60-80 cm with minor noise)
// 4. DEPARTING (distance increasing: 90 -> 170 -> 240 cm)
let state = 'IDLE';
let stateTicks = 0;
let truckFillDistance = 70.0;
let currentUptime = 0;

function generateDistance() {
  stateTicks++;
  currentUptime += 2;

  switch (state) {
    case 'IDLE':
      // Empty driveway: ~235 - 250 cm
      if (stateTicks > 6 && Math.random() < 0.25) {
        state = 'APPROACHING';
        stateTicks = 0;
        truckFillDistance = 50 + Math.random() * 45; // random waste level
        console.log(`[Simulator] >> Truck approaching yard entrance...`);
      }
      return 240.0 + (Math.random() * 6 - 3);

    case 'APPROACHING':
      if (stateTicks >= 3) {
        state = 'DWELLING';
        stateTicks = 0;
        console.log(`[Simulator] ** Truck stationed at sensor. Level: ${Math.round(truckFillDistance)} cm`);
      }
      return 190.0 - (stateTicks * 40);

    case 'DWELLING':
      // Parked under sensor for ~10-15 ticks (20-30 seconds)
      if (stateTicks >= 8) {
        state = 'DEPARTING';
        stateTicks = 0;
        console.log(`[Simulator] << Truck departing yard entrance...`);
      }
      // Small sensor jitter ±1.5 cm
      return truckFillDistance + (Math.random() * 3 - 1.5);

    case 'DEPARTING':
      if (stateTicks >= 3) {
        state = 'IDLE';
        stateTicks = 0;
        console.log(`[Simulator] -- Yard entrance clear. Idle.`);
      }
      return 120.0 + (stateTicks * 45);

    default:
      state = 'IDLE';
      return 240.0;
  }
}

function sendTelemetry() {
  const distance = Math.round(generateDistance() * 10) / 10;
  const payload = JSON.stringify({
    device_id: DEVICE_ID,
    distance_cm: distance,
    raw_distance_cm: distance,
    rssi: -62 + Math.floor(Math.random() * 5),
    uptime_s: currentUptime,
    timestamp: new Date().toISOString()
  });

  const url = new URL(BACKEND_URL);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'x-api-key': config.DEVICE_API_KEY
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`[Simulator] Dist: ${distance} cm | State: ${state} | HTTP ${res.statusCode}`);
    });
  });

  req.on('error', (err) => {
    console.warn(`[Simulator] Connection to backend failed (${err.message}). Retrying in 2s...`);
  });

  req.write(payload);
  req.end();
}

console.log('====================================================');
console.log('  BinPulse Yard Entrance Hardware Simulator Running');
console.log(`  Target: ${BACKEND_URL}`);
console.log(`  Emulating ESP32-S3 + HC-SR04 at ${SEND_INTERVAL_MS}ms interval`);
console.log('====================================================');

setInterval(sendTelemetry, SEND_INTERVAL_MS);
sendTelemetry();
