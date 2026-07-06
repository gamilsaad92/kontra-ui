import { useState, useEffect, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const PORTAL_COLORS = {
  lender:   { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500"    },
  servicer: { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500"  },
  investor: { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500" },
  borrower: { bg: "bg-emerald-100",text: "text-emerald-700",dot: "bg-emerald-500"},
  other:    { bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400"   },
};

function PortalBadge({ portal }) {
  const c = PORTAL_COLORS[portal] || PORTAL_COLORS.other;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {portal || "—"}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
      <p className="text-3xl font-bold text-black">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function computeStats(visitors) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayVisits = visitors.filter(v => new Date(v.visited_at) >= today).length;
  const uniqueIPs = new Set(visitors.map(v => v.ip)).size;
  const portalCounts = {};
  visitors.forEach(v => { if (v.portal) portalCounts[v.portal] = (portalCounts[v.portal] || 0) + 1; });
  const topPortal = Object.entries(portalCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const countryCounts = {};
  visitors.forEach(v => { if (v.country) countryCounts[v.country] = (countryCounts[v.country] || 0) + 1; });
  const topCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  return { todayVisits, uniqueIPs, topPortal, topCountry, total: visitors.length };
}

export default function AdminVisitorsPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed]     = useState(false);
  const [error, setError]       = useState("");
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filter, setFilter]     = useState("all");

  const fetchVisitors = useCallback(async (key) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/visitors`, {
        headers: { "x-admin-key": key },
      });
      if (res.status === 401) { setError("Wrong password. Try again."); setAuthed(false); return; }
      const data = await res.json();
      setVisitors(data.visitors || []);
      setLastRefresh(new Date());
    } catch {
      setError("Could not reach the API. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleLogin(e) {
    e.preventDefault();
    setError("");
    setAuthed(true);
    fetchVisitors(password);
  }

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => fetchVisitors(password), 30000);
    return () => clearInterval(id);
  }, [authed, password, fetchVisitors]);

  const filtered = filter === "all" ? visitors : visitors.filter(v => v.portal === filter);
  const stats    = computeStats(visitors);

  // ── Login screen ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                 style={{ background: "#800020" }}>K</div>
            <div>
              <p className="text-black font-semibold text-sm">Kontra Admin</p>
              <p className="text-gray-500 text-xs">Visitor Analytics</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="bg-white border border-gray-200 rounded-2xl p-7 flex flex-col gap-4 shadow-sm">
            <h1 className="text-black font-semibold text-lg">Admin Access</h1>
            <p className="text-gray-600 text-sm">Enter your admin password to view visitor data.</p>

            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-black text-sm
                         placeholder:text-gray-400 focus:outline-none focus:border-red-800 transition"
            />
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition hover:opacity-90"
              style={{ background: "#800020" }}
            >
              View Analytics
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 text-black">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm"
               style={{ background: "#800020" }}>K</div>
          <div>
            <p className="text-black font-semibold text-sm">Visitor Analytics</p>
            <p className="text-gray-500 text-xs">
              {lastRefresh ? `Last updated ${formatTime(lastRefresh.toISOString())}` : "Loading..."}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchVisitors(password)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50
                     border border-gray-300 rounded-lg text-xs text-gray-700 transition disabled:opacity-50 shadow-sm"
        >
          {loading ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15"/>
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          )}
          Refresh
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Visits"    value={stats.total}        sub="all time" />
          <StatCard label="Today"           value={stats.todayVisits}  sub="since midnight" />
          <StatCard label="Unique Visitors" value={stats.uniqueIPs}    sub="by IP address" />
          <StatCard label="Top Portal"      value={stats.topPortal}    sub="most visited" />
          <StatCard label="Top Country"     value={stats.topCountry}   sub="by location" />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {["all", "lender", "servicer", "investor", "borrower", "other"].map(p => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize border
                ${filter === p
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-black"
                }`}
            >
              {p === "all" ? `All (${visitors.length})` : p}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-10 h-10 mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <p className="text-sm text-gray-500">{loading ? "Loading visitors..." : "No visitors yet"}</p>
              <p className="text-xs mt-1 text-gray-400">Visits appear here in real-time as people view the platform</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-semibold">When</th>
                    <th className="text-left px-4 py-3 font-semibold">Company / Org</th>
                    <th className="text-left px-4 py-3 font-semibold">Location</th>
                    <th className="text-left px-4 py-3 font-semibold">Portal</th>
                    <th className="text-left px-4 py-3 font-semibold">Page</th>
                    <th className="text-left px-4 py-3 font-semibold">Device</th>
                    <th className="text-left px-4 py-3 font-semibold">Browser</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {formatTime(v.visited_at)}
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="text-black truncate font-medium text-xs">
                          {v.company || v.org || "Unknown"}
                        </p>
                        {v.ip && (
                          <p className="text-gray-400 text-xs font-mono truncate">{v.ip}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-black text-xs whitespace-nowrap">
                        {[v.city, v.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <PortalBadge portal={v.portal} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs font-mono max-w-[160px] truncate">
                        {v.page || "/"}
                      </td>
                      <td className="px-4 py-3 text-black text-xs">{v.device || "—"}</td>
                      <td className="px-4 py-3 text-black text-xs">{v.browser || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          This page is private — only you can see it. Auto-refreshes every 30 seconds.
        </p>
      </div>
    </div>
  );
}
