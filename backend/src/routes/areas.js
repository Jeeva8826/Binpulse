const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all areas
router.get('/', (req, res) => {
  try {
    const areas = db.query("SELECT * FROM areas ORDER BY name ASC");
    res.json(areas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single area
router.get('/:id', (req, res) => {
  try {
    const area = db.get("SELECT * FROM areas WHERE id = ?", [req.params.id]);
    if (!area) return res.status(404).json({ error: 'Area not found' });
    res.json(area);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new area
router.post('/', (req, res) => {
  try {
    const { name, code, lat, lng, population, households, wasteCategory, baseRateKgDay } = req.body;
    if (!name || !code || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'name, code, lat, and lng are required' });
    }

    const id = 'AREA_' + code.toUpperCase().replace(/\s+/g, '_');
    db.run(
      `INSERT INTO areas (id, name, code, lat, lng, population, households, waste_category, base_rate_kg_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        code,
        parseFloat(lat),
        parseFloat(lng),
        parseInt(population || 12000, 10),
        parseInt(households || 3000, 10),
        wasteCategory || 'bio',
        parseFloat(baseRateKgDay || 450.0)
      ]
    );

    const created = db.get("SELECT * FROM areas WHERE id = ?", [id]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update area
router.put('/:id', (req, res) => {
  try {
    const { name, population, households, wasteCategory, baseRateKgDay, currentClass } = req.body;
    db.run(
      `UPDATE areas SET
         name = COALESCE(?, name),
         population = COALESCE(?, population),
         households = COALESCE(?, households),
         waste_category = COALESCE(?, waste_category),
         base_rate_kg_day = COALESCE(?, base_rate_kg_day),
         current_class = COALESCE(?, current_class)
       WHERE id = ?`,
      [name, population, households, wasteCategory, baseRateKgDay, currentClass, req.params.id]
    );

    const updated = db.get("SELECT * FROM areas WHERE id = ?", [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE area
router.delete('/:id', (req, res) => {
  try {
    db.run("DELETE FROM areas WHERE id = ?", [req.params.id]);
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
