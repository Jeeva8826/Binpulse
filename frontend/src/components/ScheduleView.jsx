import React, { useState } from 'react';

export default function ScheduleView({
  schedule,
  onGenerateSchedule,
  loading
}) {
  const [selectedCell, setSelectedCell] = useState(null);

  const dayNames = schedule?.dayNames || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const grid = schedule?.grid || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Title & Controls */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary tracking-tight">Data-Driven Smart Collection Schedule</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
              Week of {schedule?.weekStartDate || 'Active Week'}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            Collection schedules are derived from historical accumulation rates and public health constraints. 
            High-density and bio-waste areas have a mandatory max-gap of 2 days; standard areas 3 days. 
            Hover or click any cell to inspect the algorithmic justification.
          </p>
        </div>

        <button
          onClick={onGenerateSchedule}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-white text-xs font-bold hover:bg-primary transition-all shadow-xs disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[17px]">auto_mode</span>
          <span>{loading ? 'Optimizing...' : 'Regenerate Weekly Plan'}</span>
        </button>
      </div>

      {/* Constraints & Rules Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
            <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-on-surface">Bio-Waste Max Gap: 2 Days</span>
            <span className="text-[11px] text-on-surface-variant">Prevents microbial degradation & odors</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-800">
            <span className="material-symbols-outlined text-[20px]">recycling</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-on-surface">Non-Bio Max Gap: 3 Days</span>
            <span className="text-[11px] text-on-surface-variant">Dry recyclable material accumulation</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
            <span className="material-symbols-outlined text-[20px]">bolt</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-on-surface">Spike & Weekend Rules</span>
            <span className="text-[11px] text-on-surface-variant">Extra collections dynamically inserted</span>
          </div>
        </div>
      </div>

      {/* Weekly Schedule Grid (Area × Day) */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-surface-container mb-4">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-primary">Ward × Weekday Dispatch Matrix</h2>
            <p className="text-xs text-on-surface-variant">Click any active collection marker to view the mathematical reason</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-secondary"></span>
              <span className="text-on-surface-variant">Scheduled</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-on-surface-variant">Extra (Spike/Weekend)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-200"></span>
              <span className="text-outline">No Visit</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-surface-container text-outline uppercase tracking-wider text-[11px]">
                <th className="pb-3 pr-4 font-bold min-w-[160px]">Municipal Ward</th>
                <th className="pb-3 px-2 font-bold min-w-[70px]">Class</th>
                {dayNames.map((d, idx) => (
                  <th key={idx} className="pb-3 px-3 font-bold text-center">
                    {d.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {grid.map((row) => (
                <tr key={row.areaId} className="hover:bg-surface-container-low/40 transition-colors">
                  <td className="py-3.5 pr-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-on-surface text-xs">{row.areaName}</span>
                      <span className="text-[10px] text-outline font-mono">{row.areaCode} • {row.wasteCategory}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      row.currentClass === 'HIGH' ? 'bg-red-100 text-red-800' :
                      row.currentClass === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {row.currentClass}
                    </span>
                  </td>

                  {row.days.map((isScheduled, dayIdx) => {
                    const reason = row.reasons[dayIdx];
                    const isExtra = reason && (reason.includes('EXTRA') || reason.includes('Weekend'));
                    const isSelected = selectedCell?.areaId === row.areaId && selectedCell?.dayIdx === dayIdx;

                    return (
                      <td key={dayIdx} className="py-3.5 px-3 text-center">
                        {isScheduled ? (
                          <button
                            onClick={() => setSelectedCell({ areaId: row.areaId, dayIdx, row, reason })}
                            className={`w-7 h-7 rounded-full inline-flex items-center justify-center transition-all ${
                              isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
                            } ${
                              isExtra
                                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs'
                                : 'bg-secondary text-white hover:bg-primary shadow-xs'
                            }`}
                            title={reason || 'Scheduled Collection'}
                          >
                            <span className="material-symbols-outlined text-[15px]">check</span>
                          </button>
                        ) : (
                          <span className="inline-block w-2 h-2 rounded-full bg-slate-200"></span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Selected Cell Detail Modal / Card */}
        {selectedCell && (
          <div className="mt-4 p-4 rounded-xl bg-surface-container border border-surface-container-high flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">info</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">
                  {selectedCell.row.areaName} ({dayNames[selectedCell.dayIdx]} Collection)
                </span>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  <strong>Recommendation Rationale:</strong> {selectedCell.reason}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-xs font-semibold text-outline hover:text-on-surface"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
