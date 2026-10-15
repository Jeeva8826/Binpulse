import React from 'react';

export default function Analytics({
  classification,
  categories,
  trends
}) {
  const areas = classification?.areas || [];
  const catList = categories?.categories || [];
  const trendList = (trends?.trends || []).filter((item) => Number.isFinite(Number(item.total_kg)));
  const trendDays = trendList.length;
  const trendAverage = trendDays
    ? Math.round(trendList.reduce((sum, item) => sum + Number(item.total_kg), 0) / trendDays)
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary tracking-tight">Municipal Waste Generation Analytics</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
              {classification?.mode === 'ml' ? 'ML Smoothing Active' : 'Rule-Based Statistical Engine'}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            {classification?.modeExplanation || 'Evaluating daily waste accumulation across 9 Coimbatore wards over an 8-week history.'}
            {' '}These area totals use the seeded simulated dataset; the ultrasonic sensor reports live yard distance and truck presence, not ward-by-ward waste weights.
          </p>
        </div>
      </div>

      {/* Category Breakdown & Trend Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bio vs Non-Bio Breakdown */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-outline uppercase tracking-wider block mb-3">
            Waste Segregation Distribution
          </span>

          <div className="space-y-4 my-2">
            {catList.map((cat) => (
              <div key={cat.waste_category} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-on-surface capitalize">
                      {cat.waste_category === 'bio' ? 'Biodegradable (Food/Organic)' : cat.waste_category === 'non-bio' ? 'Non-Bio Recyclables' : 'Mixed Waste'}
                  </span>
                  <span className="font-mono font-bold text-primary">{cat.percentage}%</span>
                </div>
                <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      cat.waste_category === 'bio' ? 'bg-secondary' : 'bg-blue-600'
                    }`}
                    style={{ width: `${cat.percentage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-outline font-medium">
                  <span>{cat.record_count} total collections</span>
                  <span>{Math.round(cat.total_kg).toLocaleString()} kg total</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-outline pt-2 border-t border-surface-container">
            Density: Bio ~450 kg/m³, Non-Bio ~180 kg/m³
          </div>
        </div>

        {/* 30-Day Generation Trend Preview */}
        <div className="md:col-span-2 bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-outline uppercase tracking-wider">
              30-Day City-Wide Intake Trend (kg/day)
            </span>
            <span className="text-xs font-semibold text-secondary">
              {trendDays >= 6 ? `${trendDays}-day history · Avg: ${trendAverage.toLocaleString()} kg/day` : `History: ${trendDays}/6 days`}
            </span>
          </div>

          {/* SVG Trend Sparkline */}
          <div className="h-40 w-full relative my-2">
            {trendDays >= 6 ? (
              <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d6b4b" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#1d6b4b" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Generate polyline points from trendList */}
                {(() => {
                  const maxVal = Math.max(...trendList.map(t => t.total_kg), 6000);
                  const minVal = Math.min(...trendList.map(t => t.total_kg), 2000);
                  const points = trendList.slice(-25).map((t, i) => {
                    const x = (i / 24) * 480 + 10;
                    const y = 110 - ((t.total_kg - minVal) / (maxVal - minVal || 1)) * 90;
                    return `${x},${y}`;
                  }).join(' ');

                  const areaPoints = `10,110 ${points} 490,110`;

                  return (
                    <>
                      <polygon points={areaPoints} fill="url(#trendGrad)" />
                      <polyline points={points} fill="none" stroke="#1d6b4b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-xs text-outline">
                <span className="material-symbols-outlined text-2xl">monitoring</span>
                <span>{trendDays === 0
                  ? 'No trend records found. Reload demo data to populate analytics.'
                  : `Only ${trendDays} day${trendDays === 1 ? '' : 's'} of records found. At least 6 days are needed to chart a trend.`}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between text-[11px] text-outline pt-2 border-t border-surface-container">
            <span>30 Days Ago</span>
            <span>Mid-Period</span>
            <span className="font-semibold text-primary">Today</span>
          </div>
        </div>
      </div>

      {/* Ward Classification & Rationale Table */}
      <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-surface-container mb-4">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-primary">Ward Classification Rationale & Weekday Generation Profiles</h2>
            <p className="text-xs text-on-surface-variant">
              Classified into High, Medium, Low based on accumulation thresholds (&gt;550 kg/day = HIGH, 320-550 kg/day = MEDIUM, &lt;320 kg/day = LOW)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-container text-outline uppercase tracking-wider text-[10px]">
                <th className="pb-3 font-bold">Ward</th>
                <th className="pb-3 font-bold">Classification</th>
                <th className="pb-3 font-bold">Mean Daily Generation</th>
                <th className="pb-3 font-bold">Variability (± Std)</th>
                <th className="pb-3 font-bold">Trend</th>
                <th className="pb-3 font-bold">Spike Status</th>
                <th className="pb-3 font-bold">Algorithmic Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {areas.map((a) => (
                <tr key={a.areaId} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-3 font-medium text-on-surface">
                    <span className="font-bold text-primary">{a.name}</span>
                    <span className="text-[10px] text-outline block font-mono">{a.code}</span>
                  </td>
                  <td className="py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      a.currentClass === 'HIGH' ? 'bg-red-100 text-red-800' :
                      a.currentClass === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {a.currentClass}
                    </span>
                  </td>
                  <td className="py-3 font-mono font-bold text-primary">
                    {a.avgDailyKg} kg/day
                  </td>
                  <td className="py-3 font-mono text-outline">
                    ±{a.stdDevKg} kg
                  </td>
                  <td className="py-3 capitalize font-medium text-on-surface-variant">
                    {a.trend}
                  </td>
                  <td className="py-3">
                    {a.spikeDetected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                        Spike ({a.spikeRatio}x)
                      </span>
                    ) : (
                      <span className="text-[10px] text-outline font-medium">Normal</span>
                    )}
                  </td>
                  <td className="py-3 text-[11px] text-on-surface-variant max-w-xs">
                    {a.rationale}
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
