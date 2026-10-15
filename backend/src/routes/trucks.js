const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all trucks
router.get('/', (req, res) => {
  try {
    const trucks = db.query("SELECT * FROM trucks ORDER BY plate_number ASC");
    res.json(trucks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new truck
router.post('/', (req, res) => {
  try {
    const { plateNumber, driverName, capacityKg, capacityM3, fuelConsumptionLKm } = req.body;
    if (!plateNumber || !driverName) {
      return res.status(400).json({ error: 'plateNumber and driverName are required' });
    }

    const id = 'TRUCK_' + plateNumber.replace(/[^a-zA-Z0-9]/g, '_');
    db.run(
      `INSERT INTO trucks (id, plate_number, driver_name, capacity_kg, capacity_m3, fuel_consumption_l_km)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        plateNumber,
        driverName,
        parseFloat(capacityKg || 2500.0),
        parseFloat(capacityM3 || 8.0),
        parseFloat(fuelConsumptionLKm || 0.35)
      ]
    );

    const created = db.get("SELECT * FROM trucks WHERE id = ?", [id]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update truck
router.put('/:id', (req, res) => {
  try {
    const { driverName, capacityKg, status } = req.body;
    db.run(
      `UPDATE trucks SET
         driver_name = COALESCE(?, driver_name),
         capacity_kg = COALESCE(?, capacity_kg),
         status = COALESCE(?, status)
       WHERE id = ?`,
      [driverName, capacityKg, status, req.params.id]
    );

    const updated = db.get("SELECT * FROM trucks WHERE id = ?", [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single truck
router.get('/:id', (req, res) => {
  try {
    const truck = db.get("SELECT * FROM trucks WHERE id = ?", [req.params.id]);
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    res.json(truck);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE truck
router.delete('/:id', (req, res) => {
  try {
    db.run("DELETE FROM trucks WHERE id = ?", [req.params.id]);
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
