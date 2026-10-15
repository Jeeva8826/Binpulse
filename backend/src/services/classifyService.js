const db = require('../db');
const alertService = require('./alertService');

/**
 * Classify all municipal areas into HIGH, MEDIUM, LOW
 * Computes statistics, weekday profiles, trend, and flags spikes
 */
function classifyAreas() {
  const areas = db.query("SELECT * FROM areas ORDER BY name ASC");
  const weeksAvailable = getAvailableWeeksCount();
  const mlModeSetting = db.get("SELECT value FROM settings WHERE key = 'ML_MODE_ENABLED'");
  const mlRequested = mlModeSetting && mlModeSetting.value === 'true';

  const mode = (mlRequested && weeksAvailable >= 4) ? 'ml' : 'rule_based';
  const modeExplanation = (mode === 'ml')
    ? 'ML mode active — using per-weekday exponential smoothing and linear trend models.'
    : (weeksAvailable < 4)
      ? `Rule-based mode — insufficient history for ML (${weeksAvailable} weeks available, 4 required).`
      : 'Rule-based statistical mode active.';

  const results = [];

  const isMlMode = (mode === 'ml');

  for (const area of areas) {
    // Fetch last 60 days of historical daily quantities in chronological order
    const history = db.query(
      `SELECT recorded_date, SUM(quantity_kg) as daily_kg
       FROM area_quantities
       WHERE area_id = ?
       GROUP BY recorded_date
       ORDER BY recorded_date ASC
       LIMIT 60`,
      [area.id]
    );

    const dailyValues = history.map(h => h.daily_kg);
    const count = dailyValues.length;

    let avgDailyKg = area.base_rate_kg_day || 450.0;
    let stdDev = 50.0;
    let trend = 'stable';
    let weekdayProfiles = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
    let mlMeta = null;

    if (count > 0) {
      const mean = dailyValues.reduce((s, v) => s + v, 0) / count;
      const variance = dailyValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / count;
      stdDev = Math.sqrt(variance);

      if (isMlMode && count >= 14) {
        // --- REAL ML MODE: Exponential Smoothing + OLS Linear Regression ---
        // 1. Ordinary Least Squares Linear Trend Regression: y = m * t + b
        const tMean = (count - 1) / 2.0;
        let num = 0.0;
        let den = 0.0;
        for (let t = 0; t < count; t++) {
          num += (t - tMean) * (dailyValues[t] - mean);
          den += Math.pow(t - tMean, 2);
        }
        const slope = den > 0 ? num / den : 0.0;
        const intercept = mean - slope * tMean;

        // One-step-ahead ML forecast
        const forecastKg = Math.max(100, intercept + slope * count);
        avgDailyKg = forecastKg;

        if (slope > 1.2) trend = 'increasing';
        else if (slope < -1.2) trend = 'decreasing';
        else trend = 'stable';

        // 2. Per-Weekday Exponential Smoothing (alpha = 0.35)
        const alpha = 0.35;
        const weekdaySeries = [[], [], [], [], [], [], []];
        for (const h of history) {
          const dayIdx = (new Date(h.recorded_date).getDay() + 6) % 7;
          weekdaySeries[dayIdx].push(h.daily_kg);
        }

        weekdayProfiles = weekdaySeries.map((series) => {
          if (series.length === 0) return Math.round(avgDailyKg);
          let smoothed = series[0];
          for (let i = 1; i < series.length; i++) {
            smoothed = alpha * series[i] + (1 - alpha) * smoothed;
          }
          return Math.round(smoothed);
        });

        mlMeta = {
          algorithm: 'Exponential Smoothing + OLS Trend Forecast',
          alpha,
          trendSlopeKgDay: Math.round(slope * 100) / 100,
          forecastNextDayKg: Math.round(forecastKg)
        };
      } else {
        // --- RULE-BASED STATISTICAL MODE ---
        avgDailyKg = mean;

        // 7-day vs older moving average trend
        const recent = dailyValues.slice(-7);
        const older = dailyValues.slice(0, -7);
        if (recent.length > 0 && older.length > 0) {
          const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
          const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
          if (recentAvg > olderAvg * 1.1) trend = 'increasing';
          else if (recentAvg < olderAvg * 0.9) trend = 'decreasing';
        }

        // Arithmetic average per weekday
        const weekdaySums = [0, 0, 0, 0, 0, 0, 0];
        const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
        for (const h of history) {
          const dayIdx = (new Date(h.recorded_date).getDay() + 6) % 7;
          weekdaySums[dayIdx] += h.daily_kg;
          weekdayCounts[dayIdx]++;
        }
        weekdayProfiles = weekdaySums.map((sum, i) => weekdayCounts[i] > 0 ? Math.round(sum / weekdayCounts[i]) : Math.round(avgDailyKg));
      }
    }

    // Classification Rule:
    // HIGH: avg >= 550 kg/day
    // MEDIUM: 320 <= avg < 550 kg/day
    // LOW: avg < 320 kg/day
    let classification = 'MEDIUM';
    if (avgDailyKg >= 550) {
      classification = 'HIGH';
    } else if (avgDailyKg < 320) {
      classification = 'LOW';
    }

    // Update in database
    db.run("UPDATE areas SET current_class = ? WHERE id = ?", [classification, area.id]);

    // Check for Spike in the most recent reading
    let spikeDetected = false;
    let spikeRatio = 1.0;
    if (count > 0) {
      const latestDayKg = dailyValues[dailyValues.length - 1];
      const zScore = stdDev > 0 ? (latestDayKg - avgDailyKg) / stdDev : 0;
      spikeRatio = avgDailyKg > 0 ? latestDayKg / avgDailyKg : 1.0;

      if (zScore >= 2.0 || spikeRatio >= 1.6) {
        spikeDetected = true;
        alertService.createSpikeAlert({
          areaId: area.id,
          areaName: area.name,
          recordedKg: latestDayKg,
          baselineKg: Math.round(avgDailyKg),
          zScore: Math.round(zScore * 10) / 10
        });
      }
    }

    results.push({
      areaId: area.id,
      name: area.name,
      code: area.code,
      wasteCategory: area.waste_category,
      population: area.population,
      currentClass: classification,
      avgDailyKg: Math.round(avgDailyKg),
      stdDevKg: Math.round(stdDev),
      trend,
      spikeDetected,
      spikeRatio: Math.round(spikeRatio * 100) / 100,
      weekdayProfiles,
      mlMeta,
      rationale: isMlMode
        ? `ML ${classification} forecast: ${Math.round(avgDailyKg)} kg/day (${trend} trend, slope ${mlMeta?.trendSlopeKgDay} kg/d)`
        : `${classification} generation: ${Math.round(avgDailyKg)} kg/day avg (${trend} trend, ±${Math.round(stdDev)} kg std)`
    });
  }

  return {
    mode,
    modeExplanation,
    weeksAvailable,
    classifiedAt: new Date().toISOString(),
    areas: results
  };
}

/**
 * Check how many weeks of data are currently in area_quantities
 */
function getAvailableWeeksCount() {
  const row = db.get(
    `SELECT (julianday(MAX(recorded_date)) - julianday(MIN(recorded_date))) / 7.0 as weeks
     FROM area_quantities`
  );
  if (!row || !row.weeks) return 0;
  return Math.max(0, Math.floor(row.weeks));
}

module.exports = {
  classifyAreas,
  getAvailableWeeksCount
};
