import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Overview from './components/Overview';
import YardMonitor from './components/YardMonitor';
import ScheduleView from './components/ScheduleView';
import RouteMap from './components/RouteMap';
import Analytics from './components/Analytics';
import DispatchForm from './components/DispatchForm';
import AlertsView from './components/AlertsView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import LegacyBins from './components/LegacyBins';
import EcoRouteDataset from './components/EcoRouteDataset';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isHardwareMode, setIsHardwareModeState] = useState(
    () => localStorage.getItem('binpulse-mode') === 'hardware'
  );
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Core Data States
  const [yardStatus, setYardStatus] = useState(null);
  const [visits, setVisits] = useState([]);
  const [areas, setAreas] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [trips, setTrips] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [routePlan, setRoutePlan] = useState(null);
  const [classification, setClassification] = useState(null);
  const [categories, setCategories] = useState(null);
  const [trends, setTrends] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [summaryReport, setSummaryReport] = useState(null);
  const [settings, setSettings] = useState(null);

  const wsRef = useRef(null);
  const modeRef = useRef(isHardwareMode);

  const setIsHardwareMode = (enabled) => {
    modeRef.current = enabled;
    setIsHardwareModeState(enabled);
    localStorage.setItem('binpulse-mode', enabled ? 'hardware' : 'simulation');
    refreshAllData(enabled);
  };

  // Fetch all initial data
  const refreshAllData = async (hardwareMode = modeRef.current) => {
    try {
      const [
        yardRes,
        visitsRes,
        areasRes,
        trucksRes,
        tripsRes,
        schedRes,
        routeRes,
        classRes,
        catRes,
        trendRes,
        alertsRes,
        repRes,
        settingsRes
      ] = await Promise.all([
        fetch(`/api/yard/status?source=${hardwareMode ? 'hardware' : 'simulation'}`).then(r => r.json()).catch(() => null),
        fetch('/api/yard/visits?limit=30').then(r => r.json()).catch(() => []),
        fetch('/api/areas').then(r => r.json()).catch(() => []),
        fetch('/api/trucks').then(r => r.json()).catch(() => []),
        fetch('/api/dispatch/trips').then(r => r.json()).catch(() => []),
        fetch('/api/schedule').then(r => r.json()).catch(() => null),
        fetch('/api/routes').then(r => r.json()).catch(() => null),
        fetch('/api/classify/status').then(r => r.json()).catch(() => null),
        fetch('/api/analytics/categories').then(r => r.json()).catch(() => null),
        fetch('/api/analytics/trends').then(r => r.json()).catch(() => null),
        fetch('/api/alerts').then(r => r.json()).catch(() => []),
        fetch('/api/reports/summary').then(r => r.json()).catch(() => null),
        fetch('/api/settings').then(r => r.json()).catch(() => null)
      ]);

      if (yardRes) setYardStatus(yardRes);
      if (visitsRes) setVisits(visitsRes);
      if (areasRes) setAreas(areasRes);
      if (trucksRes) setTrucks(trucksRes);
      if (tripsRes) setTrips(tripsRes);
      if (schedRes) setSchedule(schedRes);
      if (routeRes) setRoutePlan(routeRes);
      if (classRes) setClassification(classRes);
      if (catRes) setCategories(catRes);
      if (trendRes) setTrends(trendRes);
      if (alertsRes) setAlerts(alertsRes);
      if (repRes) setSummaryReport(repRes);
      if (settingsRes) setSettings(settingsRes);
    } catch (err) {
      console.warn('Initial data load error:', err);
    }
  };

  useEffect(() => {
    refreshAllData();

    // WebSocket real-time connection
    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'YARD_TELEMETRY') {
            const isSimulatorReading = String(msg.data.deviceId || '').endsWith('_SIM');
            if (isSimulatorReading === modeRef.current) return;
            setYardStatus(prev => ({
              ...prev,
              latestDistanceCm: msg.data.distanceCm,
              isTruckPresent: msg.data.isTruckPresent,
              currentDwellSeconds: msg.data.dwellSeconds,
              latestReadingAt: msg.data.timestamp,
              latestEvent: msg.data.event,
              latestDeviceId: msg.data.deviceId,
              activeLiveVisit: msg.data.activeLiveVisit ?? prev?.activeLiveVisit,
              device: {
                ...prev?.device,
                deviceId: msg.data.deviceId,
                status: 'online',
                lastSeenAt: msg.data.timestamp
              }
            }));
          } else if (msg.type === 'LIVE_YARD_VISIT') {
            setYardStatus(prev => ({
              ...prev,
              activeLiveVisit: msg.data?.status === 'departed' ? null : msg.data
            }));
          } else if (msg.type === 'TRUCK_VISIT_COMPLETED') {
            const isSimulatorVisit = String(msg.data.deviceId || '').endsWith('_SIM');
            if (isSimulatorVisit === modeRef.current) return;
            // Prepend new visit
            setVisits(prev => [msg.data, ...prev]);
            refreshAllData(); // Refresh summary and attribution
          }
        } catch (e) {
          // ignore
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWs, 3000); // Reconnect
      };

      wsRef.current = ws;
    };

    connectWs();

    // Polling fallback every 10s for alerts & stats
    const interval = setInterval(() => refreshAllData(modeRef.current), 10000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Action handlers
  const handleSeedDemoData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulate/seed', { method: 'POST' });
      if (!response.ok) throw new Error('Could not reload the demo dataset');
      await refreshAllData();
    } catch (error) {
      alert(error.message || 'Could not reload demo data');
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (!confirm('Reset simulation data back to baseline?')) return;
    setLoading(true);
    try {
      const resetResponse = await fetch('/api/simulate/reset', { method: 'POST' });
      if (!resetResponse.ok) throw new Error('Could not reset simulated data');
      const seedResponse = await fetch('/api/simulate/seed', { method: 'POST' });
      if (!seedResponse.ok) throw new Error('Data was reset but the demo baseline could not be restored');
      await refreshAllData();
    } catch (error) {
      alert(error.message || 'Could not reset demo data');
    } finally {
      setLoading(false);
    }
  };

  const handleInjectDistance = async (distanceCm) => {
    if (isHardwareMode) return;
    await fetch('/api/simulate/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distanceCm })
    });
  };

  const handleSimulateTruckEvent = async (params) => {
    if (isHardwareMode) return;
    await fetch('/api/simulate/truck-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    await refreshAllData();
  };

  const handleStartTrip = async (tripData) => {
    setLoading(true);
    try {
      await fetch('/api/dispatch/trips/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData)
      });
      await refreshAllData();
      setActiveTab('yard-monitor');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTrip = async (tripId) => {
    await fetch(`/api/dispatch/trips/${tripId}/complete`, { method: 'POST' });
    await refreshAllData();
  };

  const handleGenerateSchedule = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schedule/generate', { method: 'POST' });
      const newSched = await res.json();
      setSchedule(newSched);
    } finally {
      setLoading(false);
    }
  };

  const handleOptimiseRoute = async (params) => {
    setLoading(true);
    try {
      const res = await fetch('/api/routes/optimise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const newPlan = await res.json();
      setRoutePlan(newPlan);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (alertId) => {
    await fetch(`/api/alerts/${alertId}/resolve`, { method: 'POST' });
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const handleSaveSettings = async (newSettings) => {
    setLoading(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      await refreshAllData();
      alert('Settings saved successfully!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Fixed Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alerts.length}
        isHardwareMode={isHardwareMode}
        yardOnline={yardStatus?.device?.status === 'online'}
      />

      {/* Main Content Area */}
      <div className="pl-64 flex-1 flex flex-col min-w-0">
        {/* Fixed Top Navbar */}
        <Navbar
          isHardwareMode={isHardwareMode}
          setIsHardwareMode={setIsHardwareMode}
          onSeedDemoData={handleSeedDemoData}
          onResetData={handleResetData}
          loading={loading}
          mlMode={classification?.mode || 'rule_based'}
          wsConnected={wsConnected}
        />

        {/* Dynamic Route Body */}
        <main className="app-main pt-20 px-8 pb-12 flex-1 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <Overview
              routePlan={routePlan}
              summaryReport={summaryReport}
              yardStatus={yardStatus}
              areas={areas}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'yard-monitor' && (
            <YardMonitor
              yardStatus={yardStatus}
              visits={visits}
              trucks={trucks}
              isHardwareMode={isHardwareMode}
              onInjectDistance={handleInjectDistance}
              onSimulateTruckEvent={handleSimulateTruckEvent}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleView
              schedule={schedule}
              onGenerateSchedule={handleGenerateSchedule}
              loading={loading}
            />
          )}

          {activeTab === 'routes' && (
            <RouteMap
              routePlan={routePlan}
              onOptimiseRoute={handleOptimiseRoute}
              loading={loading}
            />
          )}

          {activeTab === 'analytics' && (
            <Analytics
              classification={classification}
              categories={categories}
              trends={trends}
            />
          )}

          {activeTab === 'dispatch' && (
            <DispatchForm
              trucks={trucks}
              areas={areas}
              trips={trips}
              onStartTrip={handleStartTrip}
              onCompleteTrip={handleCompleteTrip}
              loading={loading}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsView
              alerts={alerts}
              onResolveAlert={handleResolveAlert}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              summaryReport={summaryReport}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              loading={loading}
            />
          )}

          {activeTab === 'legacy-bins' && (
            <LegacyBins />
          )}

          {activeTab === 'dataset' && (
            <EcoRouteDataset />
          )}
        </main>
      </div>
    </div>
  );
}
