/*
 * BinPulse central yard entrance sensor for Arduino Uno.
 * Sends distance telemetry over USB serial to the local BinPulse backend.
 * HC-SR04: VCC -> 5V, GND -> GND, TRIG -> D7, ECHO -> D8.
 */

const unsigned long SERIAL_BAUD_RATE = 115200;
const unsigned long SEND_INTERVAL_MS = 2000UL;
const unsigned long ECHO_TIMEOUT_US = 30000UL;
const int TRIG_PIN = 7;
const int ECHO_PIN = 8;
const char DEVICE_ID[] = "ARDUINO_YARD_01";

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  const unsigned long duration = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);
  if (duration == 0) return -1.0f;

  const float distance = duration * 0.0343f / 2.0f;
  if (distance < 2.0f || distance > 400.0f) return -1.0f;
  return distance;
}

float readMedianDistance() {
  float samples[3];
  int count = 0;
  for (int i = 0; i < 3; i++) {
    const float distance = readDistanceCm();
    if (distance > 0.0f) samples[count++] = distance;
    delay(40);
  }
  if (count == 0) return -1.0f;

  if (count == 3) {
    if (samples[0] > samples[1]) { const float t = samples[0]; samples[0] = samples[1]; samples[1] = t; }
    if (samples[1] > samples[2]) { const float t = samples[1]; samples[1] = samples[2]; samples[2] = t; }
    if (samples[0] > samples[1]) { const float t = samples[0]; samples[0] = samples[1]; samples[1] = t; }
    return samples[1];
  }
  if (count == 2) return (samples[0] + samples[1]) / 2.0f;
  return samples[0];
}

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  delay(1500); // Allow the Uno bootloader and serial connection to settle.
}

void loop() {
  const float distance = readMedianDistance();

  // A negative distance is a sensor timeout heartbeat. The backend records it
  // as a dropout and keeps the physical device online without inventing data.
  Serial.print("{\"device_id\":\"");
  Serial.print(DEVICE_ID);
  Serial.print("\",\"distance_cm\":");
  if (distance > 0.0f) Serial.print(distance, 1);
  else Serial.print(-1);
  Serial.print(",\"uptime_s\":");
  Serial.print(millis() / 1000UL);
  Serial.println("}");

  delay(SEND_INTERVAL_MS);
}
