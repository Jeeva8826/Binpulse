import React, { useState } from 'react';

export default function DispatchForm({
  trucks,
  areas,
  trips,
  onStartTrip,
  onCompleteTrip,
  loading
}) {
  const [selectedTruck, setSelectedTruck] = useState('');
  const [driverName, setDriverName] = useState('');
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [category, setCategory] = useState('bio');
  const [notes, setNotes] = useState('');
  const [attributionStrategy, setAttributionStrategy] = useState('auto');

  const handleToggleArea = (areaId) => {
    setSelectedAreas(prev =>
      prev.includes(areaId) ? prev.filter(id => id !== areaId) : [...prev, areaId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedTruck || selectedAreas.length === 0) {
      alert('Please select a truck and at least one municipal ward.');
      return;
    }

    const strat = attributionStrategy === 'auto'
      ? (selectedAreas.length === 1 ? 'single_area' : 'weighted')
      : attributionStrategy;

    onStartTrip({
      truckId: selectedTruck,
      driverName: driverName || 'Designated Driver',
      areaIds: selectedAreas,
      wasteCategory: category,
      attributionStrategy: strat,
      notes
    });

    // Reset form
    setSelectedAreas([]);
    setNotes('');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary tracking-tight">Driver & Dispatch Input Console</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
              Fleet Assignment
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            Because a single ultrasonic sensor measures distance only, truck identity, assigned wards, and waste category 
            originate here. When the truck later passes the yard entrance sensor, the visit links to this dispatch record.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dispatch Form (1 Col) */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs">
          <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 pb-2 border-b border-surface-container">
            Dispatch Vehicle on Route
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
            {/* Truck Selector */}
            <div>
              <label className="font-semibold text-on-surface block mb-1">Select Collection Truck:</label>
              <select
                value={selectedTruck}
                onChange={(e) => {
                  setSelectedTruck(e.target.value);
                  const t = trucks.find(tr => tr.id === e.target.value);
                  if (t) setDriverName(t.driver_name);
                }}
                required
                className="w-full bg-surface-container-low border border-surface-container rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-secondary"
              >
                <option value="">-- Choose Truck --</option>
                {trucks && trucks.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.plate_number} ({t.driver_name} - {t.capacity_kg} kg)
                  </option>
                ))}
              </select>
            </div>

            {/* Driver Name */}
            <div>
              <label className="font-semibold text-on-surface block mb-1">Driver Name:</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Driver name"
                className="w-full bg-surface-container-low border border-surface-container rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-secondary"
              />
            </div>

            {/* Waste Category */}
            <div>
              <label className="font-semibold text-on-surface block mb-1">Waste Stream Category:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('bio')}
                  className={`py-2 px-3 rounded-lg font-bold border transition-all ${
                    category === 'bio'
                      ? 'bg-secondary text-white border-secondary shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant border-surface-container'
                  }`}
                >
                  Biodegradable
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('non-bio')}
                  className={`py-2 px-3 rounded-lg font-bold border transition-all ${
                    category === 'non-bio'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant border-surface-container'
                  }`}
                >
                  Non-Bio Recyclable
                </button>
              </div>
            </div>

            {/* Municipal Wards Selection */}
            <div>
              <label className="font-semibold text-on-surface block mb-1">
                Wards Visited ({selectedAreas.length} selected):
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto bg-surface-container-low p-2 rounded-lg border border-surface-container">
                {areas && areas.map(a => {
                  const checked = selectedAreas.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                        checked ? 'bg-secondary-container text-on-secondary-container font-semibold' : 'hover:bg-surface-container'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleArea(a.id)}
                        className="rounded accent-secondary"
                      />
                      <span>{a.name} ({a.code})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Attribution Strategy */}
            <div>
              <label className="font-semibold text-on-surface block mb-1">Area Attribution Strategy:</label>
              <select
                value={attributionStrategy}
                onChange={(e) => setAttributionStrategy(e.target.value)}
                className="w-full bg-surface-container-low border border-surface-container rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-secondary"
              >
                <option value="auto">Auto (Single-Area if 1 ward, Demographic if multi)</option>
                <option value="single_area">Strategy 1: Single-Area Exact (100% confidence)</option>
                <option value="weighted">Strategy 2: Weighted Demographic Split (Population Pro-Rata)</option>
                <option value="calibrated">Strategy 3: Calibrated Historical Regression (Least-Squares)</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="font-semibold text-on-surface block mb-1">Dispatch Notes:</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Morning commercial sweep"
                className="w-full bg-surface-container-low border border-surface-container rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-secondary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-secondary text-white font-bold text-xs hover:bg-primary transition-all shadow-xs disabled:opacity-50"
            >
              {loading ? 'Dispatching...' : 'Dispatch Vehicle on Route'}
            </button>
          </form>
        </div>

        {/* Active & Recent Dispatched Trips (2 Cols) */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-container mb-4">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider">
                Active & Recent Vehicle Dispatches
              </h2>
              <span className="text-xs text-outline font-mono">
                {trips ? trips.filter(t => t.status === 'dispatched').length : 0} En Route
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-container text-outline uppercase tracking-wider text-[10px]">
                    <th className="pb-2 font-bold">Trip ID</th>
                    <th className="pb-2 font-bold">Vehicle</th>
                    <th className="pb-2 font-bold">Driver</th>
                    <th className="pb-2 font-bold">Wards Covered</th>
                    <th className="pb-2 font-bold">Category</th>
                    <th className="pb-2 font-bold">Status</th>
                    <th className="pb-2 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {trips && trips.slice(0, 15).map((t) => {
                    const isDispatched = t.status === 'dispatched';
                    return (
                      <tr key={t.id} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="py-2.5 font-mono font-bold text-primary">{t.id.slice(-8)}</td>
                        <td className="py-2.5 font-mono text-on-surface">{t.plate_number}</td>
                        <td className="py-2.5 text-on-surface-variant">{t.driver_name || t.truck_driver}</td>
                        <td className="py-2.5 text-on-surface">
                          {t.areas ? t.areas.map(a => a.code).join(', ') : 'Assigned Wards'}
                        </td>
                        <td className="py-2.5 capitalize font-medium">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.waste_category === 'non-bio' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {t.waste_category}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isDispatched ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isDispatched ? 'On Route' : 'Completed'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {isDispatched && (
                            <button
                              onClick={() => onCompleteTrip(t.id)}
                              className="px-2 py-1 rounded bg-surface-container text-primary hover:bg-secondary hover:text-white transition-all text-[11px] font-semibold"
                              title="Manually complete trip if not auto-cleared by yard sensor"
                            >
                              Arrived at Yard
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[11px] text-outline pt-3 border-t border-surface-container mt-4">
            Notice: Completed trips automatically trigger area attribution according to the configured multi-area strategy.
          </div>
        </div>
      </div>
    </div>
  );
}
