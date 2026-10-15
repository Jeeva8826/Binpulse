#ifndef BINPULSE_BIN_CONFIG_H
#define BINPULSE_BIN_CONFIG_H

// Arduino Uno USB serial bridge settings. Backend defaults: COM12 at 115200.
const long SERIAL_BAUD_RATE = 115200;
const char* BIN_ID = "BIN01";

// HC-SR04 wiring based on the attached Uno photo: TRIG -> D7, ECHO -> D8.
// Uno digital inputs tolerate the HC-SR04's 5V ECHO output directly.
const int TRIG_PIN = 7;
const int ECHO_PIN = 8;

// Measure the installed bin and calibrate these distances (centimetres).
const float BIN_RADIUS_CM = 15.0f;
const float BIN_HEIGHT_CM = 30.0f;
const float EMPTY_DISTANCE_CM = 30.0f;
const float FULL_DISTANCE_CM = 5.0f;

const unsigned long SEND_INTERVAL_MS = 2000UL;

#endif
