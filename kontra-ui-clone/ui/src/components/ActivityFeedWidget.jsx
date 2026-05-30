import { useState, useEffect } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const PORTAL_COLORS = {
  lender:   { bg: "#800020", label: "Lender"   },
  servicer: { bg: "#D97706", label: "Servicer" },
  investor: { bg: "#7C3AED", label: "Investor" },
  borrower: { bg: "#059669", label: "Borrower" },
  agent:    { bg: "#0EA5E9", label: "AI Agent" },
};

export default function ActivityFeedWidget() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchEvents() {
    try {
      const res = await fetch(`${API_BASE}/api/events?limit=8`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchEvents();
    const id = setInterval(fetchEvents, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-[#111827] border border-slate-700/60 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <p className="text-sm font-semibold text-white">Live Activity</p>
        </div>
        <span className="text-xs text-slate-500">Cross-portal</span>
      </div>

      <div className="divide-y divide-slate-800">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-14 h-5 rounded bg-slate-800 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 rounded bg-slate-800 w-3/4" />
                <div className="h-2.5 rounded bg-slate-800 w-1/2" />
              </div>
            </div>
          ))
        ) : events.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-slate-500">No events yet</p>
        ) : (
          events.map((ev, i) => {
            const meta = ev.portalMeta || PORTAL_COLORS[ev.portal] || { bg: "#64748B", label: ev.portal };
            return (
              <div key={i} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-800/30 transition">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 text-white"
                  style={{ background: meta.bg }}
                >
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium leading-tight truncate">{ev.action}</p>
                  {ev.detail && <p className="text-xs text-slate-400 mt-0.5 truncate">{ev.detail}</p>}
                </div>
                <span className="text-xs text-slate-500 shrink-0 whitespace-nowrap">{ev.relativeTime}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
