const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('../backend/node_modules/express');
const db = require('../backend/src/db');

const app = express();
app.use(express.json());
app.use('/api/areas', require('../backend/src/routes/areas'));
app.use('/api/trucks', require('../backend/src/routes/trucks'));
app.use('/api/analytics', require('../backend/src/routes/analytics'));
app.use('/api/schedule', require('../backend/src/routes/schedule'));
app.use('/api/routes', require('../backend/src/routes/routes'));
app.use('/api/dispatch', require('../backend/src/routes/dispatch'));
app.use('/api/yard', require('../backend/src/routes/yard'));
app.use('/api/device', require('../backend/src/routes/device'));
app.use('/api/reports', require('../backend/src/routes/reports'));
app.use('/api/simulate', require('../backend/src/routes/simulate'));

let server;
let baseUrl;

test.before(async () => {
  db.initDb();
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('Complete software workflow: demo data through collection report', async () => {
  const categoriesRes = await fetch(`${baseUrl}/api/analytics/categories`);
  assert.equal(categoriesRes.status, 200);
  const categories = await categoriesRes.json();
  assert.ok(categories.categories.some((item) => item.waste_category === 'bio'));
  assert.ok(categories.categories.some((item) => item.waste_category === 'non-bio'));

  const trendsRes = await fetch(`${baseUrl}/api/analytics/trends?days=30`);
  const trends = await trendsRes.json();
  assert.ok(trends.trends.length >= 6, 'Seeded demo history should support a chart');

  const scheduleRes = await fetch(`${baseUrl}/api/schedule/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekStartDate: '2026-10-19' })
  });
  assert.equal(scheduleRes.status, 201);
  assert.ok((await scheduleRes.json()).grid.length >= 9);

  const routeRes = await fetch(`${baseUrl}/api/routes/optimise`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dayOfWeek: 0, truckCapacityKg: 2800 })
  });
  assert.equal(routeRes.status, 200);
  assert.ok((await routeRes.json()).optimised);

  const dispatchRes = await fetch(`${baseUrl}/api/dispatch/trips/start`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      truckId: 'TRUCK_TN38_1001', driverName: 'Workflow Test',
      areaIds: ['AREA_RS_PURAM'], wasteCategory: 'bio'
    })
  });
  assert.equal(dispatchRes.status, 201);
  const dispatch = await dispatchRes.json();
  assert.equal(db.get('SELECT status FROM trucks WHERE id = ?', ['TRUCK_TN38_1001']).status, 'on-route');

  const completeRes = await fetch(`${baseUrl}/api/dispatch/trips/${dispatch.tripId}/complete`, { method: 'POST' });
  assert.equal(completeRes.status, 200);
  assert.equal(db.get('SELECT status FROM trucks WHERE id = ?', ['TRUCK_TN38_1001']).status, 'idle');

  const simulatedEventRes = await fetch(`${baseUrl}/api/simulate/truck-event`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      truckId: 'TRUCK_TN38_1002', wasteCategory: 'non-bio', dwellSeconds: 5,
      medianDistanceCm: 75, areaIds: ['AREA_PEELAMEDU']
    })
  });
  assert.equal(simulatedEventRes.status, 201);
  const simulatedEvent = await simulatedEventRes.json();
  assert.equal(simulatedEvent.visit.quantitySource, 'ultrasonic_estimate');
  const simulatedQuantity = db.get('SELECT is_simulated FROM area_quantities WHERE visit_id = ?', [simulatedEvent.visit.visitId]);
  assert.equal(simulatedQuantity.is_simulated, 1, 'Simulated events must not be represented as physical readings');

  const summaryRes = await fetch(`${baseUrl}/api/reports/summary`);
  assert.equal(summaryRes.status, 200);
  assert.ok((await summaryRes.json()).totalVisitsCount > 0);

  const csvRes = await fetch(`${baseUrl}/api/reports/export.csv`);
  assert.equal(csvRes.status, 200);
  assert.match(await csvRes.text(), /^Date,Area,Code,Category,Quantity_Kg/);

  const hardwareReadingRes = await fetch(`${baseUrl}/api/device/readings`, {
    method: 'POST', headers: {
      'Content-Type': 'application/json', 'x-api-key': 'binpulse_secret_key_2026'
    },
    body: JSON.stringify({
      device_id: 'ESP32_YARD_WORKFLOW_TEST', distance_cm: 240,
      timestamp: new Date().toISOString()
    })
  });
  assert.equal(hardwareReadingRes.status, 200);

  const resetRes = await fetch(`${baseUrl}/api/simulate/reset`, { method: 'POST' });
  assert.equal(resetRes.status, 200);
  assert.equal(db.get("SELECT COUNT(*) AS count FROM truck_visits WHERE device_id = 'ESP32_YARD_SIM'").count, 0);
  assert.equal(db.get("SELECT COUNT(*) AS count FROM sensor_readings WHERE device_id = 'ESP32_YARD_WORKFLOW_TEST'").count, 1,
    'Resetting simulation must preserve physical-device telemetry');

  const reseedRes = await fetch(`${baseUrl}/api/simulate/seed`, { method: 'POST' });
  assert.equal(reseedRes.status, 200);
  assert.equal(db.get('SELECT COUNT(*) AS count FROM area_quantities WHERE is_simulated = 1').count, 549);
});
