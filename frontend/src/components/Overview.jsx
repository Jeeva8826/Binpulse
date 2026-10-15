import React from 'react';

export default function Overview({
  routePlan,
  summaryReport,
  yardStatus,
  areas,
  setActiveTab
}) {
  const savings = routePlan?.savings || summaryReport?.savings || {
    kmSaved: 14.8,
    tripsAvoided: 2,
    fuelSavedL: 5.2,
    co2SavedKg: 13.9,
    isEstimate: true
  };

  const baseline = routePlan?.baseline || { totalKm: 24.6, tripsCount: 3, stopsCount: 9 };
  const optimised = routePlan?.optimised || { totalKm: 9.8, tripsCount: 1, stopsCount: 4 };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Mission Header */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary tracking-tight">Coimbatore Smart Waste Operations</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Review 2 Centralised Architecture
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            Eliminating fragile per-bin sensors in favor of centralised yard arrival sensing and accumulation-rate driven scheduling. 
            Vehicles collect only wards scheduled by health-gap rules, dramatically reducing daily municipal kilometers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('routes')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-white text-xs font-bold hover:bg-primary transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[17px]">map</span>
            <span>View Active Route</span>
          </button>
          <button
            onClick={() => setActiveTab('yard-monitor')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container transition-all"
          >
            <span className="material-symbols-outlined text-[17px]">sensors</span>
            <span>Yard Telemetry</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Baseline Route */}
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline text-[11px] font-bold uppercase tracking-wider">
            <span>Baseline Plan</span>
            <span className="material-symbols-outlined text-[18px]">straighten</span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-on-surface">{baseline.totalKm}</span>
              <span className="text-xs text-outline font-medium">km</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Fixed daily route visiting all {baseline.stopsCount || 9} wards
            </p>
          </div>
          <div className="text-[10px] text-outline font-medium pt-2 border-t border-surface-container">
            {baseline.tripsCount || 3} separate truck dispatches
          </div>
        </div>

        {/* Card 2: Optimised Route */}
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-secondary-container shadow-xs flex flex-col justify-between bg-gradient-to-b from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-secondary text-[11px] font-bold uppercase tracking-wider">
            <span>Optimised Route</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">local_shipping</span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-secondary">{optimised.totalKm}</span>
              <span className="text-xs text-secondary font-medium">km</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Data-scheduled wards ({optimised.stopsCount || 4} stops)
            </p>
          </div>
          <div className="text-[10px] text-secondary font-semibold pt-2 border-t border-surface-container">
            {optimised.tripsCount || 1} optimised trip (CVRP 2-opt)
          </div>
        </div>

        {/* Card 3: Distance Saved */}
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline text-[11px] font-bold uppercase tracking-wider">
            <span>Distance Saved</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">route</span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-emerald-700">-{savings.kmSaved}</span>
              <span className="text-xs text-emerald-700 font-medium">km</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Avoided empty travel vs baseline
            </p>
          </div>
          <div className="text-[10px] text-emerald-700 font-bold pt-2 border-t border-surface-container">
            {savings.tripsAvoided} unnecessary trips eliminated
          </div>
        </div>

        {/* Card 4: Fuel & Emissions (Estimated) */}
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline text-[11px] font-bold uppercase tracking-wider">
            <span>Fuel & Carbon Impact</span>
            <span className="material-symbols-outlined text-[18px] text-teal-600">energy_savings_leaf</span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-primary">{savings.fuelSavedL}</span>
              <span className="text-xs text-outline font-medium">L saved</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Prevents <span className="font-semibold text-secondary">{savings.co2SavedKg} kg CO₂</span> emissions
            </p>
          </div>
          <div className="text-[10px] text-amber-700 font-medium pt-2 border-t border-surface-container">
            * Estimated @ 0.35 L/km diesel
          </div>
        </div>

        {/* Card 5: Yard Entrance Telemetry */}
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline text-[11px] font-bold uppercase tracking-wider">
            <span>Central Yard Ingestion</span>
            <span className="material-symbols-outlined text-[18px] text-primary">sensors</span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-primary">
                {yardStatus?.today?.visitCount || 0}
              </span>
              <span className="text-xs text-outline font-medium">trucks today</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              ~{Math.round(yardStatus?.today?.totalEstimatedKg || 0)} kg estimated intake
            </p>
          </div>
          <div className="text-[10px] text-secondary font-semibold pt-2 border-t border-surface-container">
            Ultrasonic status: {yardStatus?.device?.status === 'online' ? 'Online' : 'Standby'}
          </div>
        </div>
      </div>

      {/* Ward Status & Operational Priority Matrix */}
      <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-surface-container mb-4">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-primary">Municipal Ward Priority & Generation Status</h2>
            <p className="text-xs text-on-surface-variant">Classified using 60-day moving accumulation trends and public-health constraints</p>
          </div>
          <button
            onClick={() => setActiveTab('analytics')}
            className="text-xs font-semibold text-secondary hover:text-primary transition-all flex items-center gap-1"
          >
            <span>Full Ward Analytics</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-container text-outline uppercase tracking-wider text-[10px]">
                <th className="pb-2 font-bold">Ward Code</th>
                <th className="pb-2 font-bold">Ward Name</th>
                <th className="pb-2 font-bold">Category</th>
                <th className="pb-2 font-bold">Classification</th>
                <th className="pb-2 font-bold">Est. Daily Generation</th>
                <th className="pb-2 font-bold">Population</th>
                <th className="pb-2 font-bold">Collection Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {areas && areas.map((area) => {
                const isHigh = area.current_class === 'HIGH';
                const isMed = area.current_class === 'MEDIUM';
                const isBio = area.waste_category === 'bio';

                return (
                  <tr key={area.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-2.5 font-mono font-bold text-primary">{area.code}</td>
                    <td className="py-2.5 font-medium text-on-surface">{area.name}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isBio ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {isBio ? 'Biodegradable' : 'Non-Bio Recyclable'}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isHigh ? 'bg-red-100 text-red-800' : isMed ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {area.current_class}
                      </span>
                    </td>
                    <td className="py-2.5 font-semibold text-on-surface">
                      {Math.round(area.base_rate_kg_day || 450)} kg/day
                    </td>
                    <td className="py-2.5 text-on-surface-variant">
                      {area.population?.toLocaleString() || '15,000'}
                    </td>
                    <td className="py-2.5 text-on-surface-variant text-[11px]">
                      {isHigh ? 'Routine 4x/week (Max 2d gap)' : isMed ? '3x/week schedule' : '2x/week bi-weekly'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
