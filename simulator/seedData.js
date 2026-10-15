const db = require('../backend/src/db');

// Master Coimbatore Municipal Areas
const COIMBATORE_AREAS = [
  { id: 'AREA_RS_PURAM', name: 'R.S. Puram', code: 'RSP', lat: 11.0118, lng: 76.9465, population: 18500, households: 4200, category: 'bio', baseRate: 620, class: 'HIGH' },
  { id: 'AREA_GANDHIPURAM', name: 'Gandhipuram Commercial', code: 'GDP', lat: 11.0182, lng: 76.9678, population: 22000, households: 3800, category: 'bio', baseRate: 780, class: 'HIGH' },
  { id: 'AREA_SAIBABA_COLONY', name: 'Saibaba Colony', code: 'SBC', lat: 11.0287, lng: 76.9450, population: 14200, households: 3400, category: 'bio', baseRate: 460, class: 'MEDIUM' },
  { id: 'AREA_PEELAMEDU', name: 'Peelamedu Tech Zone', code: 'PLM', lat: 11.0264, lng: 77.0125, population: 19500, households: 4600, category: 'non-bio', baseRate: 510, class: 'MEDIUM' },
  { id: 'AREA_TOWN_HALL', name: 'Town Hall Central Market', code: 'TNH', lat: 10.9967, lng: 76.9628, population: 26000, households: 4800, category: 'bio', baseRate: 850, class: 'HIGH' },
  { id: 'AREA_SINGANALLUR', name: 'Singanallur Ward 45', code: 'SNG', lat: 10.9992, lng: 77.0255, population: 16800, households: 3900, category: 'non-bio', baseRate: 420, class: 'MEDIUM' },
  { id: 'AREA_RACE_COURSE', name: 'Race Course Promenade', code: 'RCC', lat: 11.0028, lng: 76.9741, population: 8500, households: 1800, category: 'non-bio', baseRate: 260, class: 'LOW' },
  { id: 'AREA_SARAVANAMPATTI', name: 'Saravanampatti IT Park', code: 'SVP', lat: 11.0825, lng: 76.9967, population: 24500, households: 5500, category: 'bio', baseRate: 690, class: 'HIGH' },
  { id: 'AREA_KOVAIPUDUR', name: 'Kovaipudur Suburb', code: 'KVP', lat: 10.9385, lng: 76.9452, population: 9200, households: 2100, category: 'non-bio', baseRate: 280, class: 'LOW' }
];

// Truck Fleet
const TRUCKS = [
  { id: 'TRUCK_TN38_1001', plateNumber: 'TN-38-AA-1001', driverName: 'Murugan S.', capacityKg: 2800, capacityM3: 9.0, fuel: 0.35, status: 'idle' },
  { id: 'TRUCK_TN38_1002', plateNumber: 'TN-38-AA-1002', driverName: 'Karthik R.', capacityKg: 2500, capacityM3: 8.0, fuel: 0.34, status: 'idle' },
  { id: 'TRUCK_TN38_1003', plateNumber: 'TN-38-AA-1003', driverName: 'Selvan P.', capacityKg: 3000, capacityM3: 10.0, fuel: 0.38, status: 'idle' },
  { id: 'TRUCK_TN38_1004', plateNumber: 'TN-38-AA-1004', driverName: 'Anand V.', capacityKg: 2500, capacityM3: 8.0, fuel: 0.35, status: 'idle' }
];

function runSeed() {
  console.log('--- Initializing Database & Seeding Master Data ---');
  db.initDb();

  // 1. Insert/Update Areas
  const insertArea = db.getDb().prepare(
    `INSERT INTO areas (id, name, code, lat, lng, population, households, waste_category, base_rate_kg_day, current_class)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       lat = excluded.lat,
       lng = excluded.lng,
       population = excluded.population,
       households = excluded.households,
       waste_category = excluded.waste_category,
       base_rate_kg_day = excluded.base_rate_kg_day,
       current_class = excluded.current_class`
  );

  for (const a of COIMBATORE_AREAS) {
    insertArea.run(a.id, a.name, a.code, a.lat, a.lng, a.population, a.households, a.category, a.baseRate, a.class);
  }
  console.log(`Seeded ${COIMBATORE_AREAS.length} municipal areas.`);

  // 2. Insert/Update Trucks
  const insertTruck = db.getDb().prepare(
    `INSERT INTO trucks (id, plate_number, driver_name, capacity_kg, capacity_m3, fuel_consumption_l_km, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       plate_number = excluded.plate_number,
       driver_name = excluded.driver_name,
       capacity_kg = excluded.capacity_kg`
  );

  for (const t of TRUCKS) {
    insertTruck.run(t.id, t.plateNumber, t.driverName, t.capacityKg, t.capacityM3, t.fuel, t.status);
  }
  console.log(`Seeded ${TRUCKS.length} collection trucks.`);

  // 3. Generate 60 Days (~8.5 Weeks) of Historical Waste Quantities
  // Clear old simulated records and any attributed rows tied to simulator visits.
  // Visit-linked quantities can be marked non-simulated by older firmware/API code,
  // so delete them by their unambiguous simulator device ID before deleting visits.
  db.run(`DELETE FROM area_quantities
          WHERE is_simulated = 1
             OR visit_id IN (SELECT id FROM truck_visits WHERE device_id = 'ESP32_YARD_SIM')`);
  db.run("DELETE FROM truck_visits WHERE device_id = 'ESP32_YARD_SIM'");
  db.run("DELETE FROM trips WHERE id LIKE 'TRIP_SIM_%'");

  const insertTrip = db.getDb().prepare(
    `INSERT OR IGNORE INTO trips (id, truck_id, driver_name, waste_category, status, attribution_strategy, notes, dispatched_at, completed_at)
     VALUES (?, ?, ?, ?, 'completed', 'single_area', 'Historical collection trip', ?, ?)`
  );

  const insertQuant = db.getDb().prepare(
    `INSERT INTO area_quantities (id, trip_id, visit_id, area_id, recorded_date, waste_category, quantity_kg, attribution_method, confidence, is_simulated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const insertVisit = db.getDb().prepare(
    `INSERT INTO truck_visits (id, truck_id, trip_id, device_id, arrived_at, departed_at, dwell_s, raw_distance_cm, est_volume_m3, est_quantity_kg, quantity_source)
     VALUES (?, ?, ?, 'ESP32_YARD_SIM', ?, ?, ?, ?, ?, ?, 'ultrasonic_estimate')`
  );

  const now = new Date();
  let totalRecords = 0;
  let totalVisits = 0;

  for (let dayOffset = 60; dayOffset >= 0; dayOffset--) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() - dayOffset);
    const dateStr = dayDate.toISOString().slice(0, 10);
    const dayOfWeek = (dayDate.getDay() + 6) % 7; // 0=Mon, 6=Sun
    const isWeekend = dayOfWeek >= 5;

    // Simulate collection trips for areas scheduled or accumulating
    for (let i = 0; i < COIMBATORE_AREAS.length; i++) {
      const area = COIMBATORE_AREAS[i];

      // Realistic weekday variation:
      // Bio food waste peaks on weekends (+25%)
      // Commercial peaks on weekdays (Mon-Fri)
      let multiplier = 1.0;
      if (area.category === 'bio' && isWeekend) {
        multiplier += 0.28;
      } else if (area.code === 'GDP' && !isWeekend) {
        multiplier += 0.22; // Commercial weekday traffic
      }

      // Random natural fluctuation ±8%
      const noise = (Math.sin(dayOffset * 13 + i * 7) * 0.08);
      multiplier += noise;

      // Inject a realistic Spike Event on dayOffset = 1 (yesterday) for Saravanampatti (festival/tech event)
      if (dayOffset === 1 && area.code === 'SVP') {
        multiplier *= 1.85; // 85% sudden surge
      }

      const dailyKg = Math.round(area.baseRate * multiplier * 10) / 10;
      const quantId = `AQ_SIM_${dateStr}_${area.code}`;
      const tripId = `TRIP_SIM_${dateStr}_${i}`;
      const visitId = `VISIT_SIM_${dateStr}_${i}`;

      // Insert trip
      const arrivedAt = new Date(dayDate.getTime() + (9 + (i % 6)) * 3600000).toISOString();
      const departedAt = new Date(dayDate.getTime() + (9 + (i % 6)) * 3600000 + 45000).toISOString();
      const truck = TRUCKS[i % TRUCKS.length];
      const medianDist = Math.max(30, Math.round(180 - (dailyKg / (area.category === 'bio' ? 450 : 180) / (3.5 * 1.8) * 100)));

      insertTrip.run(tripId, truck.id, truck.driverName, area.category, arrivedAt, departedAt);

      insertVisit.run(
        visitId,
        truck.id,
        tripId,
        arrivedAt,
        departedAt,
        45,
        medianDist,
        Math.round((dailyKg / 350) * 10) / 10,
        dailyKg
      );
      totalVisits++;

      // Insert quantity
      insertQuant.run(
        quantId,
        tripId,
        visitId,
        area.id,
        dateStr,
        area.category,
        dailyKg,
        'single_area',
        1.0
      );
      totalRecords++;
    }
  }

  // 4. Run classification & initial schedule generation
  const classifyService = require('../backend/src/services/classifyService');
  const scheduleService = require('../backend/src/services/scheduleService');
  const routeService = require('../backend/src/services/routeService');

  const classification = classifyService.classifyAreas();
  const schedule = scheduleService.generateWeeklySchedule();
  const routes = routeService.optimiseRoutes({ dayOfWeek: 0 });

  console.log(`Successfully seeded ${totalRecords} historical quantity records across ${totalVisits} truck visits.`);
  console.log(`Generated active weekly schedule (${schedule.items.length} collection events) and route plan.`);

  return {
    success: true,
    areasSeeded: COIMBATORE_AREAS.length,
    trucksSeeded: TRUCKS.length,
    historicalDays: 60,
    recordsCount: totalRecords,
    visitsCount: totalVisits,
    scheduleId: schedule.id,
    planId: routes.planId
  };
}

if (require.main === module) {
  runSeed();
}

module.exports = {
  runSeed,
  COIMBATORE_AREAS,
  TRUCKS
};
