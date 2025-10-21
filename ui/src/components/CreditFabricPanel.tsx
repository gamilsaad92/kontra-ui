import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveApiBase } from "../lib/api";

type CreditGraphSignals = Record<string, number | undefined>;

type CreditGraphBorrower = {
  borrowerId: string;
  borrower?: {
    id?: string;
    name?: string;
    segment?: string;
    relationshipManager?: string;
    exposure?: number;
  };
  signals?: CreditGraphSignals;
  riskScore?: number;
  riskTier?: "stable" | "watch" | "concern" | "critical" | string;
  updatedAt?: string;
};

type CreditGraphSnapshot = {
  generatedAt?: string;
  weights?: CreditGraphSignals;
  borrowers?: CreditGraphBorrower[];
};

const creditFabricFallback: CreditGraphSnapshot = {
  generatedAt: new Date().toISOString(),
  weights: {
    paymentHistory: 0.32,
    assetCoverage: 0.26,
    covenantHealth: 0.22,
    telemetryPulse: 0.2,
  },
  borrowers: [
    {
      borrowerId: "atlas-industrial",
      borrower: {
        id: "atlas-industrial",
        name: "Atlas Industrial Holdings",
        segment: "Industrial",
        relationshipManager: "M. Alvarez",
        exposure: 12500000,
      },
      signals: {
        paymentHistory: 0.63,
        assetCoverage: 0.81,
        covenantHealth: 0.74,
        telemetryPulse: 0.59,
      },
      riskScore: 68,
      riskTier: "watch",
      updatedAt: new Date().toISOString(),
    },
    {
      borrowerId: "horizon-hospitality",
      borrower: {
        id: "horizon-hospitality",
        name: "Horizon Hospitality Group",
        segment: "Hospitality",
        relationshipManager: "A. Park",
        exposure: 8600000,
      },
      signals: {
        paymentHistory: 0.54,
        assetCoverage: 0.69,
        covenantHealth: 0.49,
        telemetryPulse: 0.46,
      },
      riskScore: 59,
      riskTier: "concern",
      updatedAt: new Date().toISOString(),
    },
    {
      borrowerId: "venture-coast",
      borrower: {
        id: "venture-coast",
        name: "Venture Coast Logistics",
        segment: "Logistics",
        relationshipManager: "D. Singh",
        exposure: 6400000,
      },
      signals: {
        paymentHistory: 0.71,
        assetCoverage: 0.61,
        covenantHealth: 0.58,
        telemetryPulse: 0.64,
      },
      riskScore: 72,
      riskTier: "stable",
      updatedAt: new Date().toISOString(),
    },
  ],
};

function cloneFallbackSnapshot(): CreditGraphSnapshot {
  return {
    generatedAt: creditFabricFallback.generatedAt,
    weights: { ...(creditFabricFallback.weights ?? {}) },
    borrowers: (creditFabricFallback.borrowers ?? []).map((borrower) => ({
      ...borrower,
      borrower: borrower.borrower ? { ...borrower.borrower } : undefined,
      signals: borrower.signals ? { ...borrower.signals } : undefined,
    })),
  };
}

const creditTierStyles: Record<string, string> = {
  stable: "border-emerald-200 bg-emerald-50 text-emerald-700",
  watch: "border-amber-200 bg-amber-50 text-amber-700",
  concern: "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
};

function classNames(...arr: (string | false | null | undefined)[]) {
  return arr.filter(Boolean).join(" ");
}

function formatCurrency(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatTierLabel(tier?: string) {
  if (!tier) return "Watch";
  const normalized = tier.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function tierBadgeClass(tier?: string) {
  return creditTierStyles[tier ?? "watch"] ?? "border-slate-200 bg-slate-100 text-slate-700";
}

function signalLabel(key: string) {
  switch (key) {
    case "paymentHistory":
      return "Payment history";
    case "assetCoverage":
      return "Asset coverage";
    case "covenantHealth":
      return "Covenant health";
    case "telemetryPulse":
      return "Telemetry pulse";
    default:
      return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  }
}

function toPercent(value?: number) {
  if (typeof value !== "number") return "—";
  return `${Math.round(value * 100)}%`;
}

function formatRelativeTime(iso?: string) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "—";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} wk${weeks > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo${months > 1 ? "s" : ""} ago`;
  const years = Math.floor(days / 365);
  return `${years} yr${years > 1 ? "s" : ""} ago`;
}

function useCreditGraphSnapshot(apiBase: string) {
  const [snapshot, setSnapshot] = useState<CreditGraphSnapshot>(cloneFallbackSnapshot());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBase}/credit-graph/snapshot`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as CreditGraphSnapshot;
        if (cancelled) return;

        if (!payload || !Array.isArray(payload.borrowers) || payload.borrowers.length === 0) {
          setSnapshot(cloneFallbackSnapshot());
          setError("Graph snapshot unavailable – showing learning fabric.");
          return;
        }

        setSnapshot({
          generatedAt: payload.generatedAt ?? creditFabricFallback.generatedAt,
          weights: { ...creditFabricFallback.weights, ...payload.weights },
          borrowers: payload.borrowers,
        });
      } catch (err: any) {
        if (!cancelled) {
          setSnapshot(cloneFallbackSnapshot());
          setError(err?.message ? `Graph offline: ${err.message}` : "Graph offline: using cached fabric.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [apiBase]);

  return { snapshot, loading, error } as const;
}

type CreditFabricPanelProps = {
  apiBase?: string;
  className?: string;
};

export default function CreditFabricPanel({ apiBase = resolveApiBase(), className }: CreditFabricPanelProps) {
export default function CreditFabricPanel({ apiBase = "/api", className }: CreditFabricPanelProps) {
  const { snapshot, loading, error } = useCreditGraphSnapshot(apiBase);

  const borrowerSummary = useMemo(
    () =>
      (snapshot.borrowers ?? []).reduce(
        (acc, borrower) => {
          const normalized = (borrower.riskTier ?? "watch").toLowerCase();
          switch (normalized) {
            case "stable":
            case "watch":
            case "concern":
            case "critical":
              acc[normalized] += 1;
              break;
            default:
              acc.watch += 1;
              break;
          }
          acc.total += 1;
          return acc;
        },
        { stable: 0, watch: 0, concern: 0, critical: 0, total: 0 }
      ),
    [snapshot.borrowers]
  );

  const weightEntries = useMemo(() => {
    const weights = snapshot.weights ?? creditFabricFallback.weights ?? {};
    return Object.entries(weights).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  }, [snapshot.weights]);

  const topBorrowers = useMemo(() => {
    const source = snapshot.borrowers && snapshot.borrowers.length > 0 ? snapshot.borrowers : creditFabricFallback.borrowers ?? [];
    return [...source]
      .filter(Boolean)
      .sort((a, b) => (b?.riskScore ?? 0) - (a?.riskScore ?? 0))
      .slice(0, 3);
  }, [snapshot.borrowers]);

  const updatedText = formatRelativeTime(snapshot.generatedAt ?? creditFabricFallback.generatedAt);

  return (
    <Card className={classNames("shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base">Autonomous Credit Fabric</CardTitle>
            <p className="text-xs text-muted-foreground">
              Consolidates borrower behavior, collateral coverage, covenant health, and telemetry into adaptive risk signals.
            </p>
          </div>
          <div className="text-xs text-muted-foreground md:text-right">
            {loading ? "Refreshing…" : updatedText === "—" ? "Last sync unavailable" : `Updated ${updatedText}`}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {error}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-12">
          <div className="space-y-4 md:col-span-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Borrowers scored</div>
              <div className="mt-2 text-3xl font-semibold">{borrowerSummary.total}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {(Object.keys(creditTierStyles) as (keyof typeof creditTierStyles)[]).map((tier) => (
                  <div key={tier} className="flex items-center justify-between">
                    <span className="capitalize">{tier}</span>
                    <span className="font-medium text-foreground">{borrowerSummary[tier]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signal weights</div>
              <ul className="mt-3 space-y-2 text-sm">
                {weightEntries.map(([key, value]) => (
                  <li key={key} className="flex items-center justify-between">
                    <span>{signalLabel(key)}</span>
                    <span className="font-medium">{toPercent(value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="md:col-span-8">
            <div className="h-full rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Top exposures by signal confidence
                </div>
                <div className="text-xs text-muted-foreground">
                  {topBorrowers.length} of {borrowerSummary.total}
                </div>
              </div>
              <div className="mt-4 space-y-4">
                {topBorrowers.map((borrower) => (
                  <div key={borrower.borrowerId} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          {borrower.borrower?.name ?? borrower.borrowerId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {borrower.borrower?.segment ?? "Segment pending"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">
                          {Math.round(borrower.riskScore ?? 0)}
                        </div>
                        <Badge variant="outline" className={classNames("mt-1", tierBadgeClass(borrower.riskTier))}>
                          {formatTierLabel(borrower.riskTier)}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground md:grid-cols-4">
                      <div>
                        <div className="text-muted-foreground">Exposure</div>
                        <div className="text-sm font-medium text-foreground">
                          {formatCurrency(borrower.borrower?.exposure)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Last update</div>
                        <div className="text-sm font-medium text-foreground">
                          {formatRelativeTime(borrower.updatedAt)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">RM</div>
                        <div className="text-sm font-medium text-foreground">
                          {borrower.borrower?.relationshipManager ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Signals tracked</div>
                        <div className="text-sm font-medium text-foreground">
                          {Object.keys(borrower.signals ?? {}).length || "—"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Dominant signals
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(borrower.signals ?? {})
                          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                          .slice(0, 3)
                          .map(([signal, value]) => (
                            <span
                              key={signal}
                              className="rounded-full border border-slate-200 px-2 py-1 text-xs font-medium text-muted-foreground"
                            >
                              {signalLabel(signal)} {toPercent(value)}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
                {topBorrowers.length === 0 && (
                  <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    Waiting for borrower telemetry to populate the credit graph.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
