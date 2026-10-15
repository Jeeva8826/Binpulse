import React from 'react';

export default function Sidebar({ activeTab, setActiveTab, alertCount, isHardwareMode, yardOnline }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'grid_view' },
    { id: 'yard-monitor', label: 'Yard Entrance Node', icon: 'sensors', badge: yardOnline ? 'LIVE' : 'OFFLINE', badgeColor: yardOnline ? 'bg-secondary-container text-on-secondary-container' : 'bg-red-100 text-red-700' },
    { id: 'schedule', label: 'Smart Schedule', icon: 'calendar_month' },
    { id: 'routes', label: 'Route Planning', icon: 'alt_route' },
    { id: 'analytics', label: 'Area Analytics', icon: 'analytics' },
    { id: 'dispatch', label: 'Driver Dispatch', icon: 'local_shipping' },
    { id: 'alerts', label: 'Alerts & Risks', icon: 'notifications', badge: alertCount > 0 ? `${alertCount}` : null, badgeColor: 'bg-error-container text-on-error-container' },
    { id: 'reports', label: 'Manifest & Reports', icon: 'summarize' },
    { id: 'dataset', label: 'EcoRoute Sample Data', icon: 'dataset', badge: 'DEMO', badgeColor: 'bg-amber-100 text-amber-800' },
    { id: 'settings', label: 'System Settings', icon: 'tune' },
    { id: 'legacy-bins', label: 'Live Sensor Dashboard', icon: 'sensors', badge: 'BIN01', badgeColor: 'bg-secondary-container text-on-secondary-container' }
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-low z-50 flex flex-col justify-between shadow-sm border-r border-surface-container">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand header */}
        <div className="h-16 px-4 flex items-center gap-3 bg-surface-container-low border-b border-surface-container">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white shadow-sm">
            <span className="material-symbols-outlined text-[22px]">recycling</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-primary tracking-tight leading-none">BinPulse</span>
            <span className="text-[11px] text-on-surface-variant leading-tight truncate">EcoRoute Autonomous Yard</span>
          </div>
        </div>

        {/* Navigation list */}
        <div className="px-3 py-3 overflow-y-auto flex-1 min-h-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-outline px-2 mb-2">
            Operations & Control
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                    active
                      ? 'bg-secondary-container text-on-secondary-container font-semibold border-l-4 border-primary shadow-xs'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`material-symbols-outlined text-[19px] ${active ? 'text-primary' : 'text-outline'}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* System status card at bottom */}
      <div className="p-3 m-3 bg-surface-container rounded-xl border border-surface-container-high shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-on-surface pb-1 border-b border-surface-container-high">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-secondary">hub</span>
            Telemetry Link
          </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${!isHardwareMode ? 'bg-blue-100 text-blue-800' : yardOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {!isHardwareMode ? 'SIMULATOR' : yardOnline ? 'ACTIVE' : 'WAITING'}
          </span>
        </div>
        <div className="flex flex-col gap-1 mt-2 text-[11px] text-on-surface-variant">
          <div className="flex justify-between">
            <span>Yard Feed</span>
            <span className="font-semibold text-primary">{isHardwareMode ? (yardOnline ? 'Arduino Live' : 'Arduino Waiting') : 'Simulator'}</span>
          </div>
          <div className="flex justify-between">
            <span>Yard Ingestion</span>
            <span className="text-secondary font-medium">Port 5000 /ws</span>
          </div>
          <div className="flex justify-between text-outline text-[10px]">
            <span>Algorithm</span>
            <span>Review 2 Data-Driven</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
