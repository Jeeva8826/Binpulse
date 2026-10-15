/*
  EcoRoute Smart Waste Collection Network - ESP32 Demo
  All values are SIMULATED. Serial Monitor baud rate: 115200.
  Prints one compact JSON record approximately every 3 seconds.
*/
#include <Arduino.h>

struct Area {
  const char* id;
  const char* name;
  const char* category;
  int baseDemandKg;
};

struct Truck {
  const char* id;
  int payloadCapacityKg;
  int tareWeightKg;
};

Area areas[] = {
  {"AREA_01", "Residential Zone", "Residential", 520},
  {"AREA_02", "Commercial Zone", "Commercial", 850},
  {"AREA_03", "Market Zone", "Market", 1200},
  {"AREA_04", "Industrial Zone", "Industrial", 680},
  {"AREA_05", "Mixed Zone", "Mixed", 760}
};

Truck trucks[] = {
  {"TRUCK_01", 5000, 5500},
  {"TRUCK_02", 4000, 4800},
  {"TRUCK_03", 6000, 6200}
};

const int AREA_COUNT = sizeof(areas) / sizeof(areas[0]);
const int TRUCK_COUNT = sizeof(trucks) / sizeof(trucks[0]);
unsigned long recordId = 1;
unsigned long lastSendMs = 0;
const unsigned long SEND_INTERVAL_MS = 3000;

float randomFloat(float low, float high) {
  return low + (random(0, 10001) / 10000.0f) * (high - low);
}

void printJsonRecord() {
  int ai = random(0, AREA_COUNT);
  int ti = random(0, TRUCK_COUNT);
  Area area = areas[ai];
  Truck truck = trucks[ti];

  float demand = area.baseDemandKg * randomFloat(0.80f, 1.20f);
  bool spike = (random(0, 10) == 0);
  if (spike) demand *= 1.50f;
  int estimatedDemandKg = (int)(demand + 0.5f);

  // Simulated weighbridge values; not readings from a real scale.
  int netWeightKg = (int)(estimatedDemandKg * randomFloat(0.80f, 1.15f));
  if (netWeightKg > truck.payloadCapacityKg) netWeightKg = truck.payloadCapacityKg;
  int grossWeightKg = truck.tareWeightKg + netWeightKg;
  float utilization = 100.0f * netWeightKg / truck.payloadCapacityKg;

  const char* recommendation;
  const char* reason;
  if (estimatedDemandKg >= 1500) {
    recommendation = "COLLECT_URGENTLY";
    reason = "Estimated demand is very high";
  } else if (estimatedDemandKg >= 1000) {
    recommendation = "COLLECT_TODAY";
    reason = "Estimated demand reached today's threshold";
  } else if (estimatedDemandKg >= 600) {
    recommendation = "MONITOR";
    reason = "Continue monitoring estimated demand";
  } else {
    recommendation = "ROUTINE";
    reason = "Estimated demand is within routine range";
  }

  // Hardcoded demonstration routes; not an optimized route.
  const char* routeSequence;
  float distanceKm;
  int travelTimeMin;
  switch (ai) {
    case 0: routeSequence = "DEPOT>AREA_01>YARD"; distanceKm = 8.4f; travelTimeMin = 24; break;
    case 1: routeSequence = "DEPOT>AREA_02>YARD"; distanceKm = 11.2f; travelTimeMin = 31; break;
    case 2: routeSequence = "DEPOT>AREA_03>YARD"; distanceKm = 6.7f; travelTimeMin = 20; break;
    case 3: routeSequence = "DEPOT>AREA_04>YARD"; distanceKm = 14.5f; travelTimeMin = 38; break;
    default: routeSequence = "DEPOT>AREA_05>YARD"; distanceKm = 9.6f; travelTimeMin = 27; break;
  }

  Serial.print("{\"project\":\"EcoRoute\",\"record_id\":");
  Serial.print(recordId++);
  Serial.print(",\"timestamp_ms\":");
  Serial.print(millis());
  Serial.print(",\"data_source\":\"SIMULATED\",\"area\":{\"area_id\":\"");
  Serial.print(area.id);
  Serial.print("\",\"name\":\"");
  Serial.print(area.name);
  Serial.print("\",\"category\":\"");
  Serial.print(area.category);
  Serial.print("\",\"estimated_demand_kg\":");
  Serial.print(estimatedDemandKg);
  Serial.print("},\"weighbridge\":{\"truck_id\":\"");
  Serial.print(truck.id);
  Serial.print("\",\"gross_weight_kg\":");
  Serial.print(grossWeightKg);
  Serial.print(",\"tare_weight_kg\":");
  Serial.print(truck.tareWeightKg);
  Serial.print(",\"net_weight_kg\":");
  Serial.print(netWeightKg);
  Serial.print("},\"vehicle\":{\"payload_capacity_kg\":");
  Serial.print(truck.payloadCapacityKg);
  Serial.print(",\"capacity_utilization_percent\":");
  Serial.print(utilization, 1);
  Serial.print("},\"collection\":{\"recommendation\":\"");
  Serial.print(recommendation);
  Serial.print("\",\"reason\":\"");
  Serial.print(reason);
  Serial.print("\",\"demand_spike\":");
  Serial.print(spike ? "true" : "false");
  Serial.print("},\"route\":{\"route_sequence\":\"");
  Serial.print(routeSequence);
  Serial.print("\",\"estimated_distance_km\":");
  Serial.print(distanceKm, 1);
  Serial.print(",\"estimated_travel_time_min\":");
  Serial.print(travelTimeMin);
  Serial.println("}}");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  randomSeed((uint32_t)micros());
  Serial.println("{\"project\":\"EcoRoute\",\"status\":\"SIMULATOR_STARTED\",\"data_source\":\"SIMULATED\"}");
}

void loop() {
  unsigned long now = millis();
  if (now - lastSendMs >= SEND_INTERVAL_MS) {
    lastSendMs = now;
    printJsonRecord();
  }
}
