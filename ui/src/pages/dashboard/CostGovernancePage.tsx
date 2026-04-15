/**
 * Kontra AI Cost Governance — Phase 7
 * Route: /cost-governance (Lender portal)
 *
 * Admin dashboard for enterprise AI budget controls:
 *   – MTD spend overview cards
 *   – 4 Usage Tier cards with token envelopes + cost ranges
 *   – Budget management table with utilization bars
 *   – ROI per workflow table
 *   – Daily spend trend (30-day sparkline)
 *   – Recent usage feed
 *   – Cost simulator
 */

import React, { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardStats {
  spend: {
    totalMtdUsd: number;
    totalAllTimeUsd: number;
    avgCostPerRunUsd: number;
    totalMtdRuns: number;
    errorRate: number;
  };
  byWorkflow: Record<string, { cost: number; runs: number; tokens: number; label: string; pct: number }>;
  byTier: Record<string, { cost: number; runs: number; label: string; color: string }>;
  byModel: Record<string, { cost: number; runs: number }>;
  dailyTrend: { date: string; cost: number; runs: number }[];
  roi: {
    totalRuns: number;
    totalCostUsd: number;
    totalManualCostAvoided: number;
    totalNetSaving: number;
    blendedRoiPct: number;
    avgCostPerRun: number;
  };
  roiByWorkflow: {
    workflowType: string;
    label: string;
    category: string;
    runs: number;
    totalCostUsd: number;
    manualCostAvoidedUsd: number;
    netSavingUsd: number;
    roiPct: number;
    avgCostPerRunUsd: number;
    avgLatencyMs: number;
  }[];
  budgets: {
    budgetId: string;
    name: string;
    limitUsd: number;
    spentUsd: number;
    utilizationPct: number;
    alertTriggered: boolean;
    hardStop: boolean;
  }[];
}

interface Tier {
  id: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  preferredModel: string;
  estimatedCostMin: number;
  estimatedCostMax: number;
  timeSavedMinutes: number;
  allowedWorkflows: string[];
}

interface SimResult {
  tierId: string;
  tierLabel: string;
  workflowType: string;
  workflowLabel: string;
  runCount: number;
  preferredModel: string;
  tokenEnvelope: { maxInputTokens: number; maxOutputTokens: number; maxTotalTokens: number };
  costEstimate: { minUsd: number; maxUsd: number; midUsd: number };
  roi: { timeSavedMinutes: number; manualCostAvoidedUsd: number; netSavingUsd: number; roiPct: number };
}

// ── API helpers ───────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";
const ORG_ID   = "demo-org";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Org-Id": ORG_ID, ...(opts.headers || {}) },
  });
  return res.json();
}

// ── Mini sparkline ────────────────────────────────────────────────────────────

function Sparkline({ data, color = "#800020" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max  = Math.max(...data, 0.001);
  const W    = 200;
  const H    = 40;
  const pts  = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (v / max) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <polygon
        points={`0,${H} ${pts} ${W},${H}`}
        fill={color}
        opacity="0.12"
      />
    </svg>
  );
}

// ── Utilization bar ───────────────────────────────────────────────────────────

function UtilBar({ pct, alert }: { pct: number; alert: boolean }) {
  const clamp = Math.min(pct, 100);
  const color = clamp >= 100 ? "#ef4444" : clamp >= 80 ? "#f59e0b" : "#22c55e";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${clamp}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Tier icon (inline svg) ────────────────────────────────────────────────────

function TierIcon({ id }: { id: string }) {
  const icons: Record<string, React.ReactNode> = {
    quick_review:   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    deep_analysis:  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    portfolio_sweep:<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    executive_memo: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  };
  return <>{icons[id] || null}</>;
}

// ── Category badge ────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  underwriting: "bg-blue-100 text-blue-800",
  servicing:    "bg-green-100 text-green-800",
  construction: "bg-orange-100 text-orange-800",
  risk:         "bg-red-100 text-red-800",
  compliance:   "bg-purple-100 text-purple-800",
  operations:   "bg-gray-100 text-gray-700",
  reporting:    "bg-indigo-100 text-indigo-800",
};

function CategoryBadge({ cat }: { cat: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[cat] || "bg-gray-100 text-gray-600"}`}>
      {cat}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Tiers & Workflows", "Budgets", "ROI Dashboard", "Cost Simulator", "Usage Feed"] as const;
type Tab = (typeof TABS)[number];

const WORKFLOW_OPTIONS = [
  "loan_review","inspection_analysis","borrower_package","draw_review",
  "covenant_check","watchlist_update","document_extraction","compliance_check",
  "portfolio_sweep","executive_memo",
];
const TIER_OPTIONS = ["quick_review","deep_analysis","portfolio_sweep","executive_memo"];

export default function CostGovernancePage() {
  const [tab, setTab]         = useState<Tab>("Overview");
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [tiers, setTiers]     = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetModal, setBudgetModal] = useState(false);

  // Simulator state
  const [simTier, setSimTier]       = useState("quick_review");
  const [simWorkflow, setSimWorkflow] = useState("loan_review");
  const [simRuns, setSimRuns]        = useState(10);
  const [simResult, setSimResult]    = useState<SimResult | null>(null);
  const [simLoading, setSimLoading]  = useState(false);

  // New budget form
  const [newBudget, setNewBudget] = useState({ name: "", limitUsd: "", alertAt: "0.80", hardStop: false, scope: "monthly" });
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetSuccess, setBudgetSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashData, tiersData] = await Promise.all([
        apiFetch("/api/cost/dashboard"),
        apiFetch("/api/cost/tiers"),
      ]);
      setStats(dashData);
      setTiers(tiersData.tiers || []);
    } catch {
      // use seeded demo data gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runSimulation() {
    setSimLoading(true);
    try {
      const result = await apiFetch(`/api/cost/tiers/${simTier}/simulate`, {
        method: "POST",
        body: JSON.stringify({ workflowType: simWorkflow, runCount: simRuns }),
      });
      setSimResult(result);
    } finally {
      setSimLoading(false);
    }
  }

  async function saveBudget() {
    setBudgetSaving(true);
    try {
      await apiFetch("/api/cost/budgets", {
        method: "POST",
        body: JSON.stringify({
          name:     newBudget.name,
          limitUsd: parseFloat(newBudget.limitUsd),
          alertAt:  parseFloat(newBudget.alertAt),
          hardStop: newBudget.hardStop,
          scope:    newBudget.scope,
        }),
      });
      setBudgetSuccess(true);
      setBudgetModal(false);
      setNewBudget({ name: "", limitUsd: "", alertAt: "0.80", hardStop: false, scope: "monthly" });
      setTimeout(() => setBudgetSuccess(false), 3000);
      await load();
    } finally {
      setBudgetSaving(false);
    }
  }

  const sparklineData = stats?.dailyTrend.map(d => d.cost) || [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Cost Governance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Enterprise budget controls · token tracking · workflow ROI</p>
          </div>
          <div className="flex items-center gap-3">
            {budgetSuccess && (
              <span className="text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">
                Budget created ✓
              </span>
            )}
            <button
              onClick={() => setBudgetModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: "#800020" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Budget
            </button>
            <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Refresh">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t
                  ? "text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              style={tab === t ? { backgroundColor: "#800020" } : {}}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading AI cost data…
            </div>
          </div>
        ) : (

        <>
          {/* ── TAB: Overview ──────────────────────────────────────────────── */}
          {tab === "Overview" && stats && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label:   "MTD AI Spend",
                    value:   `$${stats.spend.totalMtdUsd.toFixed(2)}`,
                    sub:     `${stats.spend.totalMtdRuns} runs this month`,
                    icon:    "💸",
                    accent:  "#800020",
                  },
                  {
                    label:   "Avg Cost / Run",
                    value:   `$${stats.spend.avgCostPerRunUsd.toFixed(4)}`,
                    sub:     `${stats.spend.errorRate}% error rate`,
                    icon:    "⚡",
                    accent:  "#3b82f6",
                  },
                  {
                    label:   "Blended ROI",
                    value:   `${stats.roi.blendedRoiPct.toLocaleString()}%`,
                    sub:     `$${stats.roi.totalNetSaving.toFixed(0)} net saving`,
                    icon:    "📈",
                    accent:  "#22c55e",
                  },
                  {
                    label:   "Manual Cost Avoided",
                    value:   `$${stats.roi.totalManualCostAvoided.toLocaleString()}`,
                    sub:     `vs. $${stats.roi.totalCostUsd.toFixed(2)} AI cost`,
                    icon:    "🏛️",
                    accent:  "#f59e0b",
                  },
                ].map((card) => (
                  <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{card.label}</span>
                      <span className="text-xl">{card.icon}</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* Spend Trend + By-Workflow */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">AI Spend — Last 30 Days</h3>
                  <div className="w-full overflow-x-auto">
                    <svg
                      viewBox={`0 0 ${sparklineData.length * 8} 60`}
                      className="w-full h-20"
                      preserveAspectRatio="none"
                    >
                      {sparklineData.length > 1 && (() => {
                        const max = Math.max(...sparklineData, 0.001);
                        const pts = sparklineData.map((v, i) => {
                          const x = i * 8 + 4;
                          const y = 56 - (v / max) * 50;
                          return `${x},${y.toFixed(1)}`;
                        }).join(" ");
                        return (
                          <>
                            <polyline points={pts} fill="none" stroke="#800020" strokeWidth="1.5" />
                            <polygon
                              points={`4,56 ${pts} ${(sparklineData.length - 1) * 8 + 4},56`}
                              fill="#800020"
                              opacity="0.1"
                            />
                          </>
                        );
                      })()}
                    </svg>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{stats.dailyTrend[0]?.date || ""}</span>
                      <span>{stats.dailyTrend[stats.dailyTrend.length - 1]?.date || ""}</span>
                    </div>
                  </div>
                </div>

                {/* By Workflow */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Cost by Workflow (MTD)</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.byWorkflow)
                      .sort(([, a], [, b]) => b.cost - a.cost)
                      .slice(0, 7)
                      .map(([key, wf]) => (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 truncate">{wf.label}</span>
                            <span className="text-gray-800 font-medium ml-2">${wf.cost.toFixed(3)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${wf.pct}%`, backgroundColor: "#800020", opacity: 0.7 }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Budget Utilization */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">Active Budgets</h3>
                  <button onClick={() => setTab("Budgets")} className="text-xs text-blue-600 hover:underline">View all →</button>
                </div>
                {stats.budgets.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No budgets configured. Create one to start tracking spend limits.</p>
                ) : (
                  <div className="space-y-4">
                    {stats.budgets.map(b => (
                      <div key={b.budgetId}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-800 font-medium">{b.name}</span>
                            {b.hardStop && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">hard stop</span>
                            )}
                            {b.alertTriggered && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">⚠ alert</span>
                            )}
                          </div>
                          <span className="text-gray-500 text-xs">
                            ${b.spentUsd.toFixed(2)} / ${b.limitUsd.toFixed(2)} ({b.utilizationPct}%)
                          </span>
                        </div>
                        <UtilBar pct={b.utilizationPct} alert={b.alertTriggered} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* By Model */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Cost by Model (MTD)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {Object.entries(stats.byModel)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([model, data]) => (
                      <div key={model} className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 truncate mb-1">{model}</div>
                        <div className="text-lg font-bold text-gray-900">${data.cost.toFixed(3)}</div>
                        <div className="text-xs text-gray-400">{data.runs} runs</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Tiers & Workflows ──────────────────────────────────────── */}
          {tab === "Tiers & Workflows" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {tiers.map(tier => (
                  <div
                    key={tier.id}
                    className="bg-white rounded-xl border-2 p-5 flex flex-col"
                    style={{ borderColor: tier.color }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: tier.color }}
                      >
                        <TierIcon id={tier.id} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{tier.label}</div>
                        <div className="text-xs text-gray-400">{tier.preferredModel}</div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mb-4 leading-relaxed flex-1">{tier.description}</p>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Max tokens</span>
                        <span className="font-medium text-gray-700">
                          {(tier.maxInputTokens + tier.maxOutputTokens).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cost / run</span>
                        <span className="font-medium" style={{ color: tier.color }}>
                          ${tier.estimatedCostMin.toFixed(4)} – ${tier.estimatedCostMax.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Time saved</span>
                        <span className="font-medium text-gray-700">{tier.timeSavedMinutes} min / run</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-400 mb-2">Allowed workflows</div>
                      <div className="flex flex-wrap gap-1">
                        {tier.allowedWorkflows.slice(0, 4).map(wf => (
                          <span key={wf} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {wf.replace(/_/g, " ")}
                          </span>
                        ))}
                        {tier.allowedWorkflows.length > 4 && (
                          <span className="text-xs text-gray-400">+{tier.allowedWorkflows.length - 4}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Workflow Catalog Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Workflow Catalog — Cost Benchmarks</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Manual cost baselines based on $75–130/hr blended analyst rates</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="px-5 py-3 text-left">Workflow</th>
                        <th className="px-4 py-3 text-left">Category</th>
                        <th className="px-4 py-3 text-left">Default Tier</th>
                        <th className="px-4 py-3 text-right">Time Saved</th>
                        <th className="px-4 py-3 text-right">Manual Cost</th>
                        <th className="px-4 py-3 text-right">AI Cost Est.</th>
                        <th className="px-4 py-3 text-right">ROI Est.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[
                        { id: "loan_review", label: "Loan Review", cat: "underwriting", tier: "deep_analysis", mins: 90, manual: 118.75, aiMin: 0.18, aiMax: 0.72 },
                        { id: "inspection_analysis", label: "Inspection Analysis", cat: "servicing", tier: "deep_analysis", mins: 75, manual: 98.96, aiMin: 0.18, aiMax: 0.72 },
                        { id: "borrower_package", label: "Borrower Package Review", cat: "underwriting", tier: "deep_analysis", mins: 120, manual: 158.33, aiMin: 0.18, aiMax: 0.72 },
                        { id: "draw_review", label: "Draw Request Review", cat: "construction", tier: "quick_review", mins: 45, manual: 59.38, aiMin: 0.0003, aiMax: 0.0012 },
                        { id: "covenant_check", label: "Covenant Monitoring", cat: "servicing", tier: "quick_review", mins: 20, manual: 26.39, aiMin: 0.0003, aiMax: 0.0012 },
                        { id: "watchlist_update", label: "Watchlist Update", cat: "risk", tier: "quick_review", mins: 15, manual: 19.79, aiMin: 0.0003, aiMax: 0.0012 },
                        { id: "document_extraction", label: "Document Extraction", cat: "operations", tier: "deep_analysis", mins: 60, manual: 79.17, aiMin: 0.18, aiMax: 0.72 },
                        { id: "compliance_check", label: "Compliance Check", cat: "compliance", tier: "executive_memo", mins: 50, manual: 108.33, aiMin: 0.12, aiMax: 0.48 },
                        { id: "portfolio_sweep", label: "Portfolio Sweep", cat: "risk", tier: "portfolio_sweep", mins: 480, manual: 880.00, aiMin: 1.80, aiMax: 5.20 },
                        { id: "executive_memo", label: "Executive Memo", cat: "reporting", tier: "executive_memo", mins: 60, manual: 130.00, aiMin: 0.12, aiMax: 0.48 },
                      ].map(row => {
                        const midAi = (row.aiMin + row.aiMax) / 2;
                        const roi   = Math.round(((row.manual - midAi) / midAi) * 100);
                        const tierColors: Record<string, string> = {
                          quick_review: "#22c55e", deep_analysis: "#3b82f6",
                          portfolio_sweep: "#f59e0b", executive_memo: "#8b5cf6",
                        };
                        return (
                          <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-gray-800">{row.label}</td>
                            <td className="px-4 py-3"><CategoryBadge cat={row.cat} /></td>
                            <td className="px-4 py-3">
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                                style={{ backgroundColor: tierColors[row.tier] }}
                              >
                                {row.tier.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">{row.mins} min</td>
                            <td className="px-4 py-3 text-right text-gray-700">${row.manual.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-blue-700">
                              ${row.aiMin.toFixed(4)} – ${row.aiMax.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-green-600">
                              {roi.toLocaleString()}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Budgets ───────────────────────────────────────────────── */}
          {tab === "Budgets" && stats && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {stats.budgets.map(b => (
                  <div key={b.budgetId} className={`bg-white rounded-xl border-2 p-5 ${b.alertTriggered ? "border-amber-300" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{b.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {b.hardStop && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Hard Stop</span>
                          )}
                          {b.alertTriggered && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⚠ Alert Triggered</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">{b.utilizationPct}%</div>
                        <div className="text-xs text-gray-400">utilized</div>
                      </div>
                    </div>

                    <UtilBar pct={b.utilizationPct} alert={b.alertTriggered} />

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-gray-500">Spent</div>
                        <div className="font-bold text-gray-800">${b.spentUsd.toFixed(2)}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-gray-500">Limit</div>
                        <div className="font-bold text-gray-800">${b.limitUsd.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Budget Card */}
                <button
                  onClick={() => setBudgetModal(true)}
                  className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-5 flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors min-h-[180px]"
                >
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-medium">New Budget</span>
                </button>
              </div>

              {/* Budget check tool */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Pre-flight Budget Check</h3>
                <p className="text-xs text-gray-500 mb-4">Check whether a workflow run will be allowed before executing it. Pass this check at the start of each AI workflow.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Workflow</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      value={simWorkflow}
                      onChange={e => setSimWorkflow(e.target.value)}
                    >
                      {WORKFLOW_OPTIONS.map(w => (
                        <option key={w} value={w}>{w.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Estimated Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue="0.50"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      id="budget-check-cost"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={async () => {
                        const costEl = document.getElementById("budget-check-cost") as HTMLInputElement;
                        const result = await apiFetch("/api/cost/budgets/check", {
                          method: "POST",
                          body: JSON.stringify({ workflowType: simWorkflow, estimatedCostUsd: parseFloat(costEl?.value || "0.5") }),
                        });
                        alert(result.allowed
                          ? `✅ ALLOWED\n${result.warnings.map((w: { reason: string }) => `⚠ ${w.reason}`).join("\n") || "No warnings"}`
                          : `🛑 BLOCKED\n${result.violations.map((v: { reason: string }) => v.reason).join("\n")}`
                        );
                      }}
                      className="w-full py-2 rounded-lg text-sm font-medium text-white"
                      style={{ backgroundColor: "#800020" }}
                    >
                      Check Budget
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: ROI Dashboard ─────────────────────────────────────────── */}
          {tab === "ROI Dashboard" && stats && (
            <div className="space-y-6">
              {/* Summary banner */}
              <div className="rounded-xl p-5 text-white" style={{ background: "linear-gradient(135deg, #800020 0%, #5a0018 100%)" }}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Blended ROI", value: `${stats.roi.blendedRoiPct.toLocaleString()}%` },
                    { label: "Net AI Cost", value: `$${stats.roi.totalCostUsd.toFixed(2)}` },
                    { label: "Manual Cost Avoided", value: `$${stats.roi.totalManualCostAvoided.toLocaleString()}` },
                    { label: "Net Saving", value: `$${stats.roi.totalNetSaving.toLocaleString()}` },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <div className="text-2xl font-bold">{item.value}</div>
                      <div className="text-xs opacity-70 mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ROI table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">ROI by Workflow (All-Time)</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Ranked highest to lowest ROI. Manual cost = analyst hourly rate × time saved per run.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="px-5 py-3 text-left">Workflow</th>
                        <th className="px-4 py-3 text-left">Category</th>
                        <th className="px-4 py-3 text-right">Runs</th>
                        <th className="px-4 py-3 text-right">AI Cost</th>
                        <th className="px-4 py-3 text-right">Avg / Run</th>
                        <th className="px-4 py-3 text-right">Manual Avoided</th>
                        <th className="px-4 py-3 text-right">Net Saving</th>
                        <th className="px-4 py-3 text-right">ROI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stats.roiByWorkflow.map(row => (
                        <tr key={row.workflowType} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-800">{row.label}</td>
                          <td className="px-4 py-3"><CategoryBadge cat={row.category} /></td>
                          <td className="px-4 py-3 text-right text-gray-600">{row.runs.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-gray-700">${row.totalCostUsd.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-blue-700">${row.avgCostPerRunUsd.toFixed(4)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">${row.manualCostAvoidedUsd.toFixed(0)}</td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">${row.netSavingUsd.toFixed(0)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold text-base ${row.roiPct >= 1000 ? "text-green-600" : row.roiPct >= 100 ? "text-blue-600" : "text-gray-600"}`}>
                              {row.roiPct.toLocaleString()}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold text-sm">
                      <tr>
                        <td className="px-5 py-3 text-gray-800" colSpan={2}>TOTAL</td>
                        <td className="px-4 py-3 text-right text-gray-700">{stats.roi.totalRuns.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-700">${stats.roi.totalCostUsd.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-blue-700">${stats.roi.avgCostPerRun.toFixed(4)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">${stats.roi.totalManualCostAvoided.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-green-600">${stats.roi.totalNetSaving.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-bold text-lg">{stats.roi.blendedRoiPct.toLocaleString()}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Cost Simulator ────────────────────────────────────────── */}
          {tab === "Cost Simulator" && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-1">AI Cost Simulator</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Model projected AI spend and ROI before committing a workflow to production.
                  Select a usage tier, workflow type, and run count to generate a detailed cost breakdown.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Usage Tier</label>
                    <select
                      value={simTier}
                      onChange={e => setSimTier(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      {TIER_OPTIONS.map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Workflow</label>
                    <select
                      value={simWorkflow}
                      onChange={e => setSimWorkflow(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      {WORKFLOW_OPTIONS.map(w => (
                        <option key={w} value={w}>{w.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Run Count</label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={simRuns}
                      onChange={e => setSimRuns(parseInt(e.target.value) || 1)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={runSimulation}
                  disabled={simLoading}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: "#800020" }}
                >
                  {simLoading ? "Simulating…" : "Run Simulation"}
                </button>
              </div>

              {simResult && (
                <div className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{simResult.tierLabel} · {simResult.workflowLabel}</h4>
                      <p className="text-xs text-gray-400">{simResult.runCount.toLocaleString()} runs · {simResult.preferredModel}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">{simResult.roi.roiPct.toLocaleString()}% ROI</div>
                      <div className="text-xs text-gray-400">vs manual</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Est. AI Cost (mid)",       value: `$${simResult.costEstimate.midUsd.toFixed(4)}`, accent: "#800020" },
                      { label: "Cost Range",                value: `$${simResult.costEstimate.minUsd.toFixed(4)} – $${simResult.costEstimate.maxUsd.toFixed(4)}`, accent: "#3b82f6" },
                      { label: "Manual Cost Avoided",       value: `$${simResult.roi.manualCostAvoidedUsd.toFixed(2)}`, accent: "#22c55e" },
                      { label: "Net Saving",                value: `$${simResult.roi.netSavingUsd.toFixed(2)}`, accent: "#f59e0b" },
                      { label: "Time Saved",                value: `${simResult.roi.timeSavedMinutes.toLocaleString()} min`, accent: "#8b5cf6" },
                      { label: "Max Token Envelope",        value: `${simResult.tokenEnvelope.maxTotalTokens.toLocaleString()} tk / run`, accent: "#6b7280" },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                        <div className="font-bold text-gray-900" style={{ color: item.accent }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Usage Feed ────────────────────────────────────────────── */}
          {tab === "Usage Feed" && (
            <UsageFeed />
          )}
        </>
        )}
      </div>

      {/* New Budget Modal */}
      {budgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">New Budget</h3>
              <button onClick={() => setBudgetModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Budget Name *</label>
                <input
                  value={newBudget.name}
                  onChange={e => setNewBudget(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Monthly AI Operations Budget"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Limit (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newBudget.limitUsd}
                    onChange={e => setNewBudget(p => ({ ...p, limitUsd: e.target.value }))}
                    placeholder="2500.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Scope</label>
                  <select
                    value={newBudget.scope}
                    onChange={e => setNewBudget(p => ({ ...p, scope: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                    <option value="per_workflow">Per Workflow</option>
                    <option value="per_loan">Per Loan</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Alert Threshold ({Math.round(parseFloat(newBudget.alertAt || "0.8") * 100)}%)</label>
                <input
                  type="range"
                  min="0.5"
                  max="0.99"
                  step="0.05"
                  value={newBudget.alertAt}
                  onChange={e => setNewBudget(p => ({ ...p, alertAt: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hardStop"
                  checked={newBudget.hardStop}
                  onChange={e => setNewBudget(p => ({ ...p, hardStop: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="hardStop" className="text-sm text-gray-700">
                  Hard stop — block AI calls when limit is reached
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setBudgetModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveBudget}
                disabled={budgetSaving || !newBudget.name || !newBudget.limitUsd}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "#800020" }}
              >
                {budgetSaving ? "Saving…" : "Create Budget"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Usage Feed sub-component ──────────────────────────────────────────────────

function UsageFeed() {
  const [events, setEvents] = useState<{ eventId: string; workflowType: string; model: string; tierId: string; inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number; loanId: string | null; outcome: string; recordedAt: string }[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await apiFetch(`/api/cost/usage?limit=100`);
        setEvents(r.events || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filter === "all" ? events : events.filter(e => e.workflowType === filter);

  const OUTCOME_COLOR: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    error:   "bg-red-100 text-red-700",
    timeout: "bg-orange-100 text-orange-700",
    budget_blocked: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Workflows</option>
          {["loan_review","inspection_analysis","borrower_package","draw_review","covenant_check","watchlist_update","document_extraction","compliance_check","portfolio_sweep","executive_memo"].map(w => (
            <option key={w} value={w}>{w.replace(/_/g, " ")}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">{filtered.length} events</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading usage feed…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Workflow</th>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-right">Tokens</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Latency</th>
                <th className="px-4 py-3 text-left">Loan</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.slice(0, 50).map(ev => (
                <tr key={ev.eventId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(ev.recordedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{ev.workflowType.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{ev.model}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{(ev.inputTokens + ev.outputTokens).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">${ev.costUsd.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">{ev.latencyMs.toLocaleString()}ms</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{ev.loanId || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OUTCOME_COLOR[ev.outcome] || "bg-gray-100 text-gray-600"}`}>
                      {ev.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
