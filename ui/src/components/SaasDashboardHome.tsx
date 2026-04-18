import React, { useContext, useEffect, useMemo, useState } from "react";
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
  workQueueCounts: {
    payments: number;
    inspections: number;
    compliance: number;
  };
  criticalAlerts: DashboardItem[];
  nextDeadlines: DashboardItem[];
  todaysActivity: DashboardItem[];
  aiBrief: DashboardItem[];
  quickActions: DashboardItem[];
};

function normalizeSummary(data: unknown): DashboardSummaryResponse {
  const toCount = (value: unknown) => {
    const count = Number(value);
    return Number.isFinite(count) ? count : 0;
  };
  const source = data && typeof data === "object" ? (data as Partial<DashboardSummaryResponse>) : {};
  const nextRole = source.roleView;
  const roleView: DashboardRole =
    nextRole === "lender" || nextRole === "servicer" || nextRole === "investor" || nextRole === "admin"
      ? nextRole
      : "lender";

  const nextCounts = source.workQueueCounts && typeof source.workQueueCounts === "object" ? source.workQueueCounts : {};

  return {
    roleView,
    workQueueCounts: {
      payments: toCount(nextCounts?.payments),
      inspections: toCount(nextCounts?.inspections),
      compliance: toCount(nextCounts?.compliance),
    },
    criticalAlerts: Array.isArray(source.criticalAlerts) ? source.criticalAlerts : [],
    nextDeadlines: Array.isArray(source.nextDeadlines) ? source.nextDeadlines : [],
    todaysActivity: Array.isArray(source.todaysActivity) ? source.todaysActivity : [],
    aiBrief: Array.isArray(source.aiBrief) ? source.aiBrief : [],
    quickActions: Array.isArray(source.quickActions) ? source.quickActions : [],
  };
}

type Props = {
  apiBase?: string;
};

const defaultSummary: DashboardSummaryResponse = {
  roleView: "lender",
  workQueueCounts: { payments: 0, inspections: 0, compliance: 0 },
  criticalAlerts: [],
  nextDeadlines: [],
  todaysActivity: [],
  aiBrief: [],
  quickActions: []
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
  title?: string;
  label?: string;
  ctaLabel: string;
  ctaHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
        <a href={ctaHref} className="text-xs font-semibold text-sky-700 hover:text-sky-900">
          {ctaLabel}
        </a>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function SaasDashboardHome({ apiBase }: Props) {
  const { session } = useContext(AuthContext);
  const accessToken = session?.access_token ?? null;

  const [summary, setSummary] = useState<DashboardSummaryResponse>(defaultSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole>("lender");

  useEffect(() => {
    document.title = "Kontra Command Center";
    setRole(detectRole());
  }, []);

  useEffect(() => {
    // Don't fire until we have an access token — avoids auth errors on initial render
    if (!accessToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const baseURL = normalizeApiBase(apiBase);
    
    api
      .get<DashboardSummaryResponse>("/api/dashboard/summary", {
        ...(baseURL ? { baseURL } : {}),
      })
      .then((response) => {
        if (cancelled) return;
        const nextSummary = normalizeSummary(response.data);
        setSummary(nextSummary);
        setRole(nextSummary.roleView);
      })
      .catch((requestError: any) => {
        if (cancelled) return;
        const message = requestError?.message ?? "Unable to load command center summary.";
        // Don't show raw auth/org errors — show a generic message instead
        const isAuthError = requestError?.status === 401 || requestError?.code === "AUTH_INVALID"
          || requestError?.code === "ORG_CONTEXT_MISSING";
        setError(isAuthError ? null : message);
        setSummary(defaultSummary);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiBase, accessToken]);

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
    { label: "Payments", value: summary.workQueueCounts.payments, href: buildUrl("/servicing/payments", { filter: "exceptions" }) },
    { label: "Inspections", value: summary.workQueueCounts.inspections, href: buildUrl("/servicing/inspections", { filter: "missing_evidence" }) },
    { label: "Compliance", value: summary.workQueueCounts.compliance, href: buildUrl("/governance/compliance", { filter: "open" }) }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Kontra Command Center</h1>
        <p className="text-sm text-slate-500">
          Prioritize work, triage exceptions, and jump directly to canonical portfolio, servicing, analytics, governance, and report views.
        </p>
        {error && <p className="text-xs text-amber-700">{error}</p>}
      </header>

      {loading && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Loading dashboard summary…</div>}

      <div className="grid gap-4 lg:grid-cols-1 sm:grid-cols-2">
        {roleWidgets.showWorkQueue && (
          <SectionCard title="Work Queue" ctaLabel="Open AI Validation" ctaHref="/servicing/ai-validation">
            <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {workQueueCounts.map((entry) => (
                <a key={entry.label} href={entry.href} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{entry.label}</p>
                  <p className="text-lg font-semibold text-slate-900">{entry.value}</p>
                </a>
              ))}
            </div>
            <ul className="mt-3 space-y-2">
                {summary.quickActions.slice(0, 5).map((item) => (
                <li key={item.id} className="rounded-md border border-slate-100 p-2">
                   <a href={item.href} className="text-sm font-medium text-slate-800 hover:text-sky-700">{item.title ?? item.label}</a>
                  {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {roleWidgets.showAlerts && (
          <SectionCard title="Critical Alerts" ctaLabel="Open Governance" ctaHref={buildUrl("/governance/compliance", { filter: "open" })}>
            <ul className="space-y-2">
              {summary.criticalAlerts.slice(0, 5).map((item) => (
                <li key={item.id} className="rounded-md border border-slate-100 p-2">
                   <a href={item.href} className="text-sm font-medium text-slate-800 hover:text-sky-700">{item.title ?? item.label}</a>
                  {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {roleWidgets.showDeadlines && (
          <SectionCard title="Next Deadlines" ctaLabel="Open Servicing" ctaHref="/servicing/overview">
            <ul className="space-y-2">
             {summary.nextDeadlines.slice(0, 5).map((item) => (
                <li key={item.id} className="rounded-md border border-slate-100 p-2">
                  <a href={item.href} className="text-sm font-medium text-slate-800 hover:text-sky-700">{item.title ?? item.label}</a>
                  {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {roleWidgets.showActivity && (
          <SectionCard title="Today’s Activity" ctaLabel="Open Servicing" ctaHref="/servicing/overview">
            <ul className="space-y-2">
                {summary.todaysActivity.slice(0, 5).map((item) => (
                <li key={item.id} className="rounded-md border border-slate-100 p-2">
                  <a href={item.href} className="text-sm font-medium text-slate-800 hover:text-sky-700">{item.title ?? item.label}</a>
                  {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {roleWidgets.showAiBrief && (
          <SectionCard title="AI Brief" ctaLabel="Open Analytics" ctaHref={buildUrl("/analytics", { filter: "severity_high" })}>
            {summary.aiBrief.length === 0 ? (
              <p className="text-sm text-slate-500">No AI reviews yet.</p>
            ) : (
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                {summary.aiBrief.slice(0, 3).map((point) => (
                  <li key={point.id}>
                    <a href={point.href ?? '/servicing/ai-validation'} className="hover:text-sky-700">{point.title}</a>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {roleWidgets.showQuickActions && (
          <SectionCard title="Quick Actions" ctaLabel="Open Reports" ctaHref="/reports">
            <div className="grid gap-2 sm:grid-cols-1 sm:grid-cols-2">
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
