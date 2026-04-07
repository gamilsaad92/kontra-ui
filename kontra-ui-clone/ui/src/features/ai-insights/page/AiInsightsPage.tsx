import { useEffect, useMemo, useState } from "react";
import { useAiInsights } from "../hooks/useAiInsights";
import type { InsightCategory, InsightSeverity } from "../types";

const timeWindowOptions = [7, 30, 90];
const categoryOptions: Array<"All" | InsightCategory> = ["All", "Servicing", "Compliance", "Capital Markets"];
const severityOptions: Array<"All" | InsightSeverity> = ["All", "critical", "high", "medium", "low"];

const severityConfig: Record<InsightSeverity, { label: string; dot: string; badge: string }> = {
  critical: { label: "CRITICAL", dot: "bg-brand-600", badge: "bg-brand-50 text-brand-700 border border-brand-200" },
  high:     { label: "HIGH",     dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-700 border border-amber-200" },
  medium:   { label: "MEDIUM",   dot: "bg-yellow-400", badge: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
  low:      { label: "LOW",      dot: "bg-emerald-500",badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

const trendIcon = (trend: "up" | "down" | "flat") => {
  if (trend === "up")   return <span className="text-brand-600 font-bold">↑</span>;
  if (trend === "down") return <span className="text-emerald-600 font-bold">↓</span>;
  return <span className="text-slate-400">→</span>;
};

export default function AiInsightsPage() {
  const { insights, riskDrivers, trendMovers, anomalies, recommendations, isLoading, isError, usingFallback } = useAiInsights();
  const [timeWindow, setTimeWindow] = useState<number>(30);
  const [category, setCategory] = useState<"All" | InsightCategory>("All");
  const [severity, setSeverity] = useState<"All" | InsightSeverity>("All");
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  useEffect(() => { document.title = "Risk Intelligence | Kontra"; }, []);

  const filteredInsights = useMemo(() => {
    return insights.filter((insight) => {
      const matchesWindow = insight.windowDays === timeWindow;
      const matchesCategory = category === "All" || insight.category === category;
      const matchesSeverity = severity === "All" || insight.severity === severity;
      return matchesWindow && matchesCategory && matchesSeverity;
    });
  }, [category, insights, severity, timeWindow]);

  const alertCounts = useMemo(() => ({
    critical: insights.filter(i => i.severity === "critical").length,
    high:     insights.filter(i => i.severity === "high").length,
    medium:   insights.filter(i => i.severity === "medium").length,
    low:      insights.filter(i => i.severity === "low").length,
  }), [insights]);

  const totalAlerts = alertCounts.critical + alertCounts.high + alertCounts.medium + alertCounts.low;
  const riskScore = Math.max(0, 100 - alertCounts.critical * 18 - alertCounts.high * 8 - alertCounts.medium * 3);

  const recommendationsByGroup = useMemo(() => {
    return categoryOptions
      .filter((o): o is InsightCategory => o !== "All")
      .map((group) => ({ group, items: recommendations.filter((r) => r.group === group) }))
      .filter((e) => e.items.length > 0);
  }, [recommendations]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <span className="text-sm font-medium">Analyzing portfolio signals…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Risk Intelligence</p>
          <h1 className="text-2xl font-bold text-slate-900">Risk Intelligence</h1>
          <p className="text-sm text-slate-500 max-w-xl">
            AI-driven anomaly detection, exception prioritization, and recommended actions across your loan portfolio.
          </p>
        </div>
        {usingFallback && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Demo data — live sync unavailable
          </span>
        )}
      </header>

      {/* ── Portfolio Risk Scorecard ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Risk Score */}
        <div className="col-span-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Portfolio Risk Score</p>
          <div className="flex items-end gap-3">
            <span
              className="text-5xl font-black tabular-nums"
              style={{ color: riskScore < 50 ? '#800020' : riskScore < 70 ? '#d97706' : '#059669' }}
            >
              {riskScore}
            </span>
            <span className="mb-1.5 text-slate-400 text-sm font-medium">/ 100</span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${riskScore}%`,
                background: riskScore < 50 ? '#800020' : riskScore < 70 ? '#d97706' : '#059669',
              }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {riskScore < 50 ? 'Elevated risk — immediate action required' : riskScore < 70 ? 'Moderate risk — monitor closely' : 'Portfolio within acceptable range'}
          </p>
        </div>

        {/* Alert Tally */}
        {(["critical","high","medium","low"] as InsightSeverity[]).map((sev) => {
          const cfg = severityConfig[sev];
          const count = alertCounts[sev];
          return (
            <button
              key={sev}
              onClick={() => setSeverity(sev === severity ? "All" : sev)}
              className={`rounded-xl border p-5 shadow-sm text-left transition-all ${
                severity === sev ? 'ring-2 ring-brand-600 ring-offset-2' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              </div>
              <p className="text-4xl font-black text-slate-900 tabular-nums">{count}</p>
              <p className="text-xs text-slate-500 mt-1">
                {sev === "critical" ? "Require immediate action" : sev === "high" ? "Elevated priority" : sev === "medium" ? "Monitor & review" : "Informational"}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Time window</label>
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          >
            {timeWindowOptions.map((o) => <option key={o} value={o}>Last {o} days</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "All" | InsightCategory)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          >
            {categoryOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as "All" | InsightSeverity)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          >
            {severityOptions.map((o) => <option key={o} value={o}>{o === "All" ? "All severities" : o}</option>)}
          </select>
        </div>
        {(category !== "All" || severity !== "All") && (
          <button
            onClick={() => { setCategory("All"); setSeverity("All"); }}
            className="mt-auto rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Insights Feed ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Insights feed</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {filteredInsights.length} signal{filteredInsights.length !== 1 ? "s" : ""} surfaced
          </span>
        </div>
        <div className="space-y-3">
          {filteredInsights.map((insight) => {
            const cfg = severityConfig[insight.severity];
            const isExpanded = expandedInsight === insight.id;
            return (
              <div
                key={insight.id}
                className={`rounded-xl border bg-white shadow-sm transition-all ${
                  insight.severity === "critical" ? "border-brand-200" : "border-slate-200"
                }`}
              >
                <button
                  className="w-full text-left p-5"
                  onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{insight.category}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                          {insight.windowDays}d window
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900">{insight.title}</h3>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-slate-700"
                            style={{ width: `${insight.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {(insight.confidence * 100).toFixed(0)}% model confidence
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {insight.actions.map((action) => (
                        <a
                          key={action.label}
                          href={action.href}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
                        >
                          {action.label}
                        </a>
                      ))}
                      <span className="text-slate-400 text-sm">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">AI Signal Drivers</p>
                        <ul className="space-y-2">
                          {insight.drivers.map((d, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-brand-600" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {insight.evidenceLinks.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Evidence</p>
                          <div className="flex flex-wrap gap-2">
                            {insight.evidenceLinks.map((link) => (
                              <a
                                key={link.label}
                                href={link.href}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                              >
                                <span>📄</span> {link.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredInsights.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <p className="text-slate-400 text-sm">No signals match the selected filters.</p>
              <button
                onClick={() => { setCategory("All"); setSeverity("All"); }}
                className="mt-3 text-xs font-semibold text-brand-600 underline underline-offset-4"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Risk Drivers + Top Movers ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Risk Drivers */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Portfolio risk drivers</h2>
            <span className="text-xs text-slate-400 font-medium">By portfolio share</span>
          </div>
          <div className="space-y-4">
            {riskDrivers.map((driver) => (
              <div key={driver.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-slate-800">{driver.name}</span>
                  <div className="flex items-center gap-2">
                    {trendIcon(driver.trend)}
                    <span className="text-xs font-semibold text-slate-500">{driver.change}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{
                        width: `${driver.portfolioShare * 100}%`,
                        background: driver.trend === 'up' ? '#800020' : driver.trend === 'down' ? '#059669' : '#64748b',
                      }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs font-bold text-slate-700 tabular-nums">
                    {(driver.portfolioShare * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Movers */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Portfolio KPI movers</h2>
            <span className="text-xs text-slate-400 font-medium">DSCR · Occupancy · NOI</span>
          </div>
          <div className="space-y-3">
            {trendMovers.map((mover) => {
              const isNegative = mover.change.includes('▼') || mover.change.includes('-') || mover.change.toLowerCase().includes('flagged');
              return (
                <div key={mover.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{mover.label}</p>
                      <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums">{mover.metric}</p>
                      {mover.detail && <p className="mt-1 text-xs text-slate-500 leading-relaxed">{mover.detail}</p>}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        isNegative ? 'bg-brand-50 text-brand-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {mover.change}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Anomaly Detection ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Anomaly detection</h2>
          <span className="text-xs text-slate-500 font-medium">{anomalies.length} anomal{anomalies.length !== 1 ? 'ies' : 'y'} flagged</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {anomalies.map((anomaly) => (
            <div key={anomaly.id} className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
                  Anomaly
                </span>
                <a
                  href={anomaly.reportLink}
                  className="text-xs font-semibold text-slate-500 underline underline-offset-4 hover:text-slate-800 transition-colors"
                >
                  View →
                </a>
              </div>
              <p className="text-sm font-bold text-slate-900 leading-snug">{anomaly.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{anomaly.summary}</p>
              <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 font-medium border border-slate-100">
                {anomaly.comparison}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Recommendations ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">AI recommendations</h2>
          <span className="text-xs text-slate-500">{recommendations.length} action{recommendations.length !== 1 ? 's' : ''} queued</span>
        </div>
        {recommendationsByGroup.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
            No recommendations at this time.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {recommendationsByGroup.map(({ group, items }) => (
              <div key={group} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{group}</span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                {items.map((item, idx) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-semibold text-slate-900 leading-snug">{item.title}</p>
                        <p className="text-xs leading-relaxed text-slate-600">{item.description}</p>
                        <a
                          href={item.actionHref}
                          className="inline-flex items-center rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 transition-colors"
                        >
                          {item.actionLabel} →
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Model Health Footer ── */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">AI Model Health</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Model Accuracy", value: "94.3%", sub: "Last 90 days" },
            { label: "False Positive Rate", value: "2.1%", sub: "Within threshold" },
            { label: "Signals Processed", value: `${totalAlerts}`, sub: "Active signals" },
            { label: "Last Scan", value: "< 5 min ago", sub: "Continuous monitoring" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">{stat.value}</p>
              <p className="text-xs text-slate-400">{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
