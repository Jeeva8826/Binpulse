const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all settings
router.get('/', (req, res) => {
  try {
    const rows = db.query("SELECT * FROM settings ORDER BY key ASC");
    const settingsObj = {};
    for (const r of rows) {
      settingsObj[r.key] = {
        value: r.value,
        description: r.description,
        updatedAt: r.updated_at
      };
    }
    res.json(settingsObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update settings
router.put('/', (req, res) => {
  try {
    const updates = req.body;
    const updateStmt = db.getDb().prepare(
      "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?"
    );

    for (const [k, v] of Object.entries(updates)) {
      updateStmt.run(String(v), k);
    }

    const rows = db.query("SELECT * FROM settings");
    res.json({ success: true, updatedCount: Object.keys(updates).length, settings: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
