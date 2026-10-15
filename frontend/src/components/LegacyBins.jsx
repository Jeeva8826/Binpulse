import React, { useEffect, useState } from 'react';

export default function LegacyBins() {
  const [liveBin, setLiveBin] = useState(null);
  const [serialStatus, setSerialStatus] = useState({ status: 'offline', port: 'COM12', baudRate: 115200 });
  useEffect(() => {
    const refresh = () => {
      fetch('/api/bins/').then(r => r.json()).then(rows => {
      const current = Array.isArray(rows) ? rows.find(row => row.binId === 'BIN01') : null;
      if (current) setLiveBin(current);
      }).catch(() => {});
      fetch('/api/device/serial').then(r => r.json()).then(setSerialStatus).catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 2000);
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

  const legacyBins = [
    { id: 'BIN01', name: 'My Bin (Hardware Node)', fill: 0, rate: null, hoursToFull: null, isReal: true },
    { id: 'SIM01', name: 'Gandhipuram Bus Stand', fill: 82, rate: 12.0, hoursToFull: 1.5, isReal: false },
    { id: 'SIM02', name: 'DB Road RS Puram', fill: 45, rate: 4.2, hoursToFull: 13.1, isReal: false },
    { id: 'SIM03', name: '100 Feet Road', fill: 74, rate: 9.1, hoursToFull: 2.9, isReal: false },
    { id: 'SIM04', name: 'Town Hall Market East', fill: 91, rate: 15.0, hoursToFull: 0.6, isReal: false },
    { id: 'SIM05', name: 'Saibaba Temple St', fill: 32, rate: 3.0, hoursToFull: 22.7, isReal: false },
    { id: 'SIM06', name: 'Avinashi Road Peelamedu', fill: 61, rate: 7.4, hoursToFull: 5.3, isReal: false },
    { id: 'SIM07', name: 'Race Course North', fill: 28, rate: 2.1, hoursToFull: 34.2, isReal: false },
    { id: 'SIM08', name: 'Singanallur Junction', fill: 77, rate: 10.5, hoursToFull: 2.2, isReal: false },
    { id: 'SIM09', name: 'Saravanampatti Tech Zone', fill: 86, rate: 14.2, hoursToFull: 1.0, isReal: false },
    { id: 'SIM10', name: 'Ukkadam Bus Terminus', fill: 55, rate: 6.0, hoursToFull: 7.5, isReal: false },
    { id: 'SIM11', name: 'Kovaipudur Square', fill: 19, rate: 1.8, hoursToFull: 45.0, isReal: false }
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Optional single-bin monitor notice */}
      <div className="bg-amber-50 border border-amber-300 p-5 rounded-xl shadow-xs flex items-start gap-3">
        <span className="material-symbols-outlined text-[24px] text-amber-700 shrink-0">info</span>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-amber-900">
            Arduino Uno Single-Bin Monitor
          </span>
          <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
            Connect the Arduino Uno over USB to send live ultrasonic fill readings for BIN01. The other cards are fixed sample values. The backend reads {serialStatus.port} at {serialStatus.baudRate} baud; close Arduino IDE Serial Monitor while BinPulse is using the port.
          </p>
        </div>
      </div>

      {/* Legacy Bins Grid */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs">
        <div className="flex justify-between items-center pb-3 border-b border-surface-container mb-4">
          <h2 className="text-sm font-bold text-primary uppercase tracking-wider">
            Arduino Live Feed & Sample Bin Cards
          </h2>
          <span className="text-xs text-outline font-medium">Arduino {serialStatus.status === 'online' ? 'connected' : 'waiting'} · BIN01: {liveBin ? `${readingIsFresh ? 'Live' : 'Last saved'} · ${new Date(liveBin.timestamp).toLocaleTimeString()}` : 'Waiting for sensor'} · other cards are samples</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {legacyBins.map((item) => {
            const b = item.id === 'BIN01' && liveBin ? { ...item, ...liveBin } : item;
            const isFull = b.fill >= 75;
            const isWarn = b.fill >= 50 && b.fill < 75;

            return (
              <div key={b.id} className="p-4 rounded-lg bg-surface-container-low border border-surface-container flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono font-bold text-primary text-xs">{b.id}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      b.isReal ? 'bg-secondary-container text-on-secondary-container' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {b.isReal ? (readingIsFresh ? 'Arduino Live' : 'Last Reading') : 'Simulated Sample'}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-on-surface block truncate">{b.name}</span>
                </div>

                <div className="my-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-outline">Fill Level</span>
                    <span className="font-mono font-bold text-on-surface">{b.id === 'BIN01' && !liveBin ? 'Waiting' : `${b.fill}%`}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isFull ? 'bg-red-600' : isWarn ? 'bg-amber-500' : 'bg-secondary'
                      }`}
                      style={{ width: `${b.id === 'BIN01' && !liveBin ? 0 : b.fill}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-outline pt-2 border-t border-surface-container">
                  {b.id === 'BIN01' ? <span>{liveBin ? `Volume: ${liveBin.volumeL} / ${liveBin.capacityL} L` : 'No sensor data yet'}</span> : <span>Rate: {b.rate}%/hr</span>}
                  {b.id !== 'BIN01' && <span className="font-medium text-on-surface">Full in ~{b.hoursToFull}h</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {serialStatus.error && <p className="text-xs text-amber-800">Arduino serial status: {serialStatus.error}</p>}
    </div>
  );
}
