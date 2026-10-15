const express = require('express');
const router = express.Router();
const classifyService = require('../services/classifyService');

// POST /api/classify/run
router.post('/run', (req, res) => {
  try {
    const result = classifyService.classifyAreas();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/classify/status
router.get('/status', (req, res) => {
  try {
    const result = classifyService.classifyAreas();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
