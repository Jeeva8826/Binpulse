# Live Arduino Uno Bin Monitor

This path sends real HC-SR04 readings from an Arduino Uno to the BIN01 card in the BinPulse dashboard. Arduino Uno has no Wi-Fi by itself, so the computer reads JSON over USB serial and forwards it to the local dashboard backend.

## Wiring

| HC-SR04 | Arduino Uno |
|---|---|
| VCC | 5V |
| GND | GND |
| TRIG | D7 |
| ECHO | D8 |

The Uno inputs are 5V tolerant, so the HC-SR04 ECHO line can connect directly to D8. Do not use the ESP32 wiring/pin numbers for this sketch.

## Start the dashboard and connect the board

1. In the project folder run `npm run dev`. The React dashboard uses **http://localhost:3000** and the backend uses **port 5000**.
2. Open `firmware/binpulse_bin_node/binpulse_bin_node.ino` in Arduino IDE. Select **Arduino Uno** and the port shown for the board (this setup is **COM12**), then upload.
3. The sketch streams one JSON line every two seconds at **115200 baud**. Configure the bin measurements and `EMPTY_DISTANCE_CM` / `FULL_DISTANCE_CM` in `config.h` to match the installed sensor.
4. Close Arduino IDE Serial Monitor after checking the sketch. Only one program can own COM12 at a time; BinPulse needs it open to receive live data.
5. Open the dashboard's **Arduino Bin Monitor** page. BIN01 shows the live fill, distance, and estimated volume. The other named cards are sample values.

The backend defaults to `ARDUINO_SERIAL_PORT=COM12` and `ARDUINO_BAUD_RATE=115200`; override either in `.env` if Windows assigns a different port. It stores each BIN01 sample in SQLite and restores the latest reading after a backend restart. The simulation seed and historical ward analytics remain separate from this physical feed.

## Troubleshooting

- **Waiting for Arduino:** confirm the Uno is connected to the configured COM port, close Serial Monitor, then restart the backend. The backend will retry opening the port every five seconds.
- **No readings:** check that the board runs the `binpulse_bin_node` sketch at 115200 baud and that HC-SR04 uses D7/D8 with common ground.
- **Fill level looks wrong:** measure the sensor-to-bin-bottom distance and calibrate the empty/full distances in `config.h`; estimated volume assumes a level waste surface.
