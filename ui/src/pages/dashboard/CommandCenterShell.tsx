/**
 * Kontra Command Center Shell — Phase 8
 * Reusable command center layout used by all 6 operational centers.
 */

import React, { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface KPI {
  label: string;
  value: number | string;
  delta: string;
  unit: string;
  trend: "up" | "down" | "flat";
}

interface Workflow {
  id: string;
  name: string;
  status: string;
  agent: string;
  slaHours: number;
  elapsedMins: number;
  priority: "low" | "normal" | "high" | "critical";
  [key: string]: unknown;
}

interface AgentOutput {
  id: string;
  agent: string;
  model: string;
  action: string;
  confidence: number;
  ts: string;
  status: string;
  [key: string]: unknown;
}

interface Approval {
  id: string;
  type: string;
  amount?: number;
  submittedAt: string;
  urgency: string;
  requestedBy?: string;
  [key: string]: unknown;
}

interface SLABreach {
  id: string;
  workflow: string;
  breachedBy: string;
  assignee: string;
  severity: string;
  [key: string]: unknown;
}

interface Exception {
  id: string;
  code: string;
  description: string;
  severity: string;
  [key: string]: unknown;
}

interface DashboardData {
  kpis: KPI[];
  workflows: Workflow[];
  agentOutputs: AgentOutput[];
  approvals: Approval[];
  slaBreaches: SLABreach[];
  exceptions: Exception[];
  generatedAt?: string;
}

interface CommandCenterShellProps {
  centerId: string;
  title: string;
  subtitle: string;
  accentColor: string; // tailwind color name e.g. "burgundy" → use inline hex
  accentHex: string;
  icon: React.ReactNode;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const API_BASE = "";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function relTime(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function slaColor(status: string): string {
  const m: Record<string, string> = {
    running:   "#3b82f6",
    pending:   "#f59e0b",
    complete:  "#10b981",
    escalated: "#ef4444",
    breach:    "#dc2626",
    review:    "#8b5cf6",
    approved:  "#10b981",
    rejected:  "#ef4444",
    open:      "#f59e0b",
  };
  return m[status] ?? "#6b7280";
}

function priorityBadge(p: string): React.ReactNode {
  const cfg: Record<string, { bg: string; label: string }> = {
    critical: { bg: "#dc2626", label: "CRITICAL" },
    high:     { bg: "#ef4444", label: "HIGH"     },
    normal:   { bg: "#3b82f6", label: "NORMAL"   },
    low:      { bg: "#6b7280", label: "LOW"       },
  };
  const c = cfg[p] ?? cfg.normal;
  return (
    <span style={{ background: c.bg }} className="text-white text-xs font-bold px-1.5 py-0.5 rounded">
      {c.label}
    </span>
  );
}

function pct(elapsed: number, slaHours: number): number {
  return Math.min(100, Math.round((elapsed / (slaHours * 60)) * 100));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KPICard({ kpi, hex }: { kpi: KPI; hex: string }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-col gap-1">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">{kpi.label}</p>
      <div className="flex items-end gap-2">
        <span className="text-white text-2xl font-bold">
          {typeof kpi.value === "number" ? fmt(kpi.value) : kpi.value}
          {kpi.unit && <span className="text-sm text-gray-400 ml-1">{kpi.unit}</span>}
        </span>
        <span
          className="text-xs font-semibold pb-0.5"
          style={{ color: kpi.trend === "up" ? (kpi.label.toLowerCase().includes("breach") || kpi.label.toLowerCase().includes("violation") || kpi.label.toLowerCase().includes("delinquen") || kpi.label.toLowerCase().includes("open") ? "#ef4444" : "#10b981") : kpi.trend === "down" ? "#10b981" : "#6b7280" }}
        >
          {kpi.delta}
        </span>
      </div>
    </div>
  );
}

function WorkflowRow({ wf }: { wf: Workflow }) {
  const p = pct(wf.elapsedMins, wf.slaHours);
  const elapsed = wf.elapsedMins >= 60 ? `${Math.floor(wf.elapsedMins / 60)}h ${wf.elapsedMins % 60}m` : `${wf.elapsedMins}m`;
  return (
    <div className="border-b border-gray-800 last:border-0 py-3 px-4 hover:bg-gray-800/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{wf.name}</p>
          <p className="text-gray-400 text-xs mt-0.5">
            <span className="font-mono">{(wf.loan || wf.wallet || wf.token || wf.property || wf.scope || "") as string}</span>
            {" · "}<span className="text-blue-400">{wf.agent}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {priorityBadge(wf.priority)}
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${slaColor(wf.status)}22`, color: slaColor(wf.status), border: `1px solid ${slaColor(wf.status)}44` }}>
            {wf.status.toUpperCase()}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${p}%`, background: p >= 100 ? "#dc2626" : p >= 80 ? "#f59e0b" : "#10b981" }}
          />
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{elapsed} / {wf.slaHours}h SLA</span>
      </div>
    </div>
  );
}

function AgentOutputCard({ out }: { out: AgentOutput }) {
  return (
    <div className="border border-gray-700 rounded-lg p-3 bg-gray-900 hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-400">{out.agent}</span>
          <span className="text-xs text-gray-500">{out.model}</span>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${slaColor(out.status)}22`, color: slaColor(out.status) }}>
            {out.status.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{relTime(out.ts)}</span>
          <span className="text-xs font-semibold text-emerald-400">{(out.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
      <p className="text-gray-300 text-xs leading-relaxed">{out.action}</p>
    </div>
  );
}

function ApprovalRow({ item, onAction, hex }: { item: Approval; onAction: (id: string, action: string) => void; hex: string }) {
  return (
    <div className="border-b border-gray-800 last:border-0 py-3 px-4 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{item.type}</p>
        <p className="text-gray-400 text-xs mt-0.5">
          {item.requestedBy && <span>{item.requestedBy as string} · </span>}
          {item.amount != null && item.amount > 0 && <span className="text-green-400 font-semibold">${(item.amount as number).toLocaleString()} · </span>}
          <span>{relTime(item.submittedAt)}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: item.urgency === "critical" ? "#dc262622" : item.urgency === "high" ? "#f59e0b22" : "#3b82f622", color: item.urgency === "critical" ? "#dc2626" : item.urgency === "high" ? "#f59e0b" : "#3b82f6" }}>
          {item.urgency.toUpperCase()}
        </span>
        <button onClick={() => onAction(item.id, "approve")} className="text-xs px-2 py-1 rounded font-semibold text-white hover:opacity-80 transition-opacity" style={{ background: hex }}>
          Approve
        </button>
        <button onClick={() => onAction(item.id, "escalate")} className="text-xs px-2 py-1 rounded font-semibold bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors">
          Escalate
        </button>
      </div>
    </div>
  );
}

function SLABreachCard({ breach }: { breach: SLABreach }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0 px-4">
      <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: breach.severity === "critical" ? "#dc2626" : "#f59e0b" }} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{breach.workflow}</p>
        <p className="text-gray-400 text-xs">{(breach.loan || breach.property || breach.token || breach.scope || "") as string} · Breached by <span className="text-red-400 font-semibold">{breach.breachedBy}</span></p>
      </div>
      <span className="text-xs text-gray-400 flex-shrink-0">@{breach.assignee}</span>
    </div>
  );
}

function ExceptionCard({ ex }: { ex: Exception }) {
  const color = ex.severity === "critical" ? "#dc2626" : ex.severity === "high" ? "#f59e0b" : "#3b82f6";
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-800 last:border-0 px-4">
      <span className="text-xs font-bold mt-0.5 px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${color}22`, color }}>
        {ex.severity.toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-amber-400 font-semibold">{ex.code}</p>
        <p className="text-gray-300 text-xs leading-relaxed mt-0.5">{ex.description}</p>
      </div>
    </div>
  );
}

// ── Main Shell ─────────────────────────────────────────────────────────────────

export default function CommandCenterShell({
  centerId, title, subtitle, accentHex, icon,
}: CommandCenterShellProps) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [toast, setToast]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/cc/${centerId}/dashboard`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  const handleAction = async (actionId: string, action: string) => {
    try {
      await fetch(`${API_BASE}/api/cc/${centerId}/actions/${actionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const msg = action === "approve" ? "Approved successfully" : "Escalated to supervisor";
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
      fetchData();
    } catch {
      setToast("Action failed — please retry");
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-700 rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: accentHex }} />
          <p className="text-gray-400">Loading {title}…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-red-400 font-semibold mb-2">Failed to load command center</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded text-white text-sm font-semibold" style={{ background: accentHex }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const runningCount  = data.workflows.filter(w => w.status === "running").length;
  const breachCount   = data.workflows.filter(w => w.status === "breach").length;
  const criticalCount = data.workflows.filter(w => w.priority === "critical").length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white text-sm font-semibold shadow-xl" style={{ background: accentHex }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accentHex}22`, border: `1px solid ${accentHex}44` }}>
              <span style={{ color: accentHex }}>{icon}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{title}</h1>
              <p className="text-gray-400 text-xs">{subtitle}</p>
            </div>
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-400 text-xs font-semibold">{runningCount} Running</span>
            </div>
            {breachCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-red-400 text-xs font-semibold">{breachCount} SLA Breach</span>
              </div>
            )}
            {criticalCount > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full px-3 py-1">
                <span className="text-orange-400 text-xs font-semibold">{criticalCount} Critical</span>
              </div>
            )}
            <div className="flex items-center gap-2 ml-2">
              <span className="text-gray-500 text-xs">Refreshed {lastRefresh.toLocaleTimeString()}</span>
              <button
                onClick={() => setAutoRefresh(a => !a)}
                className="text-xs px-2 py-1 rounded border transition-colors"
                style={{ borderColor: autoRefresh ? `${accentHex}66` : "#374151", color: autoRefresh ? accentHex : "#6b7280" }}
              >
                {autoRefresh ? "⟳ Live" : "⟳ Paused"}
              </button>
              <button onClick={fetchData} className="text-xs px-3 py-1 rounded text-white font-semibold transition-opacity hover:opacity-80" style={{ background: accentHex }}>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {data.kpis.map((k, i) => <KPICard key={i} kpi={k} hex={accentHex} />)}
        </div>

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* LEFT: Live Workflow Queue (2/3 width) */}
          <div className="xl:col-span-2 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700" style={{ borderLeftWidth: 3, borderLeftColor: accentHex }}>
              <div>
                <h2 className="text-white font-semibold text-sm">Live Workflow Queue</h2>
                <p className="text-gray-400 text-xs">{data.workflows.length} workflows · SLA progress tracked</p>
              </div>
              <span className="text-xs text-gray-500">{data.workflows.filter(w => w.status === "complete").length} complete</span>
            </div>
            <div className="divide-y divide-gray-800">
              {data.workflows.map(wf => <WorkflowRow key={wf.id} wf={wf} />)}
            </div>
          </div>

          {/* RIGHT: Pending Approvals (1/3 width) */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700" style={{ borderLeftWidth: 3, borderLeftColor: "#f59e0b" }}>
              <div>
                <h2 className="text-white font-semibold text-sm">Pending Approvals</h2>
                <p className="text-gray-400 text-xs">{data.approvals.length} require action</p>
              </div>
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{data.approvals.length}</span>
            </div>
            {data.approvals.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">No pending approvals</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {data.approvals.map(a => <ApprovalRow key={a.id} item={a} onAction={handleAction} hex={accentHex} />)}
              </div>
            )}
          </div>
        </div>

        {/* Agent Outputs */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700" style={{ borderLeftWidth: 3, borderLeftColor: "#3b82f6" }}>
            <h2 className="text-white font-semibold text-sm">Agent Outputs</h2>
            <p className="text-gray-400 text-xs">Real-time AI decisions, analyses, and recommendations</p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.agentOutputs.map(o => <AgentOutputCard key={o.id} out={o} />)}
          </div>
        </div>

        {/* Bottom row: SLA Breaches + Exception Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* SLA Breaches */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700" style={{ borderLeftWidth: 3, borderLeftColor: "#dc2626" }}>
              <div>
                <h2 className="text-white font-semibold text-sm">SLA Breaches</h2>
                <p className="text-gray-400 text-xs">Active breach alerts requiring escalation</p>
              </div>
              {data.slaBreaches.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center animate-pulse">{data.slaBreaches.length}</span>
              )}
            </div>
            {data.slaBreaches.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">✓ No active SLA breaches</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {data.slaBreaches.map(b => <SLABreachCard key={b.id} breach={b} />)}
              </div>
            )}
          </div>

          {/* Exception Queue */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700" style={{ borderLeftWidth: 3, borderLeftColor: "#8b5cf6" }}>
              <div>
                <h2 className="text-white font-semibold text-sm">Exception Queue</h2>
                <p className="text-gray-400 text-xs">Flagged issues requiring manual resolution</p>
              </div>
              {data.exceptions.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">{data.exceptions.length}</span>
              )}
            </div>
            {data.exceptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">✓ No active exceptions</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {data.exceptions.map(e => <ExceptionCard key={e.id} ex={e} />)}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-600 text-xs pb-4">
          {title} · Kontra Platform · Last updated {lastRefresh.toLocaleTimeString()}
          {data.generatedAt && ` · Data as of ${new Date(data.generatedAt).toLocaleTimeString()}`}
        </div>
      </div>
    </div>
  );
}
