# Live Arduino Uno Bin Monitor

This path sends real HC-SR04 readings from an Arduino Uno to the separate Live Sensor Dashboard. Arduino Uno has no Wi-Fi by itself, so the computer reads USB serial data and forwards it to the local dashboard backend. The current supplied sketch's human-readable output is supported at 9600 baud; the optional project JSON sketch uses 115200 baud.

## Wiring

| HC-SR04 | Arduino Uno |
|---|---|
| VCC | 5V |
| GND | GND |
| TRIG | D9 |
| ECHO | D10 |

The Uno inputs are 5V tolerant, so the HC-SR04 ECHO line can connect directly to D10. Do not use the ESP32 wiring/pin numbers for this sketch.

## Start the dashboard and connect the board

1. In the project folder run `npm run dev`. The React dashboard uses **http://localhost:3000** and the backend uses **port 5000**.
2. In Arduino IDE, select **Arduino Uno on COM12** and upload the supplied sensor sketch. It uses TRIG D9, ECHO D10, 40 cm bin height, and `Serial.begin(9600)`.
3. The sketch prints lines such as `Distance: 16.7 cm | Fill: 58%`. BinPulse parses those lines as physical BIN01 samples. The optional `firmware/binpulse_bin_node` sketch sends JSON at 115200 baud; set `ARDUINO_BAUD_RATE=115200` before using that alternative.
4. Close Arduino IDE Serial Monitor after checking the sketch. Only one program can own COM12 at a time; BinPulse needs it open to receive live data.
5. Open **Live Sensor Dashboard**. It shows only the current physical BIN01 fill and distance. The operations and simulation dashboard is separate and retains its existing demo data.

The backend defaults to `ARDUINO_SERIAL_PORT=COM12` and `ARDUINO_BAUD_RATE=9600`; override these in `.env` when using another port or the JSON firmware. It stores BIN01 samples in SQLite and broadcasts readings to the live page. The simulation seed and historical ward analytics remain separate from this physical feed.

## Troubleshooting

- **Waiting for Arduino:** confirm the Uno is connected to the configured COM port, close Serial Monitor, then restart the backend. The backend will retry opening the port every five seconds.
- **No readings:** close Arduino IDE Serial Monitor and check that COM12 is selected. For the supplied sketch, use 9600 baud; for the project's JSON sketch, use 115200 baud. Confirm HC-SR04 uses D9/D10 with common ground.
- **Fill level looks wrong:** measure the sensor-to-bin-bottom distance and calibrate the empty/full distances in `config.h`; estimated volume assumes a level waste surface.
