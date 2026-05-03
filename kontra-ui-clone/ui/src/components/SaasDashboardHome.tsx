import { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../lib/authContext";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";

type Props = { apiBase?: string };

/* ── Seed data — consistent with portfolio/markets/governance seeds ──────── */
const KPIS = [
  { label: "Portfolio AUM",     value: "$604.7M", delta: "+3.2% QoQ",   up: true,  sub: "6 active loans" },
  { label: "Tokenized Value",   value: "$225.4M", delta: "+$8.2M MTD",  up: true,  sub: "KTRA-2847 · KTRA-5544" },
  { label: "Active Investors",  value: "10,290",  delta: "+312 QTD",    up: true,  sub: "Accredited · Reg D 506(c)" },
  { label: "Monthly Dist.",     value: "$264,500",delta: "+1.8% MoM",   up: true,  sub: "Paid May 1, 2026" },
];

const HEALTH_DATA = [
  { name: "Performing", value: 3, color: "#10b981" },
  { name: "Watch List", value: 2, color: "#f59e0b" },
  { name: "Default",    value: 1, color: "#e11d48" },
];

const TYPE_DATA = [
  { type: "Multifamily",  balance: 98.2,  color: "#6366f1" },
  { type: "Industrial",   balance: 68.0,  color: "#0ea5e9" },
  { type: "Office",       balance: 74.6,  color: "#e11d48" },
  { type: "Mixed-Use",    balance: 127.2, color: "#8b5cf6" },
  { type: "Retail",       balance: 38.7,  color: "#f59e0b" },
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
  {
    id: "KTRA-2847", name: "Meridian Apartments",
    nav: 102.73, navDelta: "+0.32", navUp: true,
    investors: 1482, balance: "$98.2M",
    yield: "7.20%", tranche: "Senior A",
    status: "Active", statusColor: "#10b981",
    link: "/markets/tokens",
  },
  {
    id: "KTRA-5544", name: "Bayview Mixed-Use",
    nav: 98.50, navDelta: "+0.28", navUp: true,
    investors: 876, balance: "$127.2M",
    yield: "7.20%", tranche: "Senior A",
    status: "Active", statusColor: "#10b981",
    link: "/markets/tokens",
  },
  {
    id: "KTRA-3201", name: "Metro Industrial",
    nav: 95.20, navDelta: "-0.40", navUp: false,
    investors: 0, balance: "$44.9M",
    yield: "—", tranche: "Pending",
    status: "Pending KYC", statusColor: "#f59e0b",
    link: "/markets/tokens",
  },
];

const ALERTS = [
  { sev: "high",   loan: "LN-1899", prop: "Lakewood Office Tower",     issue: "DSCR 0.91× — below 1.0× minimum · special servicing referral",  route: "/governance/risk" },
  { sev: "high",   loan: "LN-3201", prop: "Metro Industrial Portfolio", issue: "Occupancy 81.5% — below 85% trigger threshold",                 route: "/governance/compliance" },
  { sev: "medium", loan: "LN-6671", prop: "Sunbelt Retail Centers",     issue: "SOFR rate reset May 15 — debt service sensitivity review due",  route: "/governance/risk" },
  { sev: "medium", loan: "LN-3201", prop: "Metro Industrial Portfolio", issue: "Reg S distribution compliance period expires in 12 days",       route: "/governance/regulatory-scans" },
  { sev: "low",    loan: "LN-4012", prop: "Harbor Logistics Center",    issue: "Phase I Environmental renewal due — AECOM engaged",             route: "/governance/document-review" },
];

const ACTIVITY = [
  { type: "Distribution Paid",   desc: "KTRA-2847 · $264,500 · 10,290 investors",       time: "2 hr ago",  icon: "💸" },
  { type: "Appraisal Received",  desc: "LN-5544 · HFF|JLL · $212M — LTV 60.0% ✓",     time: "5 hr ago",  icon: "📋" },
  { type: "Covenant Certified",  desc: "LN-2847 · Q1 DSCR 1.48× vs 1.25× floor ✓",    time: "Yesterday", icon: "✅" },
  { type: "Trade Settled",       desc: "KTRA-2847 · 250 units · BlackRock · $25.7M",    time: "Yesterday", icon: "📊" },
  { type: "Form D Filed",        desc: "KTRA-2847 · SEC accepted · No deficiencies",     time: "Jan 12",    icon: "🏛️" },
];

const QUEUE = [
  { label: "Covenant Reviews",    value: 5,  href: "/governance/compliance",      accent: "#800020" },
  { label: "Token KYC Pending",   value: 14, href: "/markets/tokens",             accent: "#7c3aed" },
  { label: "Documents In Review", value: 4,  href: "/governance/document-review", accent: "#b45309" },
];

const QUICK_ACTIONS = [
  { icon: "✦",  label: "AI Copilot",       desc: "Portfolio analysis",    href: "/ai-copilot" },
  { icon: "⌘",  label: "Command Center",   desc: "Risk heatmap + gauges", href: "/command" },
  { icon: "🌊", label: "Waterfall",        desc: "Cash flow model",       href: "/markets/waterfall" },
  { icon: "🔗", label: "Token Bridge",     desc: "Servicing → on-chain",  href: "/markets/bridge" },
];

/* ── Sub-components ──────────────────────────────────────────────────────── */
function SevDot({ sev }: { sev: string }) {
  const c: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#6b7280" };
  return (
    <span
      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: c[sev], boxShadow: sev === "high" ? "0 0 6px rgba(239,68,68,0.5)" : undefined }}
    />
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, action, actionHref }: { title: string; action?: string; actionHref?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
      <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
      {action && actionHref && (
        <Link to={actionHref} className="text-xs text-slate-500 hover:text-slate-300 transition">
          {action} →
        </Link>
      )}
    </div>
  );
}

/* ── Main dashboard ──────────────────────────────────────────────────────── */
export default function SaasDashboardHome({ apiBase: _ }: Props) {
  const { session } = useContext(AuthContext);
  const user = (session as any)?.user;
  const firstName = user?.first_name || "Alex";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white" style={{ letterSpacing: "-0.02em" }}>
              {greeting}, {firstName}.
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              &nbsp;·&nbsp;Lender Dashboard&nbsp;·&nbsp;
              <span style={{ color: "#d4687a" }}>2 high-priority alerts</span>
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

      <div className="px-6 py-5 space-y-5">

        {/* ── KPI strip ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPIS.map((k) => (
            <div
              key={k.label}
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs text-slate-500 mb-1">{k.label}</p>
              <p className="text-2xl font-bold text-white" style={{ letterSpacing: "-0.03em" }}>{k.value}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs font-semibold" style={{ color: k.up ? "#4ade80" : "#f87171" }}>
                  {k.up ? "↑" : "↓"} {k.delta}
                </span>
                <span className="text-xs text-slate-600">· {k.sub}</span>
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
                    <Pie data={HEALTH_DATA} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={0}>
                      {HEALTH_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <ReTooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                      itemStyle={{ color: "#cbd5e1" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1">
                {HEALTH_DATA.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-slate-400">{d.name}</span>
                    </div>
                    <span className="text-sm font-bold text-white">{d.value}</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-white/5">
                  <p className="text-[10px] text-slate-500">Avg DSCR · <span className="text-amber-400 font-semibold">1.35×</span></p>
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
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="type" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v.length > 7 ? v.slice(0, 6) + "…" : v}
                  />
                  <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v}M`}
                  />
                  <ReTooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [`$${v}M`, "Balance"]}
                    labelStyle={{ color: "#cbd5e1" }}
                  />
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
            <div className="p-4 space-y-3">
              {QUEUE.map((q) => (
                <Link
                  key={q.label}
                  to={q.href}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 group transition hover:opacity-90"
                  style={{ background: `${q.accent}18`, border: `1px solid ${q.accent}30` }}
                >
                  <span className="text-sm text-slate-300 group-hover:text-white transition">{q.label}</span>
                  <span className="text-2xl font-black" style={{ color: q.accent, letterSpacing: "-0.04em" }}>
                    {q.value}
                  </span>
                </Link>
              ))}
              <div className="pt-1">
                <p className="text-[10px] text-slate-600 text-center">Last updated: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Row 3: DSCR Trend + Token Market Strip ──────────── */}
        <div className="grid lg:grid-cols-5 gap-5">

          {/* DSCR Trend */}
          <Card className="lg:col-span-2">
            <CardHeader title="Portfolio DSCR — 6 Month Trend" />
            <div className="px-4 pb-4 pt-2" style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={DSCR_TREND} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dscrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="mo" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[1.0, 1.6]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <ReTooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [`${v.toFixed(2)}×`, "DSCR"]}
                    labelStyle={{ color: "#cbd5e1" }}
                  />
                  {/* Covenant floor reference */}
                  <Area type="monotone" dataKey="dscr" stroke="#10b981" strokeWidth={2} fill="url(#dscrGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-1 mt-1">
                <div className="h-px flex-1 bg-rose-500/40" style={{ borderTop: "1px dashed rgba(239,68,68,0.4)" }} />
                <span className="text-[10px] text-rose-400/60">1.25× floor</span>
              </div>
            </div>
          </Card>

          {/* Token market strip */}
          <Card className="lg:col-span-3">
            <CardHeader title="Token Market" action="Registry" actionHref="/markets/tokens" />
            <div className="divide-y divide-white/5">
              {TOKENS.map((t) => (
                <Link
                  key={t.id}
                  to={t.link}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition group"
                >
                  <div className="flex-none">
                    <p className="text-xs font-bold font-mono text-white group-hover:text-violet-300 transition">{t.id}</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5 max-w-[120px]">{t.name}</p>
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-3">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">NAV</p>
                      <p className="text-sm font-bold text-white">${t.nav.toFixed(2)}</p>
                      <p className="text-[10px]" style={{ color: t.navUp ? "#4ade80" : "#f87171" }}>
                        {t.navUp ? "↑" : "↓"} {t.navDelta}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Balance</p>
                      <p className="text-sm font-semibold text-white">{t.balance}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Tranche</p>
                      <p className="text-sm font-semibold text-white">{t.tranche}</p>
                      <p className="text-[10px] text-slate-400">{t.yield}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Investors</p>
                      <p className="text-sm font-semibold text-white">{t.investors > 0 ? t.investors.toLocaleString() : "—"}</p>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold flex-none"
                      style={{ background: `${t.statusColor}22`, color: t.statusColor, border: `1px solid ${t.statusColor}44` }}
                    >
                      {t.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Row 4: Alerts + Activity ────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-5">

          {/* Critical alerts */}
          <Card>
            <CardHeader title="Critical Alerts" action="Governance" actionHref="/governance/risk" />
            <div className="divide-y divide-white/5">
              {ALERTS.map((a, i) => (
                <Link
                  key={i}
                  to={a.route}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition group"
                >
                  <SevDot sev={a.sev} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">{a.loan}</span>
                      <span className="text-xs text-slate-400 truncate">{a.prop}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-snug group-hover:text-white transition">{a.issue}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Activity feed */}
          <Card>
            <CardHeader title="Recent Activity" action="Reports" actionHref="/reports" />
            <div className="divide-y divide-white/5">
              {ACTIVITY.map((a, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-base flex-none mt-0.5">{a.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-300">{a.type}</p>
                    <p className="text-xs text-slate-500 truncate">{a.desc}</p>
                  </div>
                  <span className="text-[11px] text-slate-600 shrink-0 mt-0.5 whitespace-nowrap">{a.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Row 5: Quick actions ─────────────────────────────── */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map((a) => (
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
        </Card>

        {/* ── Capital markets summary strip ───────────────────── */}
        <div
          className="rounded-xl px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4"
          style={{ background: "linear-gradient(135deg, rgba(109,40,217,0.12) 0%, rgba(128,0,32,0.10) 100%)", border: "1px solid rgba(109,40,217,0.2)" }}
        >
          {[
            { label: "Tokenized Loans",    value: "$225.4M",   sub: "2 active ERC-1400 tokens" },
            { label: "Secondary Volume",   value: "$124.2M",   sub: "5 trades YTD" },
            { label: "Total Distributions",value: "$264,500",  sub: "May 2026 · on-chain" },
            { label: "Compliance Status",  value: "Reg D/S ✓", sub: "SEC Form D filed" },
          ].map((m) => (
            <div key={m.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400 mb-0.5">{m.label}</p>
              <p className="text-lg font-bold text-white" style={{ letterSpacing: "-0.02em" }}>{m.value}</p>
              <p className="text-[10px] text-slate-500">{m.sub}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
