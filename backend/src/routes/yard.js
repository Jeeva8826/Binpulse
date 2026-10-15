const express = require('express');
const router = express.Router();
const yardService = require('../services/yardService');
const { broadcast } = require('../websocket');

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

// Live Arduino-only visits are kept out of the simulation/dispatched visit log.
router.get('/live-visits', (req, res) => {
  try {
    res.json(yardService.getLiveYardVisits(req.query.limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/live-assignment', (req, res) => {
  try {
    const truckId = String(req.body?.truckId || '').trim().toUpperCase();
    const plateNumber = String(req.body?.plateNumber || '').trim().toUpperCase();
    const wasteCategory = String(req.body?.wasteCategory || 'bio').trim().toLowerCase();
    if (!/^[A-Z0-9-]{2,32}$/.test(truckId)) {
      return res.status(400).json({ error: 'Enter a truck ID using 2–32 letters, numbers, or hyphens.' });
    }
    if (!/^[A-Z0-9 -]{4,16}$/.test(plateNumber)) {
      return res.status(400).json({ error: 'Enter a valid plate number using 4–16 letters, numbers, spaces, or hyphens.' });
    }
    if (!['bio', 'non-bio', 'mixed'].includes(wasteCategory)) {
      return res.status(400).json({ error: 'Choose a valid waste category.' });
    }
    const visit = yardService.assignLiveTruck({ truckId, plateNumber, wasteCategory });
    broadcast({ type: 'LIVE_YARD_VISIT', data: visit });
    res.json({ ok: true, visit });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
