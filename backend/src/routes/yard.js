const express = require('express');
const router = express.Router();
const yardService = require('../services/yardService');

// GET /api/yard/status
router.get('/status', (req, res) => {
  try {
    const source = ['hardware', 'simulation'].includes(req.query.source) ? req.query.source : 'all';
    const status = yardService.getYardStatus(source);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/yard/visits
router.get('/visits', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const visits = yardService.getVisitsLog(limit);
    res.json(visits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
