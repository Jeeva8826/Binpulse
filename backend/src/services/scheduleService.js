const db = require('../db');
const classifyService = require('./classifyService');

/**
 * Generate a smart weekly collection schedule (Monday=0 to Sunday=6)
 * respecting public-health max gap rules, accumulation rates, and spike alerts.
 */
function generateWeeklySchedule(weekStartDate) {
  const startDateStr = weekStartDate || getUpcomingMonday();
  const scheduleId = 'SCHED_' + Date.now();

  // Load classification stats
  const classification = classifyService.classifyAreas();
  const areas = classification.areas;

  // Load public health gap rules from settings
  const maxGapBioSetting = db.get("SELECT value FROM settings WHERE key = 'MAX_GAP_DAYS_BIO'");
  const maxGapNonBioSetting = db.get("SELECT value FROM settings WHERE key = 'MAX_GAP_DAYS_NON_BIO'");
  const maxGapBio = maxGapBioSetting ? parseInt(maxGapBioSetting.value, 10) : 2;
  const maxGapNonBio = maxGapNonBioSetting ? parseInt(maxGapNonBioSetting.value, 10) : 3;

  // Load active spike alerts
  const activeAlerts = db.query("SELECT * FROM alerts WHERE alert_type = 'SPIKE_DETECTED' AND is_resolved = 0");
  const spikeAreaIds = new Set(activeAlerts.map(a => a.area_id));

  // Determine schedule items per area
  const scheduleItems = [];

  for (const area of areas) {
    const isBio = area.wasteCategory === 'bio';
    const maxGap = isBio ? maxGapBio : maxGapNonBio;
    const isSpike = spikeAreaIds.has(area.areaId) || area.spikeDetected;

    let selectedDays = [];
    let reasons = {};

    // Algorithm:
    // 1. HIGH class (or Bio with high accumulation): Collect 4-5 times a week (e.g. Mon, Wed, Fri, Sun)
    // 2. MEDIUM class: Collect 2-3 times a week respecting max-gap (e.g. Mon, Thu or Tue, Sat)
    // 3. LOW class: Collect 2 times a week respecting max-gap (e.g. Tue, Fri)
    // 4. Weekend-heavy generation: If Saturday/Sunday profile > 1.25x weekday avg, ensure weekend collection.
    // 5. Spike areas: Add immediate extra collection day.

    const weekendHeavy = (area.weekdayProfiles[5] + area.weekdayProfiles[6]) / 2 > (area.avgDailyKg * 1.2);

    if (area.currentClass === 'HIGH') {
      // High volume areas need frequent clearance
      if (maxGap <= 2) {
        selectedDays = [0, 2, 4, 6]; // Mon, Wed, Fri, Sun (max gap = 2)
      } else {
        selectedDays = [0, 2, 5]; // Mon, Wed, Sat
      }
      for (const d of selectedDays) {
        reasons[d] = `High accumulation ward (${area.avgDailyKg} kg/day) — routine clearance (max gap ${maxGap}d)`;
      }
    } else if (area.currentClass === 'MEDIUM') {
      // Medium volume
      if (isBio || maxGap <= 2) {
        selectedDays = [0, 2, 5]; // Mon, Wed, Sat (max gap = 2 to 3)
      } else {
        selectedDays = [1, 4]; // Tue, Fri (max gap = 3)
      }
      for (const d of selectedDays) {
        reasons[d] = `Medium volume ward — bi/tri-weekly optimization`;
      }
    } else {
      // LOW volume
      selectedDays = [1, 4]; // Tue, Fri (satisfies max gap of 3)
      for (const d of selectedDays) {
        reasons[d] = `Low volume (${area.avgDailyKg} kg/day) — bi-weekly collection`;
      }
    }

    // Weekend heavy adjustment
    if (weekendHeavy && !selectedDays.includes(5) && !selectedDays.includes(6)) {
      selectedDays.push(5);
      reasons[5] = `Weekend accumulation spike pattern (Sat/Sun +${Math.round(((area.weekdayProfiles[5] / area.avgDailyKg) - 1) * 100)}%)`;
    }

    // Sudden spike adjustment
    if (isSpike) {
      // Add extra collection day if not already scheduled every day
      const unscheduledDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !selectedDays.includes(d));
      if (unscheduledDays.length > 0) {
        const extraDay = unscheduledDays[0];
        selectedDays.push(extraDay);
        reasons[extraDay] = `EXTRA COLLECTION: Spike detected (${Math.round(area.spikeRatio * 100)}% of baseline)`;
      }
    }

    // Sort days
    selectedDays.sort((a, b) => a - b);

    // Verify max gap constraint is strictly respected
    ensureMaxGapRespected(selectedDays, maxGap, reasons);

    for (const day of selectedDays) {
      const isExtra = reasons[day] && reasons[day].includes('EXTRA');
      scheduleItems.push({
        id: `SI_${scheduleId}_${area.areaId}_${day}`,
        scheduleId,
        areaId: area.areaId,
        dayOfWeek: day,
        isExtra: isExtra ? 1 : 0,
        reason: reasons[day] || `Scheduled collection (gap <= ${maxGap}d)`
      });
    }
  }

  // Save to DB
  db.run(
    "INSERT INTO schedules (id, week_start_date, mode) VALUES (?, ?, ?)",
    [scheduleId, startDateStr, classification.mode]
  );

  const insertItem = db.getDb().prepare(
    "INSERT INTO schedule_items (id, schedule_id, area_id, day_of_week, is_extra, reason) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const item of scheduleItems) {
    insertItem.run(item.id, item.scheduleId, item.areaId, item.dayOfWeek, item.isExtra, item.reason);
  }

  return getSchedule(scheduleId);
}

/**
 * Helper to ensure max gap between scheduled collection days never exceeds maxGap
 */
function ensureMaxGapRespected(days, maxGap, reasons) {
  if (days.length === 0) return;
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    for (let i = 0; i < days.length; i++) {
      const current = days[i];
      const next = (i === days.length - 1) ? days[0] + 7 : days[i + 1];
      const gap = next - current - 1; // Number of days without collection
      if (gap > maxGap) {
        const midpoint = Math.floor((current + next) / 2) % 7;
        if (!days.includes(midpoint)) {
          days.push(midpoint);
          days.sort((a, b) => a - b);
          reasons[midpoint] = `Public-health rule enforcement: max collection gap is ${maxGap} days`;
          changed = true;
          break; // Restart scan with updated and sorted day list
        }
      }
    }
  }
}

/**
 * Retrieve schedule by ID or latest
 */
function getSchedule(scheduleId = null) {
  const sched = scheduleId
    ? db.get("SELECT * FROM schedules WHERE id = ?", [scheduleId])
    : db.get("SELECT * FROM schedules ORDER BY created_at DESC LIMIT 1");

  if (!sched) return null;

  const items = db.query(
    `SELECT si.*, a.name as area_name, a.code as area_code, a.waste_category, a.current_class, a.base_rate_kg_day
     FROM schedule_items si
     JOIN areas a ON si.area_id = a.id
     WHERE si.schedule_id = ?
     ORDER BY si.day_of_week ASC, a.name ASC`,
    [sched.id]
  );

  // Group by area and day
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const grid = {};

  for (const item of items) {
    if (!grid[item.area_id]) {
      grid[item.area_id] = {
        areaId: item.area_id,
        areaName: item.area_name,
        areaCode: item.area_code,
        wasteCategory: item.waste_category,
        currentClass: item.current_class,
        days: [false, false, false, false, false, false, false],
        reasons: {}
      };
    }
    grid[item.area_id].days[item.day_of_week] = true;
    grid[item.area_id].reasons[item.day_of_week] = item.reason;
  }

  return {
    id: sched.id,
    weekStartDate: sched.week_start_date,
    mode: sched.mode,
    dayNames,
    grid: Object.values(grid),
    items
  };
}

function getUpcomingMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

module.exports = {
  generateWeeklySchedule,
  getSchedule
};
