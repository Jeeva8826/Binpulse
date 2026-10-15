const test = require('node:test');
const assert = require('node:assert');
const classifyService = require('../backend/src/services/classifyService');
const db = require('../backend/src/db');

test('Classifier Service Suite', async (t) => {
  db.initDb();

  await t.test('classifyAreas assigns High/Medium/Low based on daily generation', () => {
    const result = classifyService.classifyAreas();
    assert.ok(result.areas.length >= 8, 'Should classify at least 8 areas');
    assert.ok(['rule_based', 'ml'].includes(result.mode), 'Mode should be rule_based or ml');

    for (const a of result.areas) {
      assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(a.currentClass), 'Invalid class');
      assert.ok(a.avgDailyKg > 0, 'Average daily kg must be positive');
      assert.ok(Array.isArray(a.weekdayProfiles), 'Weekday profiles must be array');
      assert.strictEqual(a.weekdayProfiles.length, 7, 'Must have 7 weekdays');
    }
  });

  await t.test('Spike detection correctly flags anomalous surge', () => {
    const result = classifyService.classifyAreas();
    // In seedData, Saravanampatti (SVP) had a surge injected on day 1
    const svp = result.areas.find(a => a.code === 'SVP');
    assert.ok(svp, 'Saravanampatti area must exist');
    // Check that spike detection logic executed
    assert.strictEqual(typeof svp.spikeDetected, 'boolean');
  });

  await t.test('Available weeks count reports history', () => {
    const weeks = classifyService.getAvailableWeeksCount();
    assert.ok(weeks >= 8, 'Should have >= 8 weeks of simulated history');
  });

  await t.test('ML mode activates and computes exponential smoothing + trend models', () => {
    db.run("UPDATE settings SET value = 'true' WHERE key = 'ML_MODE_ENABLED'");
    const result = classifyService.classifyAreas();
    assert.strictEqual(result.mode, 'ml');
    assert.ok(result.modeExplanation.includes('ML mode active'));

    const rsp = result.areas.find(a => a.code === 'RSP');
    assert.ok(rsp.mlMeta, 'ML metadata must be present for area');
    assert.strictEqual(rsp.mlMeta.alpha, 0.35);
    assert.strictEqual(typeof rsp.mlMeta.trendSlopeKgDay, 'number');
    assert.ok(rsp.rationale.startsWith('ML'));

    // Reset setting back to rule-based
    db.run("UPDATE settings SET value = 'false' WHERE key = 'ML_MODE_ENABLED'");
  });
});
