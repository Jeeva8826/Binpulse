import React, { useState, useEffect } from 'react';

export default function SettingsView({
  settings,
  onSaveSettings,
  loading
}) {
  const [formValues, setFormValues] = useState({});

  useEffect(() => {
    if (settings) {
      const initial = {};
      for (const [k, v] of Object.entries(settings)) {
        initial[k] = v.value;
      }
      setFormValues(initial);
    }
  }, [settings]);

  const handleChange = (key, val) => {
    setFormValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSettings(formValues);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary tracking-tight">System Configuration & Thresholds</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
              Operational Parameters
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            Configure yard entrance sensor calibration, bulk waste density factors, public-health max-gap thresholds, 
            and multi-area attribution strategies.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary text-white text-xs font-bold hover:bg-primary transition-all shadow-xs disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[17px]">save</span>
          <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* Yard Sensor & Physics */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-col gap-4">
          <h2 className="text-sm font-bold text-primary uppercase tracking-wider pb-2 border-b border-surface-container">
            Yard Entrance Sensor Calibration
          </h2>

          <div>
            <label className="font-semibold text-on-surface block mb-1">
              Truck Presence Threshold (cm):
            </label>
            <input
              type="number"
              value={formValues.TRUCK_PRESENT_CM || 180}
              onChange={(e) => handleChange('TRUCK_PRESENT_CM', e.target.value)}
              className="w-full bg-surface-container-low border border-surface-container rounded-lg p-2 font-mono font-medium focus:outline-none focus:border-secondary"
            />
            <span className="text-[10px] text-outline mt-0.5 block">Distance below which a vehicle is considered present at the yard</span>
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">
              Empty Truck Bed Distance (cm):
            </label>
            <input
              type="number"
              value={formValues.TRUCK_BED_EMPTY_DISTANCE_CM || 180}
              onChange={(e) => handleChange('TRUCK_BED_EMPTY_DISTANCE_CM', e.target.value)}
              className="w-full bg-surface-container-low border border-surface-container rounded-lg p-2 font-mono font-medium focus:outline-none focus:border-secondary"
            />
            <span className="text-[10px] text-outline mt-0.5 block">Distance from overhead sensor down to the empty truck floor</span>
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">
              Quantity Estimation Mode:
            </label>
            <select
              value={formValues.QUANTITY_MODE || 'load_level'}
              onChange={(e) => handleChange('QUANTITY_MODE', e.target.value)}
              className="w-full bg-surface-container-low border border-surface-container rounded-lg p-2 font-medium focus:outline-none focus:border-secondary"
            >
              <option value="load_level">Load-Level (Overhead Ultrasonic Depth × Bed Area × Density)</option>
              <option value="trip_count">Trip-Count (75% Nominal Capacity per Completed Visit)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">
              Multi-Area Attribution Strategy:
            </label>
            <select
              value={formValues.ATTRIBUTION_STRATEGY || 'single_area'}
              onChange={(e) => handleChange('ATTRIBUTION_STRATEGY', e.target.value)}
              className="w-full bg-surface-container-low border border-surface-container rounded-lg p-2 font-medium focus:outline-none focus:border-secondary"
            >
              <option value="single_area">Strategy 1: Single-Area Dispatch (Exact 100%)</option>
              <option value="weighted">Strategy 2: Weighted Demographic Allocation (Population Pro-Rata)</option>
              <option value="calibrated">Strategy 3: Historical Calibration Regression (Ridge / Least-Squares)</option>
            </select>
          </div>
        </div>

        {/* Public Health & Fleet Specs */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-col gap-4">
          <h2 className="text-sm font-bold text-primary uppercase tracking-wider pb-2 border-b border-surface-container">
            Public Health & Fleet Constraints
          </h2>

          <div>
            <label className="font-semibold text-on-surface block mb-1">
              Max Gap Between Collections — Bio-Waste (Days):
            </label>
            <input
              type="number"
              min="1"
              max="7"
              value={formValues.MAX_GAP_DAYS_BIO || 2}
              onChange={(e) => handleChange('MAX_GAP_DAYS_BIO', e.target.value)}
              className="w-full bg-surface-container-low border border-surface-container rounded-lg p-2 font-mono font-medium focus:outline-none focus:border-secondary"
            />
            <span className="text-[10px] text-outline mt-0.5 block">Mandatory limit to prevent organic waste decay & health hazards</span>
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">
              Max Gap Between Collections — Non-Bio (Days):
            </label>
            <input
              type="number"
              min="1"
              max="14"
              value={formValues.MAX_GAP_DAYS_NON_BIO || 3}
              onChange={(e) => handleChange('MAX_GAP_DAYS_NON_BIO', e.target.value)}
              className="w-full bg-surface-container-low border border-surface-container rounded-lg p-2 font-mono font-medium focus:outline-none focus:border-secondary"
            />
            <span className="text-[10px] text-outline mt-0.5 block">Dry recyclables storage capacity window</span>
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">
              Default Truck Payload Capacity (kg):
            </label>
            <input
              type="number"
              step="100"
              value={formValues.DEFAULT_TRUCK_CAPACITY_KG || 2500}
              onChange={(e) => handleChange('DEFAULT_TRUCK_CAPACITY_KG', e.target.value)}
              className="w-full bg-surface-container-low border border-surface-container rounded-lg p-2 font-mono font-medium focus:outline-none focus:border-secondary"
            />
          </div>

          <div className="pt-2 border-t border-surface-container">
            <label className="font-semibold text-on-surface block mb-1">
              Enable Light Machine Learning Engine:
            </label>
            <div className="flex items-center gap-3 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formValues.ML_MODE_ENABLED === 'true'}
                  onChange={(e) => handleChange('ML_MODE_ENABLED', e.target.checked ? 'true' : 'false')}
                  className="rounded accent-secondary w-4 h-4"
                />
                <span className="font-medium text-xs text-on-surface">
                  Activate per-weekday ML models when ≥ 4 weeks history exists
                </span>
              </label>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
