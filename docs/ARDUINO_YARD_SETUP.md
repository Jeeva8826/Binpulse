# Arduino Uno Yard Entrance Sensor

This setup replaces the ESP32 Wi-Fi link with an Arduino Uno connected directly to the BinPulse computer over USB. The Uno sends ultrasonic distance readings to the backend over serial. The backend persists readings, detects arrival/departure with a three-sample debounce, and broadcasts live yard updates to the dashboard.

## Wiring

| HC-SR04 pin | Arduino Uno |
|---|---|
| VCC | 5V |
| GND | GND |
| TRIG | D7 |
| ECHO | D8 |

Connect all four sensor wires firmly. The sensor and Uno must share ground. HC-SR04 ECHO is 5V and can connect directly to an Uno digital input. The ESP32 requires a voltage divider; the Uno does not.

## Upload and connect

1. Connect the Uno to the computer by USB.
2. Open `firmware/arduino_yard_node/arduino_yard_node.ino` in Arduino IDE.
3. Select **Arduino Uno** and the port assigned to the board. On the development computer this is **COM12**.
4. Upload the sketch. It sends one JSON distance record about every two seconds at **115200 baud**.
5. Set `ARDUINO_SERIAL_PORT` in `.env` if the port differs from `COM12`. Because the supplied bin sketch uses 9600 baud, set `ARDUINO_BAUD_RATE=115200` when switching the Uno to this yard sketch.
6. Close Arduino IDE Serial Monitor. BinPulse and Serial Monitor cannot own the same port at once.
7. Start the app with `npm run dev`, select **Arduino Yard**, and open **Yard Entrance Node**.

The same serial reader can also accept the optional BIN01 payload from `firmware/binpulse_bin_node`. Only one sketch can be uploaded to the Uno at a time; choose the yard sketch for the central entrance workflow.

## Live data and truck detection

The dashboard receives distance readings through the existing `YARD_TELEMETRY` WebSocket event. The backend marks a reading as a sensor dropout if the distance is outside the HC-SR04 range or no echo is returned. Three consecutive readings at or below the configured `TRUCK_PRESENT_CM` setting confirm arrival; three consecutive readings above it confirm departure.

To check the sensor, point both transducers at a flat target between 2 cm and 400 cm away. The board should send numeric `distance_cm` values. Move the target across the configured truck-presence threshold to observe the yard state change. The sensor detects distance only; it does not identify vehicles or measure actual waste weight.

## Troubleshooting

- **Serial port is busy:** close Serial Monitor and other serial tools, then restart the backend.
- **Arduino is connected but shows no distance:** verify HC-SR04 power, common ground, TRIG D7, ECHO D8, and aim at a flat object in range.
- **Distance changes but truck presence does not:** adjust `TRUCK_PRESENT_CM` in `.env` or System Settings and move the target across that threshold.
- **Dashboard stays in Simulation:** select **Arduino Yard** in the top yard-feed control.
- **Port differs from COM12:** update `ARDUINO_SERIAL_PORT` in `.env` and restart BinPulse.
