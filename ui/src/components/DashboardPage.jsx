import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { API_BASE } from '../lib/apiBase';
import RiskScoreCard from '../modules/dashboard/RiskScoreCard';
import DelinquencyCard from '../modules/dashboard/DelinquencyCard';
import RecentActivityCard from '../modules/dashboard/RecentActivityCard';
import AIAssistantCard from '../modules/dashboard/AIAssistantCard';
import CommunicationsLogCard from '../modules/dashboard/CommunicationsLogCard';
import PortfolioCampaignCard from '../modules/dashboard/PortfolioCampaignCard';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Always render something first; ids MUST match child keys below
const DEFAULT_LAYOUT = [
  { i: 'riskScore',        x: 0,  y: 0,  w: 4, h: 8, minW: 3, minH: 5 },
  { i: 'delinquencyChart', x: 4,  y: 0,  w: 4, h: 8, minW: 3, minH: 5 },
  { i: 'recentActivity',   x: 8,  y: 0,  w: 4, h: 8, minW: 3, minH: 5 },
  { i: 'assistant',        x: 0,  y: 8,  w: 4, h: 10, minW: 3, minH: 6 },
  { i: 'commsLog',         x: 4,  y: 8,  w: 4, h: 10, minW: 3, minH: 6 },
  { i: 'campaigns',        x: 8,  y: 8,  w: 4, h: 10, minW: 3, minH: 6 },
];

const API = API_BASE || ''; // prefer relative paths on Vercel

export default function DashboardPage({ orgId }) {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef(null);

  const breakpoints = useMemo(() => ({ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }), []);
  const cols        = useMemo(() => ({ lg: 12,   md: 12,  sm: 8,   xs: 4,   xxs: 2 }), []);

  // Only keep layout items that correspond to widgets we actually render
  const knownIds = useMemo(() => new Set(DEFAULT_LAYOUT.map(x => x.i)), []);

  const mergeServerLayout = useCallback((server = []) => {
    const filtered = server.filter(item => knownIds.has(item.i));
    // Ensure we have at least defaults for anything missing
    const byId = Object.fromEntries(DEFAULT_LAYOUT.map(x => [x.i, x]));
    filtered.forEach(x => { byId[x.i] = { ...byId[x.i], ...x }; });
    return Object.values(byId);
  }, [knownIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/dashboard-layout?key=home${orgId ? `&orgId=${encodeURIComponent(orgId)}`:''}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`GET layout ${res.status}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.layout)) {
          setLayout(mergeServerLayout(data.layout));
        }
      } catch (e) {
        // keep defaults; optionally log
        // console.warn(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [API, orgId, mergeServerLayout]);

  const saveLayout = useCallback(async (newLayout) => {
    try {
      await fetch(`${API}/api/dashboard-layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: 'home', orgId, layout: newLayout }),
      });
    } catch (_e) { /* swallow */ }
  }, [API, orgId]);

  const onLayoutChange = useCallback((current /*, allBreakpoints */) => {
    setLayout(current);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveLayout(current), 500);
  }, [saveLayout]);

  if (loading) return <div className="p-4">Loading dashboard…</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={30}
        onLayoutChange={onLayoutChange}
        isDraggable
        isResizable
        draggableHandle=".card-drag"
        measureBeforeMount={false}
        useCSSTransforms={typeof window !== 'undefined'}
      >
        <div key="riskScore" className="bg-white rounded-xl shadow p-3">
          <div className="card-drag cursor-move text-sm opacity-60 mb-2">Risk Score</div>
          <RiskScoreCard />
        </div>

        <div key="delinquencyChart" className="bg-white rounded-xl shadow p-3">
          <div className="card-drag cursor-move text-sm opacity-60 mb-2">Delinquency</div>
          <DelinquencyCard />
        </div>

        <div key="recentActivity" className="bg-white rounded-xl shadow p-3">
          <div className="card-drag cursor-move text-sm opacity-60 mb-2">Recent Activity</div>
          <RecentActivityCard />
        </div>
        
        <div key="assistant" className="bg-white rounded-xl shadow p-3">
          <div className="card-drag cursor-move text-sm opacity-60 mb-2">AI Assistant</div>
          <AIAssistantCard />
        </div>

        <div key="commsLog" className="bg-white rounded-xl shadow p-3">
          <div className="card-drag cursor-move text-sm opacity-60 mb-2">Communications Log</div>
          <CommunicationsLogCard />
        </div>

        <div key="campaigns" className="bg-white rounded-xl shadow p-3">
          <div className="card-drag cursor-move text-sm opacity-60 mb-2">Portfolio Campaigns</div>
          <PortfolioCampaignCard />
        </div>
      </ResponsiveGridLayout>
    </div>
  );
}
