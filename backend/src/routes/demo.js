const express = require('express');
const router = express.Router();
const records = require('../../../firmware/ecoroute_demo/sample_data.json');

// The attached JSON is demonstration data, not a source of physical readings.
router.get('/ecoroute-records', (req, res) => {
  res.json({
    project: 'EcoRoute',
    dataSource: 'SIMULATED',
    recordCount: records.length,
    records
  });
});

module.exports = router;
