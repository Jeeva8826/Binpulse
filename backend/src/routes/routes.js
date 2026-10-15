const express = require('express');
const router = express.Router();
const routeService = require('../services/routeService');

// POST /api/routes/optimise
router.post('/optimise', (req, res) => {
  try {
    const { dayOfWeek, truckCapacityKg, planDate } = req.body;
    const plan = routeService.optimiseRoutes({ dayOfWeek, truckCapacityKg, planDate });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes
router.get('/', (req, res) => {
  try {
    let plan = routeService.getLatestRoutePlan();
    if (!plan) {
      plan = routeService.optimiseRoutes();
    }
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
