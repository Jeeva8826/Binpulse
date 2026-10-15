const test = require('node:test');
const assert = require('node:assert');
const yardService = require('../backend/src/services/yardService');
const db = require('../backend/src/db');

test('Yard Service & Telemetry Suite', async (t) => {
  db.initDb();
  yardService.resetPresenceState();

  await t.test('Debounces truck presence over consecutive readings', () => {
    // Reading 1: truck arrives under sensor (distance 80 cm, threshold 180 cm)
    const r1 = yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 80 });
    assert.strictEqual(r1.isTruckPresent, false, 'Should not confirm truck after only 1 sample');

    // Reading 2
    const r2 = yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 80 });
    assert.strictEqual(r2.isTruckPresent, false, 'Should not confirm truck after only 2 samples');

    // Reading 3: 3rd sample triggers arrival event
    const r3 = yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 80 });
    assert.strictEqual(r3.isTruckPresent, true, 'Should confirm truck present after 3 samples');
    assert.strictEqual(r3.event, 'arrival');

    // Idle readings: departure debounce
    yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 240 });
    yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 240 });
    const rDepart = yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 240 });

    assert.strictEqual(rDepart.isTruckPresent, false, 'Truck should now be departed');
    assert.strictEqual(rDepart.event, 'departure');
    assert.ok(rDepart.completedVisit, 'Should generate completed visit record on departure');
    assert.strictEqual(rDepart.completedVisit.quantitySource, 'ultrasonic_estimate');
  });

  await t.test('Physical and simulated device presence states stay isolated', () => {
    yardService.resetPresenceState();
    for (let i = 0; i < 3; i++) {
      yardService.processSensorReading({ deviceId: 'ESP32_YARD_01', distanceCm: 240 });
      yardService.processSensorReading({ deviceId: 'ESP32_YARD_SIM', distanceCm: 80 });
    }

    assert.strictEqual(yardService.getYardStatus('hardware').isTruckPresent, false);
    assert.strictEqual(yardService.getYardStatus('simulation').isTruckPresent, true);
  });

  await t.test('Volume and weight calculations in load_level mode', () => {
    // Bed length 3.5m, width 1.8m, empty distance 180cm, sensor reading 80cm -> fill height = 100cm = 1.0m
    // Volume = 3.5 * 1.8 * 1.0 = 6.3 m3
    // Weight = 6.3 m3 * 450 kg/m3 = 2835 kg
    const visit = yardService.finalizeVisit({
      deviceId: 'TEST_NODE',
      arrivedAt: '2026-10-14T10:00:00Z',
      departedAt: '2026-10-14T10:00:45Z',
      dwellSeconds: 45,
      medianDistanceCm: 80,
      tripId: null
    });

    assert.ok(visit.estVolumeM3 > 5.0 && visit.estVolumeM3 < 7.0, `Volume was ${visit.estVolumeM3}`);
    assert.ok(visit.estQuantityKg > 2000, `Weight was ${visit.estQuantityKg}`);
    assert.strictEqual(visit.quantitySource, 'ultrasonic_estimate');
  });

  await t.test('Sensor out-of-range dropout readings are rejected without corrupting arrival state', () => {
    yardService.resetPresenceState();

    // 3 samples to arrive
    yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 90 });
    yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 90 });
    const rArrival = yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 90 });
    assert.strictEqual(rArrival.isTruckPresent, true);

    // Spurious timeout reading (0 cm or out of range > 400 cm)
    const rDrop1 = yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 0 });
    assert.strictEqual(rDrop1.event, 'sensor_dropout');
    assert.strictEqual(rDrop1.isTruckPresent, true, 'Truck should still be present despite sensor timeout');

    const rDrop2 = yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 450 });
    assert.strictEqual(rDrop2.event, 'sensor_dropout');
    assert.strictEqual(rDrop2.isTruckPresent, true, 'Truck should still be present despite out-of-range noise');
  });

  await t.test('Truck status updates to idle upon automatic yard visit departure', () => {
    yardService.resetPresenceState();

    const testTruckId = 'TRUCK_TEST_DEPART';
    db.run("INSERT OR REPLACE INTO trucks (id, plate_number, driver_name, status) VALUES (?, 'TN-38-DEP', 'Depart Driver', 'on-route')", [testTruckId]);

    const testTripId = 'TRIP_TEST_DEPART_' + Date.now();
    db.run("INSERT INTO trips (id, truck_id, driver_name, status, dispatched_at) VALUES (?, ?, 'Depart Driver', 'dispatched', datetime('now', '+10 seconds'))", [testTripId, testTruckId]);
    db.run("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, 'AREA_RS_PURAM', 1)", [testTripId]);

    // Arrive
    yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 70 });
    yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 70 });
    yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 70 });

    // Depart
    yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 240 });
    yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 240 });
    yardService.processSensorReading({ deviceId: 'TEST_NODE', distanceCm: 240 });

    const truck = db.get("SELECT status FROM trucks WHERE id = ?", [testTruckId]);
    assert.strictEqual(truck.status, 'idle', 'Truck must be transitioned to idle upon yard departure');

    const trip = db.get("SELECT status FROM trips WHERE id = ?", [testTripId]);
    assert.strictEqual(trip.status, 'completed', 'Trip must be completed upon yard departure');
  });

  await t.test('Trip-count estimation mode computes nominal vehicle fraction', () => {
    db.run("UPDATE settings SET value = 'trip_count' WHERE key = 'QUANTITY_MODE'");

    const visit = yardService.finalizeVisit({
      deviceId: 'TEST_NODE',
      arrivedAt: '2026-10-14T10:00:00Z',
      departedAt: '2026-10-14T10:00:45Z',
      dwellSeconds: 45,
      medianDistanceCm: 80,
      tripId: null
    });

    assert.strictEqual(visit.quantitySource, 'trip_count');
    assert.strictEqual(visit.estQuantityKg, 1650); // 75% of 2200 kg

    // Reset back to load_level
    db.run("UPDATE settings SET value = 'load_level' WHERE key = 'QUANTITY_MODE'");
  });

  await t.test('Sensor offline detection creates SENSOR_OFFLINE alert', () => {
    // Set all devices last seen 10 minutes ago
    db.run("UPDATE device_status SET last_seen_at = datetime('now', '-10 minutes')");

    const status = yardService.getYardStatus();
    assert.strictEqual(status.device.status, 'offline');

    const alert = db.get("SELECT * FROM alerts WHERE alert_type = 'SENSOR_OFFLINE' AND is_resolved = 0");
    assert.ok(alert, 'Must create SENSOR_OFFLINE alert');
  });
});
