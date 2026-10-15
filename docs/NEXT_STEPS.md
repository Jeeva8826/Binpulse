# Step-by-Step Hardware Setup & Demonstration Guide (docs/NEXT_STEPS.md)

Follow these numbered steps to connect your physical ESP32 and ultrasonic sensor to the consolidated application:

---

## Step 1: Procure the Ultrasonic Sensor (if not in inventory)
- Check your kit for an **HC-SR04** (4-pin: VCC, TRIG, ECHO, GND) or a **JSN-SR04T** (waterproof variant).
- If neither is available, borrow or buy one from an electronics store or lab (cost is ₹70–₹120).

---

## Step 2: Wire the Hardware Circuit
Using jumper wires and a breadboard, connect the sensor to your **ESP32-S3 (Illuminen DEV V1.1)**:

1. **VCC** $\to$ Connect to **VIN** (5V) on the ESP32 board.
2. **GND** $\to$ Connect to **GND** on the ESP32 board.
3. **TRIG** $\to$ Connect directly to **TX pin on J1 header** (**GPIO 43**).
4. **ECHO** $\to$ **Connect via Voltage Divider**:
   - Run a jumper wire from sensor **ECHO** to one side of a **1.0 kΩ resistor**.
   - Connect the other side of the 1.0 kΩ resistor to the **RX pin on J1 header** (**GPIO 44**).
   - From that same RX pin connection, attach a **2.0 kΩ resistor** (or two 1 kΩ in series) going to **GND**.
   *(This ensures the 5V echo pulse from the sensor is safely stepped down to 3.3V, protecting your ESP32-S3).*

---

## Step 3: Find Your Laptop's IP Address
1. Open PowerShell or Command Prompt on your Windows laptop.
2. Type:
   ```powershell
   ipconfig
   ```
3. Look for your active Wi-Fi / Hotspot adapter (e.g. `10.81.221.165` or `192.168.x.x`).
4. Note down this IPv4 address.

---

## Step 4: Configure the Firmware
1. Open the file `firmware/binpulse_yard_node/config.h` in any text editor or Arduino IDE.
2. Set your 2.4 GHz Wi-Fi credentials and computer's current Wi-Fi IPv4 address:
   ```cpp
   const char* WIFI_SSID     = "Your_Hotspot_Name";
   const char* WIFI_PASS     = "Your_Hotspot_Password";
   const char* SERVER_URL    = "http://YOUR_COMPUTER_LAN_IP:5000/api/device/readings";
   const char* DEVICE_API_KEY = "binpulse_secret_key_2026";
   ```
3. Keep the dashboard browser at `http://localhost:3000`. The ESP32 is a separate device, so its URL must use your computer's LAN IP and port 5000, not `localhost`.
4. Save the file and upload the sketch again after changing the Wi-Fi or server URL.

---

## Step 5: Flash the ESP32-S3 Board
1. Open **Arduino IDE 2.x**.
2. Open `firmware/binpulse_yard_node/binpulse_yard_node.ino`.
3. In the top toolbar, select:
   - **Board**: `ESP32S3 Dev Module` (choose the ESP32-S3 variant, not `ESP32 Dev Module`)
   - **Port**: `COM11` (or whichever COM port your board mounts as)
4. Under **Tools** menu, ensure:
   - **USB CDC On Boot**: `Enabled`
   - **Flash Size**: `4MB` (or `8MB`)
   - **Upload Speed**: `921600`
5. Click **Upload** ($\to$).
   - If the upload reports `This chip is ESP32-S3, not ESP32`, the selected board is the classic ESP32. Change it to **ESP32S3 Dev Module** and upload again.
6. Once uploaded, open the **Serial Monitor** at **115200 baud**.
7. Confirm the terminal prints:
   `[WiFi] Connected! IP: 10.81.221.xxx`
   `[HTTP 200] Telemetry sent: xx.x cm (ping)`
8. If HTTP fails, confirm both devices use the same Wi-Fi network, the backend is running, and Windows Firewall allows Node.js on the private network.

---

## Step 6: Start the Software Application
1. Open a terminal in the project root directory `BINPULSE PROJECT`.
2. Run:
   ```bash
   npm run dev
   ```
3. Both backend (port 5000) and frontend (port 3000) will launch concurrently.
4. Open your browser to: **http://localhost:3000**

---

## Step 7: Verify Live Physical Readings
1. On the dashboard, switch the top banner toggle from **Simulation** to **Hardware (ESP32)**.
2. Navigate to the **Yard Entrance Node** tab.
3. Move your hand or a flat notebook in front of the ultrasonic sensor (10 cm to 50 cm away).
4. Watch the gauge update in real-time over WebSocket!
5. Hold your hand under the sensor for 6 seconds: observe the status switch to **TRUCK PRESENT** and the dwell timer begin counting.
6. Pull your hand away: watch the dwell timer finalize, calculate estimated waste volume & weight, and record a new entry in the **Truck Visit Event Log**!

Hardware mode filters out simulator readings, disables simulation test controls, and displays the most recent physical reading and event. Switch back to Simulation to use the manual test controls.
