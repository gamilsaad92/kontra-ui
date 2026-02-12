import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type DashboardRole = "lender" | "servicer" | "investor" | "admin";

type DashboardCountSummary = {
  needsReviewPayments: number;
  needsReviewInspections: number;
  openCompliance: number;
  upcomingDeadlines: number;
};

type DashboardItem = {
  id: string | number;
  title: string;
  subtitle?: string;
  href: string;
  severity?: "high" | "medium" | "low";
};

type DashboardSummaryResponse = {
  counts: DashboardCountSummary;
  workQueueTop5: DashboardItem[];
  alertsTop5: DashboardItem[];
  deadlinesTop5: DashboardItem[];
  activityTop5: DashboardItem[];
  aiBrief: DashboardItem[];
};

type Props = {
  apiBase?: string;
  orgId?: string | number | null;
};

const defaultSummary: DashboardSummaryResponse = {
  counts: {
    needsReviewPayments: 0,
    needsReviewInspections: 0,
    openCompliance: 0,
    upcomingDeadlines: 0
  },
  workQueueTop5: [],
  alertsTop5: [],
  deadlinesTop5: [],
  activityTop5: [],
  aiBrief: []
};

const fallbackSummary: DashboardSummaryResponse = {
  counts: {
    needsReviewPayments: 4,
    needsReviewInspections: 3,
    openCompliance: 2,
    upcomingDeadlines: 6
  },
  workQueueTop5: [
    { id: "w-1", title: "Payment exception review", subtitle: "Loan K-1102 · Due today", href: "/servicing/payments?filter=exceptions" },
    { id: "w-2", title: "Inspection evidence missing", subtitle: "Loan K-2031 · 1 day overdue", href: "/servicing/inspections?filter=missing_evidence" },
    { id: "w-3", title: "Compliance memo approval", subtitle: "Open covenant package", href: "/governance/compliance?filter=open" },
    { id: "w-4", title: "Borrower financial review", subtitle: "Sunbelt CRE 2024-2", href: "/servicing/borrower-financials?filter=needs_review" },
    { id: "w-5", title: "Escrow variance exception", subtitle: "Kontra Bridge 2024-1", href: "/servicing/escrow?filter=exceptions" }
  ],
  alertsTop5: [
    { id: "a-1", title: "Delinquency warning", subtitle: "2 loans moved to 30+ DPD", href: "/portfolio/loans?filter=needs_attention", severity: "high" },
    { id: "a-2", title: "Covenant breach", subtitle: "DSCR below threshold", href: "/governance/compliance?filter=open", severity: "high" },
    { id: "a-3", title: "Risk trend deterioration", subtitle: "3 loans downgraded", href: "/analytics?filter=severity_high", severity: "medium" },
    { id: "a-4", title: "Insurance certificate expired", subtitle: "Borrower upload required", href: "/servicing/management?filter=insurance_expired", severity: "medium" },
    { id: "a-5", title: "Escrow balance below minimum", subtitle: "Immediate top-up required", href: "/servicing/escrow?filter=below_minimum", severity: "high" }
  ],
  deadlinesTop5: [
    { id: "d-1", title: "Inspection due", subtitle: "5 assets due in next 7 days", href: "/servicing/inspections?filter=due_soon" },
    { id: "d-2", title: "Borrower financials due", subtitle: "3 submissions due this week", href: "/servicing/borrower-financials?filter=due_soon" },
    { id: "d-3", title: "Escrow reconciliation", subtitle: "2 reconciliations due", href: "/servicing/escrow?filter=due_soon" },
    { id: "d-4", title: "Maturity event", subtitle: "Loan K-3390 matures in 12 days", href: "/portfolio/loans?filter=maturity_soon" },
    { id: "d-5", title: "Compliance attestation", subtitle: "Quarterly filing pending", href: "/governance/compliance?filter=due_soon" }
  ],
  activityTop5: [
    { id: "t-1", title: "AI payment review completed", subtitle: "12 minutes ago", href: "/servicing/ai-validation" },
    { id: "t-2", title: "Inspection order submitted", subtitle: "34 minutes ago", href: "/servicing/inspections" },
    { id: "t-3", title: "Compliance packet uploaded", subtitle: "1 hour ago", href: "/governance/document-review" },
    { id: "t-4", title: "Borrower docs requested", subtitle: "2 hours ago", href: "/servicing/management" },
    { id: "t-5", title: "Portfolio exception resolved", subtitle: "Today", href: "/portfolio/loans?filter=recently_resolved" }
  ],
  aiBrief: [
    { id: "b-1", title: "Three high-severity anomalies detected in payment timing.", href: "/analytics?filter=severity_high" },
    { id: "b-2", title: "Two loans now require manual covenant verification.", href: "/governance/compliance?filter=open" },
    { id: "b-3", title: "Inspection evidence gaps concentrated in two markets.", href: "/servicing/inspections?filter=missing_evidence" },
    { id: "b-4", title: "Net delinquency risk rose 0.8% week-over-week.", href: "/portfolio/loans?filter=needs_attention" }
  ]
};

function normalizeApiBase(base?: string): string | undefined {
  if (!base) return undefined;
  const trimmed = base.trim();
  if (!trimmed) return undefined;
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  return withoutTrailing.endsWith("/api") ? withoutTrailing : `${withoutTrailing}/api`;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return path;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function detectRole(): DashboardRole {
  const queryRole = new URLSearchParams(window.location.search).get("role") as DashboardRole | null;
  if (queryRole && ["lender", "servicer", "investor", "admin"].includes(queryRole)) {
    return queryRole;
  }
  const storedRole = window.localStorage.getItem("kontra:dashboardRole") as DashboardRole | null;
  if (storedRole && ["lender", "servicer", "investor", "admin"].includes(storedRole)) {
    return storedRole;
  }
  return "lender";
}

function SectionCard({
  title,
  ctaLabel,
  ctaHref,
  children
}: {
  title: string;
  ctaLabel: string;
  ctaHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
        <a href={ctaHref} className="text-xs font-semibold text-sky-700 hover:text-sky-900">
          {ctaLabel}
        </a>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function SaasDashboardHome({ apiBase, orgId }: Props) {
  const [summary, setSummary] = useState<DashboardSummaryResponse>(defaultSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole>("lender");

  useEffect(() => {
    document.title = "Kontra Command Center";
    setRole(detectRole());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const baseURL = normalizeApiBase(apiBase);

    api
      .get<DashboardSummaryResponse>("/dashboard/summary", {
        ...(baseURL ? { baseURL } : {}),
        headers: { "x-organization-id": String(orgId ?? 1) }
      })
      .then((response) => {
        if (cancelled) return;
        setSummary(response.data);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Using fallback command center summary while dashboard API is unavailable.");
        setSummary(fallbackSummary);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiBase, orgId]);

  const roleWidgets = useMemo(() => {
    const base = {
      showWorkQueue: true,
      showAlerts: true,
      showDeadlines: true,
      showActivity: true,
      showAiBrief: true,
      showQuickActions: true
    };

    if (role === "investor") {
      return { ...base, showWorkQueue: false, showDeadlines: false };
    }

    if (role === "admin") {
      return { ...base, showDeadlines: false };
    }

    return base;
  }, [role]);

  const workQueueCounts = [
    { label: "Payments", value: summary.counts.needsReviewPayments, href: buildUrl("/servicing/payments", { filter: "exceptions" }) },
    { label: "Inspections", value: summary.counts.needsReviewInspections, href: buildUrl("/servicing/inspections", { filter: "missing_evidence" }) },
    { label: "Compliance", value: summary.counts.openCompliance, href: buildUrl("/governance/compliance", { filter: "open" }) }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Kontra Command Center</h1>
        <p className="text-sm text-slate-500">
          Prioritize work, triage exceptions, and jump directly to canonical portfolio, servicing, analytics, governance, and report views.
        </p>
        <p className="text-xs text-slate-400">Role view: {role}</p>
        {error && <p className="text-xs text-amber-700">{error}</p>}
      </header>

      {loading && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Loading dashboard summary…</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {roleWidgets.showWorkQueue && (
          <SectionCard title="Work Queue" ctaLabel="Open AI Validation" ctaHref="/servicing/ai-validation">
            <div className="grid grid-cols-3 gap-2">
              {workQueueCounts.map((entry) => (
                <a key={entry.label} href={entry.href} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{entry.label}</p>
                  <p className="text-lg font-semibold text-slate-900">{entry.value}</p>
                </a>
              ))}
            </div>
            <ul className="mt-3 space-y-2">
              {summary.workQueueTop5.slice(0, 5).map((item) => (
                <li key={item.id} className="rounded-md border border-slate-100 p-2">
                  <a href={item.href} className="text-sm font-medium text-slate-800 hover:text-sky-700">{item.title}</a>
                  {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {roleWidgets.showAlerts && (
          <SectionCard title="Critical Alerts" ctaLabel="Open Governance" ctaHref={buildUrl("/governance/compliance", { filter: "open" })}>
            <ul className="space-y-2">
              {summary.alertsTop5.slice(0, 5).map((item) => (
                <li key={item.id} className="rounded-md border border-slate-100 p-2">
                  <a href={item.href} className="text-sm font-medium text-slate-800 hover:text-sky-700">{item.title}</a>
                  {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {roleWidgets.showDeadlines && (
          <SectionCard title="Next Deadlines" ctaLabel="Open Servicing" ctaHref="/servicing/overview">
            <ul className="space-y-2">
              {summary.deadlinesTop5.slice(0, 5).map((item) => (
                <li key={item.id} className="rounded-md border border-slate-100 p-2">
                  <a href={item.href} className="text-sm font-medium text-slate-800 hover:text-sky-700">{item.title}</a>
                  {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {roleWidgets.showActivity && (
          <SectionCard title="Today’s Activity" ctaLabel="Open Servicing" ctaHref="/servicing/overview">
            <ul className="space-y-2">
              {summary.activityTop5.slice(0, 5).map((item) => (
                <li key={item.id} className="rounded-md border border-slate-100 p-2">
                  <a href={item.href} className="text-sm font-medium text-slate-800 hover:text-sky-700">{item.title}</a>
                  {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {roleWidgets.showAiBrief && (
          <SectionCard title="AI Brief" ctaLabel="Open Analytics" ctaHref={buildUrl("/analytics", { filter: "severity_high" })}>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              {summary.aiBrief.slice(0, 5).map((point) => (
                <li key={point.id}>
                  <a href={point.href} className="hover:text-sky-700">{point.title}</a>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {roleWidgets.showQuickActions && (
          <SectionCard title="Quick Actions" ctaLabel="Open Reports" ctaHref="/reports">
            <div className="grid gap-2 sm:grid-cols-2">
              <a href={buildUrl("/servicing/payments", { runReview: true, filter: "exceptions" })} className="rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-800 hover:border-sky-300 hover:text-sky-700">Run Payment Review</a>
              <a href={buildUrl("/servicing/inspections", { action: "order" })} className="rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-800 hover:border-sky-300 hover:text-sky-700">Order Inspection</a>
              <a href={buildUrl("/servicing/management", { request: "rent_roll" })} className="rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-800 hover:border-sky-300 hover:text-sky-700">Request Rent Roll</a>
              <a href={buildUrl("/governance/compliance", { action: "create_review" })} className="rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-800 hover:border-sky-300 hover:text-sky-700">Create Compliance Review</a>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
