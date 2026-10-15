const test = require('node:test');
const assert = require('node:assert');
const scheduleService = require('../backend/src/services/scheduleService');
const db = require('../backend/src/db');

test('Scheduler Service Suite', async (t) => {
  db.initDb();

  await t.test('generateWeeklySchedule covers all municipal areas with reasons', () => {
    const schedule = scheduleService.generateWeeklySchedule('2026-10-19');
    assert.ok(schedule.id, 'Schedule must have an ID');
    assert.ok(schedule.grid.length >= 8, 'Schedule must cover all registered areas');

    for (const areaGrid of schedule.grid) {
      assert.ok(areaGrid.days.some(d => d === true), `Area ${areaGrid.areaName} must be collected at least once`);
      assert.ok(Object.keys(areaGrid.reasons).length > 0, 'Every scheduled day must have a reason string');
    }
  });

  await t.test('Public health max-gap rule is never violated', () => {
    const schedule = scheduleService.generateWeeklySchedule('2026-10-19');
    const maxGapBio = parseInt(db.get("SELECT value FROM settings WHERE key = 'MAX_GAP_DAYS_BIO'").value, 10);
    const maxGapNonBio = parseInt(db.get("SELECT value FROM settings WHERE key = 'MAX_GAP_DAYS_NON_BIO'").value, 10);

    for (const areaGrid of schedule.grid) {
      const isBio = areaGrid.wasteCategory === 'bio';
      const maxGap = isBio ? maxGapBio : maxGapNonBio;

      const scheduledDayIndices = [];
      areaGrid.days.forEach((isScheduled, idx) => {
        if (isScheduled) scheduledDayIndices.push(idx);
      });

      assert.ok(scheduledDayIndices.length > 0, `Area ${areaGrid.areaName} must have scheduled days`);

      // Check circular gap over 7 days
      for (let i = 0; i < scheduledDayIndices.length; i++) {
        const cur = scheduledDayIndices[i];
        const next = (i === scheduledDayIndices.length - 1) ? scheduledDayIndices[0] + 7 : scheduledDayIndices[i + 1];
        const gap = next - cur - 1;
        assert.ok(
          gap <= maxGap,
          `Max gap violated for ${areaGrid.areaName}: gap was ${gap} days, max allowed is ${maxGap} days`
        );
      }
    }
  });
});
