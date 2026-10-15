# BinPulse / EcoRoute

**BinPulse / EcoRoute** is a waste-operations dashboard and decision-support system for municipal collection teams. It combines ward-level collection planning, truck dispatch and route optimization with sensor telemetry from a central yard and an individual monitored bin.

The project is configured around Coimbatore municipal operations. It includes a React dashboard, a Node.js API, a SQLite database, a historical-data simulator, and Arduino firmware for the supported sensor nodes.

## What the system does

- Presents operational summaries, ward analytics, collection schedules, alerts, dispatches, route plans, yard visits, and downloadable manifests in one dashboard.
- Uses historical waste-generation data to produce collection plans and explain why an area is scheduled.
- Creates capacity-aware truck routes and compares optimized plans with the configured baseline.
- Supports simulated yard telemetry for software demonstrations and an Arduino Uno over USB for physical truck-presence sensing at a yard entrance.
- Retains an ESP32 Wi-Fi yard-node option and an optional Arduino Uno sketch for a single bin's BIN01 fill readings.
- Keeps simulated/demo records distinct from physical Arduino readings and clearly labels sample bin cards.
- Broadcasts updates through a WebSocket connection and stores operational and sensor data in SQLite.

## How data flows

| Data source | Purpose | Connection | Dashboard location |
|---|---|---|---|
| Seeded municipal history | Ward analytics, schedules, dispatch, and route planning | SQLite | Overview, Area Analytics, Smart Schedule, Route Planning, and reports |
| Yard simulator | Demonstrates truck arrival, dwell, and departure events | HTTP API on port 5000 | Yard Entrance Node in Simulation mode |
| Arduino Uno yard node | Reports ultrasonic distance and truck-presence events at the yard | USB serial to the backend on COM12 by default | Yard Entrance Node in Arduino Yard mode |
| ESP32 yard node | Optional Wi-Fi version of the central yard sensor | HTTP API on port 5000 | Yard Entrance Node in Arduino Yard mode |
| Arduino Uno BIN01 node | Live fill and distance for the physical sensor | USB serial to the backend | Live Sensor Dashboard |
| EcoRoute sample records | Displays supplied example records | Local API | EcoRoute Sample Data; records are marked simulated |

The yard selector controls the central-yard feed. The Arduino yard sketch reports distance over USB serial; the optional ESP32 sketch reports through Wi-Fi. The separate Live Sensor Dashboard reads the physical BIN01 sensor. The simulation and operations dashboard remains independent.

## Technology

- **Frontend:** React 18, Vite, Tailwind CSS, Leaflet
- **Backend:** Node.js 22+, Express, SQLite (`node:sqlite`), WebSocket
- **Hardware:** Arduino Uno with HC-SR04 over USB serial; optional ESP32/ESP32-S3 yard node over Wi-Fi
- **Default local ports:** dashboard `3000`, backend/API/WebSocket `5000`

## Run locally

### Requirements

- Node.js 22 or newer and npm
- Windows, macOS, or Linux for the dashboard and simulator
- Arduino IDE only when uploading firmware to a physical board

### Install, initialize, and start

From the project root:

```sh
npm install
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The development command starts the API on port `5000` and the Vite dashboard on port `3000`. Keep the terminal running while using the application; press `Ctrl+C` to stop both services.

The seed command loads a demonstration baseline with historical records for nine Coimbatore areas and a sample fleet. Running it restores the demo data; physical BIN01 sensor readings are stored separately.

### Environment configuration

Copy `.env.example` to `.env` and adjust values for the local machine when needed. The defaults are suitable for local development. Common settings include:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | Backend HTTP and WebSocket port |
| `DB_PATH` | `./backend/data/binpulse.sqlite` | SQLite database file |
| `ARDUINO_SERIAL_PORT` | `COM12` | USB serial port used by the Uno on Windows |
| `ARDUINO_BAUD_RATE` | `9600` | Serial speed used by the current Uno sketch and backend |
| `DEVICE_API_KEY` | example value in `.env.example` | API key shared with the ESP32 yard firmware |
| `VITE_API_URL` | `http://localhost:5000` | Frontend API base URL |
| `VITE_WS_URL` | `ws://localhost:5000/ws` | Frontend WebSocket URL |

Keep `.env` and real credentials local. Do not commit deployment secrets or Wi-Fi passwords.

## Live Arduino Uno yard sensor

The recommended Arduino setup for the central-yard dashboard uses the Uno as a USB-connected yard entrance node. It sends distance JSON to the backend, which runs the same presence debounce, visit tracking, SQLite persistence, and WebSocket broadcast path used by the ESP32 yard API.

### HC-SR04 wiring

| HC-SR04 pin | Arduino Uno |
|---|---|
| VCC | 5V |
| GND | GND |
| TRIG | D9 |
| ECHO | D10 |

Upload `firmware/arduino_yard_node/arduino_yard_node.ino`, set `ARDUINO_SERIAL_PORT` to the Uno's COM port (default `COM12`), start BinPulse with `npm run dev`, then close Arduino IDE Serial Monitor. Select **Arduino Yard** in the dashboard and open **Yard Entrance Node**. A truck-presence event is confirmed after three consecutive readings within the configured distance threshold.

See [docs/ARDUINO_YARD_SETUP.md](docs/ARDUINO_YARD_SETUP.md) for the full setup and troubleshooting guide.

## Optional Arduino Uno bin monitor

The Live Sensor Dashboard reads the physical BIN01 fill and distance values from the Arduino Uno over USB. It accepts the supplied human-readable `Distance: ... | Fill: ...` sketch at 9600 baud and the project's JSON sketch at 115200 baud. It shows physical readings only; the existing operations and simulation dashboard stays separate.

### HC-SR04 wiring

| HC-SR04 pin | Arduino Uno |
|---|---|
| VCC | 5V |
| GND | GND |
| TRIG | D7 |
| ECHO | D8 |

The Uno accepts the HC-SR04's 5V echo signal directly. Do not use this wiring for an ESP32. The default BIN01 setup uses a 40 cm bin height and 40 cm empty distance to match the supplied Arduino sketch. Calibrate the bin dimensions and empty/full sensor distances in `firmware/binpulse_bin_node/config.h` before interpreting fill and volume estimates.

### Upload and connect

1. Connect the Uno by USB and select **Arduino Uno** and its assigned serial port in Arduino IDE.
2. Open `firmware/binpulse_bin_node/binpulse_bin_node.ino` and upload it to the board.
3. Set `ARDUINO_SERIAL_PORT` in `.env` to the port assigned by the computer. The configured default is `COM12`.
4. Start BinPulse with `npm run dev` and close Arduino IDE Serial Monitor while BinPulse is reading the port. A serial port can be owned by only one application at a time.
5. Open **Live Sensor Dashboard**. It displays current physical BIN01 fill and distance readings. Arduino IDE Serial Monitor must be closed while BinPulse is receiving data.

Full instructions and troubleshooting are in [docs/REALTIME_BIN_SETUP.md](docs/REALTIME_BIN_SETUP.md).

## Yard entrance sensing

The yard entrance workflow is separate from the Arduino Uno bin monitor. It can run in **Simulation** mode with the included simulator or in **ESP32 Yard** mode with the Wi-Fi firmware.

- Start the software demonstration with `npm run simulate` in a second terminal while the backend is running. It sends simulated sensor events to port `5000`.
- For a physical yard node, configure Wi-Fi credentials, server address, and API key in `firmware/binpulse_yard_node/config.h`, then upload the sketch for the actual ESP32 board.
- The provided ESP32-S3 wiring uses a voltage divider on the HC-SR04 ECHO line. Do not connect a 5V echo output directly to an ESP32 input.

See [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md), [docs/HARDWARE_WIRING.md](docs/HARDWARE_WIRING.md), and [docs/HARDWARE_PROTOCOL.md](docs/HARDWARE_PROTOCOL.md) for the detailed yard-node setup and data contract.

## Project commands

| Command | Description |
|---|---|
| `npm run dev` | Start backend and frontend in development mode |
| `npm run seed` | Load the demonstration ward and fleet dataset |
| `npm run simulate` | Send simulated yard-sensor events to the backend |
| `npm test` | Run the automated software test suite |
| `npm run build` | Build the frontend into `frontend/dist` |
| `npm start` | Start the backend in production mode and serve `frontend/dist` on port `5000` |

For production mode, build the frontend first:

```sh
npm run build
npm start
```

Then open [http://localhost:5000](http://localhost:5000).

## Repository layout

```text
backend/       Express API, SQLite schema and services, serial reader, WebSocket
frontend/      React dashboard and Vite configuration
firmware/      Arduino Uno BIN01 and ESP32 yard-node sketches
simulator/     Historical-data seeder and yard telemetry simulator
docs/          User, hardware, architecture, protocol, and operations guides
tests/         Automated backend and workflow tests
```

## Operational assumptions

- Ward-level historic volumes and EcoRoute sample records are demonstration data; they are not measurements from a municipal weighing system.
- The ultrasonic bin sensor estimates fill from distance and configured bin geometry. It does not weigh waste.
- The yard entrance sensor detects presence and dwell at one fixed point. It does not provide truck GPS tracking or verified ward-by-ward weights.
- Route quality depends on the configured fleet, area coordinates, schedule, and distance data. Map tiles require an internet connection.

Additional project details are available in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/USER_GUIDE.md](docs/USER_GUIDE.md), and [docs/LIMITATIONS.md](docs/LIMITATIONS.md).
