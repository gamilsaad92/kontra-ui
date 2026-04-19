import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ClockIcon,
  SparklesIcon,
  BoltIcon,
  DocumentMagnifyingGlassIcon,
  DocumentPlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { api } from "../lib/api";
import { AuthContext } from "../lib/authContext";

type DashboardRole = "lender" | "servicer" | "investor" | "admin";

type DashboardItem = {
  id: string | number;
  title?: string;
  label?: string;
  subtitle?: string;
  href: string;
  severity?: "high" | "medium" | "low";
};

type DashboardSummaryResponse = {
  roleView: DashboardRole;
  workQueueCounts: { payments: number; inspections: number; compliance: number };
  criticalAlerts: DashboardItem[];
  nextDeadlines: DashboardItem[];
  todaysActivity: DashboardItem[];
  aiBrief: DashboardItem[];
  quickActions: DashboardItem[];
};

const BRAND = "#800020";

const DEMO_ALERTS: DashboardItem[] = [
  { id: 1, title: "Payment overdue — Rosewood Tower (LON-2847)", href: "/servicing/payments?filter=exceptions", severity: "high" },
  { id: 2, title: "Covenant breach detected — Harbour Square (LON-1193)", href: "/governance/compliance?filter=open", severity: "high" },
  { id: 3, title: "Insurance expiring in 7 days — Pacific Vista (LON-3041)", href: "/servicing/overview", severity: "medium" },
  { id: 4, title: "Inspection overdue by 14 days — Metro Commerce (LON-2210)", href: "/servicing/inspections", severity: "medium" },
  { id: 5, title: "Rent roll submission pending — Skyline Retail (LON-1882)", href: "/servicing/management", severity: "low" },
];

const DEMO_DEADLINES: DashboardItem[] = [
  { id: 1, title: "Q2 borrower financials — Rosewood Tower", subtitle: "Due in 3 days", href: "/servicing/overview" },
  { id: 2, title: "Annual inspection — Pacific Vista (LON-3041)", subtitle: "Due in 5 days", href: "/servicing/inspections" },
  { id: 3, title: "Insurance renewal — Metro Commerce", subtitle: "Due in 7 days", href: "/servicing/overview" },
  { id: 4, title: "Escrow reconciliation — Harbour Square", subtitle: "Due in 12 days", href: "/servicing/payments" },
  { id: 5, title: "Covenant compliance report — Q2", subtitle: "Due in 18 days", href: "/governance/compliance" },
];

const DEMO_ACTIVITY: DashboardItem[] = [
  { id: 1, title: "Payment posted — LON-2847 ($29,968)", subtitle: "2 hours ago", href: "/servicing/payments" },
  { id: 2, title: "Inspection report uploaded — LON-1193", subtitle: "4 hours ago", href: "/servicing/inspections" },
  { id: 3, title: "Draw request approved — LON-3041 ($850K)", subtitle: "Yesterday", href: "/servicing/overview" },
  { id: 4, title: "New borrower message — Skyline Retail", subtitle: "Yesterday", href: "/servicing/overview" },
  { id: 5, title: "AI covenant review completed — LON-2210", subtitle: "2 days ago", href: "/governance/compliance" },
];

const DEMO_AI_BRIEF: DashboardItem[] = [
  { id: 1, title: "Portfolio collections running 98.2% — above 90-day average of 97.6%", href: "/analytics" },
  { id: 2, title: "2 loans showing early-stage delinquency signals — recommend proactive outreach", href: "/governance/compliance?filter=open" },
  { id: 3, title: "LON-1193 covenant ratio deteriorating — suggest covenant waiver review", href: "/governance/compliance" },
];

const DEMO_WORK_QUEUE = { payments: 3, inspections: 7, compliance: 4 };

const PERFORMANCE_DATA = [
  { month: "May", collections: 97.1, target: 98 },
  { month: "Jun", collections: 96.8, target: 98 },
  { month: "Jul", collections: 97.4, target: 98 },
  { month: "Aug", collections: 98.1, target: 98 },
  { month: "Sep", collections: 97.9, target: 98 },
  { month: "Oct", collections: 98.3, target: 98 },
  { month: "Nov", collections: 97.6, target: 98 },
  { month: "Dec", collections: 98.5, target: 98 },
  { month: "Jan", collections: 98.0, target: 98 },
  { month: "Feb", collections: 97.8, target: 98 },
  { month: "Mar", collections: 98.4, target: 98 },
  { month: "Apr", collections: 98.2, target: 98 },
];

function normalizeSummary(data: unknown): DashboardSummaryResponse {
  const toCount = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const src = data && typeof data === "object" ? (data as Partial<DashboardSummaryResponse>) : {};
  const nR = src.roleView;
  const roleView: DashboardRole =
    nR === "lender" || nR === "servicer" || nR === "investor" || nR === "admin" ? nR : "lender";
  const nC = src.workQueueCounts && typeof src.workQueueCounts === "object" ? src.workQueueCounts : {};
  return {
    roleView,
    workQueueCounts: {
      payments: toCount(nC?.payments),
      inspections: toCount(nC?.inspections),
      compliance: toCount(nC?.compliance),
    },
    criticalAlerts: Array.isArray(src.criticalAlerts) ? src.criticalAlerts : [],
    nextDeadlines: Array.isArray(src.nextDeadlines) ? src.nextDeadlines : [],
    todaysActivity: Array.isArray(src.todaysActivity) ? src.todaysActivity : [],
    aiBrief: Array.isArray(src.aiBrief) ? src.aiBrief : [],
    quickActions: Array.isArray(src.quickActions) ? src.quickActions : [],
  };
}

function detectRole(): DashboardRole {
  const q = new URLSearchParams(window.location.search).get("role") as DashboardRole | null;
  if (q && ["lender", "servicer", "investor", "admin"].includes(q)) return q;
  const s = window.localStorage.getItem("kontra:dashboardRole") as DashboardRole | null;
  if (s && ["lender", "servicer", "investor", "admin"].includes(s)) return s;
  return "lender";
}

function normalizeApiBase(base?: string) {
  if (!base) return undefined;
  const t = base.trim().replace(/\/+$/, "");
  return t.endsWith("/api") ? t : `${t}/api`;
}

const SEVERITY_STYLES = {
  high:   { dot: "bg-red-500",   text: "text-red-700",   badge: "bg-red-50 border-red-200" },
  medium: { dot: "bg-amber-400", text: "text-amber-700", badge: "bg-amber-50 border-amber-200" },
  low:    { dot: "bg-slate-300", text: "text-slate-600",  badge: "bg-slate-50 border-slate-200" },
};

function SeverityDot({ severity }: { severity?: "high" | "medium" | "low" }) {
  const s = SEVERITY_STYLES[severity ?? "low"];
  return <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />;
}

function KpiCard({
  label, value, sub, icon: Icon, trend, up,
}: {
  label: string; value: string; sub: string;
  icon: React.ElementType; trend?: string; up?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#fff0f3" }}>
          <Icon className="h-4 w-4" style={{ color: BRAND }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        <div className="mt-1 flex items-center gap-2">
          {trend && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
              {up ? <ArrowTrendingUpIcon className="h-3 w-3" /> : <ArrowTrendingDownIcon className="h-3 w-3" />}
              {trend}
            </span>
          )}
          <p className="text-xs text-slate-400">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title, ctaLabel, ctaHref, icon: Icon, children,
}: {
  title: string; ctaLabel: string; ctaHref: string;
  icon?: React.ElementType; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-slate-400" />}
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
        </div>
        <a href={ctaHref} className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: BRAND }}>
          {ctaLabel} <ArrowRightIcon className="h-3 w-3" />
        </a>
      </div>
      {children}
    </section>
  );
}

export default function SaasDashboardHome({ apiBase }: { apiBase?: string }) {
  const { session } = useContext(AuthContext);
  const accessToken = session?.access_token ?? null;

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole>("lender");

  useEffect(() => {
    document.title = "Kontra Command Center";
    setRole(detectRole());
  }, []);

  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const baseURL = normalizeApiBase(apiBase);
    api.get<DashboardSummaryResponse>("/api/dashboard/summary", { ...(baseURL ? { baseURL } : {}) })
      .then((res) => {
        if (cancelled) return;
        const next = normalizeSummary(res.data);
        setSummary(next);
        setRole(next.roleView);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const isAuth = err?.status === 401 || err?.code === "AUTH_INVALID" || err?.code === "ORG_CONTEXT_MISSING";
        setError(isAuth ? null : (err?.message ?? null));
        setSummary(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, accessToken]);

  const alerts    = (summary?.criticalAlerts.length  ? summary.criticalAlerts  : DEMO_ALERTS).slice(0, 5);
  const deadlines = (summary?.nextDeadlines.length    ? summary.nextDeadlines    : DEMO_DEADLINES).slice(0, 5);
  const activity  = (summary?.todaysActivity.length   ? summary.todaysActivity   : DEMO_ACTIVITY).slice(0, 5);
  const aiBrief   = (summary?.aiBrief.length          ? summary.aiBrief          : DEMO_AI_BRIEF).slice(0, 3);
  const wq        = summary?.workQueueCounts ?? DEMO_WORK_QUEUE;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const quickActions = useMemo(() => [
    { label: "Run Payment Review",       icon: BanknotesIcon,           href: "/servicing/payments?runReview=true&filter=exceptions" },
    { label: "Order Inspection",         icon: MagnifyingGlassIcon,     href: "/servicing/inspections?action=order" },
    { label: "Request Rent Roll",        icon: DocumentMagnifyingGlassIcon, href: "/servicing/management?request=rent_roll" },
    { label: "Create Compliance Review", icon: ShieldCheckIcon,         href: "/governance/compliance?action=create_review" },
    { label: "New Loan Origination",     icon: DocumentPlusIcon,        href: "/portfolio" },
    { label: "View AI Validation",       icon: SparklesIcon,            href: "/servicing/ai-validation" },
  ], []);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Command Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">{today}</p>
        </div>
        {error && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">{error}</p>}
        {loading && <p className="text-xs text-slate-400 animate-pulse">Refreshing data…</p>}
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Portfolio AUM"      value="$2.84B"  sub="147 active loans"    icon={BuildingOffice2Icon}      trend="+$42M MoM"  up={true}  />
        <KpiCard label="Collections Rate"  value="98.2%"   sub="vs 98.0% last month" icon={BanknotesIcon}            trend="+0.2%"      up={true}  />
        <KpiCard label="Delinquency Rate"  value="1.8%"    sub="vs 2.1% last quarter" icon={ExclamationTriangleIcon} trend="-0.3%"      up={true}  />
        <KpiCard label="Open Work Items"   value={String(wq.payments + wq.inspections + wq.compliance)} sub={`${wq.payments} payments · ${wq.inspections} inspections`} icon={ClipboardDocumentListIcon} />
      </div>

      {/* ── Portfolio Performance Chart ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Collections Performance</h2>
          </div>
          <span className="text-xs text-slate-400">12-month trailing · % of scheduled</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={PERFORMANCE_DATA} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={BRAND} stopOpacity={0.15} />
                <stop offset="95%" stopColor={BRAND} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis domain={[95, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(v: number) => [`${v}%`, "Collections"]}
            />
            <Area type="monotone" dataKey="target"      stroke="#e2e8f0" strokeWidth={1} fill="none" strokeDasharray="4 4" dot={false} name="Target" />
            <Area type="monotone" dataKey="collections" stroke={BRAND}   strokeWidth={2} fill="url(#collGrad)" dot={{ r: 3, fill: BRAND, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Work Queue ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Payments", value: wq.payments,    href: "/servicing/payments?filter=exceptions",         color: "text-red-600",   bg: "bg-red-50   border-red-100"   },
          { label: "Inspections", value: wq.inspections, href: "/servicing/inspections?filter=missing_evidence", color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
          { label: "Compliance", value: wq.compliance,   href: "/governance/compliance?filter=open",            color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
        ].map((item) => (
          <a key={item.label} href={item.href}
            className={`rounded-xl border p-4 text-center transition hover:shadow-sm ${item.bg}`}>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">{item.label}</p>
          </a>
        ))}
      </div>

      {/* ── 2-col grid ── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Critical Alerts */}
        <SectionCard title="Critical Alerts" ctaLabel="View all" ctaHref="/governance/compliance?filter=open" icon={ExclamationTriangleIcon}>
          <ul className="space-y-2">
            {alerts.map((item) => {
              const s = SEVERITY_STYLES[item.severity ?? "low"];
              return (
                <li key={item.id} className={`flex items-start gap-2.5 rounded-lg border p-3 ${s.badge}`}>
                  <SeverityDot severity={item.severity} />
                  <div className="min-w-0">
                    <a href={item.href} className={`text-sm font-medium leading-snug hover:underline ${s.text}`}>
                      {item.title ?? item.label}
                    </a>
                    {item.subtitle && <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>

        {/* Next Deadlines */}
        <SectionCard title="Upcoming Deadlines" ctaLabel="Open Servicing" ctaHref="/servicing/overview" icon={ClockIcon}>
          <ul className="space-y-2">
            {deadlines.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <a href={item.href} className="text-sm font-medium text-slate-800 hover:underline leading-snug">
                    {item.title ?? item.label}
                  </a>
                  {item.subtitle && <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Today's Activity */}
        <SectionCard title="Today's Activity" ctaLabel="Open Servicing" ctaHref="/servicing/overview" icon={BoltIcon}>
          <ul className="space-y-2">
            {activity.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <a href={item.href} className="text-sm font-medium text-slate-800 hover:underline leading-snug">
                    {item.title ?? item.label}
                  </a>
                  {item.subtitle && <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* AI Brief */}
        <SectionCard title="AI Brief" ctaLabel="Open Analytics" ctaHref="/analytics?filter=severity_high" icon={SparklesIcon}>
          <div className="rounded-lg border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 space-y-3">
            {aiBrief.map((point) => (
              <div key={point.id} className="flex items-start gap-2.5">
                <SparklesIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: BRAND }} />
                <a href={point.href ?? "/servicing/ai-validation"} className="text-sm text-slate-700 hover:underline leading-snug">
                  {point.title}
                </a>
              </div>
            ))}
          </div>
          <a href="/servicing/ai-validation"
            className="mt-2 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition hover:bg-slate-50"
            style={{ borderColor: BRAND, color: BRAND }}>
            <SparklesIcon className="h-4 w-4" />
            Open AI Validation Suite
          </a>
        </SectionCard>

      </div>

      {/* ── Quick Actions ── */}
      <SectionCard title="Quick Actions" ctaLabel="View Reports" ctaHref="/reports" icon={ArrowTrendingUpIcon}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickActions.map(({ label, icon: Icon, href }) => (
            <a key={label} href={href}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium text-slate-700 transition hover:border-transparent hover:shadow-md"
              style={{ ["--tw-shadow-color" as string]: "rgba(128,0,32,0.08)" }}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition group-hover:opacity-90"
                style={{ background: "#fff0f3" }}>
                <Icon className="h-4 w-4" style={{ color: BRAND }} />
              </div>
              <span className="leading-tight">{label}</span>
            </a>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
