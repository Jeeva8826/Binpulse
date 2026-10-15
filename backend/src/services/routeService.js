const db = require('../db');
const config = require('../config');

const ROAD_FACTOR = 1.3;
const FUEL_L_PER_KM = 0.35;
const CO2_KG_PER_L = 2.68;

/**
 * Great-circle distance between two (lat, lng) points in km
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = (lat2 - lat1) * Math.PI / 180.0;
  const dLon = (lon2 - lon1) * Math.PI / 180.0;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180.0) * Math.cos(lat2 * Math.PI / 180.0) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function roadKm(lat1, lon1, lat2, lon2) {
  return haversineKm(lat1, lon1, lat2, lon2) * ROAD_FACTOR;
}

/**
 * Optimise routes for a specific day using Capacitated VRP (CVRP)
 * @param {Object} params - { dayOfWeek (0..6), truckCapacityKg, planDate }
 */
function optimiseRoutes(params = {}) {
  const dayOfWeek = params.dayOfWeek !== undefined ? parseInt(params.dayOfWeek, 10) : ((new Date().getDay() + 6) % 7);
  const planDate = params.planDate || new Date().toISOString().slice(0, 10);

  const capacitySetting = db.get("SELECT value FROM settings WHERE key = 'DEFAULT_TRUCK_CAPACITY_KG'");
  const truckCapacityKg = params.truckCapacityKg || (capacitySetting ? parseFloat(capacitySetting.value) : 2500.0);

  // Get active schedule
  let schedule = db.get("SELECT * FROM schedules ORDER BY created_at DESC LIMIT 1");
  if (!schedule) {
    const scheduleService = require('./scheduleService');
    schedule = scheduleService.generateWeeklySchedule();
  }

  // Fetch areas scheduled for this day
  const scheduledAreas = db.query(
    `SELECT a.*, si.is_extra, si.reason
     FROM schedule_items si
     JOIN areas a ON si.area_id = a.id
     WHERE si.schedule_id = ? AND si.day_of_week = ?
     ORDER BY si.is_extra DESC, a.current_class DESC`,
    [schedule.id, dayOfWeek]
  );

  // Fetch ALL areas for baseline comparison
  const allAreas = db.query("SELECT * FROM areas");

  const depot = config.DEPOT;
  const yard = config.YARD;

  // 1. Solve baseline route (visiting ALL areas)
  const baselineSolution = solveCVRP(allAreas, truckCapacityKg, depot, yard);

  // 2. Solve optimised route (visiting scheduled areas only)
  const scheduledStops = scheduledAreas.length > 0 ? scheduledAreas : allAreas.slice(0, 4);
  const optimisedSolution = solveCVRP(scheduledStops, truckCapacityKg, depot, yard);

  // Savings calculations
  const kmSaved = Math.max(0, Math.round((baselineSolution.totalKm - optimisedSolution.totalKm) * 10) / 10);
  const tripsAvoided = Math.max(0, baselineSolution.trips.length - optimisedSolution.trips.length);
  const stopsSkipped = Math.max(0, allAreas.length - scheduledStops.length);
  const fuelSavedL = Math.round(kmSaved * FUEL_L_PER_KM * 10) / 10;
  const co2SavedKg = Math.round(fuelSavedL * CO2_KG_PER_L * 10) / 10;

  const planId = 'PLAN_' + Date.now();
  const routesJson = JSON.stringify(optimisedSolution.trips);

  db.run(
    `INSERT INTO route_plans (id, schedule_id, plan_date, baseline_km, baseline_trips, baseline_stops,
                              optimised_km, optimised_trips, optimised_stops, km_saved, fuel_saved_l, co2_saved_kg, routes_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planId,
      schedule.id,
      planDate,
      baselineSolution.totalKm,
      baselineSolution.trips.length,
      allAreas.length,
      optimisedSolution.totalKm,
      optimisedSolution.trips.length,
      scheduledStops.length,
      kmSaved,
      fuelSavedL,
      co2SavedKg,
      routesJson
    ]
  );

  return {
    planId,
    planDate,
    dayOfWeek,
    depot,
    yard,
    truckCapacityKg,
    baseline: {
      totalKm: baselineSolution.totalKm,
      tripsCount: baselineSolution.trips.length,
      stopsCount: allAreas.length
    },
    optimised: {
      totalKm: optimisedSolution.totalKm,
      tripsCount: optimisedSolution.trips.length,
      stopsCount: scheduledStops.length,
      trips: optimisedSolution.trips
    },
    savings: {
      kmSaved,
      tripsAvoided,
      stopsSkipped,
      fuelSavedL,
      co2SavedKg,
      isEstimate: true
    }
  };
}

/**
 * Solve Capacitated Vehicle Routing Problem (CVRP)
 * Starts at Depot, visits stops up to capacity limit, ends at Yard.
 */
function solveCVRP(stopsList, capacityKg, depot, yard) {
  const remaining = stopsList.map(s => ({
    ...s,
    demandKg: s.base_rate_kg_day || 450.0
  }));

  const trips = [];
  let totalKm = 0.0;

  while (remaining.length > 0) {
    let currentLoad = 0;
    let currentLat = depot.lat;
    let currentLng = depot.lng;
    let currentTripStops = [];
    let tripKm = 0;

    while (true) {
      // Find stops that fit in truck
      let fits = remaining.filter(s => currentLoad + s.demandKg <= capacityKg * 1.1); // 10% tolerance

      // Safety against infinite loop: If truck is empty and no single stop fits because demand > capacity,
      // take the stop and split its load across trips
      if (fits.length === 0 && currentTripStops.length === 0 && remaining.length > 0) {
        const oversized = remaining[0];
        const takenLoad = Math.min(oversized.demandKg, capacityKg);
        const actualDist = roadKm(currentLat, currentLng, oversized.lat, oversized.lng);
        tripKm += actualDist;
        currentLat = oversized.lat;
        currentLng = oversized.lng;
        currentLoad = takenLoad;

        currentTripStops.push({
          id: oversized.id,
          name: oversized.name,
          code: oversized.code,
          lat: oversized.lat,
          lng: oversized.lng,
          demandKg: Math.round(takenLoad),
          isExtra: !!oversized.is_extra,
          reason: (oversized.reason || 'Regular collection') + (oversized.demandKg > capacityKg ? ' (Dedicated load)' : '')
        });

        oversized.demandKg -= takenLoad;
        if (oversized.demandKg <= 10) {
          remaining.splice(0, 1);
        }
        break; // Truck loaded to capacity, deliver to yard
      }

      if (fits.length === 0) break;

      // Choose nearest stop from current position
      let bestStop = null;
      let minDistance = Infinity;

      for (const candidate of fits) {
        const d = roadKm(currentLat, currentLng, candidate.lat, candidate.lng);
        // Prioritize extra / spike stops by reducing apparent distance
        const priorityFactor = candidate.is_extra ? 0.7 : 1.0;
        const weightedDist = d * priorityFactor;

        if (weightedDist < minDistance) {
          minDistance = weightedDist;
          bestStop = candidate;
        }
      }

      if (!bestStop) break;

      const actualDist = roadKm(currentLat, currentLng, bestStop.lat, bestStop.lng);
      tripKm += actualDist;
      currentLat = bestStop.lat;
      currentLng = bestStop.lng;
      currentLoad += bestStop.demandKg;

      currentTripStops.push({
        id: bestStop.id,
        name: bestStop.name,
        code: bestStop.code,
        lat: bestStop.lat,
        lng: bestStop.lng,
        demandKg: Math.round(bestStop.demandKg),
        isExtra: !!bestStop.is_extra,
        reason: bestStop.reason || 'Regular collection'
      });

      const idx = remaining.findIndex(s => s.id === bestStop.id);
      if (idx !== -1) remaining.splice(idx, 1);
    }

    // Return to Central Yard from last stop
    const returnDist = roadKm(currentLat, currentLng, yard.lat, yard.lng);
    tripKm += returnDist;

    // Apply 2-opt tour improvement if trip has >= 4 stops
    if (currentTripStops.length >= 4) {
      currentTripStops = twoOptTour(currentTripStops, depot, yard);
    }

    trips.push({
      tripIndex: trips.length + 1,
      start: depot,
      end: yard,
      loadKg: Math.round(currentLoad),
      capacityKg,
      utilizationPct: Math.round((currentLoad / capacityKg) * 100),
      distanceKm: Math.round(tripKm * 10) / 10,
      stops: currentTripStops
    });

    totalKm += tripKm;
  }

  return {
    trips,
    totalKm: Math.round(totalKm * 10) / 10
  };
}

/**
 * 2-Opt heuristic to untangle route crossings
 */
function twoOptTour(stops, start, end) {
  let best = stops.slice();
  let improved = true;

  function calculateDistance(tour) {
    let d = roadKm(start.lat, start.lng, tour[0].lat, tour[0].lng);
    for (let i = 0; i < tour.length - 1; i++) {
      d += roadKm(tour[i].lat, tour[i].lng, tour[i + 1].lat, tour[i + 1].lng);
    }
    d += roadKm(tour[tour.length - 1].lat, tour[tour.length - 1].lng, end.lat, end.lng);
    return d;
  }

  let bestDist = calculateDistance(best);

  let iterations = 0;
  while (improved && iterations < 20) {
    improved = false;
    iterations++;

    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = best.slice(0, i)
          .concat(best.slice(i, j + 1).reverse())
          .concat(best.slice(j + 1));

        const dist = calculateDistance(candidate);
        if (dist < bestDist - 0.05) {
          best = candidate;
          bestDist = dist;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return best;
}

function getLatestRoutePlan() {
  const plan = db.get("SELECT * FROM route_plans ORDER BY created_at DESC LIMIT 1");
  if (!plan) return null;

  return {
    id: plan.id,
    planDate: plan.plan_date,
    baseline: {
      totalKm: plan.baseline_km,
      tripsCount: plan.baseline_trips,
      stopsCount: plan.baseline_stops
    },
    optimised: {
      totalKm: plan.optimised_km,
      tripsCount: plan.optimised_trips,
      stopsCount: plan.optimised_stops,
      trips: JSON.parse(plan.routes_json || '[]')
    },
    savings: {
      kmSaved: plan.km_saved,
      tripsAvoided: Math.max(0, plan.baseline_trips - plan.optimised_trips),
      fuelSavedL: plan.fuel_saved_l,
      co2SavedKg: plan.co2_saved_kg,
      isEstimate: true
    }
  };
}

module.exports = {
  haversineKm,
  roadKm,
  optimiseRoutes,
  getLatestRoutePlan
};
