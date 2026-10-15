const express = require('express');
const router = express.Router();
const db = require('../db');
const yardService = require('../services/yardService');
const { broadcast } = require('../websocket');

// POST /api/simulate/reading (Inject single distance reading)
router.post('/reading', (req, res) => {
  try {
    const { distanceCm, deviceId } = req.body;
    const reading = yardService.processSensorReading({
      deviceId: deviceId || 'ESP32_YARD_SIM',
      distanceCm: parseFloat(distanceCm || 240.0),
      timestamp: new Date().toISOString()
    });

    broadcast({ type: 'YARD_TELEMETRY', data: reading });
    res.json({ ok: true, reading });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulate/truck-event (Simulate entire arrival, dwell and departure sequence)
router.post('/truck-event', (req, res) => {
  try {
    const { truckId, wasteCategory, dwellSeconds, medianDistanceCm, areaIds } = req.body;

    const truck = truckId
      ? db.get("SELECT * FROM trucks WHERE id = ?", [truckId])
      : db.get("SELECT * FROM trucks LIMIT 1");

    const category = wasteCategory || 'bio';
    const dwell = parseInt(dwellSeconds || '45', 10);
    const dist = parseFloat(medianDistanceCm || '75.0'); // 75 cm to waste surface

    const now = new Date();
    const arrivedAt = new Date(now.getTime() - dwell * 1000).toISOString();
    const departedAt = now.toISOString();

    // Create a trip if areaIds provided
    let tripId = null;
    if (areaIds && areaIds.length > 0) {
      tripId = 'TRIP_SIM_' + Date.now();
      db.run(
        "INSERT INTO trips (id, truck_id, driver_name, waste_category, status, dispatched_at) VALUES (?, ?, ?, ?, 'dispatched', ?)",
        [tripId, truck ? truck.id : 'TRUCK_TN38_1001', truck ? truck.driver_name : 'Driver Sim', category, arrivedAt]
      );

      const insertArea = db.getDb().prepare("INSERT INTO trip_areas (trip_id, area_id, stop_order) VALUES (?, ?, ?)");
      areaIds.forEach((aid, i) => insertArea.run(tripId, aid, i + 1));
    }

    const visit = yardService.finalizeVisit({
      deviceId: 'ESP32_YARD_SIM',
      arrivedAt,
      departedAt,
      dwellSeconds: dwell,
      medianDistanceCm: dist,
      tripId
    });

    broadcast({ type: 'TRUCK_VISIT_COMPLETED', data: visit });

    res.status(201).json({ ok: true, visit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulate/seed
router.post('/seed', (req, res) => {
  try {
    const seedData = require('../../../simulator/seedData');
    const result = seedData.runSeed();
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulate/reset
router.post('/reset', (req, res) => {
  try {
    db.exec('BEGIN IMMEDIATE');
    db.run(`DELETE FROM area_quantities
            WHERE is_simulated = 1
               OR visit_id IN (SELECT id FROM truck_visits WHERE device_id = 'ESP32_YARD_SIM')`);
    db.run("DELETE FROM truck_visits WHERE device_id = 'ESP32_YARD_SIM'");
    db.run("DELETE FROM trips WHERE id LIKE 'TRIP_SIM_%'");
    db.run("DELETE FROM sensor_readings WHERE device_id = 'ESP32_YARD_SIM'");
    db.exec('COMMIT');
    yardService.resetPresenceState();

    res.json({ ok: true, message: 'Simulation data reset successfully' });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
