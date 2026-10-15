const db = require('../db');
const config = require('../config');

// Keep simulator and physical device debounce state independent.
const presenceStates = new Map();
function createPresenceState() {
  return {
    isTruckPresent: false,
    consecutivePresent: 0,
    consecutiveAbsent: 0,
    arrivedAt: null,
    rawDistances: [],
    currentDwellSeconds: 0,
    activeTripId: null,
    activeLiveVisitId: null,
    liveTruckAssignment: null
  };
}
function getPresenceState(deviceId = 'ESP32_YARD_01') {
  if (!presenceStates.has(deviceId)) presenceStates.set(deviceId, createPresenceState());
  return presenceStates.get(deviceId);
}

const REQUIRED_CONSECUTIVE = 3; // Debounce threshold (samples)

/**
 * Process a raw ultrasonic distance reading from the yard entrance
 * @param {Object} data - { deviceId, distanceCm, rawDistanceCm, timestamp, rssi, uptimeS }
 */
function processSensorReading(data) {
  const deviceId = data.deviceId || 'ESP32_YARD_01';
  const isArduinoYard = deviceId === 'ARDUINO_YARD_01';
  const presenceState = getPresenceState(deviceId);
  const distanceCm = parseFloat(data.distanceCm);
  const rawDistanceCm = parseFloat(data.rawDistanceCm || data.distanceCm);
  const now = data.timestamp ? new Date(data.timestamp) : new Date();
  const nowIso = now.toISOString();

  // Fetch configured threshold
  const thresholdSetting = db.get("SELECT value FROM settings WHERE key = 'TRUCK_PRESENT_CM'");
  const thresholdCm = thresholdSetting ? parseFloat(thresholdSetting.value) : config.TRUCK_PRESENT_CM;

  // Record device status / heartbeat
  db.run(
    `INSERT INTO device_status (device_id, last_seen_at, ip_address, rssi, uptime_s, status)
     VALUES (?, ?, ?, ?, ?, 'online')
     ON CONFLICT(device_id) DO UPDATE SET
       last_seen_at = excluded.last_seen_at,
       ip_address = COALESCE(excluded.ip_address, device_status.ip_address),
       rssi = COALESCE(excluded.rssi, device_status.rssi),
       uptime_s = COALESCE(excluded.uptime_s, device_status.uptime_s),
       status = 'online'`,
    [deviceId, nowIso, data.ipAddress || null, data.rssi || null, data.uptimeS || null]
  );

  // Validate distance measurement range (HC-SR04 / JSN-SR04T: 2cm to 400cm)
  const isOutOfRange = isNaN(distanceCm) || distanceCm < 2.0 || distanceCm > 400.0;
  let event = 'ping';
  let completedVisit = null;

  if (isOutOfRange) {
    // Sensor dropout / timeout reading: ignore for debounce hysteresis to avoid false departures
    event = 'sensor_dropout';
  } else {
    // Evaluate instantaneous presence
    const isCurrentlyClose = distanceCm <= thresholdCm;

    if (isCurrentlyClose) {
      presenceState.consecutivePresent++;
      presenceState.consecutiveAbsent = 0;
      presenceState.rawDistances.push(distanceCm);

      if (!presenceState.isTruckPresent && presenceState.consecutivePresent >= REQUIRED_CONSECUTIVE) {
        // Confirmed Arrival
        presenceState.isTruckPresent = true;
        presenceState.arrivedAt = now;
        event = 'arrival';

        if (isArduinoYard) {
          const visitId = `LIVE_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
          presenceState.activeLiveVisitId = visitId;
          presenceState.liveTruckAssignment = null;
          db.run(
            `INSERT INTO live_yard_visits (visit_id, device_id, status, arrived_at, dwell_s, distance_cm)
             VALUES (?, ?, 'awaiting_identification', ?, 0, ?)`,
            [visitId, deviceId, nowIso, distanceCm]
          );
        } else {
          // Simulated/other yard feeds retain the existing dispatched-trip behavior.
          const activeTrip = db.get("SELECT id FROM trips WHERE status = 'dispatched' ORDER BY dispatched_at DESC LIMIT 1");
          if (activeTrip) presenceState.activeTripId = activeTrip.id;
        }
      }
    } else {
      presenceState.consecutiveAbsent++;
      presenceState.consecutivePresent = 0;

      if (presenceState.isTruckPresent && presenceState.consecutiveAbsent >= REQUIRED_CONSECUTIVE) {
        // Confirmed Departure
        presenceState.isTruckPresent = false;
        const departedAt = now;
        const dwellMs = departedAt.getTime() - (presenceState.arrivedAt ? presenceState.arrivedAt.getTime() : now.getTime());
        const dwellSeconds = Math.max(1, Math.round(dwellMs / 1000));
        event = 'departure';

        // Calculate median distance during visit
        const distances = presenceState.rawDistances.slice();
        distances.sort((a, b) => a - b);
        const medianDistance = distances.length > 0 ? distances[Math.floor(distances.length / 2)] : distanceCm;

        completedVisit = finalizeVisit({
          deviceId,
          arrivedAt: presenceState.arrivedAt ? presenceState.arrivedAt.toISOString() : nowIso,
          departedAt: nowIso,
          dwellSeconds,
          medianDistanceCm: medianDistance,
          tripId: isArduinoYard ? null : presenceState.activeTripId,
          persist: !isArduinoYard,
          visitId: isArduinoYard ? presenceState.activeLiveVisitId : null,
          wasteCategoryOverride: isArduinoYard ? presenceState.liveTruckAssignment?.wasteCategory : null
        });

        if (isArduinoYard && presenceState.activeLiveVisitId) {
          const assignment = presenceState.liveTruckAssignment;
          db.run(
            `UPDATE live_yard_visits SET status = 'departed', departed_at = ?, dwell_s = ?, distance_cm = ?,
               est_volume_m3 = ?, est_quantity_kg = ?, quantity_source = ? WHERE visit_id = ?`,
            [nowIso, dwellSeconds, medianDistance, completedVisit.estVolumeM3, completedVisit.estQuantityKg,
              completedVisit.quantitySource, presenceState.activeLiveVisitId]
          );
          completedVisit = {
            ...completedVisit,
            truckId: assignment?.truckId || null,
            plateNumber: assignment?.plateNumber || null,
            wasteCategory: assignment?.wasteCategory || 'bio'
          };
        }

        // Reset state for next truck
        presenceState.arrivedAt = null;
        presenceState.rawDistances = [];
        presenceState.currentDwellSeconds = 0;
        presenceState.activeTripId = null;
        presenceState.activeLiveVisitId = null;
        presenceState.liveTruckAssignment = null;
      }
    }
  }

  // Update ongoing dwell if truck is present
  if (presenceState.isTruckPresent && presenceState.arrivedAt) {
    presenceState.currentDwellSeconds = Math.round((now.getTime() - presenceState.arrivedAt.getTime()) / 1000);
  } else {
    presenceState.currentDwellSeconds = 0;
  }

  if (isArduinoYard && presenceState.activeLiveVisitId) {
    db.run(
      `UPDATE live_yard_visits SET dwell_s = ?, distance_cm = ? WHERE visit_id = ? AND departed_at IS NULL`,
      [presenceState.currentDwellSeconds, isOutOfRange ? null : distanceCm, presenceState.activeLiveVisitId]
    );
  }

  // Log raw reading
  db.run(
    `INSERT INTO sensor_readings (device_id, distance_cm, raw_distance_cm, is_truck_present, dwell_s, event, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [deviceId, distanceCm, rawDistanceCm, presenceState.isTruckPresent ? 1 : 0, presenceState.currentDwellSeconds, event, nowIso]
  );

  return {
    deviceId,
    distanceCm,
    isTruckPresent: presenceState.isTruckPresent,
    dwellSeconds: presenceState.currentDwellSeconds,
    event,
    completedVisit,
    activeLiveVisit: getActiveLiveVisit(deviceId),
    timestamp: nowIso
  };
}

function getActiveLiveVisit(deviceId = 'ARDUINO_YARD_01') {
  return db.get(
    `SELECT visit_id AS visitId, device_id AS deviceId, truck_id AS truckId, plate_number AS plateNumber,
       waste_category AS wasteCategory, status, arrived_at AS arrivedAt, dwell_s AS dwellSeconds,
       distance_cm AS distanceCm
     FROM live_yard_visits WHERE device_id = ? AND departed_at IS NULL ORDER BY arrived_at DESC LIMIT 1`,
    [deviceId]
  );
}

function assignLiveTruck({ truckId, plateNumber, wasteCategory = 'bio' }) {
  const state = getPresenceState('ARDUINO_YARD_01');
  if (!state.isTruckPresent || !state.activeLiveVisitId) {
    const error = new Error('No live vehicle is currently detected at the yard entrance.');
    error.statusCode = 409;
    throw error;
  }
  state.liveTruckAssignment = { truckId, plateNumber, wasteCategory };
  db.run(
    `UPDATE live_yard_visits SET truck_id = ?, plate_number = ?, waste_category = ?, status = 'identified'
     WHERE visit_id = ? AND departed_at IS NULL`,
    [truckId, plateNumber, wasteCategory, state.activeLiveVisitId]
  );
  return getActiveLiveVisit('ARDUINO_YARD_01');
}

function getLiveYardVisits(limit = 20) {
  return db.query(
    `SELECT visit_id AS visitId, device_id AS deviceId, truck_id AS truckId, plate_number AS plateNumber,
       waste_category AS wasteCategory, status, arrived_at AS arrivedAt, departed_at AS departedAt,
       dwell_s AS dwellSeconds, distance_cm AS distanceCm, est_volume_m3 AS estimatedVolumeM3,
       est_quantity_kg AS estimatedQuantityKg, quantity_source AS quantitySource
     FROM live_yard_visits ORDER BY arrived_at DESC LIMIT ?`,
    [Math.max(1, Math.min(100, Number(limit) || 20))]
  );
}

/**
 * Finalize visit and calculate estimated volume & weight based on mode
 */
function finalizeVisit({ deviceId, arrivedAt, departedAt, dwellSeconds, medianDistanceCm, tripId, persist = true, visitId: suppliedVisitId = null, wasteCategoryOverride = null }) {
  const visitId = suppliedVisitId || 'VISIT_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const modeSetting = db.get("SELECT value FROM settings WHERE key = 'QUANTITY_MODE'");
  const quantityMode = modeSetting ? modeSetting.value : config.QUANTITY_MODE;

  let estVolumeM3 = 0.0;
  let estQuantityKg = 0.0;
  let quantitySource = 'ultrasonic_estimate';

  // Find trip info if available
  let trip = null;
  let truck = null;
  if (tripId) {
    trip = db.get("SELECT * FROM trips WHERE id = ?", [tripId]);
    if (trip) {
      truck = db.get("SELECT * FROM trucks WHERE id = ?", [trip.truck_id]);
    }
  }

  const category = wasteCategoryOverride || (trip && trip.waste_category) || 'bio';
  const density = config.DENSITIES_KG_M3[category] || 300.0;

  if (quantityMode === 'load_level') {
    // Ultrasonic height calculation
    const emptyDistanceSetting = db.get("SELECT value FROM settings WHERE key = 'TRUCK_BED_EMPTY_DISTANCE_CM'");
    const emptyDistanceCm = emptyDistanceSetting ? parseFloat(emptyDistanceSetting.value) : config.TRUCK_BED_EMPTY_DISTANCE_CM;

    // Fill height = distance down to bed floor minus distance to top of trash
    const fillHeightCm = Math.max(0, emptyDistanceCm - medianDistanceCm);
    const fillHeightM = Math.min(config.DEFAULT_TRUCK_BED.max_height_m, fillHeightCm / 100.0);

    estVolumeM3 = Math.round(config.DEFAULT_TRUCK_BED.length_m * config.DEFAULT_TRUCK_BED.width_m * fillHeightM * 100) / 100;
    estQuantityKg = Math.round(estVolumeM3 * density * 10) / 10;
    quantitySource = 'ultrasonic_estimate';
  } else {
    // Trip-count based fallback estimation
    const defaultCapacity = truck ? truck.capacity_kg : 2200.0;
    estQuantityKg = Math.round(defaultCapacity * 0.75); // Assume 75% average truck fill
    estVolumeM3 = Math.round((estQuantityKg / density) * 100) / 100;
    quantitySource = 'trip_count';
  }

  if (persist) {
    // Existing simulation and ESP32 flow continues to store into operational trips.
    db.run(
      `INSERT INTO truck_visits (id, truck_id, trip_id, device_id, arrived_at, departed_at, dwell_s, raw_distance_cm, est_volume_m3, est_quantity_kg, quantity_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [visitId, truck ? truck.id : null, trip ? trip.id : null, deviceId, arrivedAt, departedAt,
        dwellSeconds, medianDistanceCm, estVolumeM3, estQuantityKg, quantitySource]
    );

    if (trip) {
      db.run("UPDATE trips SET status = 'completed', completed_at = ? WHERE id = ?", [departedAt, trip.id]);
      if (truck) db.run("UPDATE trucks SET status = 'idle' WHERE id = ?", [truck.id]);
      const attributionService = require('./attributionService');
      attributionService.attributeTrip({
        tripId: trip.id,
        visitId,
        quantityKg: estQuantityKg,
        wasteCategory: category,
        recordedDate: departedAt.slice(0, 10)
      });
    }
  }

  return {
    visitId,
    truckId: truck ? truck.id : null,
    tripId: trip ? trip.id : null,
    arrivedAt,
    departedAt,
    dwellSeconds,
    rawDistanceCm: medianDistanceCm,
    estVolumeM3,
    estQuantityKg,
    quantitySource,
    wasteCategory: category
  };
}

/**
 * Get current live yard status
 */
function getYardStatus(source = 'all') {
  const sourceFilter = source === 'hardware'
    ? "WHERE device_id != 'ESP32_YARD_SIM'"
    : source === 'simulation'
      ? "WHERE device_id = 'ESP32_YARD_SIM'"
      : '';
  const latestReading = db.get(`SELECT * FROM sensor_readings ${sourceFilter} ORDER BY id DESC LIMIT 1`);
  // Simulator heartbeats must never make the physical ESP32 look online.
  const deviceFilter = source === 'simulation'
    ? "WHERE device_id = 'ESP32_YARD_SIM'"
    : source === 'hardware'
      ? "WHERE device_id != 'ESP32_YARD_SIM'"
      : '';
  const device = db.get(`SELECT * FROM device_status ${deviceFilter} ORDER BY last_seen_at DESC LIMIT 1`);
  const stateDeviceId = (latestReading && latestReading.device_id) || (device && device.device_id) ||
    (source === 'simulation' ? 'ESP32_YARD_SIM' : 'ESP32_YARD_01');
  const sourcePresenceState = getPresenceState(stateDeviceId);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayVisits = db.get(
    "SELECT COUNT(*) as count, COALESCE(SUM(est_quantity_kg), 0) as total_kg FROM truck_visits WHERE date(arrived_at) = date('now') OR date(arrived_at) = date('now', 'localtime') OR date(arrived_at) = ?",
    [todayStr]
  );

  // Determine device online health (offline if silent > 60s)
  let deviceStatus = 'offline';
  if (device && device.last_seen_at) {
    const lastSeenMs = new Date(device.last_seen_at).getTime();
    if (Date.now() - lastSeenMs < 60000) {
      deviceStatus = 'online';
    }
  }

  // Trigger offline alert if device is disconnected
  if (deviceStatus === 'offline' && source !== 'simulation') {
    const alertService = require('./alertService');
    alertService.createSensorOfflineAlert((device && device.device_id) || 'ESP32_YARD_01');
  }

  return {
    isTruckPresent: sourcePresenceState.isTruckPresent,
    currentDwellSeconds: sourcePresenceState.currentDwellSeconds,
    latestDistanceCm: latestReading ? latestReading.distance_cm : null,
    latestReadingAt: latestReading ? latestReading.timestamp : null,
    latestEvent: latestReading ? latestReading.event : null,
    latestDeviceId: latestReading ? latestReading.device_id : null,
    device: {
      deviceId: device ? device.device_id : 'ESP32_YARD_01',
      status: deviceStatus,
      lastSeenAt: device ? device.last_seen_at : null,
      rssi: device ? device.rssi : -68,
      uptimeS: device ? device.uptime_s : 0
    },
    serialLink: { port: config.ARDUINO_SERIAL_PORT, baudRate: config.ARDUINO_BAUD_RATE },
    activeLiveVisit: getActiveLiveVisit('ARDUINO_YARD_01'),
    today: {
      visitCount: todayVisits ? todayVisits.count : 0,
      totalEstimatedKg: todayVisits ? Math.round(todayVisits.total_kg) : 0
    }
  };
}

/**
 * Get historical visits log
 */
function getVisitsLog(limit = 50) {
  return db.query(
    `SELECT v.*, t.plate_number, t.driver_name, tr.waste_category
     FROM truck_visits v
     LEFT JOIN trucks t ON v.truck_id = t.id
     LEFT JOIN trips tr ON v.trip_id = tr.id
     ORDER BY v.arrived_at DESC
     LIMIT ?`,
    [limit]
  );
}

module.exports = {
  processSensorReading,
  finalizeVisit,
  getYardStatus,
  assignLiveTruck,
  getLiveYardVisits,
  getVisitsLog,
  getPresenceState: (deviceId) => getPresenceState(deviceId),
  resetPresenceState: () => {
    presenceStates.clear();
    presenceStates.set('ESP32_YARD_01', createPresenceState());
    presenceStates.set('ARDUINO_YARD_01', createPresenceState());
  }
};
