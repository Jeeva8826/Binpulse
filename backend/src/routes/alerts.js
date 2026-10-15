const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');

// GET /api/alerts
router.get('/', (req, res) => {
  try {
    const alerts = alertService.getActiveAlerts();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/:id/resolve
router.post('/:id/resolve', (req, res) => {
  try {
    alertService.resolveAlert(req.params.id);
    res.json({ success: true, resolved: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
