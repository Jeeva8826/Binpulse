const test = require('node:test');
const assert = require('node:assert');
const attributionService = require('../backend/src/services/attributionService');
const db = require('../backend/src/db');

test('Area Attribution Service Suite', async (t) => {
  db.initDb();

  // Create a sample trip for testing single-area strategy
  const testTripSingleId = 'TRIP_TEST_SINGLE_' + Date.now();
  db.run("INSERT OR REPLACE INTO trucks (id, plate_number, driver_name) VALUES ('TRUCK_TEST', 'TN-38-TEST', 'Test Driver')");
  db.run("INSERT OR REPLACE INTO areas (id, name, code, lat, lng, population) VALUES ('AREA_TEST_A', 'Test Ward A', 'TWA', 11.0, 76.9, 10000)");
  db.run("INSERT OR REPLACE INTO areas (id, name, code, lat, lng, population) VALUES ('AREA_TEST_B', 'Test Ward B', 'TWB', 11.1, 77.0, 20000)");

  db.run(
    "INSERT INTO trips (id, truck_id, driver_name, waste_category, status) VALUES (?, 'TRUCK_TEST', 'Test Driver', 'bio', 'dispatched')",
    [testTripSingleId]
  );
  db.run("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, 'AREA_TEST_A', 1)", [testTripSingleId]);

  await t.test('Strategy 1: Single-area dispatch gives 100% quantity and confidence 1.0', () => {
    db.run("UPDATE settings SET value = 'single_area' WHERE key = 'ATTRIBUTION_STRATEGY'");
    const results = attributionService.attributeTrip({
      tripId: testTripSingleId,
      visitId: null,
      quantityKg: 1200,
      wasteCategory: 'bio',
      recordedDate: '2026-10-14'
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].areaId, 'AREA_TEST_A');
    assert.strictEqual(results[0].quantityKg, 1200);
    assert.strictEqual(results[0].attributionMethod, 'single_area');
    assert.strictEqual(results[0].confidence, 1.0);
  });

  await t.test('Strategy 2: Weighted demographic allocation splits quantity proportionally', () => {
    const testTripMultiId = 'TRIP_TEST_MULTI_' + Date.now();
    db.run(
      "INSERT INTO trips (id, truck_id, driver_name, waste_category, status) VALUES (?, 'TRUCK_TEST', 'Test Driver', 'bio', 'dispatched')",
      [testTripMultiId]
    );
    // Area A (pop 10,000) and Area B (pop 20,000) -> 1/3 and 2/3
    db.run("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, 'AREA_TEST_A', 1)", [testTripMultiId]);
    db.run("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, 'AREA_TEST_B', 2)", [testTripMultiId]);

    db.run("UPDATE settings SET value = 'weighted' WHERE key = 'ATTRIBUTION_STRATEGY'");
    const results = attributionService.attributeTrip({
      tripId: testTripMultiId,
      visitId: null,
      quantityKg: 3000,
      wasteCategory: 'bio',
      recordedDate: '2026-10-14'
    });

    assert.strictEqual(results.length, 2);
    const areaA = results.find(r => r.areaId === 'AREA_TEST_A');
    const areaB = results.find(r => r.areaId === 'AREA_TEST_B');

    assert.strictEqual(areaA.quantityKg, 1000);
    assert.strictEqual(areaB.quantityKg, 2000);
    assert.strictEqual(areaA.attributionMethod, 'weighted');
    assert.strictEqual(areaA.confidence, 0.75);
  });

  await t.test('Strategy 3: Calibration mode fallback handles small sample gracefully', () => {
    db.run("UPDATE settings SET value = 'calibrated' WHERE key = 'ATTRIBUTION_STRATEGY'");
    const testTripCalId = 'TRIP_TEST_CAL_' + Date.now();
    db.run(
      "INSERT INTO trips (id, truck_id, driver_name, waste_category, status) VALUES (?, 'TRUCK_TEST', 'Test Driver', 'bio', 'dispatched')",
      [testTripCalId]
    );
    db.run("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, 'AREA_TEST_A', 1)", [testTripCalId]);
    db.run("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, 'AREA_TEST_B', 2)", [testTripCalId]);

    const results = attributionService.attributeTrip({
      tripId: testTripCalId,
      visitId: null,
      quantityKg: 1500,
      wasteCategory: 'bio',
      recordedDate: '2026-10-14'
    });

    assert.strictEqual(results.length, 2);
    assert.ok(results[0].confidence > 0.5, 'Confidence must be > 0.5');
  });

  await t.test('Strategy 3: Calibrated mode solves ridge regression when sufficient multi-area trips exist', () => {
    db.run("UPDATE settings SET value = 'calibrated' WHERE key = 'ATTRIBUTION_STRATEGY'");

    // Seed 6 historical completed trips covering Area A and Area B
    for (let i = 0; i < 6; i++) {
      const histTripId = `TRIP_HIST_${Date.now()}_${i}`;
      const histVisitId = `VISIT_HIST_${Date.now()}_${i}`;
      const qty = 1500 + i * 50;

      db.run(
        "INSERT INTO trips (id, truck_id, driver_name, waste_category, status, dispatched_at, completed_at) VALUES (?, 'TRUCK_TEST', 'Test Driver', 'bio', 'completed', datetime('now'), datetime('now'))",
        [histTripId]
      );
      db.run("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, 'AREA_TEST_A', 1)", [histTripId]);
      db.run("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, 'AREA_TEST_B', 2)", [histTripId]);
      db.run(
        "INSERT INTO truck_visits (id, truck_id, trip_id, device_id, arrived_at, departed_at, dwell_s, raw_distance_cm, est_quantity_kg) VALUES (?, 'TRUCK_TEST', ?, 'TEST_NODE', datetime('now'), datetime('now'), 45, 80, ?)",
        [histVisitId, histTripId, qty]
      );
    }

    const testActiveCalId = 'TRIP_TEST_ACTIVE_CAL_' + Date.now();
    db.run(
      "INSERT INTO trips (id, truck_id, driver_name, waste_category, status) VALUES (?, 'TRUCK_TEST', 'Test Driver', 'bio', 'dispatched')",
      [testActiveCalId]
    );
    db.run("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, 'AREA_TEST_A', 1)", [testActiveCalId]);
    db.run("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, 'AREA_TEST_B', 2)", [testActiveCalId]);

    const results = attributionService.attributeTrip({
      tripId: testActiveCalId,
      visitId: null,
      quantityKg: 2000,
      wasteCategory: 'bio',
      recordedDate: '2026-10-14'
    });

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].attributionMethod, 'calibrated');
    assert.ok(results[0].confidence >= 0.65, `Confidence was ${results[0].confidence}`);
    assert.ok(results[0].quantityKg > 0);
    assert.ok(results[1].quantityKg > 0);
    assert.strictEqual(Math.round(results[0].quantityKg + results[1].quantityKg), 2000);
  });
});
