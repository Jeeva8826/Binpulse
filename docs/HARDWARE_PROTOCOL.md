# BinPulse Yard Node Communication Protocol (docs/HARDWARE_PROTOCOL.md)

## 1. Protocol Specifications

- **Transport**: HTTP/1.1 over Wi-Fi (HTTPS-ready)
- **Content Type**: `application/json`
- **Authentication**: Custom HTTP header `x-api-key: binpulse_secret_key_2026`
- **Default Telemetry Rate**: 1 reading every 2000 ms (2.0 seconds)
- **Debounce Threshold**: 3 consecutive samples (6.0 seconds)

---

## 2. Ingestion Endpoint: `POST /api/device/readings`

### HTTP Request Format
```http
POST /api/device/readings HTTP/1.1
Host: 10.81.221.165:5000
Content-Type: application/json
x-api-key: binpulse_secret_key_2026

{
  "device_id": "ESP32_YARD_01",
  "distance_cm": 74.5,
  "raw_distance_cm": 74.5,
  "rssi": -65,
  "uptime_s": 1284,
  "dwell_s": 14,
  "event": "ping",
  "timestamp": "2026-10-14T22:30:00.000Z"
}
```

### JSON Fields Schema

| Field | Type | Required | Description |
|---|---|---|---|
| `device_id` | String | Yes | Unique identifier of the yard hardware node (e.g., `ESP32_YARD_01`). |
| `distance_cm` | Float | Yes | Median-filtered distance in centimeters from sensor to target surface. |
| `raw_distance_cm`| Float | No | Unfiltered single-pulse distance. |
| `rssi` | Integer| No | Wi-Fi Received Signal Strength Indication in dBm (e.g., `-65`). |
| `uptime_s` | Integer| No | Microcontroller running time in seconds. |
| `dwell_s` | Integer| No | Ongoing dwell duration if truck presence is active. |
| `event` | String | No | Event tag: `"ping"` (routine heartbeat), `"arrival"` (debounced entrance), `"departure"` (debounced departure), or `"buffered_flush"`. |

### Batched Payload Support (for offline buffer flush)
The endpoint accepts an array of reading objects:
```json
[
  { "device_id": "ESP32_YARD_01", "distance_cm": 82.0, "event": "buffered_flush" },
  { "device_id": "ESP32_YARD_01", "distance_cm": 78.5, "event": "buffered_flush" }
]
```

### Response Status Codes
- `200 OK`: Telemetry processed successfully. Returns:
  ```json
  {
    "ok": true,
    "processed": 1,
    "latest": {
      "deviceId": "ESP32_YARD_01",
      "distanceCm": 74.5,
      "isTruckPresent": true,
      "dwellSeconds": 14,
      "event": "ping"
    }
  }
  ```
- `400 Bad Request`: Payload missing required `distance_cm` field.
- `401 Unauthorized`: Missing or invalid `x-api-key` header.
- `500 Internal Error`: Database or ingestion processing error.

---

## 3. Presence State Machine Diagram

```
                 +-----------------------+
                 |       STATE 0:        |
                 |      YARD IDLE        | <------------------------------------+
                 | (Distance > 180 cm)   |                                      |
                 +-----------------------+                                      |
                             |                                                  |
                             | Distance <= 180 cm                               | Distance > 180 cm
                             | (Sample 1 of 3)                                  | (Sample 3 of 3)
                             v                                                  |
                 +-----------------------+                                      |
                 |       STATE 1:        |                                      |
                 |  APPROACH DEBOUNCE    |                                      |
                 | (1..2 samples below)  | -----------------------+             |
                 +-----------------------+                        |             |
                             |                                    |             |
                             | Distance <= 180 cm                 | Distance >  |
                             | (Sample 3 of 3 confirmed)          | 180 cm      |
                             v                                    | (Abort)     |
                 +-----------------------+                        |             |
                 |       STATE 2:        | <----------------------+             |
                 |     TRUCK PRESENT     |                                      |
                 | - Record Arrival Time |                                      |
                 | - Increment Dwell (s) |                                      |
                 | - Accumulate Medians  |                                      |
                 +-----------------------+                                      |
                             |                                                  |
                             | Distance > 180 cm                                |
                             | (Sample 1 of 3)                                  |
                             v                                                  |
                 +-----------------------+                                      |
                 |       STATE 3:        |                                      |
                 |  DEPARTURE DEBOUNCE   |                                      |
                 | (1..2 samples clear)  |                                      |
                 +-----------------------+                                      |
                             |                                                  |
                             | Distance > 180 cm                                |
                             | (Sample 3 of 3 confirmed)                        |
                             +--------------------------------------------------+
                                   - Finalize Total Dwell Time (s)
                                   - Compute Median Load Distance
                                   - Calculate Volume (m³) & Weight (kg)
                                   - Trigger Area Attribution
                                   - Emit TRUCK_VISIT_COMPLETED Event
```

---

## 4. Legacy Backwards-Compatibility Route

### `POST /api/reading/`
Accepts legacy bin-level JSON payloads for backwards compatibility:
```json
{
  "bin_id": "BIN01",
  "fill": 68
}
```
Returns: `{"ok": true, "legacy": true, "bin_id": "BIN01", "fill": 68}`.
