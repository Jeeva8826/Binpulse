# BinPulse / EcoRoute: Review-2 Hackathon Pitch Package (docs/HACKATHON_PITCH.md)

**INFINIX'26 Hackathon | Problem SC-02: Smart Waste Collection Network | SDG 11: Sustainable Cities**

---

## 1. Refined Problem Statement
Municipalities in fast-growing urban hubs like Coimbatore struggle with inefficient waste collection logistics. 
Traditional approaches fall into two flawed extremes:
1. **Static Blind Routes**: Trucks visit every street daily regardless of accumulation, consuming thousands of liters of excess diesel and producing avoidable carbon emissions.
2. **Fragile Per-Bin IoT Monitoring**: Placing an ultrasonic sensor and cellular modem in every public dustbin costs millions in capital, suffers high battery maintenance overhead, and inevitably collapses due to sensor theft, vandalism, and harsh street conditions.

**BinPulse / EcoRoute resolves this paradox**: instead of monitoring thousands of public dustbins, we monitor incoming waste at a **single secured collection yard**, learn ward accumulation rates from historical data, and optimize collection schedules before routing vehicles.

---

## 2. How We Responded to the Judges (Review-2 Pivot)
> *"In Review 1, the judges rightly objected that putting an IoT sensor in every public dustbin is cost-prohibitive, unoriginal, and vulnerable to street vandalism. They challenged us to monitor centrally at processing yards, separate bio from non-bio waste, and predict which areas need collection on which days. 
> We took this feedback to heart. We pivoted the entire architecture: we completely eliminated per-bin sensors, established a single non-contact ultrasonic arrival node at the Coimbatore Central Yard, built a data-driven scheduling engine respecting public-health rules, and created multi-area attribution algorithms to handle trucks serving multiple wards. We do not pretend our ultrasonic sensor measures weight directly—we use physics-based volume-density estimation, label all calculated weights as estimates, and deliver an explainable, tamper-proof municipal operations dashboard."*

---

## 3. The Innovation Story (Core Differentiators)

1. **Tamper-Resistant & 98% Cheaper**:
   - Rather than deploying 500 sensors across street corners where they can be stolen or damaged, BinPulse deploys **one single node** inside the guarded municipal processing facility.
2. **Schedule Optimisation Before Route Optimisation**:
   - Moving from *"which bins are full right now"* to *"which municipal wards need clearance today based on empirical accumulation and public health deadlines"*.
3. **Multi-Area Ward Attribution**:
   - Real-world collection trucks visit multiple wards before reaching the yard. BinPulse provides 3 selectable attribution strategies (single-ward dispatch, demographic weighting, and least-squares regression) so waste quantities are correctly mapped back to their generating zones.
4. **Radical Engineering Honesty**:
   - No fabricated weighing-bridge data. Ultrasonic readings provide bed fill height, which is converted to volume and density-adjusted weight, clearly tagged as `quantity_source: "ultrasonic_estimate"` across all APIs and screens.

---

## 4. Cost Comparison Formula

$$\text{Per-Bin Model Cost} = N_{\text{bins}} \times (\text{Sensor} + \text{Battery} + \text{Cellular SIM} + \text{Theft Replacement Factor})$$
For Coimbatore Zone 3 ($\sim 500$ collection points):
$$500 \text{ bins} \times ₹1,800/\text{bin} = ₹9,00,000 \text{ Capital Cost} + ₹30,000/\text{month ongoing SIM/battery fees.}$$

$$\text{BinPulse Centralised Yard Node Cost} = 1 \times \text{ESP32} + 1 \times \text{Sensor} + \text{Wi-Fi Yard Link} \approx ₹1,200 \text{ Total!}$$
**Result**: Over **99% capital cost reduction** with zero public vandalism surface.

---

## 5. Expected Environmental & Operational Impact
Based on 60-day historical simulation across 9 Coimbatore wards:
- **Travel Distance Saved**: $14.8\text{ km}$ per operating cycle ($60\%$ reduction vs. static baseline visiting all 9 wards).
- **Trips Avoided**: 2 redundant vehicle dispatches eliminated daily.
- **Fuel Saved**: $\sim 5.2\text{ litres}$ of diesel saved per day ($1,898\text{ L/year}$).
- **Carbon Abatement**: $\sim 13.9\text{ kg CO}_2$ daily emission reduction ($5.07\text{ metric tonnes CO}_2/\text{year}$).
*(All figures clearly designated as statistical estimates at 0.35 L/km fleet diesel rate).*

---

## 6. 5-Minute Demo Presentation Script

- **[0:00 - 0:45] The Hook & Judge Response**:
  - Remind judges of Review 1 feedback. Show the "Legacy Bins" tab for 10 seconds: *"Here is our old per-bin model. We listened to you: it's too expensive and fragile. Today, we present the consolidated Review-2 Centralised Yard System."*
- **[0:45 - 1:45] Live Yard Entrance Hardware**:
  - Switch to **Yard Entrance Node** tab.
  - Show the real-time distance gauge. Point to the physical ESP32 on the desk (or move an object toward the sensor).
  - Watch distance drop below 180 cm: state transitions from IDLE to **TRUCK PRESENT**, dwell timer counts in real-time.
  - Move object away: debounces departure, logs visit, calculates estimated volume ($m^3$) and weight ($kg$) based on bio-waste density ($450\text{ kg/m}^3$).
- **[1:45 - 2:45] Data-Driven Smart Scheduling**:
  - Switch to **Smart Schedule** tab.
  - Show the 7-day grid (Area $\times$ Day). Point out that Area A (high bio) is collected 4x/week with a max-gap of 2 days, while Area C is collected 2x/week.
  - Click on a cell to reveal the algorithmic justification tooltip. Point out: *"Nothing is hardcoded; this schedule is generated dynamically from accumulation rates and public health constraints."*
- **[2:45 - 3:45] CVRP Route Optimisation & Map**:
  - Switch to **Route Planning** tab.
  - Show the Leaflet map with Coimbatore Depot ($10.999^\circ\text{ N}$), Central Yard ($10.992^\circ\text{ N}$), and ordered ward stops.
  - Move the truck capacity slider or change the weekday selector: watch routes recalculate instantaneously with 2-opt tour improvement.
  - Show the KPI card: **14.8 km saved**, **5.2 L diesel saved**, **13.9 kg CO₂ prevented**.
- **[3:45 - 4:30] Driver Dispatch & Multi-Ward Attribution**:
  - Switch to **Driver Dispatch** tab.
  - Explain how a multi-ward trip is attributed back to wards using demographic weights or calibration regression so the model refines its knowledge.
- **[4:30 - 5:00] Conclusion & Call to Action**:
  - Reiterate: *"Runnable today with a single command on Windows, zero weighing-bridge fiction, production-ready firmware, and over 99% cost savings for Coimbatore Corporation."*

---

## 7. Judge Q&A: Strong Answers to Likely Questions

### Q1: "Can an ultrasonic sensor measure weight?"
> **Answer**: *"No, and that is why we do not claim it does. An ultrasonic sensor measures distance. Mounted overhead, it measures the surface level of waste in the truck bed. We convert that height into volume ($m^3$) and estimate weight using standard bulk density constants ($450\text{ kg/m}^3$ for wet bio-waste, $180\text{ kg/m}^3$ for dry recyclables). Every single number in our database and UI is explicitly labeled as 'Estimated Weight', never measured mass."*

### Q2: "How do you know which area the waste came from if the truck visits multiple wards?"
> **Answer**: *"A sensor cannot read minds or GPS tracks from distance alone. That is why we built a lightweight Driver Dispatch console where the driver logs assigned wards upon departure. For multi-ward trips, our backend provides three selectable attribution strategies: single-ward priority, demographic population weighting, and historical least-squares regression solving ward generation rates over time."*

### Q3: "Is the Machine Learning real, or just simple rules?"
> **Answer**: *"We follow the engineering principle of starting simple: rule-based percentile classification, moving averages, and z-score spike detection. We built an optional light ML module (exponential smoothing and linear trend fitting) that only activates when 4 or more weeks of history exist. If insufficient data exists, the dashboard explicitly reports 'Rule-based mode — insufficient history for ML'. We refuse to claim fake deep learning where statistics suffice."*

### Q4: "What if an ultrasonic sensor is blinded by dust or outdoor rain?"
> **Answer**: *"Our firmware implements a median-of-7 acoustic filter that rejects transient spikes and noise. For outdoor yard gates exposed to monsoon rain and diesel soot, our architecture specifies the sealed, waterproof JSN-SR04T transducer rather than bare indoor sensors. The firmware also features Wi-Fi auto-reconnect, local ring buffering during network outages, and a hardware watchdog timer."*

---

## 8. Future Roadmap
1. **ANPR (Automatic Number Plate Recognition)**: Optical camera at yard gate to auto-identify truck plate and pull the active trip dispatch without driver manual selection.
2. **Dual-Frequency Ultrasonic / LiDAR**: Multi-point overhead grid scan to map irregular waste heaps more accurately than single-point ultrasonic.
3. **Municipal ERP Integration**: Seamless export to Coimbatore City Municipal Corporation (CCMC) sanitation portals.
