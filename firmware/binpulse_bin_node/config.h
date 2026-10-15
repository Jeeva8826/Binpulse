#ifndef BINPULSE_BIN_CONFIG_H
#define BINPULSE_BIN_CONFIG_H

// Arduino Uno USB serial bridge settings. Backend defaults: COM12 at 115200.
const long SERIAL_BAUD_RATE = 115200;
const char* BIN_ID = "BIN01";

// HC-SR04 wiring from the user's Arduino sketch: TRIG -> D9, ECHO -> D10.
// Uno digital inputs tolerate the HC-SR04's 5V ECHO output directly.
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

// Measure the installed bin and calibrate these distances (centimetres).
const float BIN_RADIUS_CM = 15.0f;
const float BIN_HEIGHT_CM = 40.0f;
const float EMPTY_DISTANCE_CM = 40.0f;
const float FULL_DISTANCE_CM = 5.0f;

const unsigned long SEND_INTERVAL_MS = 2000UL;

#endif
