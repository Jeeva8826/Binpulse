# BinPulse Technical Limitations & Honest Disclosures (docs/LIMITATIONS.md)

Engineering integrity requires stating plainly what a system can and cannot do. 
The following limitations are intrinsic to the physical setup, sensor model, and algorithmic design:

---

## 1. Single Ultrasonic Sensor Physics Limitations
1. **Distance Only, Not Mass**: An ultrasonic sensor measures acoustic time-of-flight. It has zero capability to measure gravitational mass or density. All weight values displayed on the dashboard are derived estimates based on assumed bulk densities ($450\text{ kg/m}^3$ bio, $180\text{ kg/m}^3$ non-bio).
2. **Uneven Load Surface**: Waste in an open truck bed settles in irregular heaps. A single overhead beam samples the distance to one central acoustic reflection point. If the load is piled unevenly or concaved, volume estimation will have a ±15% to 25% margin of error. (A future upgrade would employ a multi-sensor scanning bar or LiDAR).
3. **No Vehicle Identification**: A distance sensor cannot distinguish Truck A from Truck B. Vehicle plate identity and ward coverage must be selected via the Driver Dispatch console or future ANPR cameras.
4. **Speed of Sound Temperature Drift**: Speed of sound in air varies by $\sim 0.6\text{ m/s per }^\circ\text{C}$. While the firmware includes temperature adjustment, uncalibrated seasonal swings (e.g., 20°C winter morning to 38°C summer afternoon) cause a ±3% distance drift unless an ambient thermistor (like a DHT22 or DS18B20) is connected.

---

## 2. Multi-Area Attribution Constraints
1. **Statistical Pro-Rata vs. True Ward Fractions**: In multi-ward collection runs, demographic weighting assumes generation is strictly proportional to population and households. In reality, commercial strips or wedding halls can skew a single ward's output on any given day.
2. **Regression Sample Requirements**: Strategy 3 (least-squares calibration) requires at least 3 historical multi-ward combinations per area to avoid collinearity and rank deficiency. Below this threshold, the system automatically falls back to demographic weighting.

---

## 3. Route Routing & GIS Approximations
1. **Road Factor Heuristic**: Distance computations use Great-Circle Haversine multiplied by a Coimbatore empirical road tortuosity factor ($1.3\times$). While accurate for aggregate fuel and kilometer savings estimates, it does not account for one-way street restrictions, peak hour traffic congestion, or railway gate delays.
2. **Offline Fallback**: Turn-by-turn road networks (OSRM / OpenRouteService) require internet connectivity; when offline, the system safely falls back to Euclidean road-factor CVRP routing.

---

## 4. Synthetic & Seed Data Distinction
1. **Demonstration Dataset**: The 60-day historical dataset and live emulator generate plausible, statistically realistic waste accumulation with weekend surges and tech-corridor festival spikes. However, they are synthetic data designed to prove the analytical and scheduling pipeline, not real Coimbatore municipal weigh-ins.
2. **Clear Labeling**: All generated records carry `is_simulated = 1` in the database to prevent confusion during field trials.
