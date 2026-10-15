const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

// Ensure db directory exists
const dbDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(config.DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA busy_timeout = 8000;');
  }
  return dbInstance;
}

function initDb() {
  const db = getDb();
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Initialize default settings if not exists
  const defaultSettings = [
    ['QUANTITY_MODE', config.QUANTITY_MODE, 'Quantity estimation mode: load_level or trip_count'],
    ['ATTRIBUTION_STRATEGY', config.ATTRIBUTION_STRATEGY, 'Multi-area attribution strategy: single_area, weighted, or calibrated'],
    ['TRUCK_PRESENT_CM', String(config.TRUCK_PRESENT_CM), 'Threshold distance (cm) below which truck is considered present at yard'],
    ['SENSOR_MOUNT_HEIGHT_CM', String(config.SENSOR_MOUNT_HEIGHT_CM), 'Height of ultrasonic sensor above ground (cm)'],
    ['TRUCK_BED_EMPTY_DISTANCE_CM', String(config.TRUCK_BED_EMPTY_DISTANCE_CM), 'Distance from sensor to empty truck bed (cm)'],
    ['MAX_GAP_DAYS_BIO', '2', 'Public health rule: maximum days between collections for bio/high density areas'],
    ['MAX_GAP_DAYS_NON_BIO', '3', 'Public health rule: maximum days between collections for non-bio/standard areas'],
    ['DEFAULT_TRUCK_CAPACITY_KG', '2500', 'Default vehicle capacity (kg)'],
    ['FUEL_L_PER_KM', '0.35', 'Assumed diesel fuel consumption per km (litres)'],
    ['CO2_KG_PER_L', '2.68', 'kg CO2 produced per litre of diesel fuel burned'],
    ['ML_MODE_ENABLED', 'false', 'Enable light ML when >= 4 weeks history exists']
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)');
  for (const [k, v, desc] of defaultSettings) {
    stmt.run(k, v, desc);
  }

  return db;
}

function sanitizeParams(params) {
  const arr = Array.isArray(params) ? params : [params];
  return arr.map(p => (p === undefined ? null : p));
}

function query(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...sanitizeParams(params));
}

function get(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.get(...sanitizeParams(params)) || null;
}

function run(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.run(...sanitizeParams(params));
}

function exec(sql) {
  const db = getDb();
  return db.exec(sql);
}

module.exports = {
  getDb,
  initDb,
  query,
  get,
  run,
  exec
};
