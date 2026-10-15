# BinPulse System Evolution & Review-2 Change Log (docs/CHANGES.md)

## 1. Initial State Assessment (What Was Working / Broken / Missing / Conflicting)

Prior to this consolidation, the project existed in three disparate folders:

| Component | Initial Status | Issue / Defect | Remediation & Consolidation |
|---|---|---|---|
| `Bin_Pulze_UI` | **Working (Visuals) / Broken (Wiring)** | High quality Tailwind CSS dashboard mockup, but entirely static HTML. Contained zero `fetch` or WebSocket logic, hardcoded telemetry (18.4 km baseline, 14 bins), and non-functional navigation. | Re-engineered into a reactive Vite + React single-page application retaining the visual theme, Material Symbols, and color palette. Wired all buttons, KPI cards, Leaflet map layers, and forms to live backend APIs and WebSocket streams. |
| `Binpulse` (Django) | **Conflicting / Legacy** | Heavy Django 5 backend requiring a dedicated Python virtualenv (`myvenv`), specific Python 3.13 configuration, and separate server startup. | Replaced with a unified Node.js / Express backend with SQLite (`node:sqlite`) and WebSocket server. Zero-compiler dependencies on Windows. Legacy routes (`POST /api/reading/`, `GET /api/bins/`) preserved as compatibility wrappers. |
| `BinPulse_dropin` | **Conflicting / Obsolete Model** | Implemented per-bin regression fill tracking and bin-to-bin nearest neighbor routing. Directly conflicted with Review 2 judge feedback rejecting per-bin sensing. | Demoted per-bin monitoring to an optional, clearly labeled `LegacyBins.jsx` tab for presentation comparison. Core architecture pivoted to centralised yard entrance sensing and accumulation-rate ward scheduling. |
| Weighing Bridge Concept | **Conflicting / Disallowed** | The judges suggested central weighing bridges, but the team explicitly confirmed **no weighing bridge exists**. | Completely eliminated weighing bridge tables, endpoints, and UI references ("Gross Weight", "Tare Weight", "Net Bridge Weight"). Substituted with ultrasonic presence detection and overhead load-level volume/weight estimation. |
| Hardware Firmware | **Broken for Review 2** | `binpulse_node.ino` was written for a bin lid pointing down into garbage with hardcoded 30cm empty depth. | Re-authored as `firmware/binpulse_yard_node/binpulse_yard_node.ino` + `config.h` for yard entrance presence detection (180 cm threshold, median-of-7 filter, debounced arrival/departure state machine, offline ring buffering, API key header). |
| Simulation & Seeds | **Missing** | Only had simple random bin increments. Lacked multi-ward historical generation patterns, weekday vs weekend profiles, and spike events. | Created `simulator/seedData.js` generating 60+ days of realistic daily historical data across 9 Coimbatore wards (RS Puram, Gandhipuram, Town Hall, etc.) with surge anomalies and `simulator/index.js` emulating live ESP32 HTTP streams. |

---

## 2. Review 2 Redesign Pivot Summary

### A. Centralised Collection Yard Sensing
- Moved sensor from individual trash cans to the entrance of the Coimbatore Central Waste Processing Yard (10.9920° N, 76.9550° E).
- Single hardware node at the yard entrance serves the entire municipal zone fleet, reducing hardware unit requirements from thousands of public sensors to **one secured node**.

### B. Precise Role of the Ultrasonic Sensor
1. **Truck Presence & Dwell Timing**: Distance drops below 180 cm debounced over 3 consecutive samples (6 seconds) to confirm truck arrival. Dwell time recorded until departure.
2. **Load-Level Estimation (Overhead Mode)**: Measures waste depth in the truck bed, converting height to volume ($3.5\text{ m} \times 1.8\text{ m} \times \text{depth}$) and weight using category densities ($450\text{ kg/m}^3$ bio, $180\text{ kg/m}^3$ non-bio).
3. **Honest Labeling**: All calculated weights are explicitly stored with `quantity_source: "ultrasonic_estimate"` and labeled as estimates across dashboard cards and CSV exports.

### C. Area Attribution for Multi-Area Trips
Implemented all three selectable strategies:
- **Strategy 1 — Single-Area Dispatch (Exact)**: 100% attributed to assigned ward with confidence 1.0.
- **Strategy 2 — Weighted Allocation**: Pro-rated based on demographic ward population/households with confidence 0.75.
- **Strategy 3 — Calibration Over Time**: Least-squares ridge regression solving ward rates from multi-area trip combinations.

### D. Data-Driven Scheduling Before Route Optimisation
- Shifts from "which bins are full" to "which wards need collection on which days".
- Incorporates mandatory **public-health max-gap rules**: maximum 2 days between collections for bio/high-density wards; maximum 3 days for standard wards.
- Detects sudden accumulation spikes ($z \ge 2.0$ or $>1.6\times$ baseline) and automatically schedules extra collections.
- Capacitated VRP (CVRP) with 2-opt heuristic generates routes starting at Central Depot and ending at the Central Yard.
