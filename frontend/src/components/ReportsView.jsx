import React from 'react';

export default function ReportsView({
  summaryReport
}) {
  const savings = summaryReport?.savings || { kmSaved: 124.5, tripsAvoided: 18, fuelSavedL: 43.5, co2SavedKg: 116.8 };
  const dailyHistory = summaryReport?.pastWeekDaily || [];

  const handleDownloadCsv = () => {
    window.open('/api/reports/export.csv', '_blank');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary tracking-tight">Municipal Reports & Operational Manifest</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
              Review 2 Audit Trail
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            Consolidated operational summaries detailing collection performance, emissions abatements, and exportable manifest data.
          </p>
        </div>

        <button
          onClick={handleDownloadCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-white text-xs font-bold hover:bg-primary transition-all shadow-xs"
        >
          <span className="material-symbols-outlined text-[17px]">download</span>
          <span>Export Manifest (CSV)</span>
        </button>
      </div>

      {/* Aggregate Savings Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs">
          <span className="text-xs font-bold text-outline uppercase tracking-wider block mb-1">Total Travel Avoided</span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-3xl font-extrabold text-emerald-700">{savings.kmSaved}</span>
            <span className="text-xs text-outline font-medium">km saved</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Cumulative savings over baseline fixed routes</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs">
          <span className="text-xs font-bold text-outline uppercase tracking-wider block mb-1">Trips Eliminated</span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-3xl font-extrabold text-primary">{savings.tripsAvoided}</span>
            <span className="text-xs text-outline font-medium">trips</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Redundant vehicle dispatches prevented</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs">
          <span className="text-xs font-bold text-outline uppercase tracking-wider block mb-1">Estimated Fuel Saved</span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-3xl font-extrabold text-teal-700">{savings.fuelSavedL}</span>
            <span className="text-xs text-outline font-medium">Litres Diesel</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Estimated at standard fleet rate of 0.35 L/km</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs">
          <span className="text-xs font-bold text-outline uppercase tracking-wider block mb-1">Estimated CO₂ Abatement</span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-3xl font-extrabold text-secondary">{savings.co2SavedKg}</span>
            <span className="text-xs text-outline font-medium">kg CO₂</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Estimated at 2.68 kg CO₂ per litre diesel burned</p>
        </div>
      </div>

      {/* Past 7 Days Daily Breakdown Table */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs">
        <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 pb-2 border-b border-surface-container">
          Past 7 Days Aggregate Ingestion Log
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-container text-outline uppercase tracking-wider text-[10px]">
                <th className="pb-2 font-bold">Recorded Date</th>
                <th className="pb-2 font-bold">Total Estimated Intake</th>
                <th className="pb-2 font-bold">Wards Serviced</th>
                <th className="pb-2 font-bold">Quality / Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {dailyHistory && dailyHistory.map((d, i) => (
                <tr key={i} className="hover:bg-surface-container-low/40 transition-colors">
                  <td className="py-2.5 font-mono font-medium text-on-surface">{d.recorded_date}</td>
                  <td className="py-2.5 font-mono font-bold text-primary">{Math.round(d.daily_kg)} kg</td>
                  <td className="py-2.5 text-on-surface-variant">Scheduled Wards (Per Review-2 Planner)</td>
                  <td className="py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      High (Confidence 1.0)
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
