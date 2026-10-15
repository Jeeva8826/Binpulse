const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/reports/summary
router.get('/summary', (req, res) => {
  try {
    const totalVisits = db.get("SELECT COUNT(*) as count, COALESCE(SUM(est_quantity_kg), 0) as total_kg FROM truck_visits");
    const totalSavings = db.get(
      `SELECT COALESCE(SUM(km_saved), 0) as km_saved,
              COALESCE(SUM(fuel_saved_l), 0) as fuel_saved_l,
              COALESCE(SUM(co2_saved_kg), 0) as co2_saved_kg,
              COALESCE(SUM(baseline_trips - optimised_trips), 0) as trips_avoided
       FROM route_plans`
    );

    const pastWeekQuantities = db.query(
      `SELECT recorded_date, SUM(quantity_kg) as daily_kg
       FROM area_quantities
       WHERE recorded_date >= date('now', '-7 days')
       GROUP BY recorded_date
       ORDER BY recorded_date ASC`
    );

    res.json({
      totalVisitsCount: totalVisits ? totalVisits.count : 0,
      totalWasteEstimatedKg: totalVisits ? Math.round(totalVisits.total_kg) : 0,
      savings: {
        kmSaved: totalSavings ? Math.round(totalSavings.km_saved * 10) / 10 : 0,
        fuelSavedL: totalSavings ? Math.round(totalSavings.fuel_saved_l * 10) / 10 : 0,
        co2SavedKg: totalSavings ? Math.round(totalSavings.co2_saved_kg * 10) / 10 : 0,
        tripsAvoided: totalSavings ? Math.max(0, totalSavings.trips_avoided) : 0,
        isEstimate: true
      },
      pastWeekDaily: pastWeekQuantities
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/export.csv
router.get('/export.csv', (req, res) => {
  try {
    const rows = db.query(
      `SELECT aq.recorded_date, a.name as area_name, a.code as area_code, aq.waste_category,
              aq.quantity_kg, aq.attribution_method, aq.confidence, t.plate_number as truck_plate,
              v.dwell_s, v.quantity_source
       FROM area_quantities aq
       JOIN areas a ON aq.area_id = a.id
       LEFT JOIN trips tr ON aq.trip_id = tr.id
       LEFT JOIN trucks t ON tr.truck_id = t.id
       LEFT JOIN truck_visits v ON aq.visit_id = v.id
       ORDER BY aq.recorded_date DESC
       LIMIT 500`
    );

    const headers = 'Date,Area,Code,Category,Quantity_Kg,Attribution_Method,Confidence,Truck,Dwell_Seconds,Quantity_Source\n';
    const csvLines = rows.map(r =>
      `"${r.recorded_date}","${r.area_name}","${r.area_code}","${r.waste_category}",${r.quantity_kg},"${r.attribution_method}",${r.confidence},"${r.truck_plate || 'N/A'}",${r.dwell_s || 0},"${r.quantity_source || 'estimate'}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="binpulse_manifest.csv"');
    res.send(headers + csvLines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
