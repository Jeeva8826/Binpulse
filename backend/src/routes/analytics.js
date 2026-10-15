const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/analytics/areas
router.get('/areas', (req, res) => {
  try {
    const areas = db.query(
      `SELECT a.id, a.name, a.code, a.waste_category, a.current_class, a.base_rate_kg_day, a.population,
              COALESCE(SUM(aq.quantity_kg), 0) as total_collected_kg,
              COALESCE(AVG(aq.quantity_kg), a.base_rate_kg_day) as avg_trip_kg,
              COUNT(aq.id) as collection_count
       FROM areas a
       LEFT JOIN area_quantities aq ON a.id = aq.area_id
       GROUP BY a.id
       ORDER BY total_collected_kg DESC`
    );

    res.json(areas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/trends
router.get('/trends', (req, res) => {
  try {
    const days = parseInt(req.query.days || '30', 10);

    const dailyTrends = db.query(
      `SELECT recorded_date,
              SUM(CASE WHEN waste_category = 'bio' THEN quantity_kg ELSE 0 END) as bio_kg,
              SUM(CASE WHEN waste_category = 'non-bio' THEN quantity_kg ELSE 0 END) as non_bio_kg,
              SUM(quantity_kg) as total_kg,
              COUNT(DISTINCT trip_id) as trips_count
       FROM area_quantities
       WHERE recorded_date >= date('now', '-' || ? || ' days')
       GROUP BY recorded_date
       ORDER BY recorded_date ASC`,
      [days]
    );

    res.json({
      days,
      trends: dailyTrends
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/categories
router.get('/categories', (req, res) => {
  try {
    const breakdown = db.query(
      `SELECT waste_category,
              COUNT(*) as record_count,
              ROUND(SUM(quantity_kg), 1) as total_kg,
              ROUND(AVG(quantity_kg), 1) as avg_kg
       FROM area_quantities
       GROUP BY waste_category`
    );

    const totalKg = breakdown.reduce((sum, b) => sum + b.total_kg, 0);
    const withPercentages = breakdown.map(b => ({
      ...b,
      percentage: totalKg > 0 ? Math.round((b.total_kg / totalKg) * 100) : 0
    }));

    res.json({
      totalKg: Math.round(totalKg),
      categories: withPercentages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
