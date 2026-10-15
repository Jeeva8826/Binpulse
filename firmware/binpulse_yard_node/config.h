/**
 * BinPulse Central Yard Entrance Node - Configuration Header
 * Board: ESP32-S3 Dev Module (Illuminen ESP DEV V1.1) or standard ESP32 Dev Module
 * Sensor: HC-SR04 Ultrasonic Sensor (or JSN-SR04T waterproof module)
 */

#ifndef BINPULSE_CONFIG_H
#define BINPULSE_CONFIG_H

// =============================================================================
// 1. NETWORK & BACKEND CONNECTION (EDIT THESE FOR YOUR LAPTOP / HOTSPOT)
// =============================================================================
const char* WIFI_SSID     = "YOUR_2_4_GHZ_WIFI_NAME";
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";

// Server URL: Laptop IP on WiFi (verified via ipconfig)
// Port 5000 is the BinPulse consolidated Express backend
const char* SERVER_URL    = "http://YOUR_COMPUTER_LAN_IP:5000/api/device/readings";

// Device Security API Key (matches DEVICE_API_KEY in backend .env)
const char* DEVICE_API_KEY = "binpulse_secret_key_2026";
const char* DEVICE_ID      = "ESP32_YARD_01";
const char* FIRMWARE_VER   = "2.0.0";

// =============================================================================
// 2. PIN CONFIGURATION (ESP32-S3 Illuminen Dev Board or Standard ESP32)
// =============================================================================
// ESP32-S3 Default: J1 Header TX = GPIO 43, RX = GPIO 44
// Standard ESP32 Default: TRIG = GPIO 5, ECHO = GPIO 18
#if CONFIG_IDF_TARGET_ESP32S3
  const int TRIG_PIN = 43; // Trigger pulse output
  const int ECHO_PIN = 44; // Echo pulse input (via 1k/2k divider if sensor on 5V!)
  const int STATUS_LED_PIN = 2; // Onboard LED or external indicator (-1 = none)
#else
  const int TRIG_PIN = 5;  // Standard ESP32 Trigger
  const int ECHO_PIN = 18; // Standard ESP32 Echo (via 1k/2k divider!)
  const int STATUS_LED_PIN = 2;
#endif

// =============================================================================
// 3. PHYSICAL CALIBRATION & TIMING THRESHOLDS
// =============================================================================
// Sensor height from ground / empty driveway level in cm
const float SENSOR_MOUNT_HEIGHT_CM     = 250.0;

// Threshold below which truck presence is detected (overhead to truck roof/bed)
const float TRUCK_PRESENT_THRESHOLD_CM = 180.0;

// Empty truck bed level from sensor in cm
const float TRUCK_BED_EMPTY_DISTANCE_CM = 180.0;

// Number of consecutive samples required to confirm arrival or departure (hysteresis)
const int DEBOUNCE_CONSECUTIVE_SAMPLES = 3;

// Telemetry transmit interval in milliseconds
const unsigned long SEND_INTERVAL_MS   = 2000;

// Offline Ring Buffer Capacity (stores readings during temporary Wi-Fi drops)
const int OFFLINE_BUFFER_CAPACITY      = 50;

// Ambient temperature for speed of sound compensation (Speed = 331.3 + 0.606 * T)
const float AMBIENT_TEMP_C             = 28.0;

#endif // BINPULSE_CONFIG_H
