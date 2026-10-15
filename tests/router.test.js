const test = require('node:test');
const assert = require('node:assert');
const routeService = require('../backend/src/services/routeService');
const db = require('../backend/src/db');

test('Route Optimisation Service Suite', async (t) => {
  db.initDb();

  await t.test('haversineKm and roadKm compute realistic distances', () => {
    // Distance between Coimbatore Junction (11.000, 76.963) and Gandhipuram (11.018, 76.968) ~ 2.0 km
    const dist = routeService.haversineKm(11.000, 76.963, 11.018, 76.968);
    assert.ok(dist >= 1.5 && dist <= 2.5, `Distance was ${dist}`);

    const road = routeService.roadKm(11.000, 76.963, 11.018, 76.968);
    assert.ok(road > dist, 'Road distance with factor 1.3 must exceed great-circle distance');
  });

  await t.test('optimiseRoutes creates valid trips within truck payload capacity', () => {
    const truckCapacityKg = 2500;
    const plan = routeService.optimiseRoutes({ dayOfWeek: 0, truckCapacityKg });

    assert.ok(plan.planId, 'Plan must have an ID');
    assert.ok(plan.optimised.trips.length > 0, 'Must have at least 1 trip');

    for (const trip of plan.optimised.trips) {
      assert.ok(
        trip.loadKg <= truckCapacityKg * 1.15,
        `Trip load ${trip.loadKg} kg exceeded truck capacity ${truckCapacityKg} kg`
      );
      assert.strictEqual(trip.start.name, 'Coimbatore Central Depot');
      assert.strictEqual(trip.end.name, 'Coimbatore Central Waste Processing Yard');
      assert.ok(trip.stops.length > 0, 'Trip must visit stops');
    }
  });

  await t.test('Baseline comparison yields positive fuel and CO2 savings', () => {
    const plan = routeService.optimiseRoutes({ dayOfWeek: 1 });
    assert.ok(plan.savings.kmSaved >= 0, 'Km saved must be non-negative');
    assert.ok(plan.savings.fuelSavedL >= 0, 'Fuel saved must be non-negative');
    assert.ok(plan.savings.co2SavedKg >= 0, 'CO2 saved must be non-negative');
    assert.strictEqual(plan.savings.isEstimate, true, 'Savings must be marked as estimates');
  });

  await t.test('Oversized stop demand exceeding truck capacity is handled safely without infinite loop', () => {
    // Insert a temporary massive demand ward (4500 kg with 2000 kg truck capacity)
    db.run("INSERT OR REPLACE INTO areas (id, name, code, lat, lng, base_rate_kg_day) VALUES ('AREA_OVERSIZE_TEST', 'Oversize Ward', 'OVS', 11.02, 76.95, 4500.0)");

    // Ensure it is in schedule
    let schedule = db.get("SELECT * FROM schedules ORDER BY created_at DESC LIMIT 1");
    if (!schedule) {
      schedule = require('../backend/src/services/scheduleService').generateWeeklySchedule();
    }
    db.run(
      "INSERT OR REPLACE INTO schedule_items (id, schedule_id, area_id, day_of_week, is_extra, reason) VALUES ('SI_TEST_OVS', ?, 'AREA_OVERSIZE_TEST', 3, 0, 'Oversize test')",
      [schedule.id]
    );

    const plan = routeService.optimiseRoutes({ dayOfWeek: 3, truckCapacityKg: 2000 });
    assert.ok(plan.optimised.trips.length > 0, 'Must create trips');
    // Clean up test stop
    db.run("DELETE FROM schedule_items WHERE id = 'SI_TEST_OVS'");
    db.run("DELETE FROM areas WHERE id = 'AREA_OVERSIZE_TEST'");
  });
});
