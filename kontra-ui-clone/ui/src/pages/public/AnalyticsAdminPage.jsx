import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

// ── Auth gate (same pattern as PilotAdminPage) ────────────────────────────────
function PasswordGate({ onAuth }) {
  const [pwd, setPwd]       = useState("");
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  async function check(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/analytics`, {
        headers: { "x-pilot-password": pwd },
      });
      if (r.status === 401) { setErr("Wrong password."); return; }
      if (r.status === 503) { setErr("PILOT_ADMIN_PASSWORD not set on server."); return; }
      if (!r.ok) { setErr("Server error — check API logs."); return; }
      sessionStorage.setItem("pilot_admin_pwd", pwd);
      onAuth(pwd);
    } catch {
      setErr("Cannot reach API. Is the backend running?");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mx-auto mb-3 text-xl">📊</div>
          <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
          <p className="text-xs text-gray-400 mt-1">Kontra internal — not publicly linked</p>
        </div>
        <form onSubmit={check} className="space-y-4">
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
            placeholder="Admin password" autoFocus
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <button type="submit" disabled={!pwd || loading}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 transition">
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Funnel bar ────────────────────────────────────────────────────────────────
function FunnelBar({ steps }) {
  if (!steps.length) return <p className="text-xs text-gray-400 py-4 text-center">No data yet.</p>;
  const max = Math.max(...steps.map(s => s.sessions), 1);
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const prev = i === 0 ? null : steps[i - 1];
        const pct = Math.round((s.sessions / max) * 100);
        const dropPct = prev && prev.sessions > 0
          ? Math.round(((prev.sessions - s.sessions) / prev.sessions) * 100)
          : null;
        return (
          <div key={s.phase}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-700">
                Phase {s.phase} — {s.label}
              </span>
              <div className="flex items-center gap-2">
                {dropPct !== null && dropPct > 0 && (
                  <span className="text-[10px] font-bold text-red-400">−{dropPct}% dropped</span>
                )}
                <span className="text-xs font-bold text-gray-900">{s.sessions.toLocaleString()}</span>
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: i === 0 ? "#1f2937" : pct > 50 ? "#16a34a" : pct > 25 ? "#d97706" : "#dc2626" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab breakdown ─────────────────────────────────────────────────────────────
const TAB_LABELS = {
  overview:     "Overview",
  documents:    "Documents",
  participants: "Participants",
  tasks:        "Tasks",
  activity:     "Activity",
  settings:     "Settings",
  intelligence: "Intelligence",
};

function TabBreakdown({ tabs }) {
  if (!tabs.length) return <p className="text-xs text-gray-400 py-4 text-center">No tab data yet.</p>;
  const max = Math.max(...tabs.map(t => t.count), 1);
  return (
    <div className="divide-y divide-gray-100">
      {tabs.map((t, i) => (
        <div key={t.tab} className="flex items-center gap-3 py-2.5">
          <span className="text-[10px] text-gray-400 w-4 text-right shrink-0">{i + 1}</span>
          <span className="text-xs font-semibold text-gray-800 w-24 shrink-0">{TAB_LABELS[t.tab] || t.tab}</span>
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.round((t.count / max) * 100)}%`, background: "#800020" }} />
          </div>
          <span className="text-xs font-bold text-gray-700 w-10 text-right shrink-0">{t.count.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalyticsAdminPage() {
  const [password, setPassword] = useState(() => sessionStorage.getItem("pilot_admin_pwd") || "");
  const [data, setData]         = useState(null);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const loadAnalytics = useCallback(async (pwd) => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/analytics`, {
        headers: { "x-pilot-password": pwd },
      });
      if (!r.ok) throw new Error("Failed to load analytics");
      setData(await r.json());
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (password) loadAnalytics(password);
  }, [password, loadAnalytics]);

  if (!password) {
    return <PasswordGate onAuth={setPassword} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/pilot" className="text-gray-400 hover:text-gray-700 transition text-sm">← Pilot Admin</Link>
            <span className="text-gray-200">|</span>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Session Analytics</h1>
              <p className="text-[10px] text-gray-400">Last 7 days · anonymous sessions only</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => loadAnalytics(password)}
              className="text-xs text-gray-400 hover:text-gray-700 transition px-2 py-1 rounded-lg hover:bg-gray-50">
              Refresh
            </button>
            <button onClick={() => { sessionStorage.removeItem("pilot_admin_pwd"); setPassword(""); }}
              className="text-xs text-gray-400 hover:text-gray-700 transition">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Table-missing banner */}
        {data?.table_missing && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <p className="text-sm font-semibold text-amber-900 mb-1">Analytics table not created yet</p>
            <p className="text-xs text-amber-700">
              The <code className="font-mono bg-amber-100 px-1 rounded">analytics_events</code> table is created automatically when the API restarts.
              Events will appear here within a few minutes once users start navigating the product.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

        {loading && !data && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        )}

        {data && (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Events (7d)", value: data.total_events.toLocaleString(), icon: "⚡" },
                { label: "Unique workspaces viewed", value: data.unique_workspaces_viewed.toLocaleString(), icon: "🏠" },
                { label: "Creation funnel starts", value: (data.funnel[0]?.sessions ?? 0).toLocaleString(), icon: "🚀" },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="text-2xl mb-1">{k.icon}</div>
                  <p className="text-2xl font-black text-gray-900">{k.value}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Workspace creation funnel */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-bold text-gray-900 mb-1">Workspace creation funnel</h2>
              <p className="text-xs text-gray-400 mb-5">
                How many sessions reached each phase. Drop-off between phases tells you where users get confused or give up.
              </p>
              <FunnelBar steps={data.funnel} />
            </div>

            {/* Tab visits */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-bold text-gray-900 mb-1">Workspace tabs — visit counts</h2>
              <p className="text-xs text-gray-400 mb-5">
                Which sections coordinators actually open. High-count tabs are load-bearing; low-count may be ignored or hard to find.
              </p>
              <TabBreakdown tabs={data.tab_visits} />
            </div>

            {/* How to read this */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-bold text-gray-700 mb-2">How to read this</h3>
              <ul className="space-y-1.5 text-xs text-gray-500">
                <li><strong className="text-gray-700">Phase 0 → 1 drop-off:</strong> Users who start but don't complete the AI description or template selection.</li>
                <li><strong className="text-gray-700">Phase 1 → 2 drop-off:</strong> Users who see the preview but abandon before entering their details.</li>
                <li><strong className="text-gray-700">Phase 2 → 3 drop-off:</strong> Users who fill in their info but don't click "Activate."</li>
                <li><strong className="text-gray-700">Tab counts:</strong> Normalized to the number of navigation events — not unique users.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
