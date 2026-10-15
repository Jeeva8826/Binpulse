import React from 'react';

export default function Navbar({
  isHardwareMode,
  setIsHardwareMode,
  mlMode,
  wsConnected,
  onSeedDemoData,
  onResetData,
  loading
}) {
  return (
    <header className="app-navbar fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest/95 backdrop-blur-md z-40 px-6 flex items-center justify-between border-b border-surface-container shadow-xs">
      {/* Left Context */}
      <div className="app-navbar-context flex items-center gap-4 min-w-0">
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-[16px] text-secondary">location_city</span>
            <span className="font-semibold text-on-surface">Coimbatore Central Municipal Zone</span>
            <span className="text-outline-variant">•</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-secondary-container text-on-secondary-container font-semibold">
              <span className="material-symbols-outlined text-[12px] text-secondary">eco</span>
              SDG 11: Sustainable Cities
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-outline mt-0.5">
            <span>Depot: 10.999° N, 76.961° E</span>
            <span>•</span>
            <span>Central Yard: 10.992° N, 76.955° E</span>
          </div>
        </div>
      </div>

      {/* Center Mode Banners */}
      <div className="app-navbar-mode flex items-center">
        {/* Hardware vs Simulation Toggle Banner */}
        <div className="flex items-center bg-surface-container-low px-3 py-1 rounded-full border border-surface-container gap-2">
          <span className="text-[11px] font-semibold text-on-surface-variant">Yard feed:</span>
          <button
            onClick={() => setIsHardwareMode(false)}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
              !isHardwareMode ? 'bg-secondary text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Simulation
          </button>
          <button
            onClick={() => setIsHardwareMode(true)}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
              isHardwareMode ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            ESP32 Yard
          </button>
        </div>

      </div>

      <div className="app-navbar-status flex items-center gap-3">
        {/* Intelligence Mode Banner */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-surface-container text-primary border border-surface-container-high">
          <span className="material-symbols-outlined text-[15px] text-secondary">psychology</span>
          <span>Engine:</span>
          <span className="font-bold text-secondary uppercase">
            {mlMode === 'ml' ? 'Light ML (Active)' : 'Rule-Based Stats'}
          </span>
        </div>

        {/* WebSocket Live Sync */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-surface-container-low text-on-surface-variant border border-surface-container">
          <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`}></span>
          <span className="font-medium">{wsConnected ? 'Live Yard Sync' : 'Reconnecting...'}</span>
        </div>
      </div>

      {/* Right Quick Actions */}
      {!isHardwareMode && <div className="app-navbar-actions flex items-center gap-2">
        <button
          onClick={onSeedDemoData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface transition-all border border-surface-container-high shadow-xs"
          title="Reload 8+ weeks of realistic historical data for 9 Coimbatore wards"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">database</span>
          <span>{loading ? 'Seeding...' : 'Reload Demo Data'}</span>
        </button>

        <button
          onClick={onResetData}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-error hover:bg-red-50 transition-all border border-transparent hover:border-red-200"
          title="Reset simulation data"
        >
          <span className="material-symbols-outlined text-[16px]">restart_alt</span>
          <span>Reset</span>
        </button>
      </div>}
    </header>
  );
}
