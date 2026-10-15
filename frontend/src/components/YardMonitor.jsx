import React, { useState, useEffect } from 'react';

export default function YardMonitor({
  yardStatus,
  visits,
  trucks,
  isHardwareMode,
  onInjectDistance,
  onSimulateTruckEvent
}) {
  const [testDistance, setTestDistance] = useState(85);
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('bio');
  const [dwellTime, setDwellTime] = useState(45);

  const device = yardStatus?.device || {
    deviceId: 'ESP32_YARD_01',
    status: 'offline',
    lastSeenAt: null,
    rssi: null,
    uptimeS: null
  };

  const isTruckPresent = !!yardStatus?.isTruckPresent;
  const hasReading = Number.isFinite(Number(yardStatus?.latestDistanceCm));
  const distanceCm = hasReading ? Number(yardStatus.latestDistanceCm) : 0;
  const currentDwell = yardStatus?.currentDwellSeconds || 0;

  // Visual gauge percentage (0 cm = full truck near sensor, 250 cm = empty driveway)
  const maxDistance = 250;
  const gaugePercent = hasReading ? Math.max(0, Math.min(100, Math.round(((maxDistance - distanceCm) / maxDistance) * 100))) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary tracking-tight">Yard Entrance Ultrasonic Node</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              device.status === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}>
              {device.status === 'online' ? 'DEVICE ONLINE' : 'WAITING FOR DEVICE'}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            Centralised non-contact ultrasonic sensor at the facility entrance. Replaces weighing-bridge instrumentation 
            to detect truck presence, debounce dwell time, and estimate incoming waste volume.
          </p>
        </div>

        {/* Sensor Health Quick Pill */}
        <div className="flex items-center gap-3 bg-surface-container-low px-4 py-2 rounded-xl border border-surface-container">
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-outline font-semibold uppercase">Hardware Target</span>
            <span className="text-xs font-mono font-bold text-primary">{yardStatus?.latestDeviceId || device.deviceId}</span>
          </div>
          <div className="w-px h-7 bg-surface-container-high"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-outline font-semibold uppercase">Wi-Fi RSSI</span>
            <span className="text-xs font-mono font-semibold text-secondary">{device.rssi || -68} dBm</span>
          </div>
        </div>
      </div>

      {/* Main Live Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Distance & Presence Gauge */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-col items-center text-center justify-between">
          <div className="w-full flex items-center justify-between text-xs text-outline font-bold uppercase tracking-wider pb-3 border-b border-surface-container">
            <span>Ultrasonic Distance</span>
            <span className={`inline-flex items-center gap-1 ${device.status === 'online' ? 'text-emerald-700' : 'text-outline'}`}>
              <span className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
              {device.status === 'online' ? 'Live Feed' : 'No recent data'}
            </span>
          </div>

          {/* Large Gauge Graphic */}
          <div className="relative my-6 flex flex-col items-center">
            <div className="w-48 h-48 rounded-full border-8 border-surface-container-high flex flex-col items-center justify-center relative overflow-hidden bg-surface-container-low/30">
              {/* Animated fill height bar */}
              <div
                className={`absolute bottom-0 w-full transition-all duration-700 ease-out ${
                  isTruckPresent ? 'bg-secondary/25 border-t-2 border-secondary' : 'bg-slate-200/50'
                }`}
                style={{ height: `${gaugePercent}%` }}
              ></div>

              <div className="relative z-10 flex flex-col items-center">
                <span className="text-4xl font-extrabold text-primary font-mono tracking-tight">
                  {hasReading ? Math.round(distanceCm) : '—'}
                </span>
                <span className="text-xs font-bold text-outline uppercase tracking-wider">cm</span>
                <span className="text-[10px] text-on-surface-variant mt-1 font-medium">
                  {!hasReading ? 'Waiting for first reading' : isTruckPresent ? 'Truck Stationed' : 'Driveway Clear'}
                </span>
              </div>
            </div>
          </div>

          {/* Presence Status Banner */}
          <div className={`w-full py-2.5 px-4 rounded-lg flex items-center justify-between text-xs font-bold ${
            isTruckPresent
              ? 'bg-secondary-container text-on-secondary-container border border-secondary'
              : 'bg-surface-container text-on-surface-variant'
          }`}>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                {isTruckPresent ? 'local_shipping' : 'sensors'}
              </span>
              <span>{isTruckPresent ? 'TRUCK PRESENT AT SENSOR' : 'YARD ENTRANCE IDLE'}</span>
            </span>
            <span>{isTruckPresent ? `Dwell: ${currentDwell}s` : hasReading ? '> 180 cm' : '—'}</span>
          </div>
        </div>

        {/* Load Estimation & Density Physics Card */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-outline font-bold uppercase tracking-wider pb-3 border-b border-surface-container">
            <span>Load-Level Estimation Model</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">calculate</span>
          </div>

          <div className="flex flex-col gap-3 my-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 leading-relaxed">
              <strong>Review 2 Physical Role:</strong> There is no weighing-bridge. Distance readings are converted to waste height 
              in the truck bed (<span className="font-mono">fill_height = 180cm - distance</span>), then to estimated volume & weight via bulk density.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-low p-3 rounded-lg border border-surface-container">
                <span className="text-[10px] text-outline font-semibold uppercase">Waste Height</span>
                <div className="text-xl font-bold text-primary font-mono mt-0.5">
                  {isTruckPresent ? Math.max(0, Math.round(180 - distanceCm)) : 0} <span className="text-xs font-normal">cm</span>
                </div>
                <span className="text-[10px] text-on-surface-variant">in truck bed</span>
              </div>

              <div className="bg-surface-container-low p-3 rounded-lg border border-surface-container">
                <span className="text-[10px] text-outline font-semibold uppercase">Estimated Volume</span>
                <div className="text-xl font-bold text-secondary font-mono mt-0.5">
                  {isTruckPresent ? Math.round(3.5 * 1.8 * Math.max(0, (180 - distanceCm) / 100) * 10) / 10 : 0} <span className="text-xs font-normal">m³</span>
                </div>
                <span className="text-[10px] text-on-surface-variant">bed 3.5m × 1.8m</span>
              </div>
            </div>

            <div className="bg-surface-container-low p-3 rounded-lg border border-surface-container">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-on-surface">Estimated Waste Weight</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                  Estimated, Not Measured
                </span>
              </div>
              <div className="text-2xl font-extrabold text-primary font-mono mt-1">
                {isTruckPresent
                  ? Math.round(3.5 * 1.8 * Math.max(0, (180 - distanceCm) / 100) * 450)
                  : 0}{' '}
                <span className="text-sm font-medium text-outline">kg (Bio-Waste @ 450 kg/m³)</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-outline pt-2 border-t border-surface-container flex justify-between">
            <span>Non-Bio Density: 180 kg/m³</span>
            <span>Debounce: 3 consecutive readings</span>
          </div>
        </div>

        {/* Hardware & Simulation Testing Panel */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-outline font-bold uppercase tracking-wider pb-3 border-b border-surface-container">
            <span>{isHardwareMode ? 'ESP32 Live Connection' : 'Simulation & Testing'}</span>
            <span className="material-symbols-outlined text-[18px] text-primary">{isHardwareMode ? 'sensors' : 'science'}</span>
          </div>

          {isHardwareMode ? (
            <div className="flex flex-col gap-3 my-3 text-xs text-on-surface-variant">
              <p className="leading-relaxed">The dashboard is listening for real readings from your ESP32 ultrasonic sensor. A new reading should arrive about every 2 seconds.</p>
              <div className="rounded-lg bg-surface-container-low p-3 space-y-1">
                <div className="flex justify-between gap-3"><span>Connection</span><strong>{device.status === 'online' ? 'ESP32 connected' : 'Waiting for ESP32'}</strong></div>
                <div className="flex justify-between gap-3"><span>Last reading</span><strong>{yardStatus?.latestReadingAt ? new Date(yardStatus.latestReadingAt).toLocaleTimeString() : 'None received yet'}</strong></div>
                <div className="flex justify-between gap-3"><span>Last event</span><strong>{yardStatus?.latestEvent || '—'}</strong></div>
                <div className="flex justify-between gap-3"><span>Wi-Fi signal</span><strong>{device.rssi == null ? '—' : `${device.rssi} dBm`}</strong></div>
              </div>
              <p className="text-[11px] leading-relaxed">For the device URL, use your computer’s Wi-Fi/LAN IP and port 5000. The ESP32 cannot use localhost.</p>
            </div>
          ) : (
          <div className="flex flex-col gap-3 my-2">
            <div>
              <label className="text-[11px] font-semibold text-on-surface flex justify-between">
                <span>Manual Distance Inject:</span>
                <span className="font-mono text-secondary font-bold">{testDistance} cm</span>
              </label>
              <input
                type="range"
                min="20"
                max="250"
                value={testDistance}
                onChange={(e) => setTestDistance(parseInt(e.target.value, 10))}
                className="w-full mt-1 accent-secondary"
              />
              <div className="flex justify-between text-[10px] text-outline mt-0.5">
                <span>20 cm (Full)</span>
                <span>180 cm (Empty Bed)</span>
                <span>250 cm (Clear)</span>
              </div>
            </div>

            <button
              onClick={() => onInjectDistance(testDistance)}
              className="w-full py-1.5 px-3 rounded-lg bg-surface-container text-primary font-bold text-xs hover:bg-surface-container-high transition-all border border-surface-container-high"
            >
              Inject Single Sensor Sample
            </button>

            <div className="pt-2 border-t border-surface-container flex flex-col gap-2">
              <span className="text-[11px] font-bold text-on-surface">Simulate Complete Truck Arrival Event:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-surface-container-low border border-surface-container rounded px-2 py-1 text-xs"
                >
                  <option value="bio">Bio-Waste (450 kg/m³)</option>
                  <option value="non-bio">Non-Bio Recyclable (180 kg/m³)</option>
                </select>

                <select
                  value={selectedTruck}
                  onChange={(e) => setSelectedTruck(e.target.value)}
                  className="bg-surface-container-low border border-surface-container rounded px-2 py-1 text-xs"
                >
                  <option value="">Auto-Assign Truck</option>
                  {trucks && trucks.map(t => (
                    <option key={t.id} value={t.id}>{t.plate_number}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => onSimulateTruckEvent({
                  truckId: selectedTruck || undefined,
                  wasteCategory: selectedCategory,
                  dwellSeconds: dwellTime,
                  medianDistanceCm: testDistance
                })}
                className="w-full py-2 px-3 rounded-lg bg-secondary text-white font-bold text-xs hover:bg-primary transition-all shadow-xs"
              >
                Trigger Arrival → Dwell (45s) → Departure
              </button>
            </div>
          </div>
          )}

          <div className="text-[10px] text-outline pt-2 border-t border-surface-container">
            {isHardwareMode ? 'Live values are physical ESP32 readings; quantity remains an estimate.' : 'Simulation values are generated locally; no hardware reading is implied.'}
          </div>
        </div>
      </div>

      {/* Historical Truck Visit Log Table */}
      <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-surface-container mb-4">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-primary">Yard Entrance Truck Visit Event Log</h2>
            <p className="text-xs text-on-surface-variant">
              Every completed truck event records dwell duration and estimated quantity. All weights are labeled as ultrasonic estimates.
            </p>
          </div>
          <span className="text-xs font-mono text-outline">
            Showing last {visits ? Math.min(20, visits.length) : 0} arrivals
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-container text-outline uppercase tracking-wider text-[10px]">
                <th className="pb-2 font-bold">Arrival Time</th>
                <th className="pb-2 font-bold">Departure</th>
                <th className="pb-2 font-bold">Dwell Time</th>
                <th className="pb-2 font-bold">Vehicle Plate</th>
                <th className="pb-2 font-bold">Waste Type</th>
                <th className="pb-2 font-bold">Sensor Distance</th>
                <th className="pb-2 font-bold">Estimated Vol</th>
                <th className="pb-2 font-bold">Estimated Weight</th>
                <th className="pb-2 font-bold">Quantity Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {visits && visits.slice(0, 20).map((v) => (
                <tr key={v.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-2.5 font-mono text-on-surface">
                    {v.arrived_at ? new Date(v.arrived_at).toLocaleTimeString() : 'N/A'}
                  </td>
                  <td className="py-2.5 font-mono text-outline">
                    {v.departed_at ? new Date(v.departed_at).toLocaleTimeString() : 'N/A'}
                  </td>
                  <td className="py-2.5 font-semibold text-secondary">
                    {v.dwell_s}s
                  </td>
                  <td className="py-2.5 font-mono font-bold text-primary">
                    {v.plate_number || 'TN-38-AA-1001'}
                  </td>
                  <td className="py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      v.waste_category === 'non-bio' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {v.waste_category === 'non-bio' ? 'Non-Bio' : 'Bio-Waste'}
                    </span>
                  </td>
                  <td className="py-2.5 font-mono text-outline">
                    {Math.round(v.raw_distance_cm)} cm
                  </td>
                  <td className="py-2.5 font-mono text-on-surface">
                    {v.est_volume_m3} m³
                  </td>
                  <td className="py-2.5 font-mono font-bold text-primary">
                    ~{Math.round(v.est_quantity_kg)} kg
                  </td>
                  <td className="py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container text-on-surface-variant">
                      {v.quantity_source || 'ultrasonic_estimate'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
