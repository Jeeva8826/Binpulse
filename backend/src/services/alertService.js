const db = require('../db');

function createSpikeAlert({ areaId, areaName, recordedKg, baselineKg, zScore }) {
  const id = `ALT_SPIKE_${areaId}_${Date.now()}`;
  const message = `Spike detected in ${areaName}: recorded ${recordedKg} kg vs baseline ${baselineKg} kg (z-score: ${zScore}). Extra collection recommended.`;

  // Avoid spamming duplicate unresolved alerts for same area
  const existing = db.get("SELECT id FROM alerts WHERE area_id = ? AND alert_type = 'SPIKE_DETECTED' AND is_resolved = 0", [areaId]);
  if (!existing) {
    db.run(
      `INSERT INTO alerts (id, alert_type, area_id, message, severity, is_resolved)
       VALUES (?, 'SPIKE_DETECTED', ?, ?, 'critical', 0)`,
      [id, areaId, message]
    );
  }
}

function createOverflowAlert({ areaId, areaName, daysSinceCollection, maxGap }) {
  const id = `ALT_OVERFLOW_${areaId}_${Date.now()}`;
  const message = `Overflow risk in ${areaName}: ${daysSinceCollection} days without collection exceeds threshold of ${maxGap} days.`;

  const existing = db.get("SELECT id FROM alerts WHERE area_id = ? AND alert_type = 'OVERFLOW_RISK' AND is_resolved = 0", [areaId]);
  if (!existing) {
    db.run(
      `INSERT INTO alerts (id, alert_type, area_id, message, severity, is_resolved)
       VALUES (?, 'OVERFLOW_RISK', ?, ?, 'warning', 0)`,
      [id, areaId, message]
    );
  }
}

function createSensorOfflineAlert(deviceId) {
  const id = `ALT_OFFLINE_${deviceId}_${Date.now()}`;
  const message = `Yard entrance sensor ${deviceId} is offline or has stopped transmitting telemetry.`;

  const existing = db.get("SELECT id FROM alerts WHERE alert_type = 'SENSOR_OFFLINE' AND is_resolved = 0");
  if (!existing) {
    db.run(
      `INSERT INTO alerts (id, alert_type, area_id, message, severity, is_resolved)
       VALUES (?, 'SENSOR_OFFLINE', NULL, ?, 'warning', 0)`,
      [id, message]
    );
  }
}

function getActiveAlerts() {
  return db.query(
    `SELECT a.*, ar.name as area_name
     FROM alerts a
     LEFT JOIN areas ar ON a.area_id = ar.id
     WHERE a.is_resolved = 0
     ORDER BY
       CASE a.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
       a.created_at DESC`
  );
}

function resolveAlert(id) {
  return db.run(
    "UPDATE alerts SET is_resolved = 1, resolved_at = datetime('now') WHERE id = ?",
    [id]
  );
}

module.exports = {
  createSpikeAlert,
  createOverflowAlert,
  createSensorOfflineAlert,
  getActiveAlerts,
  resolveAlert
};
