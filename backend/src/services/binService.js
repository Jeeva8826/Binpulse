const db = require('../db');

function optionalNumber(value) {
  const parsed = Number(value);
  return value === undefined || value === null || value === '' || !Number.isFinite(parsed) ? null : parsed;
}

function recordReading({ binId, fill, distanceCm, volumeL, capacityL, timestamp = new Date().toISOString() }) {
  const reading = {
    id: binId,
    binId,
    fill: Math.max(0, Math.min(100, Math.round(Number(fill)))),
    distanceCm: optionalNumber(distanceCm),
    volumeL: optionalNumber(volumeL),
    capacityL: optionalNumber(capacityL),
    timestamp,
    isReal: true
  };
  db.run(
    `INSERT INTO bin_readings (bin_id, fill, distance_cm, volume_l, capacity_l, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [reading.binId, reading.fill, reading.distanceCm, reading.volumeL, reading.capacityL, reading.timestamp]
  );
  return reading;
}

function getReadings() {
  return db.query(`
    SELECT r.bin_id AS id, r.bin_id AS binId, r.fill, r.distance_cm AS distanceCm,
           r.volume_l AS volumeL, r.capacity_l AS capacityL, r.timestamp, 1 AS isReal
    FROM bin_readings r
    INNER JOIN (SELECT bin_id, MAX(id) AS latest_id FROM bin_readings GROUP BY bin_id) latest
      ON latest.latest_id = r.id
    ORDER BY r.bin_id
  `);
}

module.exports = { recordReading, getReadings };
