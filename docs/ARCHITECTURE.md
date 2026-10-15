# BinPulse / EcoRoute System Architecture (docs/ARCHITECTURE.md)

## 1. System Topology & Data Flow Diagram

```
+-----------------------------------------------------------------------------------------+
|                                PHYSICAL FIELD / YARD ENTRANCE                           |
|                                                                                         |
|   +-----------------------+     Trigger / Echo     +--------------------------------+   |
|   | HC-SR04 / JSN-SR04T   | <====================> | ESP32-S3 Yard Entrance Node    |   |
|   | Ultrasonic Sensor     |                        | (Illuminen DEV V1.1 / ESP32)   |   |
|   | (Mounted @ 250 cm)    |                        | Median Filter + State Machine  |   |
|   +-----------------------+                        +--------------------------------+   |
+--------------------------------------------------------------------|--------------------+
                                                                     |
                                      HTTP JSON POST (x-api-key)     |
                                      /api/device/readings           |
                                                                     v
+-----------------------------------------------------------------------------------------+
|                                    NODE.JS / EXPRESS BACKEND                            |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   | REST Endpoints: /api/device, /api/yard, /api/schedule, /api/routes, /api/alerts  |   |
|   +---------------------------------------------------------------------------------+   |
|         |                                      |                               |        |
|         v                                      v                               v        |
|   +-------------------+              +-------------------+           +--------------+   |
|   | Yard Service      |              | Intelligence Core |           | WebSocket    |   |
|   | Presence Debounce |              | - Classification  |           | Broadcaster  |   |
|   | Dwell Timing      |              | - Smart Scheduler |           | /ws          |   |
|   | Volume/Load Est.  |              | - 2-Opt CVRP      |           +--------------+   |
|   +-------------------+              | - Multi-Area Attr |                   |          |
|         |                            +-------------------+                   |          |
|         +-----------------------+--------------+                             |          |
|                                 v                                            |          |
|              +-------------------------------------+                         |          |
|              | SQLite Database (node:sqlite)       |                         |          |
|              | data/binpulse.sqlite                |                         |          |
|              +-------------------------------------+                         |          |
+------------------------------------------------------------------------------|----------+
                                                                               |
                                      Real-Time WebSocket Stream               |
                                      + REST API Requests                      |
                                                                               v
+-----------------------------------------------------------------------------------------+
|                                  VITE + REACT CLIENT APPLICATION                        |
|                                                                                         |
|   - Real-time Yard Entrance Telemetry Gauge & Dwell Timer                               |
|   - Coimbatore Zone-3 Leaflet Route Map (Depot -> Wards -> Yard)                       |
|   - Weekly Smart Collection Grid (Area x Day with Rationale)                            |
|   - Driver Dispatch Console (Truck, Ward Assignment, Category)                          |
|   - Area-wise Generation Analytics & High/Medium/Low Classifier                         |
|   - KPI Savings Dashboard (Baseline vs Optimised Km, Fuel, CO2)                         |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Core Algorithmic Frameworks

### A. Ultrasonic Presence & Load Estimation
- **Presence Detection**: Distance reading $d \le 180\text{ cm}$ over 3 consecutive samples (6 seconds) transitions the node into the `TRUCK_PRESENT` state.
- **Dwell Calculation**: Measures total停留 dwell time $T_{\text{dwell}} = t_{\text{depart}} - t_{\text{arrive}}$.
- **Load Estimation ($load\_level$ mode)**:
  $$\text{Fill Height } h = \max(0, 180\text{ cm} - d_{\text{median}})$$
  $$\text{Volume } V = 3.5\text{ m (length)} \times 1.8\text{ m (width)} \times \frac{h}{100}\text{ m}$$
  $$\text{Estimated Weight } W = V \times \rho_{\text{category}}$$
  Where bulk density $\rho_{\text{bio}} = 450\text{ kg/m}^3$ and $\rho_{\text{non-bio}} = 180\text{ kg/m}^3$.

### B. Multi-Area Attribution Strategies
When a truck services multiple wards prior to yard arrival:
1. **Strategy 1 (Single-Area)**: Trip assigned to 1 ward $\implies 100\%$ allocated directly.
2. **Strategy 2 (Demographic Weighted)**:
   $$W_{\text{ward}} = W_{\text{trip}} \times \frac{\text{Population}_{\text{ward}}}{\sum \text{Population}}$$
3. **Strategy 3 (Calibration Regression)**:
   Solves $\text{Trip Quantity} = \sum (\text{Ward Indicator} \times \text{Ward Rate})$ over historical multi-ward trips using regularized least-squares regression.

### C. Smart Collection Scheduling Algorithm
- Inputs: Ward accumulation rates ($\text{kg/day}$), area class (HIGH/MED/LOW), truck payload limit ($2500\text{ kg}$), and public-health constraints.
- **Public-Health Max-Gap Rule**:
  - Biodegradable / food waste: Maximum 2 days between collections ($\le 48\text{ hours}$).
  - Non-biodegradable recyclables: Maximum 3 days between collections ($\le 72\text{ hours}$).
- **Spike Detection**: Computes daily $z$-score against 60-day moving average. If $z \ge 2.0$ or ratio $\ge 1.6$, triggers `SPIKE_DETECTED` alert and adds an immediate extra collection day.

### D. Capacitated Vehicle Routing Problem (CVRP)
- Solves daily vehicle tours for scheduled wards.
- Starts at Coimbatore Central Depot ($10.9990^\circ\text{ N}, 76.9610^\circ\text{ E}$), visits assigned stops without exceeding truck payload, and terminates at Central Waste Yard ($10.9920^\circ\text{ N}, 76.9550^\circ\text{ E}$).
- Road distance: $\text{Road Km} = \text{Haversine Km} \times 1.3$.
- 2-Opt local search untangles crossing routes.
- Computes baseline savings against daily fixed routing visiting all 9 wards.

---

## 3. Database Schema

1. `areas`: `(id PK, name, code, lat, lng, population, households, waste_category, base_rate_kg_day, current_class, last_collected_at)`
2. `trucks`: `(id PK, plate_number, driver_name, capacity_kg, capacity_m3, fuel_consumption_l_km, status)`
3. `trips`: `(id PK, truck_id FK, driver_name, waste_category, status, attribution_strategy, notes, dispatched_at, completed_at)`
4. `trip_areas`: `(id PK, trip_id FK, area_id FK, stop_order, weight_ratio)`
5. `truck_visits`: `(id PK, truck_id FK, trip_id FK, device_id, arrived_at, departed_at, dwell_s, raw_distance_cm, est_volume_m3, est_quantity_kg, quantity_source)`
6. `area_quantities`: `(id PK, trip_id FK, visit_id FK, area_id FK, recorded_date, waste_category, quantity_kg, attribution_method, confidence, is_simulated)`
7. `sensor_readings`: `(id PK, device_id, distance_cm, raw_distance_cm, is_truck_present, dwell_s, event, timestamp)`
8. `device_status`: `(device_id PK, last_seen_at, ip_address, rssi, uptime_s, status, firmware_version)`
9. `schedules`: `(id PK, week_start_date, mode, created_at)`
10. `schedule_items`: `(id PK, schedule_id FK, area_id FK, day_of_week, is_extra, reason)`
11. `route_plans`: `(id PK, plan_date, baseline_km, baseline_trips, baseline_stops, optimised_km, optimised_trips, optimised_stops, km_saved, fuel_saved_l, co2_saved_kg, routes_json)`
12. `alerts`: `(id PK, alert_type, area_id FK, message, severity, is_resolved, created_at)`
13. `settings`: `(key PK, value, description, updated_at)`

---

## 4. REST API Endpoints Summary

- `GET /api/health`: Healthcheck & version
- `POST /api/device/readings`: Yard node telemetry ingestion (API key protected)
- `GET /api/demo/ecoroute-records`: Read-only access to the two supplied EcoRoute example records (always marked simulated)
- `GET /api/yard/status`: Live yard sensor state, presence, and today's total intake
- `GET /api/yard/visits`: Historical log of truck arrivals with dwell times & estimated quantities
- `GET, POST, PUT /api/areas`: Municipal wards CRUD
- `GET, POST, PUT /api/trucks`: Collection vehicle fleet CRUD
- `GET, POST /api/dispatch/trips`: Driver trip logging and completion
- `GET /api/analytics/areas`, `/trends`, `/categories`: Historical generation trends & breakdowns
- `POST /api/classify/run`: Triggers classification run (High/Medium/Low)
- `POST /api/schedule/generate`, `GET /api/schedule`: Smart weekly schedule generation & query
- `POST /api/routes/optimise`, `GET /api/routes`: CVRP route solving & savings calculation
- `GET, POST /api/alerts`: Active alerts & resolution
- `GET /api/reports/summary`, `/export.csv`: Savings report & CSV manifest download
- `GET, PUT /api/settings`: Configuration parameters
- `POST /api/simulate/seed`, `/reading`, `/truck-event`, `/reset`: Simulation triggers
