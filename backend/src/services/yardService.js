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
    activeTripId: null
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

        // Look up currently dispatched trip if available (most recent dispatch)
        const activeTrip = db.get("SELECT id FROM trips WHERE status = 'dispatched' ORDER BY dispatched_at DESC LIMIT 1");
        if (activeTrip) {
          presenceState.activeTripId = activeTrip.id;
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
          tripId: presenceState.activeTripId
        });

        // Reset state for next truck
        presenceState.arrivedAt = null;
        presenceState.rawDistances = [];
        presenceState.currentDwellSeconds = 0;
        presenceState.activeTripId = null;
      }
    }
  }

  // Update ongoing dwell if truck is present
  if (presenceState.isTruckPresent && presenceState.arrivedAt) {
    presenceState.currentDwellSeconds = Math.round((now.getTime() - presenceState.arrivedAt.getTime()) / 1000);
  } else {
    presenceState.currentDwellSeconds = 0;
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
    timestamp: nowIso
  };
}

/**
 * Finalize visit and calculate estimated volume & weight based on mode
 */
function finalizeVisit({ deviceId, arrivedAt, departedAt, dwellSeconds, medianDistanceCm, tripId }) {
  const visitId = 'VISIT_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
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

  const category = (trip && trip.waste_category) || 'bio';
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

  // Insert visit record
  db.run(
    `INSERT INTO truck_visits (id, truck_id, trip_id, device_id, arrived_at, departed_at, dwell_s, raw_distance_cm, est_volume_m3, est_quantity_kg, quantity_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      visitId,
      truck ? truck.id : null,
      trip ? trip.id : null,
      deviceId,
      arrivedAt,
      departedAt,
      dwellSeconds,
      medianDistanceCm,
      estVolumeM3,
      estQuantityKg,
      quantitySource
    ]
  );

  // If a trip was active, mark it completed, set truck to idle, and run attribution
  if (trip) {
    db.run(
      "UPDATE trips SET status = 'completed', completed_at = ? WHERE id = ?",
      [departedAt, trip.id]
    );

    if (truck) {
      db.run("UPDATE trucks SET status = 'idle' WHERE id = ?", [truck.id]);
    }

    // Call attribution service dynamically
    const attributionService = require('./attributionService');
    attributionService.attributeTrip({
      tripId: trip.id,
      visitId,
      quantityKg: estQuantityKg,
      wasteCategory: category,
      recordedDate: departedAt.slice(0, 10)
    });
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
  getVisitsLog,
  getPresenceState: (deviceId) => getPresenceState(deviceId),
  resetPresenceState: () => {
    presenceStates.clear();
    presenceStates.set('ESP32_YARD_01', createPresenceState());
  }
};
