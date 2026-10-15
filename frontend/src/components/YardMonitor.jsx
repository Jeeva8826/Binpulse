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
  const [liveYardStatus, setLiveYardStatus] = useState(null);
  const [liveVisits, setLiveVisits] = useState([]);
  const [showAssignment, setShowAssignment] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [liveTruckId, setLiveTruckId] = useState('');
  const [livePlateNumber, setLivePlateNumber] = useState('');
  const [liveWasteCategory, setLiveWasteCategory] = useState('bio');

  useEffect(() => {
    if (!isHardwareMode) {
      setLiveYardStatus(null);
      setShowAssignment(false);
      return undefined;
    }
    let active = true;
    const refreshLiveYard = async () => {
      try {
        const [statusResponse, visitsResponse] = await Promise.all([
          fetch('/api/yard/status?source=hardware'),
          fetch('/api/yard/live-visits?limit=20')
        ]);
        const [status, rows] = await Promise.all([statusResponse.json(), visitsResponse.json()]);
        if (!active) return;
        setLiveYardStatus(status);
        setLiveVisits(Array.isArray(rows) ? rows : []);
      } catch {}
    };
    refreshLiveYard();
    const timer = window.setInterval(refreshLiveYard, 1200);
    return () => { active = false; window.clearInterval(timer); };
  }, [isHardwareMode]);

  const activeLiveVisit = liveYardStatus ? liveYardStatus.activeLiveVisit : yardStatus?.activeLiveVisit;
  const liveDevice = isHardwareMode ? (liveYardStatus?.device || yardStatus?.device) : yardStatus?.device;
  const livePresence = isHardwareMode ? (liveYardStatus?.isTruckPresent ?? yardStatus?.isTruckPresent) : yardStatus?.isTruckPresent;
  const liveDistance = isHardwareMode ? (liveYardStatus?.latestDistanceCm ?? yardStatus?.latestDistanceCm) : yardStatus?.latestDistanceCm;
  const liveDwell = isHardwareMode ? (liveYardStatus?.currentDwellSeconds ?? yardStatus?.currentDwellSeconds) : yardStatus?.currentDwellSeconds;
  const liveEvent = isHardwareMode ? (liveYardStatus?.latestEvent ?? yardStatus?.latestEvent) : yardStatus?.latestEvent;

  useEffect(() => {
    if (isHardwareMode && livePresence && activeLiveVisit?.status === 'awaiting_identification') {
      setLiveTruckId(`LIVE-${Date.now().toString().slice(-6)}`);
      setLivePlateNumber(`TN-38-AB-${Math.floor(1000 + Math.random() * 9000)}`);
      setLiveWasteCategory('bio');
      setAssignmentError('');
      setShowAssignment(true);
    } else if (!livePresence || activeLiveVisit?.status === 'identified') {
      setShowAssignment(false);
    }
  }, [isHardwareMode, livePresence, activeLiveVisit?.visitId, activeLiveVisit?.status]);

  const regenerateLiveIdentity = () => {
    setLiveTruckId(`LIVE-${Date.now().toString().slice(-6)}`);
    setLivePlateNumber(`TN-38-AB-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const saveLiveAssignment = async (event) => {
    event.preventDefault();
    setAssignmentBusy(true);
    setAssignmentError('');
    try {
      const response = await fetch('/api/yard/live-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truckId: liveTruckId, plateNumber: livePlateNumber, wasteCategory: liveWasteCategory })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save the truck details.');
      setLiveYardStatus(prev => prev ? { ...prev, activeLiveVisit: result.visit } : prev);
      setShowAssignment(false);
      const visitsResponse = await fetch('/api/yard/live-visits?limit=20');
      const rows = await visitsResponse.json();
      setLiveVisits(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setAssignmentError(error.message || 'Could not save the truck details.');
    } finally {
      setAssignmentBusy(false);
    }
  };

  const device = liveDevice || {
    deviceId: 'ARDUINO_YARD_01',
    status: 'offline',
    lastSeenAt: null,
    rssi: null,
    uptimeS: null
  };

  const isTruckPresent = !!livePresence;
  const hasReading = Number.isFinite(Number(liveDistance)) && Number(liveDistance) >= 2 && Number(liveDistance) <= 400;
  const distanceCm = hasReading ? Number(liveDistance) : 0;
  const currentDwell = liveDwell || 0;

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
            Centralised ultrasonic sensor at the facility entrance. Arduino Uno streams distance over USB to detect truck
            presence, debounce dwell time, and estimate incoming waste volume. An ESP32 Wi-Fi node is also supported.
          </p>
        </div>

        {/* Sensor Health Quick Pill */}
        <div className="flex items-center gap-3 bg-surface-container-low px-4 py-2 rounded-xl border border-surface-container">
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-outline font-semibold uppercase">Hardware Target</span>
            <span className="text-xs font-mono font-bold text-primary">{liveYardStatus?.latestDeviceId || yardStatus?.latestDeviceId || device.deviceId}</span>
          </div>
          <div className="w-px h-7 bg-surface-container-high"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-outline font-semibold uppercase">Connection</span>
            <span className="text-xs font-mono font-semibold text-secondary">
              {String(device.deviceId || '').startsWith('ARDUINO_') ? 'USB Serial' : device.rssi ? `${device.rssi} dBm` : 'Wi-Fi'}
            </span>
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
              {liveEvent === 'sensor_dropout' ? 'No echo' : device.status === 'online' ? 'Live Feed' : 'No recent data'}
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
            <span>{isHardwareMode ? 'Arduino Live Connection' : 'Simulation & Testing'}</span>
            <span className="material-symbols-outlined text-[18px] text-primary">{isHardwareMode ? 'sensors' : 'science'}</span>
          </div>

          {isHardwareMode ? (
            <div className="flex flex-col gap-3 my-3 text-xs text-on-surface-variant">
              <p className="leading-relaxed">The dashboard is listening for readings from your Arduino Uno ultrasonic sensor over USB serial. A new reading should arrive about every 2 seconds.</p>
              <div className="rounded-lg bg-surface-container-low p-3 space-y-1">
                <div className="flex justify-between gap-3"><span>Connection</span><strong>{device.status === 'online' ? 'Arduino connected' : 'Waiting for Arduino'}</strong></div>
                <div className="flex justify-between gap-3"><span>Last reading</span><strong>{(liveYardStatus?.latestReadingAt || yardStatus?.latestReadingAt) ? new Date(liveYardStatus?.latestReadingAt || yardStatus.latestReadingAt).toLocaleTimeString() : 'None received yet'}</strong></div>
                <div className="flex justify-between gap-3"><span>Sensor status</span><strong>{liveEvent === 'sensor_dropout' ? 'No echo' : liveEvent || 'Waiting for reading'}</strong></div>
                <div className="flex justify-between gap-3"><span>Serial link</span><strong>USB · {liveYardStatus?.serialLink?.baudRate || yardStatus?.serialLink?.baudRate || 9600} baud</strong></div>
              </div>
              <div className="rounded-lg border border-surface-container p-3 space-y-1.5">
                <div className="flex justify-between gap-3"><span>Vehicle state</span><strong>{isTruckPresent ? 'Detected at entrance' : 'Waiting for vehicle'}</strong></div>
                {activeLiveVisit && <>
                  <div className="flex justify-between gap-3"><span>Truck ID</span><strong>{activeLiveVisit.truckId || 'Identification needed'}</strong></div>
                  <div className="flex justify-between gap-3"><span>Plate number</span><strong>{activeLiveVisit.plateNumber || 'Awaiting manual entry'}</strong></div>
                  <div className="flex justify-between gap-3"><span>Arrival time</span><strong>{new Date(activeLiveVisit.arrivedAt).toLocaleTimeString()}</strong></div>
                  <div className="flex justify-between gap-3"><span>Distance / dwell</span><strong>{Number(activeLiveVisit.distanceCm).toFixed(1)} cm · {activeLiveVisit.dwellSeconds || currentDwell}s</strong></div>
                </>}
                {isTruckPresent && activeLiveVisit?.status === 'awaiting_identification' && <button
                  onClick={() => setShowAssignment(true)}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-primary text-white font-bold text-xs hover:bg-secondary transition-colors"
                >
                  Enter Truck Details
                </button>}
              </div>
              <p className="text-[11px] leading-relaxed">Bring a hand or object within 180 cm for three readings to trigger detection. The sensor detects presence; staff enter the truck identity. Keep Serial Monitor closed while BinPulse is using COM12.</p>
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
            {isHardwareMode ? 'Live values are physical Arduino ultrasonic readings; quantity remains an estimate.' : 'Simulation values are generated locally; no hardware reading is implied.'}
          </div>
        </div>
      </div>

      {isHardwareMode ? (
      <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-surface-container mb-4">
          <div>
            <h2 className="text-base font-bold text-primary">Live Arduino Yard Visit Log</h2>
            <p className="text-xs text-on-surface-variant">Physical detections and manually identified trucks only.</p>
          </div>
          <span className="text-xs font-mono text-outline">{liveVisits.length} live visit{liveVisits.length === 1 ? '' : 's'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-surface-container text-outline uppercase tracking-wider text-[10px]">
              <th className="pb-2 font-bold">Arrival</th><th className="pb-2 font-bold">Status</th><th className="pb-2 font-bold">Truck ID</th><th className="pb-2 font-bold">Plate</th><th className="pb-2 font-bold">Distance</th><th className="pb-2 font-bold">Dwell</th>
            </tr></thead>
            <tbody className="divide-y divide-surface-container-low">
              {liveVisits.map(v => <tr key={v.visitId}>
                <td className="py-2.5 font-mono">{new Date(v.arrivedAt).toLocaleTimeString()}</td>
                <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v.status === 'departed' ? 'bg-slate-200 text-slate-700' : v.status === 'identified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{v.status === 'departed' ? 'Departed' : v.status === 'identified' ? 'Identified' : 'Needs ID'}</span></td>
                <td className="py-2.5 font-mono font-bold">{v.truckId || '—'}</td>
                <td className="py-2.5 font-mono font-bold text-primary">{v.plateNumber || 'Pending'}</td>
                <td className="py-2.5 font-mono">{v.distanceCm == null ? '—' : `${Number(v.distanceCm).toFixed(1)} cm`}</td>
                <td className="py-2.5">{v.dwellSeconds || 0}s</td>
              </tr>)}
              {!liveVisits.length && <tr><td colSpan="6" className="py-8 text-center text-outline">Waiting for the first physical detection.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
      /* Simulation visit log stays on the simulation feed. */
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
      )}

      {showAssignment && isHardwareMode && isTruckPresent && activeLiveVisit?.status === 'awaiting_identification' && (
        <div className="fixed inset-0 z-[100] bg-slate-950/50 flex items-center justify-center p-4" role="presentation">
          <form onSubmit={saveLiveAssignment} className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6" role="dialog" aria-modal="true" aria-labelledby="live-truck-title">
            <div className="flex justify-between items-start gap-4 mb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Live sensor detection</p>
                <h2 id="live-truck-title" className="text-xl font-bold text-primary mt-1">Identify the detected truck</h2>
                <p className="text-xs text-on-surface-variant mt-1">Distance {Number(activeLiveVisit.distanceCm).toFixed(1)} cm · detected {new Date(activeLiveVisit.arrivedAt).toLocaleTimeString()}</p>
              </div>
              <button type="button" onClick={() => setShowAssignment(false)} className="text-outline hover:text-primary" aria-label="Close">✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-on-surface">Truck ID
                <input required maxLength="32" value={liveTruckId} onChange={e => setLiveTruckId(e.target.value.toUpperCase())} className="w-full mt-1 px-3 py-2 rounded-lg border border-surface-container-high bg-white" placeholder="LIVE-TRUCK-01" />
              </label>
              <label className="text-xs font-semibold text-on-surface">Number plate
                <input required maxLength="16" value={livePlateNumber} onChange={e => setLivePlateNumber(e.target.value.toUpperCase())} className="w-full mt-1 px-3 py-2 rounded-lg border border-surface-container-high bg-white" placeholder="TN-38-AB-1234" />
              </label>
              <label className="text-xs font-semibold text-on-surface sm:col-span-2">Waste category
                <select value={liveWasteCategory} onChange={e => setLiveWasteCategory(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-surface-container-high bg-white">
                  <option value="bio">Bio-Waste</option><option value="non-bio">Non-Bio Recyclable</option><option value="mixed">Mixed Waste</option>
                </select>
              </label>
            </div>
            <button type="button" onClick={regenerateLiveIdentity} className="text-xs text-secondary font-semibold mt-3 hover:underline">Generate demo truck ID and plate</button>
            {assignmentError && <p className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{assignmentError}</p>}
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setShowAssignment(false)} className="px-4 py-2 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low">Later</button>
              <button type="submit" disabled={assignmentBusy} className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-secondary disabled:opacity-50">{assignmentBusy ? 'Saving…' : 'Confirm Truck Arrival'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
