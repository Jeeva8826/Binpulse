const express = require('express');
const router = express.Router();
const scheduleService = require('../services/scheduleService');

// POST /api/schedule/generate
router.post('/generate', (req, res) => {
  try {
    const { weekStartDate } = req.body;
    const schedule = scheduleService.generateWeeklySchedule(weekStartDate);
    res.status(201).json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule
router.get('/', (req, res) => {
  try {
    let schedule = scheduleService.getSchedule(req.query.id);
    if (!schedule) {
      schedule = scheduleService.generateWeeklySchedule();
    }
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
