import React, { useEffect, useState } from 'react';

function Metric({ label, value, suffix = '' }) {
  return (
    <div className="rounded-lg border border-surface-container bg-surface-container-low p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold text-primary">{value}{suffix}</div>
    </div>
  );
}

export default function EcoRouteDataset() {
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/demo/ecoroute-records')
      .then((response) => {
        if (!response.ok) throw new Error(`Dataset request failed (${response.status})`);
        return response.json();
      })
      .then((data) => { if (active) setDataset(data); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-xl border border-amber-300 bg-amber-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary">EcoRoute Sample Dataset</h1>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              These supplied example records are simulated. Their weighbridge values, recommendations, and routes are not live ESP32 measurements or optimized routes.
            </p>
          </div>
          <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-900">SIMULATED DATA</span>
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {!dataset && !error && <div className="rounded-xl border border-surface-container bg-white p-6 text-sm text-outline">Loading supplied records…</div>}

      {dataset && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label="Records in supplied dataset" value={dataset.recordCount} />
            <Metric label="Data source" value={dataset.dataSource} />
            <Metric label="Live hardware feed" value="Separate" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {dataset.records.map((record) => (
              <article key={record.record_id} className="rounded-xl border border-surface-container bg-white p-5 shadow-xs">
                <div className="mb-4 flex items-center justify-between border-b border-surface-container pb-3">
                  <div>
                    <h2 className="font-bold text-primary">{record.area.name}</h2>
                    <p className="text-xs text-outline">{record.area.area_id} · {record.area.category}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">Record {record.record_id} · SIMULATED</span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Metric label="Estimated demand" value={record.area.estimated_demand_kg} suffix=" kg" />
                  <Metric label="Net weight" value={record.weighbridge.net_weight_kg} suffix=" kg" />
                  <Metric label="Capacity used" value={record.vehicle.capacity_utilization_percent} suffix="%" />
                  <Metric label="Recommendation" value={record.collection.recommendation.replaceAll('_', ' ')} />
                  <Metric label="Route distance" value={record.route.estimated_distance_km} suffix=" km" />
                  <Metric label="Travel time" value={record.route.estimated_travel_time_min} suffix=" min" />
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div><dt className="text-outline">Truck</dt><dd className="font-semibold text-on-surface">{record.weighbridge.truck_id}</dd></div>
                  <div><dt className="text-outline">Gross / tare</dt><dd className="font-semibold text-on-surface">{record.weighbridge.gross_weight_kg} / {record.weighbridge.tare_weight_kg} kg</dd></div>
                  <div><dt className="text-outline">Reason</dt><dd className="font-semibold text-on-surface">{record.collection.reason}</dd></div>
                  <div><dt className="text-outline">Demand spike</dt><dd className="font-semibold text-on-surface">{record.collection.demand_spike ? 'Yes' : 'No'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-outline">Example route sequence</dt><dd className="font-mono font-semibold text-on-surface">{record.route.route_sequence}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
