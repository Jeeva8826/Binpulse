# BinPulse Verification & Test Report (docs/TEST_REPORT.md)

**Execution Date**: 2026-10-15  
**Host Environment**: Windows 11, Node.js v25.2.1, npm 11.6.2, SQLite (node:sqlite)  
**Current Verification (2026-10-15)**: **58 / 58 automated tests passing; production frontend build successful (46 modules).**

The test runner creates and seeds a temporary SQLite database, keeping automated test records out of the live dashboard database.

---

## 1. Automated Test Suites Summary

| Test Suite File | Subsystem Verified | Tests Run | Pass | Fail | Execution Time |
|---|---|---|---|---|---|
| `tests/api.test.js` | REST Endpoints (all 15+ routes), Valid/Invalid Inputs, Auth Rejection, 404s, EcoRoute sample dataset | 23 | 23 | 0 | 152.0 ms |
| `tests/yard.test.js` | Presence Debounce, Dwell, Load Estimation, Dropout Rejection, Truck Idle Reset, Offline Alerts | 6 | 6 | 0 | 53.1 ms |
| `tests/classifier.test.js` | High/Med/Low Ward Classification, Moving Averages, Spike Detection, Light ML (Exp Smoothing + OLS Trend) | 4 | 4 | 0 | 26.1 ms |
| `tests/scheduler.test.js` | Weekly Grid Generation, Public Health Max-Gap Enforcement (Deterministic Loop) | 2 | 2 | 0 | 63.8 ms |
| `tests/router.test.js` | Capacitated VRP (CVRP), 2-Opt Tour Improvement, Baseline Savings, Oversized Demand Loop Protection | 4 | 4 | 0 | 19.2 ms |
| `tests/attribution.test.js` | Multi-Area Attribution (Strategy 1: Single, Strategy 2: Weighted, Strategy 3: Calibrated Ridge Regression) | 4 | 4 | 0 | 87.7 ms |
| `tests/firmware.test.js` | Host C++ Logic: Temp-Compensated Speed of Sound, Median-of-7 Acoustic Filter, State Machine, Contract | 4 | 4 | 0 | 2.0 ms |
| `tests/bin.test.js` | BIN01 persistence, latest-reading restoration, and legacy fill-only compatibility | 2 | 2 | 0 | included in suite total |
| `tests/workflow.test.js` | End-to-end seeded analytics, schedule, route, dispatch, yard event, hardware ingestion, reset/reseed, CSV report | 1 | 1 | 0 | 532 ms |
| **Vite Frontend Build** | Production Rollup Bundler & JSX Syntax Compilation | 46 modules | 46 | 0 | 1.46 s |
| **Current total** | **Automated unit/API/workflow tests and production frontend compilation** | **58 tests + 46 modules** | **58 tests pass** | **0 test failures** | **~7.4 s tests; ~4.5 s build** |

---

## 2. Deep Verification Record (Actual Executed Tests)

The Arduino Uno serial bridge is configured for COM12 at 115200 baud. Windows lists COM12, but opening it returned `Access to the port 'COM12' is denied` during this run, so the physical serial feed and sketch upload could not be verified. The software/API tests and browser bundle do not require COM12.

1. **REST API Smoke & Error Contract Suite (`tests/api.test.js`)**:
   - `GET /api/health` returned 200 OK with system status.
   - `GET /api/demo/ecoroute-records` returned both supplied sample records with `dataSource: "SIMULATED"`.
   - `GET /api/yard/status` verified yard sensor status, presence boolean, and device telemetry.
   - `GET /api/yard/visits` verified historical visit log retrieval.
   - `GET /api/areas` returned 9 seeded Coimbatore municipal areas.
   - `GET /api/areas/:id` returned specific ward data and verified 404 on non-existent IDs.
   - `POST /api/areas` validated schema input and rejected incomplete payloads with 400 Bad Request.
   - `PUT /api/areas/:id` verified field updates with sanitized undefined parameters.
   - `GET, POST, and DELETE /api/trucks` verified full fleet CRUD lifecycle.
   - `POST /api/dispatch/trips/start` and `/trips/:id/complete` verified vehicle dispatch lifecycle and aliases.
   - `GET /api/analytics/areas`, `/trends`, `/categories` returned segregated bio/non-bio telemetry.
   - `POST /api/classify/run` and `GET /api/classify/status` verified statistical classification.
   - `POST /api/schedule/generate` and `GET /api/routes` verified routing and schedule generation.
   - `GET /api/alerts` and `POST /api/alerts/:id/resolve` verified alert resolution.
   - `GET /api/settings` and `PUT /api/settings` verified runtime parameter tuning.
   - `POST /api/simulate/reading` and `/simulate/truck-event` verified simulated hardware injection.
   - `GET /api/reports/summary` verified aggregate KPI statistics.
   - `GET /api/reports/export.csv` downloaded valid CSV manifest starting with `Date,Area,Code,Category`.
   - `POST /api/device/readings` accepted authenticated telemetry with `x-api-key` and rejected invalid keys with 401.
   - Legacy routes `POST /api/reading/` and `GET /api/bins/` verified backwards compatibility.

2. **Presence State Machine & Estimation Suite (`tests/yard.test.js`)**:
   - Verified that 1 or 2 readings under 180 cm do not trigger arrival (anti-jitter debounce).
   - Verified that the 3rd consecutive reading transitions to `TRUCK_PRESENT` and emits `arrival` event.
   - Verified departure hysteresis (3 consecutive clear readings finalize visit and compute dwell duration).
   - Verified load-level equation: $3.5\text{ m} \times 1.8\text{ m} \times \text{fill height} \times \text{density}$ yields correct kilograms.
   - Verified that out-of-range sensor dropouts (<2 cm or >400 cm) are ignored by debouncing and do not cause spurious departure events.
   - Verified that truck fleet status transitions from `on-route` to `idle` upon yard arrival/departure completion.
   - Verified trip-count estimation fallback mode (`QUANTITY_MODE = 'trip_count'`).
   - Verified that device silence (>60s) triggers `SENSOR_OFFLINE` alert.

3. **Public Health Constraint Suite (`tests/scheduler.test.js`)**:
   - Tested circular gap across the 7-day schedule using a deterministic convergence loop.
   - Verified that no biodegradable ward ever exceeds a 2-day gap between scheduled collections.
   - Verified that non-biodegradable wards never exceed a 3-day gap.

4. **Multi-Area Attribution Strategy Suite (`tests/attribution.test.js`)**:
   - Strategy 1 allocated 100% of quantity to single ward with confidence 1.0.
   - Strategy 2 split 3000 kg across Ward A (pop 10,000) and Ward B (pop 20,000) into 1000 kg and 2000 kg with confidence 0.75.
   - Strategy 3 graceful fallback when historical multi-area sample size < 3 trips per area.
   - Strategy 3 active calibration: solved regularized ridge regression $(X^T X + \lambda I) \beta = X^T y + \lambda \beta_0$ over historical multi-area trips, verifying confidence $\ge 0.65$ and total mass conservation.

5. **Route Optimisation Suite (`tests/router.test.js`)**:
   - Verified Haversine distance and $1.3\times$ road circuity factor.
   - Solved Capacitated Vehicle Routing (CVRP) within truck payload constraints.
   - Verified positive fuel and CO₂ baseline savings.
   - Verified oversized demand protection: stops with demand exceeding truck capacity are handled without infinite loop.

6. **ESP32 Firmware Host Logic Suite (`tests/firmware.test.js`)**:
   - Verified speed of sound temperature compensation $v = (331.3 + 0.606 \times T) \times 0.0001\text{ cm}/\mu\text{s}$.
   - Verified median-of-7 filter outlier and timeout rejection.
   - Verified state machine transition timing on exactly 3 consecutive samples.
   - Verified JSON payload structure matches backend hardware ingestion schema.

7. **End-to-End System Workflow (`tests/workflow.test.js`)**:
   - Started from seeded mixed-category, multi-week demo history and confirmed analytics trends are available.
   - Generated a weekly schedule and an optimized capacity-constrained route.
   - Dispatched a truck, verified its on-route state, completed the trip, and verified it returned to idle.
   - Simulated a yard truck visit and confirmed its attributed quantity remains labeled simulated.
   - Ingested an authenticated hardware-format reading, exported the CSV manifest, reset simulated telemetry, verified hardware telemetry was retained, and reseeded the 549-record baseline.

---

## 3. Shallow & Unverified Aspects (Honest Disclosures)

1. **Physical ESP32 Flashing**:
   - The ESP32-S3 firmware was statically validated, syntax-checked, and its communication protocol was automated via real HTTP ingestion tests and host-side unit tests. However, actual binary compilation and flashing to COM11 must be done on the student's workstation using the Arduino IDE as outlined in `NEXT_STEPS.md`.
2. **Headless Browser Virtual Display**:
   - Running Microsoft Edge headless in a non-desktop background agent session on Windows prevented generating visual raster PNG screenshots directly to disk. The frontend single-page application was verified via Vite production compilation (`dist/index.html`, `dist/assets/`), HTTP static serving, and unit testing.
3. **Physical Ultrasonic Acoustic Noise**:
   - The median-of-7 filter was validated in code, but physical acoustic attenuation from angled truck tailgates or dusty yard pavement can only be observed when the physical HC-SR04 is mounted.
