import React, { useEffect, useState } from 'react';

export default function LegacyBins() {
  const [liveBin, setLiveBin] = useState(null);
  const [serialStatus, setSerialStatus] = useState({ status: 'offline', port: 'COM12', baudRate: 9600 });

  useEffect(() => {
    const refresh = () => {
      fetch('/api/bins/').then(r => r.json()).then(rows => {
        const current = Array.isArray(rows) ? rows.find(row => row.binId === 'BIN01') : null;
        if (current) setLiveBin(current);
      }).catch(() => {});
      fetch('/api/device/serial').then(r => r.json()).then(setSerialStatus).catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 1500);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'BIN_TELEMETRY' && msg.data.binId === 'BIN01') setLiveBin(msg.data);
      } catch {}
    };
    return () => { window.clearInterval(timer); ws.close(); };
  }, []);

  const liveAgeMs = liveBin ? Date.now() - new Date(liveBin.timestamp).getTime() : Infinity;
  const readingIsFresh = liveAgeMs <= 10000;
  const hasLiveReading = Boolean(liveBin && readingIsFresh);
  const fill = Number(liveBin?.fill ?? 0);
  const fillStatus = fill >= 80 ? 'Full alert' : fill >= 50 ? 'High fill' : fill >= 30 ? 'Filling' : 'Below alert threshold';

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs">
        <div className="flex flex-wrap justify-between items-start gap-4 pb-5 border-b border-surface-container">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Physical sensor · Arduino Uno</p>
            <h1 className="text-2xl font-bold text-primary mt-1">Live Sensor Dashboard</h1>
            <p className="text-sm text-on-surface-variant mt-1">Live ultrasonic fill readings from BIN01 over USB serial.</p>
          </div>
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${serialStatus.status === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
            <span className={`w-2 h-2 rounded-full ${serialStatus.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {serialStatus.status === 'online' ? `Connected · ${serialStatus.port}` : `Waiting · ${serialStatus.port}`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="p-5 rounded-xl bg-surface-container-low border border-surface-container">
            <div className="text-xs font-semibold text-on-surface-variant">Bin fill level</div>
            <div className="text-4xl font-bold text-primary mt-2">{hasLiveReading ? `${fill}%` : '—'}</div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-4">
              <div className={`h-full rounded-full transition-all ${fill >= 80 ? 'bg-red-600' : fill >= 50 ? 'bg-amber-500' : 'bg-secondary'}`} style={{ width: `${hasLiveReading ? Math.min(100, Math.max(0, fill)) : 0}%` }} />
            </div>
            <div className="text-xs text-outline mt-2">{hasLiveReading ? fillStatus : 'Waiting for a fresh sensor sample'}</div>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-low border border-surface-container">
            <div className="text-xs font-semibold text-on-surface-variant">Sensor distance</div>
            <div className="text-4xl font-bold text-primary mt-2">{hasLiveReading && liveBin.distanceCm != null ? `${Number(liveBin.distanceCm).toFixed(1)} cm` : '—'}</div>
            <div className="text-xs text-outline mt-2">Measured by HC-SR04 on D9 / D10</div>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-low border border-surface-container">
            <div className="text-xs font-semibold text-on-surface-variant">Connection details</div>
            <div className="text-lg font-bold text-primary mt-2">{serialStatus.baudRate} baud</div>
            <div className="text-xs text-outline mt-2">{hasLiveReading ? `Last reading ${new Date(liveBin.timestamp).toLocaleTimeString()}` : 'Waiting for Arduino data'}</div>
          </div>
        </div>
      </section>

      {serialStatus.error && <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-4">{serialStatus.error}</p>}
      {!serialStatus.error && !hasLiveReading && <p className="text-sm text-on-surface-variant bg-surface-container-low rounded-lg p-4">Connect the Arduino and close Serial Monitor so BinPulse can receive the live data. Simulation data remains in the separate operations dashboard.</p>}
      {hasLiveReading && <p className="text-xs text-on-surface-variant">This page shows physical BIN01 sensor data only. Simulation and operational demo data remain on the existing dashboard.</p>}
    </div>
  );
}
