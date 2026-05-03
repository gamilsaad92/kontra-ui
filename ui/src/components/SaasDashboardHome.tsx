import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../lib/authContext";
import QuickStartTour from "./QuickStartTour";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";

type Props = { apiBase?: string };

const KPIS = [
  { label: "Portfolio AUM",    value: "$604.7M", delta: "+3.2% QoQ",  up: true,  sub: "6 active loans" },
  { label: "Tokenized Value",  value: "$225.4M", delta: "+$8.2M MTD", up: true,  sub: "KTRA-2847 · KTRA-5544" },
  { label: "Active Investors", value: "10,290",  delta: "+312 QTD",   up: true,  sub: "Accredited · Reg D 506(c)" },
  { label: "Monthly Dist.",    value: "$264,500", delta: "+1.8% MoM", up: true,  sub: "Paid May 1, 2026" },
];

const HEALTH_DATA = [
  { name: "Performing", value: 3, color: "#16A34A" },
  { name: "Watch List", value: 2, color: "#F59E0B" },
  { name: "Default",    value: 1, color: "#E5484D" },
];

const TYPE_DATA = [
  { type: "Multifamily", balance: 98.2,  color: "#0F172A" },
  { type: "Industrial",  balance: 68.0,  color: "#334155" },
  { type: "Office",      balance: 74.6,  color: "#E5484D" },
  { type: "Mixed-Use",   balance: 127.2, color: "#475569" },
  { type: "Retail",      balance: 38.7,  color: "#94A3B8" },
];

const DSCR_TREND = [
  { mo: "Nov", dscr: 1.42 },
  { mo: "Dec", dscr: 1.40 },
  { mo: "Jan", dscr: 1.38 },
  { mo: "Feb", dscr: 1.36 },
  { mo: "Mar", dscr: 1.37 },
  { mo: "Apr", dscr: 1.35 },
];

const TOKENS = [
  { id: "KTRA-2847", name: "Meridian Apartments",    nav: 102.73, navDelta: "+0.32", navUp: true,  investors: 1482, balance: "$98.2M",  yield: "7.20%", tranche: "Senior A", status: "Active",      link: "/markets/tokens" },
  { id: "KTRA-5544", name: "Bayview Mixed-Use",      nav: 98.50,  navDelta: "+0.28", navUp: true,  investors: 876,  balance: "$127.2M", yield: "7.20%", tranche: "Senior A", status: "Active",      link: "/markets/tokens" },
  { id: "KTRA-3201", name: "Metro Industrial",       nav: 95.20,  navDelta: "-0.40", navUp: false, investors: 0,    balance: "$44.9M",  yield: "—",     tranche: "Pending",  status: "Pending KYC", link: "/markets/tokens" },
];

const ALERTS = [
  { sev: "critical", loan: "LN-1899", prop: "Lakewood Office Tower",     issue: "DSCR 0.91× — below 1.0× minimum · special servicing referral", route: "/governance/risk" },
  { sev: "critical", loan: "LN-3201", prop: "Metro Industrial Portfolio", issue: "Occupancy 81.5% — below 85% trigger threshold",                route: "/governance/compliance" },
  { sev: "warning",  loan: "LN-6671", prop: "Sunbelt Retail Centers",     issue: "SOFR rate reset May 15 — debt service sensitivity review due",  route: "/governance/risk" },
  { sev: "warning",  loan: "LN-3201", prop: "Metro Industrial Portfolio", issue: "Reg S distribution compliance period expires in 12 days",       route: "/governance/regulatory-scans" },
  { sev: "info",     loan: "LN-4012", prop: "Harbor Logistics Center",    issue: "Phase I Environmental renewal due — AECOM engaged",             route: "/governance/document-review" },
];

const ACTIVITY = [
  { type: "Distribution Paid",  desc: "KTRA-2847 · $264,500 · 10,290 investors",    time: "2 hr ago",  dot: "#16A34A" },
  { type: "Appraisal Received", desc: "LN-5544 · HFF|JLL · $212M — LTV 60.0% ✓",  time: "5 hr ago",  dot: "#2563EB" },
  { type: "Covenant Certified", desc: "LN-2847 · Q1 DSCR 1.48× vs 1.25× floor ✓", time: "Yesterday", dot: "#16A34A" },
  { type: "Trade Settled",      desc: "KTRA-2847 · 250 units · BlackRock · $25.7M", time: "Yesterday", dot: "#7C5CFF" },
  { type: "Form D Filed",       desc: "KTRA-2847 · SEC accepted · No deficiencies",  time: "Jan 12",    dot: "#2563EB" },
];

const QUEUE = [
  { label: "Covenant Reviews",    value: 5,  href: "/governance/compliance",      sev: "critical" },
  { label: "Token KYC Pending",   value: 14, href: "/markets/tokens",             sev: "ai" },
  { label: "Documents In Review", value: 4,  href: "/governance/document-review", sev: "warning" },
];

const QUICK_ACTIONS = [
  { label: "AI Copilot",     desc: "Portfolio analysis",   href: "/ai-copilot",       isAI: true },
  { label: "Command Center", desc: "Risk heatmap + gauges", href: "/command",          isAI: false },
  { label: "Waterfall",      desc: "Cash flow model",      href: "/markets/waterfall", isAI: false },
  { label: "Token Bridge",   desc: "Servicing → on-chain", href: "/markets/bridge",   isAI: false },
];

const SEV_CONFIG = {
  critical: { dot: "#E5484D", label: "Critical", bg: "#FDECEC", text: "#C93A3F", border: "#FECACA" },
  warning:  { dot: "#F59E0B", label: "Warning",  bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  info:     { dot: "#2563EB", label: "Info",      bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE" },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white border border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, action, actionHref }: { title: string; action?: string; actionHref?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {action && actionHref && (
        <Link to={actionHref} className="text-xs text-gray-400 hover:text-gray-700 transition">
          {action} →
        </Link>
      )}
    </div>
  );
}

const TOOLTIP_STYLE = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 11,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

export default function SaasDashboardHome({ apiBase: _ }: Props) {
  const { session } = useContext(AuthContext);
  const user = (session as any)?.user;
  const firstName = user?.first_name || "Alex";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const [showTour, setShowTour] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "#F8FAFC" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900" style={{ letterSpacing: "-0.02em" }}>
              {greeting}, {firstName}.
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              &nbsp;·&nbsp;Lender Dashboard&nbsp;·&nbsp;
              <span style={{ color: "#C93A3F" }}>2 critical alerts require attention</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTour(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12h6M12 9v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Platform Tour
            </button>
            <Link
              to="/ai-copilot"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition"
              style={{ background: "#F3F0FF", color: "#7C5CFF", border: "1px solid rgba(124,92,255,0.2)" }}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              AI Copilot
            </Link>
            <Link
              to="/command"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition"
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

      <div className="px-6 py-5 space-y-5">

        {/* ── KPI strip ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPIS.map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 px-4 py-4">
              <p className="text-xs text-gray-500 mb-1 font-medium">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900" style={{ letterSpacing: "-0.03em" }}>{k.value}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-xs font-semibold" style={{ color: k.up ? "#16A34A" : "#E5484D" }}>
                  {k.up ? "↑" : "↓"} {k.delta}
                </span>
                <span className="text-xs text-gray-400">· {k.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Row 2: Charts + Work Queue ──────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Portfolio health donut */}
          <Card>
            <CardHeader title="Portfolio Health" action="View loans" actionHref="/portfolio/loans" />
            <div className="p-4 flex items-center gap-4">
              <div style={{ width: 120, height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={HEALTH_DATA} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={2} stroke="#FFFFFF">
                      {HEALTH_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <ReTooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#0F172A" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1">
                {HEALTH_DATA.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-gray-500">{d.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{d.value}</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400">Avg DSCR · <span className="font-semibold" style={{ color: "#F59E0B" }}>1.35×</span></p>
                </div>
              </div>
            </div>
          </Card>

          {/* Loan balance by property type */}
          <Card>
            <CardHeader title="Balance by Property Type" action="Assets" actionHref="/portfolio/assets" />
            <div className="px-2 pb-3 pt-2" style={{ height: 148 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={TYPE_DATA} barSize={18} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="type" tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v.length > 7 ? v.slice(0, 6) + "…" : v}
                  />
                  <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v}M`}
                  />
                  <ReTooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`$${v}M`, "Balance"]} labelStyle={{ color: "#0F172A" }} />
                  <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                    {TYPE_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Work queue */}
          <Card>
            <CardHeader title="Work Queue" />
            <div className="p-4 space-y-2">
              {QUEUE.map((q) => {
                const isAI = q.sev === "ai";
                const bg    = isAI ? "#F3F0FF" : q.sev === "critical" ? "#FDECEC" : "#FEF3C7";
                const color = isAI ? "#7C5CFF" : q.sev === "critical" ? "#C93A3F" : "#92400E";
                const border = isAI ? "rgba(124,92,255,0.2)" : q.sev === "critical" ? "#FECACA" : "#FDE68A";
                return (
                  <Link
                    key={q.label}
                    to={q.href}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:opacity-90"
                    style={{ background: bg, border: `1px solid ${border}` }}
                  >
                    <span className="text-sm text-gray-700">{q.label}</span>
                    <span className="text-xl font-black" style={{ color, letterSpacing: "-0.04em" }}>{q.value}</span>
                  </Link>
                );
              })}
              <p className="text-[10px] text-gray-400 text-center pt-1">
                Last updated: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </Card>
        </div>

        {/* ── Row 3: DSCR Trend + Token Market Strip ──────────── */}
        <div className="grid lg:grid-cols-5 gap-5">

          {/* DSCR Trend */}
          <Card className="lg:col-span-2">
            <CardHeader title="Portfolio DSCR — 6 Month Trend" />
            <div className="px-4 pb-4 pt-2" style={{ height: 138 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={DSCR_TREND} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dscrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16A34A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#F1F5F9" />
                  <XAxis dataKey="mo" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[1.0, 1.6]} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <ReTooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(2)}×`, "DSCR"]} labelStyle={{ color: "#0F172A" }} />
                  <Area type="monotone" dataKey="dscr" stroke="#16A34A" strokeWidth={2} fill="url(#dscrGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-1 mt-1">
                <div className="h-px flex-1" style={{ borderTop: "1px dashed #FECACA" }} />
                <span className="text-[10px]" style={{ color: "#E5484D" }}>1.25× floor</span>
              </div>
            </div>
          </Card>

          {/* Token market strip */}
          <Card className="lg:col-span-3">
            <CardHeader title="Token Market" action="Registry" actionHref="/markets/tokens" />
            <div className="divide-y divide-gray-100">
              {TOKENS.map((t) => {
                const statusBg    = t.status === "Active" ? "#DCFCE7" : "#FEF3C7";
                const statusColor = t.status === "Active" ? "#16A34A" : "#92400E";
                const statusBorder= t.status === "Active" ? "#BBF7D0" : "#FDE68A";
                return (
                  <Link key={t.id} to={t.link} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition group">
                    <div className="flex-none">
                      <p className="text-xs font-bold font-mono text-gray-900 group-hover:text-indigo-700 transition">{t.id}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5 max-w-[120px]">{t.name}</p>
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-3">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">NAV</p>
                        <p className="text-sm font-bold text-gray-900">${t.nav.toFixed(2)}</p>
                        <p className="text-[10px] font-semibold" style={{ color: t.navUp ? "#16A34A" : "#E5484D" }}>
                          {t.navUp ? "↑" : "↓"} {t.navDelta}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Balance</p>
                        <p className="text-sm font-semibold text-gray-900">{t.balance}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Tranche</p>
                        <p className="text-sm font-semibold text-gray-900">{t.tranche}</p>
                        <p className="text-[10px] text-gray-400">{t.yield}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Investors</p>
                        <p className="text-sm font-semibold text-gray-900">{t.investors > 0 ? t.investors.toLocaleString() : "—"}</p>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold flex-none"
                        style={{ background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}
                      >
                        {t.status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ── Row 4: Alerts + Activity ────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-5">

          {/* Critical alerts */}
          <Card>
            <CardHeader title="Critical Alerts" action="Governance" actionHref="/governance/risk" />
            <div className="divide-y divide-gray-100">
              {ALERTS.map((a, i) => {
                const cfg = SEV_CONFIG[a.sev as keyof typeof SEV_CONFIG];
                return (
                  <Link key={i} to={a.route} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition group">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cfg.dot }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-gray-400 shrink-0">{a.loan}</span>
                        <span className="text-xs text-gray-500 truncate">{a.prop}</span>
                      </div>
                      <p className="text-xs text-gray-700 leading-snug group-hover:text-gray-900 transition">{a.issue}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize"
                      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
                    >
                      {cfg.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Activity feed */}
          <Card>
            <CardHeader title="Recent Activity" action="Reports" actionHref="/reports" />
            <div className="divide-y divide-gray-100">
              {ACTIVITY.map((a, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.dot }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800">{a.type}</p>
                    <p className="text-xs text-gray-500 truncate">{a.desc}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">{a.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Row 5: Quick actions ─────────────────────────────── */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.label}
                to={a.href}
                className="rounded-lg p-3 text-left border transition hover:shadow-sm group"
                style={{
                  background: a.isAI ? "#F3F0FF" : "#FFFFFF",
                  borderColor: a.isAI ? "rgba(124,92,255,0.2)" : "#E5E7EB",
                }}
              >
                <p className="text-xs font-semibold mb-0.5 group-hover:opacity-80 transition" style={{ color: a.isAI ? "#7C5CFF" : "#0F172A" }}>{a.label}</p>
                <p className="text-xs text-gray-400">{a.desc}</p>
              </Link>
            ))}
          </div>
        </Card>

        {/* ── Capital markets summary strip ───────────────────── */}
        <Card className="px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Tokenized Loans",     value: "$225.4M",    sub: "2 active ERC-1400 tokens", color: "#7C5CFF" },
              { label: "Secondary Volume",    value: "$124.2M",    sub: "5 trades YTD",              color: "#0F172A" },
              { label: "Total Distributions", value: "$264,500",   sub: "May 2026 · on-chain",       color: "#16A34A" },
              { label: "Compliance Status",   value: "Reg D/S ✓",  sub: "SEC Form D filed",          color: "#0F172A" },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{m.label}</p>
                <p className="text-lg font-bold" style={{ color: m.color, letterSpacing: "-0.02em" }}>{m.value}</p>
                <p className="text-[10px] text-gray-400">{m.sub}</p>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {showTour && <QuickStartTour onClose={() => setShowTour(false)} />}
    </div>
  );
}
