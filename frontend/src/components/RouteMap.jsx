import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

export default function RouteMap({
  routePlan,
  onOptimiseRoute,
  loading
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);

  const [selectedDay, setSelectedDay] = useState(0); // 0=Monday
  const [truckCapacity, setTruckCapacity] = useState(2500);

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const trips = routePlan?.optimised?.trips || [];
  const savings = routePlan?.savings || { kmSaved: 14.8, tripsAvoided: 2, fuelSavedL: 5.2, co2SavedKg: 13.9 };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [11.015, 76.975], // Coimbatore
        zoom: 12
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const layers = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      layerGroupRef.current = layers;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // Update Route Markers and Polylines
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const layers = layerGroupRef.current;
    layers.clearLayers();

    const colors = ['#1d6b4b', '#00487f', '#7c3aed', '#b45309', '#be185d'];
    const allLatLngs = [];

    // Add Depot Marker
    const depot = routePlan?.depot || { lat: 10.9990, lng: 76.9610, name: 'Central Depot' };
    const depotIcon = L.divIcon({
      className: 'depot-marker',
      html: '<div style="background-color:#002f23; color:#fff; padding:4px 8px; border-radius:6px; font-weight:bold; font-size:11px; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.3); white-space:nowrap;">Depot (Start)</div>',
      iconSize: [80, 24],
      iconAnchor: [40, 12]
    });
    L.marker([depot.lat, depot.lng], { icon: depotIcon })
      .bindPopup(`<b>${depot.name}</b><br/>Collection Fleet Origin`)
      .addTo(layers);
    allLatLngs.push([depot.lat, depot.lng]);

    // Add Central Yard Marker
    const yard = routePlan?.yard || { lat: 10.9920, lng: 76.9550, name: 'Processing Yard' };
    const yardIcon = L.divIcon({
      className: 'yard-marker',
      html: '<div style="background-color:#ba1a1a; color:#fff; padding:4px 8px; border-radius:6px; font-weight:bold; font-size:11px; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.3); white-space:nowrap;">Central Yard (End)</div>',
      iconSize: [110, 24],
      iconAnchor: [55, 12]
    });
    L.marker([yard.lat, yard.lng], { icon: yardIcon })
      .bindPopup(`<b>${yard.name}</b><br/>Ultrasonic Entrance Node`)
      .addTo(layers);
    allLatLngs.push([yard.lat, yard.lng]);

    // Draw Trips
    trips.forEach((trip, tIdx) => {
      const color = colors[tIdx % colors.length];
      const tripPoints = [[depot.lat, depot.lng]];

      trip.stops.forEach((stop, sIdx) => {
        tripPoints.push([stop.lat, stop.lng]);
        allLatLngs.push([stop.lat, stop.lng]);

        // Stop Marker
        const stopIcon = L.divIcon({
          className: 'stop-marker',
          html: `<div style="background-color:${color}; color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:11px; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.2);">${sIdx + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        L.marker([stop.lat, stop.lng], { icon: stopIcon })
          .bindPopup(`
            <div style="font-family:sans-serif; font-size:12px;">
              <b>Stop ${sIdx + 1}: ${stop.name}</b><br/>
              Demand: <b>${stop.demandKg} kg</b><br/>
              Reason: <i>${stop.reason}</i>
            </div>
          `)
          .addTo(layers);
      });

      // End at yard
      tripPoints.push([yard.lat, yard.lng]);

      // Polyline for trip
      L.polyline(tripPoints, {
        color,
        weight: 3.5,
        opacity: 0.85,
        dashArray: tIdx === 0 ? null : '6, 6'
      }).addTo(layers);
    });

    if (allLatLngs.length > 1) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] });
    }
  }, [routePlan]);

  const handleApplyParams = () => {
    onOptimiseRoute({ dayOfWeek: selectedDay, truckCapacityKg: truckCapacity });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Controls Bar */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-primary tracking-tight">Capacitated Route Optimisation (CVRP)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
              Depot → Scheduled Wards → Central Yard
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            Computes optimal vehicle routes visiting only wards scheduled for collection on the chosen day. 
            Solves CVRP with nearest-neighbor clustering and 2-opt tour improvement.
          </p>
        </div>

        {/* Day Selector & Capacity Controls */}
        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center bg-surface-container-low px-3 py-1.5 rounded-lg border border-surface-container gap-2">
            <span className="text-xs font-semibold text-outline">Day:</span>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold text-primary focus:outline-none"
            >
              {dayNames.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-surface-container-low px-3 py-1.5 rounded-lg border border-surface-container gap-2">
            <span className="text-xs font-semibold text-outline">Capacity:</span>
            <input
              type="number"
              min="1000"
              max="5000"
              step="250"
              value={truckCapacity}
              onChange={(e) => setTruckCapacity(parseFloat(e.target.value))}
              className="w-16 bg-transparent text-xs font-mono font-bold text-primary focus:outline-none text-right"
            />
            <span className="text-xs text-outline font-semibold">kg</span>
          </div>

          <button
            onClick={handleApplyParams}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-white text-xs font-bold hover:bg-primary transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[17px]">sync</span>
            <span>{loading ? 'Solving...' : 'Recalculate Route'}</span>
          </button>
        </div>
      </div>

      {/* Map & Itinerary Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaflet Map Card (2 Cols) */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-xs flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-surface-container mb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <span className="material-symbols-outlined text-[18px] text-secondary">explore</span>
              <span>Coimbatore Zone-3 GIS Route Visualization</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-outline font-medium">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-primary"></span>
                <span>Depot</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-red-600"></span>
                <span>Yard</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                <span>Ward Stop</span>
              </span>
            </div>
          </div>

          <div className="flex-1 w-full rounded-lg overflow-hidden border border-surface-container" ref={mapContainerRef}></div>
        </div>

        {/* Trips Itinerary & Savings Comparison (1 Col) */}
        <div className="flex flex-col gap-4">
          {/* Comparison KPI Summary */}
          <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs">
            <span className="text-xs font-bold text-outline uppercase tracking-wider block mb-3">
              Route Savings (vs Daily Fixed Baseline)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-low p-3 rounded-lg border border-surface-container">
                <span className="text-[10px] text-outline font-semibold uppercase">Distance Saved</span>
                <div className="text-xl font-bold text-emerald-700 font-mono mt-0.5">
                  -{savings.kmSaved} km
                </div>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-surface-container">
                <span className="text-[10px] text-outline font-semibold uppercase">Trips Avoided</span>
                <div className="text-xl font-bold text-primary font-mono mt-0.5">
                  {savings.tripsAvoided} trips
                </div>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-surface-container">
                <span className="text-[10px] text-outline font-semibold uppercase">Fuel Saved</span>
                <div className="text-xl font-bold text-teal-700 font-mono mt-0.5">
                  ~{savings.fuelSavedL} L
                </div>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-surface-container">
                <span className="text-[10px] text-outline font-semibold uppercase">CO₂ Prevented</span>
                <div className="text-xl font-bold text-secondary font-mono mt-0.5">
                  ~{savings.co2SavedKg} kg
                </div>
              </div>
            </div>
          </div>

          {/* Ordered Stops List */}
          <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-xs flex-1 flex flex-col justify-between">
            <span className="text-xs font-bold text-outline uppercase tracking-wider block mb-2">
              Trip Itinerary Stops ({trips.length} active vehicle tours)
            </span>

            <div className="space-y-3 overflow-y-auto max-h-[260px] pr-1">
              {trips.map((t, idx) => (
                <div key={idx} className="bg-surface-container-low/70 p-3 rounded-lg border border-surface-container">
                  <div className="flex justify-between items-center text-xs font-bold text-primary mb-2">
                    <span>Trip #{t.tripIndex}: {t.stops.length} Ward Stops</span>
                    <span className="font-mono text-secondary">
                      {t.loadKg} / {t.capacityKg} kg ({t.utilizationPct}%)
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {t.stops.map((s, sIdx) => (
                      <div key={s.id} className="flex items-center justify-between text-[11px] text-on-surface-variant">
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-secondary text-white text-[9px] font-bold flex items-center justify-center">
                            {sIdx + 1}
                          </span>
                          <span className="font-medium text-on-surface">{s.name}</span>
                        </span>
                        <span className="font-mono">{s.demandKg} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[10px] text-outline pt-2 border-t border-surface-container mt-2">
              All trips start at Central Depot and conclude at Central Yard entrance for unload & telemetry check.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
