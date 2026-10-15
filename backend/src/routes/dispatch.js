const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all active and recent dispatch trips
router.get('/trips', (req, res) => {
  try {
    const trips = db.query(
      `SELECT t.*, tr.plate_number, tr.driver_name as truck_driver
       FROM trips t
       JOIN trucks tr ON t.truck_id = tr.id
       ORDER BY t.dispatched_at DESC
       LIMIT 50`
    );

    // Attach visited areas
    for (const trip of trips) {
      trip.areas = db.query(
        `SELECT ta.*, a.name, a.code
         FROM trip_areas ta
         JOIN areas a ON ta.area_id = a.id
         WHERE ta.trip_id = ?
         ORDER BY ta.stop_order ASC`,
        [trip.id]
      );
    }

    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST start new trip dispatch
router.post('/trips/start', (req, res) => {
  try {
    const { truckId, driverName, areaIds, wasteCategory, attributionStrategy, notes } = req.body;

    if (!truckId || !areaIds || !Array.isArray(areaIds) || areaIds.length === 0) {
      return res.status(400).json({ error: 'truckId and areaIds array are required' });
    }

    const tripId = 'TRIP_' + Date.now();
    const cat = wasteCategory || 'bio';
    const strat = attributionStrategy || (areaIds.length === 1 ? 'single_area' : 'weighted');

    db.run(
      `INSERT INTO trips (id, truck_id, driver_name, waste_category, status, attribution_strategy, notes)
       VALUES (?, ?, ?, ?, 'dispatched', ?, ?)`,
      [tripId, truckId, driverName || 'Assigned Driver', cat, strat, notes || null]
    );

    // Update truck status
    db.run("UPDATE trucks SET status = 'on-route' WHERE id = ?", [truckId]);

    // Insert trip areas
    const insertArea = db.getDb().prepare(
      "INSERT INTO trip_areas (trip_id, area_id, stop_order, weight_ratio) VALUES (?, ?, ?, ?)"
    );

    const ratio = 1.0 / areaIds.length;
    areaIds.forEach((aid, idx) => {
      insertArea.run(tripId, aid, idx + 1, ratio);
    });

    res.status(201).json({
      success: true,
      tripId,
      status: 'dispatched',
      message: `Trip ${tripId} successfully dispatched for ${areaIds.length} areas`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shared trip completion logic
function handleCompleteTrip(tripId, res) {
  try {
    const trip = db.get("SELECT * FROM trips WHERE id = ?", [tripId]);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const nowIso = new Date().toISOString();
    db.run("UPDATE trips SET status = 'completed', completed_at = ? WHERE id = ?", [nowIso, trip.id]);
    db.run("UPDATE trucks SET status = 'idle' WHERE id = ?", [trip.truck_id]);

    res.json({ success: true, tripId: trip.id, status: 'completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST complete trip manually
router.post('/trips/:id/complete', (req, res) => {
  handleCompleteTrip(req.params.id, res);
});

router.post('/trips/:id/end', (req, res) => {
  handleCompleteTrip(req.params.id, res);
});

router.post('/:id/complete', (req, res) => {
  handleCompleteTrip(req.params.id, res);
});

router.post('/:id/end', (req, res) => {
  handleCompleteTrip(req.params.id, res);
});

// Aliases for /start and /end
router.post('/start', (req, res, next) => {
  req.url = '/trips/start';
  router.handle(req, res, next);
});

router.post('/end', (req, res) => {
  const tripId = req.body.tripId || req.body.id;
  if (!tripId) return res.status(400).json({ error: 'tripId is required' });
  handleCompleteTrip(tripId, res);
});

module.exports = router;
