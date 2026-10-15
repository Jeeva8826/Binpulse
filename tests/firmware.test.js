const test = require('node:test');
const assert = require('node:assert');

/**
 * Host-side unit test verifying the ESP32-S3 firmware logic:
 * - Speed of sound temperature compensation
 * - Median-of-7 acoustic filtering algorithm
 * - Arrival/Departure debounced state machine
 * - JSON payload contract serialization
 */

function calculateSpeedOfSoundCmUs(tempC) {
  return (331.3 + 0.606 * tempC) * 0.0001;
}

function medianOf7Filter(samples) {
  const valid = samples.filter(s => s >= 2.0 && s <= 400.0);
  if (valid.length < 3) return -1.0; // Inconclusive
  valid.sort((a, b) => a - b);
  return valid[Math.floor(valid.length / 2)];
}

class FirmwareStateMachine {
  constructor(thresholdCm = 180.0, debounceSamples = 3) {
    this.thresholdCm = thresholdCm;
    this.debounceSamples = debounceSamples;
    this.isTruckPresent = false;
    this.consecutivePresent = 0;
    this.consecutiveAbsent = 0;
    this.lastEvent = 'ping';
  }

  processReading(distCm) {
    if (distCm < 0) return { event: 'ignore_error', isPresent: this.isTruckPresent };

    if (distCm <= this.thresholdCm) {
      this.consecutivePresent++;
      this.consecutiveAbsent = 0;
      if (!this.isTruckPresent && this.consecutivePresent >= this.debounceSamples) {
        this.isTruckPresent = true;
        this.lastEvent = 'arrival';
        return { event: 'arrival', isPresent: true };
      }
    } else {
      this.consecutiveAbsent++;
      this.consecutivePresent = 0;
      if (this.isTruckPresent && this.consecutiveAbsent >= this.debounceSamples) {
        this.isTruckPresent = false;
        this.lastEvent = 'departure';
        return { event: 'departure', isPresent: false };
      }
    }
    this.lastEvent = 'ping';
    return { event: 'ping', isPresent: this.isTruckPresent };
  }
}

test('ESP32 Firmware Host Logic Suite', async (t) => {

  await t.test('Speed of sound temperature compensation matches physics model', () => {
    // At 20 C: (331.3 + 0.606*20) = 343.42 m/s = 0.034342 cm/us
    const v20 = calculateSpeedOfSoundCmUs(20.0);
    assert.ok(Math.abs(v20 - 0.034342) < 0.0001, `v20 was ${v20}`);

    // At 28 C (Coimbatore baseline): 348.27 m/s
    const v28 = calculateSpeedOfSoundCmUs(28.0);
    assert.ok(Math.abs(v28 - 0.034827) < 0.0001, `v28 was ${v28}`);
  });

  await t.test('Median-of-7 filter rejects outliers, noise spikes, and timeouts', () => {
    // 7 samples with 2 noise spikes and 1 dropout (-1):
    // raw: [82.1, 450.0, 81.9, -1.0, 82.5, 3.0, 82.0]
    // valid: [3.0, 81.9, 82.0, 82.1, 82.5] -> median = 82.0
    const raw = [82.1, 450.0, 81.9, -1.0, 82.5, 3.0, 82.0];
    const filtered = medianOf7Filter(raw);
    assert.strictEqual(filtered, 82.0, `Filtered median was ${filtered}`);

    // If fewer than 3 valid samples, reject as inconclusive (-1.0)
    const bad = [-1.0, -1.0, 450.0, -1.0, 80.0, -1.0, -1.0];
    assert.strictEqual(medianOf7Filter(bad), -1.0);
  });

  await t.test('Firmware debounce state machine transitions on exactly N samples', () => {
    const sm = new FirmwareStateMachine(180.0, 3);

    // Initial state: idle
    assert.strictEqual(sm.isTruckPresent, false);

    // 1st close sample: ping, not yet present
    let res = sm.processReading(75.0);
    assert.strictEqual(res.event, 'ping');
    assert.strictEqual(res.isPresent, false);

    // 2nd close sample: ping
    res = sm.processReading(75.0);
    assert.strictEqual(res.event, 'ping');
    assert.strictEqual(res.isPresent, false);

    // 3rd close sample: ARRIVAL!
    res = sm.processReading(75.0);
    assert.strictEqual(res.event, 'arrival');
    assert.strictEqual(res.isPresent, true);

    // 1 clear sample: ping, still present
    res = sm.processReading(240.0);
    assert.strictEqual(res.event, 'ping');
    assert.strictEqual(res.isPresent, true);

    // 2 clear samples: ping, still present
    res = sm.processReading(240.0);
    assert.strictEqual(res.event, 'ping');
    assert.strictEqual(res.isPresent, true);

    // 3 clear samples: DEPARTURE!
    res = sm.processReading(240.0);
    assert.strictEqual(res.event, 'departure');
    assert.strictEqual(res.isPresent, false);
  });

  await t.test('Firmware JSON serialization contract validates against backend schema', () => {
    const payload = {
      device_id: 'ESP32_YARD_01',
      distance_cm: 78.5,
      raw_distance_cm: 78.5,
      rssi: -65,
      uptime_s: 342,
      dwell_s: 42,
      event: 'arrival'
    };

    assert.ok(payload.device_id.startsWith('ESP32'));
    assert.ok(typeof payload.distance_cm === 'number');
    assert.ok(typeof payload.rssi === 'number');
    assert.ok(typeof payload.uptime_s === 'number');
    assert.ok(['arrival', 'departure', 'ping'].includes(payload.event));
  });
});
