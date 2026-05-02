import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../lib/authContext";
import { api } from "../lib/api";

type Props = { apiBase?: string };

const DEMO_KPIS = [
  { label: "Portfolio AUM", value: "$2.41B", delta: "+3.2%", up: true, sub: "847 active loans" },
  { label: "Current Draws", value: "$142.3M", delta: "+$8.1M", up: true, sub: "34 pending reviews" },
  { label: "Avg DSCR", value: "1.38×", delta: "-0.04", up: false, sub: "Fleet min: 1.10×" },
  { label: "30-Day P&I", value: "$18.7M", delta: "On track", up: true, sub: "Next: Jun 1" },
];

const DEMO_ALERTS = [
  { id: 1, sev: "high", loan: "LN-2847", property: "Meridian Apartments", issue: "DSCR covenant breach — 1.08× vs 1.15× floor", route: "/compliance-center" },
  { id: 2, sev: "high", loan: "LN-3011", property: "Harbor Point Mixed-Use", issue: "Draw request $2.1M — missing lien waiver from tier-2 subs", route: "/servicer/draws" },
  { id: 3, sev: "medium", loan: "LN-2741", property: "Sunset Ridge Retail", issue: "Insurance expiring in 14 days — $4.8M replacement cost", route: "/compliance-center" },
  { id: 4, sev: "medium", loan: "LN-3204", property: "Riverview Office Tower", issue: "Occupancy fell to 81% — below 85% trigger threshold", route: "/analytics" },
  { id: 5, sev: "low", loan: "LN-0094", property: "Northside Industrial", issue: "Inspection due within 30 days — schedule required", route: "/inspection" },
];

const DEMO_ACTIVITY = [
  { id: 1, type: "Draw Approved", desc: "LN-0094 · $82,000 · Northside Industrial", time: "2 min ago" },
  { id: 2, type: "Payment Received", desc: "LN-2847 · $142,500 P&I · Meridian Apartments", time: "18 min ago" },
  { id: 3, type: "Inspection Filed", desc: "LN-3011 · Phase 3 complete · Harbor Point", time: "1 hr ago" },
  { id: 4, type: "Covenant Flagged", desc: "LN-3204 · Occupancy trigger · Riverview Office", time: "3 hr ago" },
  { id: 5, type: "Draw Submitted", desc: "LN-2741 · $440,000 · Sunset Ridge Retail", time: "5 hr ago" },
];

const DEMO_QUEUE = [
  { label: "Draws Pending", value: 34, href: "/servicer/draws", color: "#800020" },
  { label: "Inspections Due", value: 12, href: "/inspection", color: "#b45309" },
  { label: "Compliance Items", value: 7, href: "/compliance-center", color: "#6d28d9" },
];

function SevDot({ sev }: { sev: string }) {
  const colors: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#6b7280" };
  return (
    <span
      className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
      style={{ background: colors[sev] || "#6b7280", boxShadow: sev === "high" ? "0 0 6px rgba(239,68,68,0.6)" : undefined }}
    />
  );
}

export default function SaasDashboardHome({ apiBase }: Props) {
  const { session } = useContext(AuthContext);
  const [kpis, setKpis] = useState(DEMO_KPIS);
  const [summary, setSummary] = useState<any>(null);
  const user = (session as any)?.user;
  const firstName = user?.first_name || "Alex";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    document.title = "Kontra · Lender Dashboard";
    const token = session?.access_token;
    if (!token) return;
    api
      .get("/api/dashboard/summary")
      .then((r: any) => setSummary(r.data))
      .catch(() => {});
  }, [session?.access_token]);

  const queueCounts = summary?.workQueueCounts
    ? [
        { label: "Draws Pending", value: summary.workQueueCounts.payments || 34, href: "/servicer/draws", color: "#800020" },
        { label: "Inspections Due", value: summary.workQueueCounts.inspections || 12, href: "/inspection", color: "#b45309" },
        { label: "Compliance Items", value: summary.workQueueCounts.compliance || 7, href: "/compliance-center", color: "#6d28d9" },
      ]
    : DEMO_QUEUE;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top bar */}
      <div className="px-6 pt-6 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white" style={{ letterSpacing: "-0.02em" }}>
              {greeting}, {firstName}.
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · Platform Demo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/ai-copilot"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition"
              style={{ background: "rgba(128,0,32,0.2)", color: "#d4687a", border: "1px solid rgba(128,0,32,0.3)" }}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              AI Copilot
            </Link>
            <Link
              to="/command"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition"
              style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round" />
              </svg>
              Command Center
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold text-white" style={{ letterSpacing: "-0.03em" }}>{kpi.value}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="text-xs font-semibold"
                  style={{ color: kpi.up ? "#4ade80" : "#f87171" }}
                >
                  {kpi.up ? "↑" : "↓"} {kpi.delta}
                </span>
                <span className="text-xs text-slate-600">· {kpi.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Work queue */}
        <div className="grid grid-cols-3 gap-4">
          {queueCounts.map((q) => (
            <Link
              key={q.label}
              to={q.href}
              className="rounded-xl p-4 flex items-center justify-between group transition-all hover:scale-[1.02]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <p className="text-xs text-slate-500">{q.label}</p>
                <p className="text-3xl font-bold text-white mt-1" style={{ letterSpacing: "-0.04em" }}>{q.value}</p>
              </div>
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform"
                style={{ background: `${q.color}22`, color: q.color }}
              >
                →
              </div>
            </Link>
          ))}
        </div>

        {/* Two-column: alerts + activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Critical alerts */}
          <div
            className="rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h2 className="text-sm font-semibold text-slate-300">Critical Alerts</h2>
              <Link to="/compliance-center" className="text-xs text-slate-500 hover:text-slate-300">View all →</Link>
            </div>
            <div className="divide-y divide-white/5">
              {DEMO_ALERTS.map((a) => (
                <Link
                  key={a.id}
                  to={a.route}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition group"
                >
                  <SevDot sev={a.sev} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-slate-500">{a.loan}</span>
                      <span className="text-xs text-slate-400 truncate">{a.property}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-snug group-hover:text-white transition truncate">{a.issue}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div
            className="rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h2 className="text-sm font-semibold text-slate-300">Today's Activity</h2>
              <Link to="/reports" className="text-xs text-slate-500 hover:text-slate-300">Full log →</Link>
            </div>
            <div className="divide-y divide-white/5">
              {DEMO_ACTIVITY.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <div
                    className="mt-0.5 h-5 w-5 rounded shrink-0 flex items-center justify-center text-[9px] font-bold"
                    style={{ background: "rgba(128,0,32,0.2)", color: "#d4687a" }}
                  >
                    ✓
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-300">{a.type}</p>
                    <p className="text-xs text-slate-500 truncate">{a.desc}</p>
                  </div>
                  <span className="text-[11px] text-slate-600 shrink-0 mt-0.5">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Review Draw", desc: "34 pending", href: "/servicer/draws", icon: "💰" },
              { label: "Run AI Brief", desc: "Portfolio analysis", href: "/ai-copilot", icon: "✦" },
              { label: "Covenant Check", desc: "7 open items", href: "/compliance-center", icon: "⚖" },
              { label: "Order Inspection", desc: "12 due", href: "/inspection", icon: "🏢" },
            ].map((a) => (
              <Link
                key={a.label}
                to={a.href}
                className="rounded-lg p-3 text-left transition hover:bg-white/5 group"
                style={{ border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="text-lg mb-1">{a.icon}</div>
                <p className="text-xs font-semibold text-slate-300 group-hover:text-white transition">{a.label}</p>
                <p className="text-xs text-slate-500">{a.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
