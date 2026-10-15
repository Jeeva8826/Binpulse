EcoRoute C++ and JSON Demo

Files:
- EcoRoute_Demo.ino: ESP32 Arduino C++ sketch that emits one JSON line about every 3 seconds.
- sample_data.json: two example JSON records with the same structure.

Run: Open the .ino file in Arduino IDE, select your ESP32 board and COM port, upload, then open Tools > Serial Monitor and set baud rate to 115200.

Important: all values are simulated. Weighbridge readings are not from a real scale; routes are hardcoded rather than optimized; recommendations use fixed rules, not a trained ML model. The JSON file is a sample and is not automatically loaded onto the ESP32.
