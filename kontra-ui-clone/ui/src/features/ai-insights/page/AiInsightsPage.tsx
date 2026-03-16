import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { useAiInsights } from "../hooks/useAiInsights";
import InsightFeedItem from "../components/InsightFeedItem";
import RecommendationGroup from "../components/RecommendationGroup";
import AnomalyCard from "../components/AnomalyCard";
import type { InsightCategory, InsightSeverity } from "../types";

const timeWindowOptions = [7, 30, 90];
const categoryOptions: Array<"All" | InsightCategory> = [
  "All",
  "Servicing",
  "Compliance",
  "Capital Markets",
];
const severityOptions: Array<"All" | InsightSeverity> = [
  "All",
  "critical",
  "high",
  "medium",
  "low",
];

export default function AiInsightsPage() {
  const { insights, riskDrivers, trendMovers, anomalies, recommendations } = useAiInsights();
  const [timeWindow, setTimeWindow] = useState<number>(30);
  const [category, setCategory] = useState<"All" | InsightCategory>("All");
  const [severity, setSeverity] = useState<"All" | InsightSeverity>("All");

  useEffect(() => {
    document.title = "AI Insights";
  }, []);

  const filteredInsights = useMemo(() => {
    return insights.filter((insight) => {
      const matchesWindow = insight.windowDays === timeWindow;
      const matchesCategory = category === "All" || insight.category === category;
      const matchesSeverity = severity === "All" || insight.severity === severity;
      return matchesWindow && matchesCategory && matchesSeverity;
    });
  }, [category, insights, severity, timeWindow]);

  const recommendationsByGroup = useMemo(() => {
    return categoryOptions
      .filter((option): option is InsightCategory => option !== "All")
      .map((group) => ({
        group,
        items: recommendations.filter((rec) => rec.group === group),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [recommendations]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Analytics</p>
        <h1 className="text-2xl font-semibold text-slate-900">AI Insights</h1>
        <p className="text-sm text-slate-600">
          Prioritized intelligence, recommended actions, and drivers behind portfolio risk shifts.
        </p>
      </header>

      <Card className="border-slate-200">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <label className="text-sm text-slate-600">
            <span className="mb-1 block font-medium text-slate-700">Time window</span>
            <select
              value={timeWindow}
              onChange={(event) => setTimeWindow(Number(event.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {timeWindowOptions.map((option) => (
                <option key={option} value={option}>
                  Last {option} days
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1 block font-medium text-slate-700">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as "All" | InsightCategory)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1 block font-medium text-slate-700">Severity</span>
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as "All" | InsightSeverity)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {severityOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "All" ? "All severities" : option}
                </option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Insights feed</h2>
          <p className="text-sm text-slate-500">
            {filteredInsights.length} insight{filteredInsights.length === 1 ? "" : "s"} surfaced
          </p>
        </div>
        <div className="space-y-4">
          {filteredInsights.map((insight) => (
            <InsightFeedItem key={insight.id} item={insight} />
          ))}
          {filteredInsights.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No insights match the selected filters.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Portfolio risk drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Driver</th>
                  <th className="pb-2">Portfolio share</th>
                  <th className="pb-2">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {riskDrivers.map((driver) => (
                  <tr key={driver.id} className="text-slate-700">
                    <td className="py-2 font-medium text-slate-900">{driver.name}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {(driver.portfolioShare * 100).toFixed(0)}%
                        </span>
                        <div className="h-1.5 w-20 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-slate-900"
                            style={{ width: `${driver.portfolioShare * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-sm">{driver.change}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Top movers: DSCR / Occupancy / NOI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trendMovers.map((mover) => (
              <div key={mover.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-900">{mover.label}</span>
                  <span className="text-xs font-semibold text-slate-500">{mover.change}</span>
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{mover.metric}</div>
                <p className="text-xs text-slate-500">{mover.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Anomaly detection</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {anomalies.map((anomaly) => (
            <AnomalyCard key={anomaly.id} anomaly={anomaly} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">AI recommendations</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {recommendationsByGroup.map((group) => (
            <RecommendationGroup
              key={group.group}
              title={group.group}
              items={group.items}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
