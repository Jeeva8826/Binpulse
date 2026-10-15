# BinPulse Hardware Wiring & Deployment Guide (docs/HARDWARE_WIRING.md)

## 1. Parts List (Bill of Materials)

| Item | Component | Specification | Quantity | Notes / Procurement |
|---|---|---|---|---|
| 1 | **Microcontroller Board** | ESP32-S3 Dev Module (`Illuminen ESP DEV V1.1`) or Standard ESP32 DevKit V1 | 1 | Team already has this board. Upload via COM11. |
| 2 | **Ultrasonic Distance Sensor** | HC-SR04 (Standard 4-pin) OR JSN-SR04T (Waterproof outdoor transducer) | 1 | **Hardware Gap**: If an HC-SR04 is not yet in inventory, buy or borrow an HC-SR04 (₹70–₹120) or JSN-SR04T (₹350–₹500 for rainproof yard mounting). |
| 3 | **Voltage Divider Resistors** | 1.0 kΩ and 2.0 kΩ (or two 1.0 kΩ in series) | 1 each | Required for ECHO line protection when powering sensor from 5V. |
| 4 | **Breadboard / Perfboard** | Mini solderless breadboard | 1 | For wiring voltage divider. |
| 5 | **Jumper Wires** | Male-to-Female & Male-to-Male | 6–8 | Dupont connection leads. |
| 6 | **Power Supply** | Micro-USB / Type-C cable + 5V 1A/2A adapter | 1 | Powers ESP32 and provides 5V VIN. |
| 7 | **Enclosure / Mount** | Weatherproof plastic junction box (IP65) | 1 (Optional) | For mounting overhead at yard entrance gantry. |

---

## 2. Wiring Pin Table

### Target Board: ESP32-S3 Dev Module (Illuminen ESP DEV V1.1)

| Sensor Pin (HC-SR04) | Board Header Pin | Board GPIO | Voltage Level | Notes |
|---|---|---|---|---|
| **VCC** | **VIN** (or 5V) | 5V Supply | 5.0 V | Powers the ultrasonic transmitter transducers. |
| **GND** | **GND** | Ground | 0 V | Common ground connection is mandatory. |
| **TRIG** | **TX** on Header J1 | **GPIO 43** | 3.3 V Output | 3.3V trigger output from ESP32 is sufficient for HC-SR04 trigger threshold (~2.5V). Direct connection. |
| **ECHO** | **RX** on Header J1 | **GPIO 44** | 3.3 V Input | **MUST GO THROUGH VOLTAGE DIVIDER!** (HC-SR04 outputs 5.0V pulses, which will damage 3.3V ESP32 GPIOs). |

*Note for Standard ESP32 DevKit boards: If using a standard ESP32 rather than an ESP32-S3, connect TRIG to **GPIO 5** and ECHO to **GPIO 18** (through the voltage divider).*

---

## 3. Voltage Divider Circuit Diagram (5V ECHO Protection)

```
        HC-SR04 (5V Sensor)                            ESP32-S3 (3.3V Safe)
     +-----------------------+                      +-----------------------+
     |                       |                      |                       |
     |         VCC ----------+--------------------> | VIN (5V Supply)       |
     |                       |                      |                       |
     |         GND ----------+---+----------------> | GND (Common Ground)   |
     |                       |   |                  |                       |
     |        TRIG ----------+---+----------------> | GPIO 43 (TX)          |
     |                       |   |                  |                       |
     |        ECHO ----------+   |                  |                       |
     +-----------------------+   |                  +-----------------------+
                 |               |                              ^
                 | (5V pulse)    |                              |
                 v               |                              |
             [ 1.0 kΩ ]          |                              |
                 |               |                              |
                 +---------------+------------------------------+ (3.3V safe pulse)
                 |
             [ 2.0 kΩ ] (or two 1k in series)
                 |
                 v
             ( GND )
```

**Voltage Divider Formula:**
$$V_{\text{out}} = V_{\text{in}} \times \frac{R_2}{R_1 + R_2} = 5.0\text{ V} \times \frac{2000}{1000 + 2000} = 3.33\text{ V}$$
This protects the ESP32 input stage while ensuring clean CMOS high logic detection ($> 2.64\text{ V}$).

---

## 4. Outdoor Deployment & Installation Guidelines

1. **Mounting Location**: Install the sensor overhead on the entrance gantry beam directly above the designated truck stopping line at the Coimbatore yard entrance.
2. **Mounting Height**: Set at **250 cm** above the pavement, pointing vertically downward.
3. **Beam Spread**: HC-SR04 has an acoustic cone angle of approximately 15°–20°. Ensure at least 60 cm lateral clearance from side pillars to avoid false echo reflections.
4. **Environmental Protection**:
   - For indoor demonstration: Standard HC-SR04 is adequate.
   - For real municipal deployment: Upgrade to waterproof **JSN-SR04T**. The transducer is sealed against rain, dust, and diesel exhaust soot.
5. **Acoustic Temperature Compensation**: Speed of sound varies with temperature ($v \approx 331.3 + 0.606 \times T^\circ\text{C}$). The firmware automatically incorporates a configurable ambient temperature parameter (default 28°C for Coimbatore).
