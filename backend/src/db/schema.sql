-- SQLite Schema for BinPulse Review-2 Redesign
-- Centralised Yard Ingestion, Area Attribution, Smart Scheduling, and Routing

CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  population INTEGER DEFAULT 15000,
  households INTEGER DEFAULT 3500,
  waste_category TEXT DEFAULT 'bio' CHECK (waste_category IN ('bio', 'non-bio', 'mixed')),
  base_rate_kg_day REAL DEFAULT 450.0,
  current_class TEXT DEFAULT 'MEDIUM' CHECK (current_class IN ('HIGH', 'MEDIUM', 'LOW')),
  last_collected_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trucks (
  id TEXT PRIMARY KEY,
  plate_number TEXT UNIQUE NOT NULL,
  driver_name TEXT NOT NULL,
  capacity_kg REAL DEFAULT 2500.0,
  capacity_m3 REAL DEFAULT 8.0,
  fuel_consumption_l_km REAL DEFAULT 0.35,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'on-route', 'maintenance')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  truck_id TEXT NOT NULL,
  driver_name TEXT,
  waste_category TEXT DEFAULT 'bio' CHECK (waste_category IN ('bio', 'non-bio', 'mixed')),
  status TEXT DEFAULT 'dispatched' CHECK (status IN ('dispatched', 'completed', 'cancelled')),
  attribution_strategy TEXT DEFAULT 'single_area' CHECK (attribution_strategy IN ('single_area', 'weighted', 'calibrated')),
  notes TEXT,
  dispatched_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (truck_id) REFERENCES trucks(id)
);

CREATE TABLE IF NOT EXISTS trip_areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  stop_order INTEGER DEFAULT 1,
  weight_ratio REAL DEFAULT 1.0,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE TABLE IF NOT EXISTS truck_visits (
  id TEXT PRIMARY KEY,
  truck_id TEXT,
  trip_id TEXT,
  device_id TEXT NOT NULL,
  arrived_at TEXT NOT NULL,
  departed_at TEXT NOT NULL,
  dwell_s INTEGER NOT NULL,
  raw_distance_cm REAL NOT NULL,
  est_volume_m3 REAL DEFAULT 0.0,
  est_quantity_kg REAL DEFAULT 0.0,
  quantity_source TEXT DEFAULT 'ultrasonic_estimate' CHECK (quantity_source IN ('ultrasonic_estimate', 'trip_count', 'manual')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (truck_id) REFERENCES trucks(id),
  FOREIGN KEY (trip_id) REFERENCES trips(id)
);

-- Physical Arduino yard visits stay separate from simulated/dispatched trips.
CREATE TABLE IF NOT EXISTS live_yard_visits (
  visit_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  truck_id TEXT,
  plate_number TEXT,
  waste_category TEXT DEFAULT 'bio' CHECK (waste_category IN ('bio', 'non-bio', 'mixed')),
  status TEXT DEFAULT 'awaiting_identification' CHECK (status IN ('awaiting_identification', 'identified', 'departed')),
  arrived_at TEXT NOT NULL,
  departed_at TEXT,
  dwell_s INTEGER DEFAULT 0,
  distance_cm REAL,
  est_volume_m3 REAL,
  est_quantity_kg REAL,
  quantity_source TEXT DEFAULT 'ultrasonic_estimate',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_live_yard_visits_arrived ON live_yard_visits(arrived_at DESC);

CREATE TABLE IF NOT EXISTS area_quantities (
  id TEXT PRIMARY KEY,
  trip_id TEXT,
  visit_id TEXT,
  area_id TEXT NOT NULL,
  recorded_date TEXT NOT NULL,
  waste_category TEXT DEFAULT 'bio',
  quantity_kg REAL NOT NULL,
  attribution_method TEXT NOT NULL CHECK (attribution_method IN ('single_area', 'weighted', 'calibrated')),
  confidence REAL DEFAULT 1.0,
  is_simulated INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id),
  FOREIGN KEY (visit_id) REFERENCES truck_visits(id),
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  distance_cm REAL NOT NULL,
  raw_distance_cm REAL,
  is_truck_present INTEGER DEFAULT 0,
  dwell_s INTEGER DEFAULT 0,
  event TEXT DEFAULT 'ping',
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Persistent latest/history records for the optional direct single-bin sensor.
CREATE TABLE IF NOT EXISTS bin_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bin_id TEXT NOT NULL,
  fill REAL NOT NULL,
  distance_cm REAL,
  volume_l REAL,
  capacity_l REAL,
  timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bin_readings_bin_time ON bin_readings(bin_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS device_status (
  device_id TEXT PRIMARY KEY,
  last_seen_at TEXT DEFAULT (datetime('now')),
  ip_address TEXT,
  rssi INTEGER,
  uptime_s INTEGER,
  battery_pct INTEGER,
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline', 'degraded')),
  firmware_version TEXT DEFAULT '2.0.0'
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  week_start_date TEXT NOT NULL,
  mode TEXT DEFAULT 'rule_based' CHECK (mode IN ('rule_based', 'ml')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule_items (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon, 6=Sun
  is_extra INTEGER DEFAULT 0,
  reason TEXT NOT NULL,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE TABLE IF NOT EXISTS route_plans (
  id TEXT PRIMARY KEY,
  schedule_id TEXT,
  plan_date TEXT NOT NULL,
  baseline_km REAL NOT NULL,
  baseline_trips INTEGER NOT NULL,
  baseline_stops INTEGER NOT NULL,
  optimised_km REAL NOT NULL,
  optimised_trips INTEGER NOT NULL,
  optimised_stops INTEGER NOT NULL,
  km_saved REAL NOT NULL,
  fuel_saved_l REAL NOT NULL,
  co2_saved_kg REAL NOT NULL,
  routes_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('SPIKE_DETECTED', 'OVERFLOW_RISK', 'SENSOR_OFFLINE', 'EXTRA_COLLECTION_RECOMMENDED')),
  area_id TEXT,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  is_resolved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON sensor_readings(timestamp);
CREATE INDEX IF NOT EXISTS idx_area_quantities_date ON area_quantities(recorded_date);
CREATE INDEX IF NOT EXISTS idx_area_quantities_area ON area_quantities(area_id);
CREATE INDEX IF NOT EXISTS idx_visits_arrived ON truck_visits(arrived_at);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts(is_resolved);
