const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const configuredDbPath = process.env.DB_PATH
  ? path.resolve(__dirname, '../../', process.env.DB_PATH)
  : path.resolve(__dirname, '../data/binpulse.sqlite');

module.exports = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  DB_PATH: configuredDbPath,
  ARDUINO_SERIAL_PORT: process.env.ARDUINO_SERIAL_PORT || 'COM12',
  ARDUINO_BAUD_RATE: parseInt(process.env.ARDUINO_BAUD_RATE || '9600', 10),
  DEVICE_API_KEY: process.env.DEVICE_API_KEY || 'binpulse_secret_key_2026',
  NODE_ENV: process.env.NODE_ENV || 'development',
  QUANTITY_MODE: process.env.QUANTITY_MODE || 'load_level', // 'load_level' | 'trip_count'
  ATTRIBUTION_STRATEGY: process.env.ATTRIBUTION_STRATEGY || 'single_area', // 'single_area' | 'weighted' | 'calibrated'
  TRUCK_PRESENT_CM: parseFloat(process.env.TRUCK_PRESENT_CM || '180.0'),
  DEPOT: {
    lat: parseFloat(process.env.DEPOT_LAT || '10.9990'),
    lng: parseFloat(process.env.DEPOT_LNG || '76.9610'),
    name: 'Coimbatore Central Depot'
  },
  YARD: {
    lat: parseFloat(process.env.YARD_LAT || '10.9920'),
    lng: parseFloat(process.env.YARD_LNG || '76.9550'),
    name: 'Coimbatore Central Waste Processing Yard'
  },
  // Waste Bulk Densities in kg/m3 (conservative estimates)
  DENSITIES_KG_M3: {
    bio: 450.0,
    'non-bio': 180.0,
    mixed: 300.0
  },
  DEFAULT_TRUCK_BED: {
    length_m: 3.5,
    width_m: 1.8,
    max_height_m: 1.4 // Maximum bed height from sensor level
  },
  SENSOR_MOUNT_HEIGHT_CM: 250.0, // Height from ground to sensor
  TRUCK_BED_EMPTY_DISTANCE_CM: 180.0 // Distance from sensor down to empty truck bed floor
};
