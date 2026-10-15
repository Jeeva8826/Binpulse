const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../backend/src/db');
const binService = require('../backend/src/services/binService');

test('Arduino bin readings are persisted and restored as the latest BIN01 record', () => {
  db.initDb();
  const first = binService.recordReading({
    binId: 'BIN01', fill: 36.7, distanceCm: 18.2, volumeL: 7.8, capacityL: 21.2,
    timestamp: '2026-10-15T10:00:00.000Z'
  });
  const second = binService.recordReading({
    binId: 'BIN01', fill: 42.4, distanceCm: 16.5, volumeL: 9.0, capacityL: 21.2,
    timestamp: '2026-10-15T10:00:02.000Z'
  });

  assert.equal(first.fill, 37);
  assert.equal(second.fill, 42);
  const restored = binService.getReadings().find((reading) => reading.binId === 'BIN01');
  assert.equal(restored.id, 'BIN01');
  assert.equal(restored.fill, 42);
  assert.equal(restored.distanceCm, 16.5);
  assert.equal(restored.volumeL, 9);
  assert.equal(restored.capacityL, 21.2);
  assert.equal(restored.timestamp, '2026-10-15T10:00:02.000Z');
  assert.equal(restored.isReal, 1);
});

test('legacy fill-only readings remain accepted and omit unknown measurements', () => {
  db.initDb();
  binService.recordReading({ binId: 'BIN02', fill: 45, timestamp: '2026-10-15T10:01:00.000Z' });
  const reading = binService.getReadings().find((item) => item.binId === 'BIN02');
  assert.equal(reading.fill, 45);
  assert.equal(reading.distanceCm, null);
  assert.equal(reading.volumeL, null);
  assert.equal(reading.capacityL, null);
});
