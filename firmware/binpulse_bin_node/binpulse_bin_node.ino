/*
 * BinPulse live BIN01 sensor for Arduino Uno.
 * USB serial sends one JSON record per sample; the Node backend reads COM12.
 * HC-SR04: VCC -> 5V, GND -> GND, TRIG -> D9, ECHO -> D10.
 */

#include "config.h"

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  const unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000UL);
  if (duration == 0) return -1.0f;

  const float distance = duration * 0.0343f / 2.0f;
  if (distance < 2.0f || distance > 400.0f) return -1.0f;
  return distance;
}

float readMedianDistance() {
  float values[5];
  int count = 0;
  for (int i = 0; i < 5; i++) {
    const float value = readDistanceCm();
    if (value > 0.0f) values[count++] = value;
    delay(35);
  }
  if (count < 3) return -1.0f;

  for (int i = 0; i < count - 1; i++) {
    for (int j = i + 1; j < count; j++) {
      if (values[j] < values[i]) {
        const float temp = values[i];
        values[i] = values[j];
        values[j] = temp;
      }
    }
  }
  return values[count / 2];
}

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  delay(1500); // Let the Uno bootloader finish before serial telemetry begins.
}

void loop() {
  const float distance = readMedianDistance();
  if (distance < 0.0f) {
    Serial.println("# sensor_no_echo");
    delay(SEND_INTERVAL_MS);
    return;
  }

  const float span = EMPTY_DISTANCE_CM - FULL_DISTANCE_CM;
  if (span <= 0.0f) {
    Serial.println("# invalid_calibration");
    delay(SEND_INTERVAL_MS);
    return;
  }

  const float fill = constrain((EMPTY_DISTANCE_CM - distance) * 100.0f / span, 0.0f, 100.0f);
  const float fillHeightCm = BIN_HEIGHT_CM * fill / 100.0f;
  const float crossSectionCm2 = PI * BIN_RADIUS_CM * BIN_RADIUS_CM;
  const float volumeLitres = crossSectionCm2 * fillHeightCm / 1000.0f;
  const float capacityLitres = crossSectionCm2 * BIN_HEIGHT_CM / 1000.0f;

  // Keep Serial output machine-readable; the backend persists and broadcasts it.
  Serial.print("{\"bin_id\":\""); Serial.print(BIN_ID);
  Serial.print("\",\"fill\":"); Serial.print(fill, 1);
  Serial.print(" ,\"distance_cm\":"); Serial.print(distance, 1);
  Serial.print(" ,\"volume_l\":"); Serial.print(volumeLitres, 1);
  Serial.print(" ,\"capacity_l\":"); Serial.print(capacityLitres, 1);
  Serial.println("}");

  delay(SEND_INTERVAL_MS);
}
