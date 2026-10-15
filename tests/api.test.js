const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('../backend/node_modules/express');
const cors = require('../backend/node_modules/cors');
const db = require('../backend/src/db');

// Set up test server
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/device', require('../backend/src/routes/device'));
app.use('/api/yard', require('../backend/src/routes/yard'));
app.use('/api/areas', require('../backend/src/routes/areas'));
app.use('/api/trucks', require('../backend/src/routes/trucks'));
app.use('/api/dispatch', require('../backend/src/routes/dispatch'));
app.use('/api/analytics', require('../backend/src/routes/analytics'));
app.use('/api/classify', require('../backend/src/routes/classify'));
app.use('/api/schedule', require('../backend/src/routes/schedule'));
app.use('/api/routes', require('../backend/src/routes/routes'));
app.use('/api/alerts', require('../backend/src/routes/alerts'));
app.use('/api/reports', require('../backend/src/routes/reports'));
app.use('/api/settings', require('../backend/src/routes/settings'));
app.use('/api/simulate', require('../backend/src/routes/simulate'));
app.use('/api/demo', require('../backend/src/routes/demo'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.0' }));
app.post('/api/reading/', (req, res) => res.json({ ok: true, legacy: true }));
app.get('/api/bins/', (req, res) => res.json({ legacy: true }));

let server;
let baseUrl;

test.before(async () => {
  db.initDb();
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('REST API Endpoint Smoke & Contract Suite', async (t) => {

  await t.test('GET /api/health returns 200 and ok status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, 'ok');
  });

  await t.test('GET /api/demo/ecoroute-records returns the supplied simulated dataset', async () => {
    const res = await fetch(`${baseUrl}/api/demo/ecoroute-records`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.project, 'EcoRoute');
    assert.strictEqual(json.dataSource, 'SIMULATED');
    assert.strictEqual(json.recordCount, 2);
    assert.strictEqual(json.records[0].area.area_id, 'AREA_03');
    assert.strictEqual(json.records[0].route.route_sequence, 'DEPOT>AREA_03>YARD');
  });

  await t.test('GET /api/yard/status returns yard monitoring telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/yard/status`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.device, 'Must include device object');
    assert.ok(typeof json.isTruckPresent === 'boolean', 'isTruckPresent must be boolean');
  });

  await t.test('GET /api/areas returns municipal areas', async () => {
    const res = await fetch(`${baseUrl}/api/areas`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json), 'Must return array');
    assert.ok(json.length >= 8, 'Must return at least 8 Coimbatore areas');
  });

  await t.test('POST /api/areas rejects missing required fields with 400', async () => {
    const res = await fetch(`${baseUrl}/api/areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Incomplete Area' })
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('GET /api/trucks returns vehicle fleet', async () => {
    const res = await fetch(`${baseUrl}/api/trucks`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json));
    assert.ok(json.length >= 4);
  });

  await t.test('GET /api/schedule returns weekly grid', async () => {
    const res = await fetch(`${baseUrl}/api/schedule`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.grid, 'Must contain grid');
    assert.ok(json.dayNames, 'Must contain day names');
  });

  await t.test('POST /api/routes/optimise calculates CVRP plan and savings', async () => {
    const res = await fetch(`${baseUrl}/api/routes/optimise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayOfWeek: 2 })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.optimised, 'Must contain optimised routes');
    assert.ok(json.savings, 'Must contain savings calculation');
    assert.strictEqual(json.savings.isEstimate, true);
  });

  await t.test('GET /api/yard/visits returns historical visit log', async () => {
    const res = await fetch(`${baseUrl}/api/yard/visits?limit=5`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json), 'Visits must be an array');
  });

  await t.test('GET /api/areas/:id returns area details and handles 404', async () => {
    const resValid = await fetch(`${baseUrl}/api/areas/AREA_RS_PURAM`);
    assert.strictEqual(resValid.status, 200);
    const jsonValid = await resValid.json();
    assert.strictEqual(jsonValid.code, 'RSP');

    const res404 = await fetch(`${baseUrl}/api/areas/AREA_NONEXISTENT_999`);
    assert.strictEqual(res404.status, 404);
  });

  await t.test('POST and PUT /api/areas handles valid mutation', async () => {
    const code = 'TST' + Date.now().toString().slice(-4);
    const resCreate = await fetch(`${baseUrl}/api/areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Ward Dynamic',
        code,
        lat: 11.05,
        lng: 76.99,
        population: 15000,
        households: 3500,
        wasteCategory: 'bio',
        baseRateKgDay: 480
      })
    });
    assert.strictEqual(resCreate.status, 201);
    const created = await resCreate.json();

    const resUpdate = await fetch(`${baseUrl}/api/areas/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseRateKgDay: 520 })
    });
    assert.strictEqual(resUpdate.status, 200);
    const updated = await resUpdate.json();
    assert.strictEqual(updated.base_rate_kg_day, 520);
  });

  await t.test('GET, POST, and DELETE /api/trucks handles fleet CRUD', async () => {
    // Missing fields validation
    const resBad = await fetch(`${baseUrl}/api/trucks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plateNumber: 'TN-38-INCOMPLETE' })
    });
    assert.strictEqual(resBad.status, 400);

    // Valid create
    const plate = 'TN-38-ZZ-' + Math.floor(Math.random() * 8999 + 1000);
    const resCreate = await fetch(`${baseUrl}/api/trucks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plateNumber: plate, driverName: 'Fleet Driver Test', capacityKg: 2800 })
    });
    assert.strictEqual(resCreate.status, 201);
    const truck = await resCreate.json();

    // Get single
    const resGet = await fetch(`${baseUrl}/api/trucks/${truck.id}`);
    assert.strictEqual(resGet.status, 200);

    // Delete
    const resDel = await fetch(`${baseUrl}/api/trucks/${truck.id}`, { method: 'DELETE' });
    assert.strictEqual(resDel.status, 200);
  });

  await t.test('POST /api/dispatch/trips/start and /trips/:id/complete lifecycle', async () => {
    // Bad request check
    const resBad = await fetch(`${baseUrl}/api/dispatch/trips/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ truckId: 'TRUCK_TN38_1001' }) // Missing areaIds
    });
    assert.strictEqual(resBad.status, 400);

    // Valid dispatch start
    const resStart = await fetch(`${baseUrl}/api/dispatch/trips/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        truckId: 'TRUCK_TN38_1001',
        driverName: 'Murugan S.',
        areaIds: ['AREA_RS_PURAM', 'AREA_GANDHIPURAM'],
        wasteCategory: 'bio',
        attributionStrategy: 'weighted'
      })
    });
    assert.strictEqual(resStart.status, 201);
    const startJson = await resStart.json();
    assert.ok(startJson.tripId);

    // Complete trip manually
    const resComp = await fetch(`${baseUrl}/api/dispatch/trips/${startJson.tripId}/complete`, {
      method: 'POST'
    });
    assert.strictEqual(resComp.status, 200);
  });

  await t.test('GET /api/analytics endpoints (areas, trends, categories)', async () => {
    const resAreas = await fetch(`${baseUrl}/api/analytics/areas`);
    assert.strictEqual(resAreas.status, 200);
    const jsonAreas = await resAreas.json();
    assert.ok(Array.isArray(jsonAreas));

    const resTrends = await fetch(`${baseUrl}/api/analytics/trends?days=7`);
    assert.strictEqual(resTrends.status, 200);
    const jsonTrends = await resTrends.json();
    assert.ok(Array.isArray(jsonTrends.trends));

    const resCats = await fetch(`${baseUrl}/api/analytics/categories`);
    assert.strictEqual(resCats.status, 200);
    const jsonCats = await resCats.json();
    assert.ok(jsonCats.totalKg >= 0);
  });

  await t.test('POST /api/classify/run and GET /api/classify/status', async () => {
    const res1 = await fetch(`${baseUrl}/api/classify/run`, { method: 'POST' });
    assert.strictEqual(res1.status, 200);
    const json1 = await res1.json();
    assert.ok(json1.areas.length >= 8);

    const res2 = await fetch(`${baseUrl}/api/classify/status`);
    assert.strictEqual(res2.status, 200);
  });

  await t.test('POST /api/schedule/generate and GET /api/routes', async () => {
    const resSched = await fetch(`${baseUrl}/api/schedule/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStartDate: '2026-10-19' })
    });
    assert.strictEqual(resSched.status, 201);

    const resRoutes = await fetch(`${baseUrl}/api/routes`);
    assert.strictEqual(resRoutes.status, 200);
    const jsonRoutes = await resRoutes.json();
    assert.ok(jsonRoutes.optimised);
  });

  await t.test('GET /api/alerts and POST /api/alerts/:id/resolve', async () => {
    const resAlerts = await fetch(`${baseUrl}/api/alerts`);
    assert.strictEqual(resAlerts.status, 200);
    const alerts = await resAlerts.json();
    assert.ok(Array.isArray(alerts));

    if (alerts.length > 0) {
      const resResolve = await fetch(`${baseUrl}/api/alerts/${alerts[0].id}/resolve`, {
        method: 'POST'
      });
      assert.strictEqual(resResolve.status, 200);
    }
  });

  await t.test('GET /api/settings and PUT /api/settings', async () => {
    const resGet = await fetch(`${baseUrl}/api/settings`);
    assert.strictEqual(resGet.status, 200);
    const settings = await resGet.json();
    assert.ok(settings.QUANTITY_MODE);

    const resPut = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ SENSOR_MOUNT_HEIGHT_CM: '255.0' })
    });
    assert.strictEqual(resPut.status, 200);
  });

  await t.test('POST /api/simulate/reading and /simulate/truck-event', async () => {
    const resSimReading = await fetch(`${baseUrl}/api/simulate/reading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distanceCm: 95.0 })
    });
    assert.strictEqual(resSimReading.status, 200);

    const resSimTruck = await fetch(`${baseUrl}/api/simulate/truck-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        truckId: 'TRUCK_TN38_1001',
        wasteCategory: 'bio',
        dwellSeconds: 40,
        medianDistanceCm: 80.0
      })
    });
    assert.strictEqual(resSimTruck.status, 201);
  });

  await t.test('GET /api/reports/summary returns aggregate KPI statistics', async () => {
    const res = await fetch(`${baseUrl}/api/reports/summary`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.savings, 'Must contain aggregate savings');
    assert.ok(json.totalVisitsCount >= 0, 'Must contain total visits');
  });

  await t.test('GET /api/reports/export.csv returns CSV manifest with headers', async () => {
    const res = await fetch(`${baseUrl}/api/reports/export.csv`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.startsWith('Date,Area,Code,Category'), 'CSV header mismatch');
  });

  await t.test('POST /api/device/readings accepts valid telemetry and rejects invalid key', async () => {
    // Valid telemetry with correct key
    const res = await fetch(`${baseUrl}/api/device/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'binpulse_secret_key_2026'
      },
      body: JSON.stringify({
        device_id: 'ESP32_YARD_API_TEST',
        distance_cm: 235.0,
        rssi: -65
      })
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.ok, true);

    const hardwareStatus = await fetch(`${baseUrl}/api/yard/status?source=hardware`).then(r => r.json());
    assert.strictEqual(hardwareStatus.latestDeviceId, 'ESP32_YARD_API_TEST');
    const simulationStatus = await fetch(`${baseUrl}/api/yard/status?source=simulation`).then(r => r.json());
    assert.strictEqual(simulationStatus.latestDeviceId, 'ESP32_YARD_SIM');

    // Invalid API key rejection
    const resBad = await fetch(`${baseUrl}/api/device/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'WRONG_API_KEY_123'
      },
      body: JSON.stringify({ distance_cm: 100 })
    });
    assert.strictEqual(resBad.status, 401);
  });

  await t.test('Legacy routes /api/reading/ and /api/bins/ respond 200', async () => {
    const res1 = await fetch(`${baseUrl}/api/reading/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bin_id: 'BIN01', fill: 45 })
    });
    assert.strictEqual(res1.status, 200);

    const res2 = await fetch(`${baseUrl}/api/bins/`);
    assert.strictEqual(res2.status, 200);
  });
});
