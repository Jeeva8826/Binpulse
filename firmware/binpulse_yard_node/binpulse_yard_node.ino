/**
 * BinPulse Central Yard Entrance Telemetry Node
 * Project: INFINIX'26 Smart Waste Collection Network (SDG 11)
 *
 * Board: ESP32-S3 Dev Module or ESP32
 * Sensor: HC-SR04 Ultrasonic Sensor mounted at yard entrance
 * Role: Non-contact presence detection, dwell timing, and load estimation
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_task_wdt.h>
#include "config.h"

// Watchdog timeout in seconds
#define WDT_TIMEOUT_SECONDS 10

// Speed of sound in cm/us adjusted for ambient temperature
// v = (331.3 + 0.606 * T) m/s = (331.3 + 0.606 * T) * 0.0001 cm/us
const float SPEED_OF_SOUND_CM_US = (331.3 + 0.606 * AMBIENT_TEMP_C) * 0.0001;

// Ring buffer entry for offline storage
struct TelemetryRecord {
  float distanceCm;
  long timestampSec;
};

TelemetryRecord offlineBuffer[OFFLINE_BUFFER_CAPACITY];
int bufferHead = 0;
int bufferCount = 0;

// State Machine Variables
bool isTruckPresent = false;
int consecutivePresentCount = 0;
int consecutiveAbsentCount = 0;
unsigned long arrivalTimestamp = 0;
unsigned long lastSendMillis = 0;

// =============================================================================
// ULTRASONIC SENSOR FILTERING
// =============================================================================

// Single ultrasonic pulse measurement with timeout (30,000 us = ~5m max distance)
float readDistanceOnce() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long pulseDurationUs = pulseIn(ECHO_PIN, HIGH, 30000);
  if (pulseDurationUs == 0) {
    return -1.0; // Out of range or echo lost
  }

  // Distance in cm = (time * speed) / 2
  float distanceCm = (pulseDurationUs * SPEED_OF_SOUND_CM_US) / 2.0;

  // HC-SR04 valid measurement range: 2 cm to 400 cm
  if (distanceCm < 2.0 || distanceCm > 400.0) {
    return -1.0;
  }
  return distanceCm;
}

// Median-of-7 filter to reject spurious reflections, dust, and electrical noise
float readFilteredDistance() {
  const int NUM_SAMPLES = 7;
  float samples[NUM_SAMPLES];
  int validCount = 0;

  for (int i = 0; i < NUM_SAMPLES; i++) {
    float dist = readDistanceOnce();
    if (dist > 0) {
      samples[validCount++] = dist;
    }
    delay(25);
  }

  if (validCount < 3) {
    return -1.0; // Inconclusive reading
  }

  // Sort valid samples (bubble sort for small N)
  for (int i = 0; i < validCount - 1; i++) {
    for (int j = i + 1; j < validCount; j++) {
      if (samples[j] < samples[i]) {
        float temp = samples[i];
        samples[i] = samples[j];
        samples[j] = temp;
      }
    }
  }

  // Return median
  return samples[validCount / 2];
}

// =============================================================================
// WI-FI & HTTP TELEMETRY TRANSMISSION
// =============================================================================

void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WiFi] Connecting to '");
  Serial.print(WIFI_SSID);
  Serial.print("'");

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start < 15000)) {
    delay(400);
    Serial.print(".");
    if (STATUS_LED_PIN >= 0) {
      digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN)); // Flash LED during connect
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    if (STATUS_LED_PIN >= 0) digitalWrite(STATUS_LED_PIN, HIGH);
  } else {
    Serial.println("\n[WiFi] Failed to connect, will buffer telemetry offline.");
    if (STATUS_LED_PIN >= 0) digitalWrite(STATUS_LED_PIN, LOW);
  }
}

// Send HTTP POST telemetry to BinPulse backend
bool postTelemetry(float distanceCm, const char* event = "ping", int dwellS = 0) {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
    if (WiFi.status() != WL_CONNECTED) return false;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  // Construct JSON payload
  String body = "{";
  body += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  body += "\"distance_cm\":" + String(distanceCm, 1) + ",";
  body += "\"raw_distance_cm\":" + String(distanceCm, 1) + ",";
  body += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  body += "\"uptime_s\":" + String(millis() / 1000) + ",";
  body += "\"dwell_s\":" + String(dwellS) + ",";
  body += "\"event\":\"" + String(event) + "\"";
  body += "}";

  int httpCode = http.POST(body);
  bool success = (httpCode >= 200 && httpCode < 300);

  if (success) {
    Serial.println("[HTTP 200] Telemetry sent: " + String(distanceCm, 1) + " cm (" + String(event) + ")");
  } else {
    Serial.println("[HTTP ERROR " + String(httpCode) + "] Failed to send payload");
  }

  http.end();
  return success;
}

// Store reading into ring buffer if server is unreachable
void bufferOffline(float distanceCm) {
  offlineBuffer[bufferHead].distanceCm = distanceCm;
  offlineBuffer[bufferHead].timestampSec = millis() / 1000;
  bufferHead = (bufferHead + 1) % OFFLINE_BUFFER_CAPACITY;
  if (bufferCount < OFFLINE_BUFFER_CAPACITY) bufferCount++;
  Serial.println("[BUFFER] Stored offline reading. Buffered count: " + String(bufferCount));
}

// Flush ring buffer when connection returns
void flushOfflineBuffer() {
  if (bufferCount == 0 || WiFi.status() != WL_CONNECTED) return;

  Serial.println("[BUFFER] Flushing " + String(bufferCount) + " offline records...");
  int startIndex = (bufferHead - bufferCount + OFFLINE_BUFFER_CAPACITY) % OFFLINE_BUFFER_CAPACITY;
  int sentCount = 0;

  for (int i = 0; i < bufferCount; i++) {
    int idx = (startIndex + i) % OFFLINE_BUFFER_CAPACITY;
    if (!postTelemetry(offlineBuffer[idx].distanceCm, "buffered_flush")) {
      break; // Keep this and later records queued for the next successful connection.
    }
    sentCount++;
    delay(50);
  }
  bufferCount -= sentCount;
  if (bufferCount > 0) {
    Serial.println("[BUFFER] Retained " + String(bufferCount) + " records after interrupted flush.");
  }
}

// =============================================================================
// SETUP & MAIN LOOP
// =============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("  BinPulse Central Yard Entrance Telemetry Node v" + String(FIRMWARE_VER));
  Serial.println("  SDG 11: Sustainable Waste Collection Network");
  Serial.println("=======================================================");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  if (STATUS_LED_PIN >= 0) pinMode(STATUS_LED_PIN, OUTPUT);

  // Initial sensor pin stabilization
  digitalWrite(TRIG_PIN, LOW);

  connectToWiFi();

  // Watchdog initialization for unattended 24/7 reliability
#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT_SECONDS * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config);
#else
  esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
#endif
  esp_task_wdt_add(NULL);
}

void loop() {
  // Feed hardware watchdog timer
  esp_task_wdt_reset();

  // Read filtered ultrasonic distance
  float distanceCm = readFilteredDistance();

  if (distanceCm < 0) {
    Serial.println("[SENSOR WARNING] Out of range or no echo. Check alignment & voltage divider.");
    delay(500);
    return;
  }

  unsigned long now = millis();

  // State Machine: Debounced Presence Detection (Hysteresis)
  bool isCurrentlyBelowThreshold = (distanceCm <= TRUCK_PRESENT_THRESHOLD_CM);
  const char* eventType = "ping";
  int dwellS = 0;

  if (isCurrentlyBelowThreshold) {
    consecutivePresentCount++;
    consecutiveAbsentCount = 0;

    if (!isTruckPresent && consecutivePresentCount >= DEBOUNCE_CONSECUTIVE_SAMPLES) {
      isTruckPresent = true;
      arrivalTimestamp = now;
      eventType = "arrival";
      Serial.println("\n>>> [EVENT] Truck Arrived at Yard Entrance! (Distance: " + String(distanceCm, 1) + " cm) <<<");
    }
  } else {
    consecutiveAbsentCount++;
    consecutivePresentCount = 0;

    if (isTruckPresent && consecutiveAbsentCount >= DEBOUNCE_CONSECUTIVE_SAMPLES) {
      isTruckPresent = false;
      dwellS = (now - arrivalTimestamp) / 1000;
      eventType = "departure";
      Serial.println("\n<<< [EVENT] Truck Departed Yard! Total Dwell: " + String(dwellS) + " seconds >>>\n");
    }
  }

  // Calculate dwell time if truck is currently stationed
  if (isTruckPresent) {
    dwellS = (now - arrivalTimestamp) / 1000;
  }

  // Send periodic telemetry or immediate state change events
  if ((now - lastSendMillis >= SEND_INTERVAL_MS) || strcmp(eventType, "arrival") == 0 || strcmp(eventType, "departure") == 0) {
    lastSendMillis = now;

    bool sent = postTelemetry(distanceCm, eventType, dwellS);
    if (!sent) {
      bufferOffline(distanceCm);
    } else {
      flushOfflineBuffer();
    }
  }

  delay(200);
}
