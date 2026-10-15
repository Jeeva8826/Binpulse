const db = require('../db');
const config = require('../config');

/**
 * Attribute trip waste quantity across visited areas
 * @param {Object} params - { tripId, visitId, quantityKg, wasteCategory, recordedDate }
 */
function attributeTrip({ tripId, visitId, quantityKg, wasteCategory = 'bio', recordedDate }) {
  const trip = db.get("SELECT * FROM trips WHERE id = ?", [tripId]);
  if (!trip) return [];

  const tripAreas = db.query(
    `SELECT ta.*, a.population, a.households, a.base_rate_kg_day, a.name as area_name
     FROM trip_areas ta
     JOIN areas a ON ta.area_id = a.id
     WHERE ta.trip_id = ?
     ORDER BY ta.stop_order ASC`,
    [tripId]
  );

  if (tripAreas.length === 0) return [];

  // Determine attribution strategy
  const setting = db.get("SELECT value FROM settings WHERE key = 'ATTRIBUTION_STRATEGY'");
  let strategy = setting ? setting.value : config.ATTRIBUTION_STRATEGY;

  // Single-area override: if only 1 area visited, always exact
  if (tripAreas.length === 1) {
    strategy = 'single_area';
  }

  const results = [];
  const recDate = recordedDate || new Date().toISOString().slice(0, 10);
  const simulatedFlag = trip.id.startsWith('TRIP_SIM_') ? 1 : 0;

  if (strategy === 'single_area') {
    // Strategy 1: Exact attribution to single area
    const area = tripAreas[0];
    const id = `AQ_${Date.now()}_${area.area_id}`;
    db.run(
      `INSERT INTO area_quantities (id, trip_id, visit_id, area_id, recorded_date, waste_category, quantity_kg, attribution_method, confidence, is_simulated)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'single_area', 1.0, ?)`,
      [id, tripId, visitId || null, area.area_id, recDate, wasteCategory, quantityKg, simulatedFlag]
    );

    // Update area's last_collected_at
    db.run("UPDATE areas SET last_collected_at = ? WHERE id = ?", [new Date().toISOString(), area.area_id]);

    results.push({
      areaId: area.area_id,
      areaName: area.area_name,
      quantityKg: Math.round(quantityKg * 10) / 10,
      attributionMethod: 'single_area',
      confidence: 1.0
    });
  } else if (strategy === 'weighted') {
    // Strategy 2: Weighted demographic allocation
    const totalPop = tripAreas.reduce((sum, a) => sum + (a.population || 10000), 0);

    for (const area of tripAreas) {
      const weight = (area.population || 10000) / (totalPop || 1);
      const allocatedKg = Math.round(quantityKg * weight * 10) / 10;
      const id = `AQ_${Date.now()}_${area.area_id}_${Math.floor(Math.random() * 1000)}`;

      db.run(
        `INSERT INTO area_quantities (id, trip_id, visit_id, area_id, recorded_date, waste_category, quantity_kg, attribution_method, confidence, is_simulated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'weighted', 0.75, ?)`,
        [id, tripId, visitId || null, area.area_id, recDate, wasteCategory, allocatedKg, simulatedFlag]
      );

      db.run("UPDATE areas SET last_collected_at = ? WHERE id = ?", [new Date().toISOString(), area.area_id]);

      results.push({
        areaId: area.area_id,
        areaName: area.area_name,
        quantityKg: allocatedKg,
        attributionMethod: 'weighted',
        confidence: 0.75
      });
    }
  } else if (strategy === 'calibrated') {
    // Strategy 3: Calibration via least-squares regression over historical multi-area trips
    const calibratedRates = solveCalibratedRates(tripAreas.map(a => a.area_id));

    if (calibratedRates && calibratedRates.canCalibrate) {
      // Split proportionally to calibrated historical rates
      const sumRates = tripAreas.reduce((sum, a) => sum + (calibratedRates.rates[a.area_id] || a.base_rate_kg_day || 400), 0);

      for (const area of tripAreas) {
        const areaRate = calibratedRates.rates[area.area_id] || area.base_rate_kg_day || 400;
        const ratio = areaRate / (sumRates || 1);
        const allocatedKg = Math.round(quantityKg * ratio * 10) / 10;
        const id = `AQ_${Date.now()}_${area.area_id}_${Math.floor(Math.random() * 1000)}`;

        db.run(
          `INSERT INTO area_quantities (id, trip_id, visit_id, area_id, recorded_date, waste_category, quantity_kg, attribution_method, confidence, is_simulated)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'calibrated', ?, ?)`,
          [id, tripId, visitId || null, area.area_id, recDate, wasteCategory, allocatedKg, calibratedRates.confidence, simulatedFlag]
        );

        db.run("UPDATE areas SET last_collected_at = ? WHERE id = ?", [new Date().toISOString(), area.area_id]);

        results.push({
          areaId: area.area_id,
          areaName: area.area_name,
          quantityKg: allocatedKg,
          attributionMethod: 'calibrated',
          confidence: calibratedRates.confidence
        });
      }
    } else {
      // Fallback to weighted allocation if insufficient calibration data
      return attributeTripWithFallback(tripAreas, tripId, visitId, quantityKg, wasteCategory, recDate);
    }
  }

  return results;
}

function attributeTripWithFallback(tripAreas, tripId, visitId, quantityKg, wasteCategory, recDate) {
  const totalPop = tripAreas.reduce((sum, a) => sum + (a.population || 10000), 0);
  const results = [];

  for (const area of tripAreas) {
    const weight = (area.population || 10000) / (totalPop || 1);
    const allocatedKg = Math.round(quantityKg * weight * 10) / 10;
    const id = `AQ_${Date.now()}_${area.area_id}_${Math.floor(Math.random() * 1000)}`;

    db.run(
      `INSERT INTO area_quantities (id, trip_id, visit_id, area_id, recorded_date, waste_category, quantity_kg, attribution_method, confidence, is_simulated)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'weighted', 0.65, ?)`,
      [id, tripId, visitId || null, area.area_id, recDate, wasteCategory, allocatedKg, tripId.startsWith('TRIP_SIM_') ? 1 : 0]
    );

    db.run("UPDATE areas SET last_collected_at = ? WHERE id = ?", [new Date().toISOString(), area.area_id]);

    results.push({
      areaId: area.area_id,
      areaName: area.area_name,
      quantityKg: allocatedKg,
      attributionMethod: 'weighted (fallback)',
      confidence: 0.65
    });
  }

  return results;
}

/**
 * Solve non-negative least-squares / ridge regression for multi-area trips:
 * trip_kg = sum(indicator_i * rate_i)
 */
function solveCalibratedRates(areaIds) {
  if (!areaIds || areaIds.length === 0) {
    return { canCalibrate: false, reason: 'no_areas_specified' };
  }

  // Query historical completed trips that visited any of these areas
  const placeholders = areaIds.map(() => '?').join(',');
  const matchingTrips = db.query(
    `SELECT DISTINCT t.id as trip_id, v.est_quantity_kg
     FROM trips t
     JOIN truck_visits v ON v.trip_id = t.id
     JOIN trip_areas ta ON ta.trip_id = t.id
     WHERE t.status = 'completed' AND v.est_quantity_kg > 0 AND ta.area_id IN (${placeholders})
     ORDER BY t.completed_at DESC LIMIT 100`,
    areaIds
  );

  // Require at least 3 historical trips per area
  const minRequired = areaIds.length * 3;
  if (matchingTrips.length < minRequired) {
    return {
      canCalibrate: false,
      reason: `insufficient_trips (${matchingTrips.length} found, minimum ${minRequired} required)`
    };
  }

  // Fetch baseline rates as regularization priors
  const beta0 = areaIds.map(aid => {
    const a = db.get("SELECT base_rate_kg_day FROM areas WHERE id = ?", [aid]);
    return a ? a.base_rate_kg_day : 450.0;
  });

  // Construct design matrix X (K x M) and target vector y (K x 1)
  const K = matchingTrips.length;
  const M = areaIds.length;
  const X = [];
  const y = [];

  for (const t of matchingTrips) {
    const visitedAreas = db.query("SELECT area_id FROM trip_areas WHERE trip_id = ?", [t.trip_id]).map(r => r.area_id);
    const row = areaIds.map(aid => visitedAreas.includes(aid) ? 1.0 : 0.0);
    X.push(row);
    y.push(t.est_quantity_kg);
  }

  // Verify each area has at least 3 occurrences in the matrix
  for (let j = 0; j < M; j++) {
    const colCount = X.reduce((acc, row) => acc + row[j], 0);
    if (colCount < 3) {
      return {
        canCalibrate: false,
        reason: `insufficient_trips_for_area (${areaIds[j]} has ${colCount} trips, minimum 3 required)`
      };
    }
  }

  // Ridge Regularized Normal Equations: (X^T * X + lambda * I) * beta = X^T * y + lambda * beta0
  const lambda = 1.0;
  const A = Array.from({ length: M }, () => new Array(M).fill(0.0));
  const b = new Array(M).fill(0.0);

  for (let i = 0; i < M; i++) {
    for (let j = 0; j < M; j++) {
      let sum = 0.0;
      for (let k = 0; k < K; k++) {
        sum += X[k][i] * X[k][j];
      }
      A[i][j] = sum + (i === j ? lambda : 0.0);
    }

    let bSum = 0.0;
    for (let k = 0; k < K; k++) {
      bSum += X[k][i] * y[k];
    }
    b[i] = bSum + lambda * beta0[i];
  }

  // Solve A * beta = b via Gaussian Elimination with partial pivoting
  const beta = solveLinearSystem(A, b);
  if (!beta) {
    return { canCalibrate: false, reason: 'singular_matrix' };
  }

  // Clamp rates to positive values (Non-negative Least Squares constraint)
  for (let j = 0; j < M; j++) {
    beta[j] = Math.max(80.0, Math.round(beta[j] * 10) / 10);
  }

  // Calculate Residual Sum of Squares (RSS) and Total Sum of Squares (TSS) for R^2 confidence
  const yMean = y.reduce((s, v) => s + v, 0) / K;
  let rss = 0.0;
  let tss = 0.0;

  for (let k = 0; k < K; k++) {
    let yPred = 0.0;
    for (let j = 0; j < M; j++) {
      yPred += X[k][j] * beta[j];
    }
    rss += Math.pow(y[k] - yPred, 2);
    tss += Math.pow(y[k] - yMean, 2);
  }

  const rSquared = tss > 0 ? Math.max(0.1, 1.0 - (rss / tss)) : 0.75;
  const confidence = Math.round(Math.min(0.95, Math.max(0.65, rSquared)) * 100) / 100;
  const meanResidualKg = Math.round(Math.sqrt(rss / K) * 10) / 10;

  const rates = {};
  areaIds.forEach((aid, idx) => {
    rates[aid] = beta[idx];
  });

  return {
    canCalibrate: true,
    rates,
    confidence,
    tripsUsed: K,
    meanResidualKg
  };
}

/**
 * Helper: Solve A * x = b via Gaussian Elimination with partial pivoting
 */
function solveLinearSystem(A_in, b_in) {
  const n = b_in.length;
  const A = A_in.map(row => row.slice());
  const b = b_in.slice();

  for (let p = 0; p < n; p++) {
    // Find pivot
    let maxRow = p;
    for (let i = p + 1; i < n; i++) {
      if (Math.abs(A[i][p]) > Math.abs(A[maxRow][p])) {
        maxRow = i;
      }
    }

    if (Math.abs(A[maxRow][p]) < 1e-12) return null; // Singular

    // Swap rows
    [A[p], A[maxRow]] = [A[maxRow], A[p]];
    [b[p], b[maxRow]] = [b[maxRow], b[p]];

    // Eliminate column p
    for (let i = p + 1; i < n; i++) {
      const alpha = A[i][p] / A[p][p];
      b[i] -= alpha * b[p];
      for (let j = p; j < n; j++) {
        A[i][j] -= alpha * A[p][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0.0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0.0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * x[j];
    }
    x[i] = (b[i] - sum) / A[i][i];
  }

  return x;
}

module.exports = {
  attributeTrip,
  solveCalibratedRates
};
