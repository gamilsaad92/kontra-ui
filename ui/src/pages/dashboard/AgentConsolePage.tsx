import React, { useState, useEffect, useCallback } from "react";
import {
  ClipboardDocumentCheckIcon,
  ShieldExclamationIcon,
  EyeIcon,
  ShieldCheckIcon,
  ScaleIcon,
  CubeTransparentIcon,
  PlayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  SparklesIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  InformationCircleIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE || "";

// ── Agent Definitions (mirrored from backend) ─────────────────────────────────

const AGENTS = [
  {
    id: "inspection_agent",
    name: "Inspection Agent",
    description: "Analyzes property inspection reports, classifies deficiencies by severity, validates GSE compliance rules, and determines draw eligibility.",
    icon: ClipboardDocumentCheckIcon,
    color: "amber",
    colorClass: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
    capabilities: ["Deficiency classification (critical/high/low)", "GSE rule validation", "Draw hold determination", "Cure timeline assignment"],
    tools: ["fetchLoan", "fetchInspectionHistory", "classifyInspectionItem", "validateFreddieRule", "approveDrawEligibility"],
  },
  {
    id: "hazard_loss_agent",
    name: "Hazard Loss Agent",
    description: "Processes insurance claims and hazard events, validates disbursement eligibility under PSA/GSE rules, and manages holdback calculations.",
    icon: ShieldExclamationIcon,
    color: "red",
    colorClass: { bg: "bg-red-50", border: "border-red-200", icon: "text-red-600", badge: "bg-red-100 text-red-700" },
    capabilities: ["Insurance proceeds holdback calc", "PSA investor notification", "Contractor bid validation", "Disbursement scheduling"],
    tools: ["fetchLoan", "validateFreddieRule", "createBorrowerRequest", "approveDrawEligibility"],
  },
  {
    id: "surveillance_agent",
    name: "Servicing Surveillance Agent",
    description: "Monitors loan performance, identifies watchlist candidates, generates risk narratives, and triggers enhanced monitoring protocols.",
    icon: EyeIcon,
    color: "violet",
    colorClass: { bg: "bg-violet-50", border: "border-violet-200", icon: "text-violet-600", badge: "bg-violet-100 text-violet-700" },
    capabilities: ["Delinquency trend analysis", "Watchlist risk classification", "Credit narrative generation", "Reserve depletion monitoring"],
    tools: ["fetchLoan", "generateWatchlistComment", "validateFreddieRule"],
  },
  {
    id: "compliance_agent",
    name: "Compliance Agent",
    description: "Validates Freddie Mac servicing compliance requirements, flags deficiencies, and produces compliance status reports.",
    icon: ShieldCheckIcon,
    color: "emerald",
    colorClass: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
    capabilities: ["Freddie Mac guide compliance", "Annual review tracking", "Insurance coverage validation", "CFPB scan"],
    tools: ["fetchLoan", "validateFreddieRule"],
  },
  {
    id: "covenant_agent",
    name: "Covenant Agent",
    description: "Tests financial covenants (DSCR, LTV, occupancy), identifies breaches, calculates cure periods, and triggers investor notifications.",
    icon: ScaleIcon,
    color: "burgundy",
    colorClass: { bg: "bg-rose-50", border: "border-rose-200", icon: "text-rose-700", badge: "bg-rose-100 text-rose-700" },
    capabilities: ["DSCR/LTV/occupancy testing", "Breach cure period calc", "Investor PSA notification", "Cure plan assessment"],
    tools: ["fetchLoan", "validateFreddieRule", "createBorrowerRequest"],
  },
  {
    id: "tokenization_agent",
    name: "Tokenization Readiness Agent",
    description: "Assesses loan eligibility for token inclusion, calculates NAV per token, validates criteria, and stages NAV snapshot publications.",
    icon: CubeTransparentIcon,
    color: "blue",
    colorClass: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
    capabilities: ["Token eligibility validation", "NAV per token calculation", "Pool snapshot staging", "Token holder notification"],
    tools: ["fetchLoan", "validateFreddieRule", "publishTokenizationSnapshot"],
  },
];

// ── Confidence meter ──────────────────────────────────────────────────────────

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 95 ? "text-emerald-600" : pct >= 80 ? "text-amber-600" : "text-red-600";
  const bg = pct >= 95 ? "bg-emerald-100" : pct >= 80 ? "bg-amber-100" : "bg-red-100";
  const fill = pct >= 95 ? "bg-emerald-500" : pct >= 80 ? "bg-amber-500" : "bg-red-500";
  const label = pct >= 95 ? "Auto-Approve" : pct >= 75 ? "Human Review" : "Escalate";
  return (
    <div className="flex items-center gap-3">
      <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center`}>
        <span className={`text-sm font-bold ${color}`}>{pct}%</span>
      </div>
      <div>
        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${fill} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <p className={`text-xs font-medium mt-0.5 ${color}`}>{label}</p>
      </div>
    </div>
  );
}

// ── Rule badge ────────────────────────────────────────────────────────────────

function RuleBadge({ rule }: { rule: { rule_id: string; description: string; result: string } }) {
  const triggered = rule.result === "triggered";
  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg ${triggered ? "bg-red-50 border border-red-100" : "bg-emerald-50 border border-emerald-100"}`}>
      {triggered
        ? <XCircleIcon className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
        : <CheckCircleIcon className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className={`text-xs font-mono font-semibold ${triggered ? "text-red-700" : "text-emerald-700"}`}>{rule.rule_id}</p>
        <p className="text-xs text-gray-600 mt-0.5">{rule.description}</p>
      </div>
    </div>
  );
}

// ── Approval path chain ───────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  servicer_review: "Servicer Review",
  lender_admin: "Lender Admin",
  platform_admin: "Platform Admin",
};

function ApprovalChain({ path }: { path: string[] }) {
  if (!path || path.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
        <span className="text-sm text-emerald-700 font-medium">Auto-approved — no human review required</span>
      </div>
    );
  }
  return (
    <div className="flex items-center flex-wrap gap-2">
      {path.map((role, i) => (
        <React.Fragment key={role}>
          <span className="px-2.5 py-1 rounded-full bg-[#800020]/10 text-[#800020] text-xs font-semibold border border-[#800020]/20">
            {ROLE_LABELS[role] || role}
          </span>
          {i < path.length - 1 && <ArrowRightIcon className="w-3 h-3 text-gray-400" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Decision Transparency Panel ───────────────────────────────────────────────

function DecisionPanel({ decision, onClose, onApprove, onReject }: {
  decision: any; onClose: () => void; onApprove?: () => void; onReject?: () => void;
}) {
  const [showToolCalls, setShowToolCalls] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const statusColor = decision.status === "completed"
    ? "bg-emerald-100 text-emerald-700"
    : decision.status === "needs_review"
    ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pointer-events-none">
      <div className="w-full max-w-2xl h-full max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col pointer-events-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 bg-gray-50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SparklesIcon className="w-4 h-4 text-[#800020]" />
              <span className="text-xs font-semibold text-[#800020] uppercase tracking-wider">AI Decision Artifact</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
                {decision.status?.replace("_", " ") || "—"}
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900">{decision.agent_name}</h2>
            <p className="text-sm text-gray-500">Loan {decision.loan_ref || decision.loan_id} · {new Date(decision.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Confidence */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Confidence Level</p>
            <ConfidenceMeter confidence={decision.confidence} />
          </div>

          {/* Sources */}
          {decision.sources?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Source Documents</p>
              <div className="flex flex-wrap gap-2">
                {decision.sources.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                    <DocumentTextIcon className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs text-blue-700 font-medium">{s.label}</span>
                    {s.date && <span className="text-xs text-blue-400">· {s.date}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rules Triggered */}
          {decision.rules_triggered?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rules Evaluated</p>
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">
                  {decision.rules_triggered.filter((r: any) => r.result === "triggered").length} triggered
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold">
                  {decision.rules_triggered.filter((r: any) => r.result === "clear").length} clear
                </span>
              </div>
              <div className="space-y-1.5">
                {decision.rules_triggered.map((r: any) => <RuleBadge key={r.rule_id} rule={r} />)}
              </div>
            </div>
          )}

          {/* Findings */}
          {decision.findings?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Findings</p>
              <ul className="space-y-1.5">
                {decision.findings.map((f: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Action */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recommended Action</p>
            <div className="p-4 bg-[#800020]/5 border border-[#800020]/20 rounded-xl">
              <p className="text-sm text-gray-800 font-medium leading-relaxed">{decision.recommended_action}</p>
            </div>
          </div>

          {/* Approval Path */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Approval Path</p>
            <ApprovalChain path={decision.approval_path} />
          </div>

          {/* Reasoning (expandable) */}
          {decision.reasoning && (
            <div>
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-800 transition-colors"
              >
                <InformationCircleIcon className="w-4 h-4" />
                Agent Reasoning
                {showReasoning ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
              </button>
              {showReasoning && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-sm text-gray-600 leading-relaxed">{decision.reasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* Tool Call Trace (expandable) */}
          {decision.tool_calls?.length > 0 && (
            <div>
              <button
                onClick={() => setShowToolCalls(!showToolCalls)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-800 transition-colors"
              >
                <WrenchScrewdriverIcon className="w-4 h-4" />
                Tool Execution Trace ({decision.tool_calls.length} calls)
                {showToolCalls ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
              </button>
              {showToolCalls && (
                <div className="mt-2 space-y-2">
                  {decision.tool_calls.map((tc: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 font-mono text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#800020] font-bold">{tc.tool}()</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-500">call #{i + 1}</span>
                      </div>
                      <p className="text-gray-500"><span className="text-gray-700 font-semibold">IN:</span> {tc.input_summary}</p>
                      <p className="text-gray-500 mt-0.5"><span className="text-gray-700 font-semibold">OUT:</span> {tc.output_summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action footer */}
        {decision.requires_human_approval && (
          <div className="border-t border-gray-100 p-4 bg-amber-50">
            <p className="text-xs text-amber-700 font-medium mb-3">
              <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" />
              This decision requires human review before the recommended action is executed.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onApprove}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a] transition-colors"
              >
                <CheckIcon className="w-4 h-4" /> Approve Action
              </button>
              <button
                onClick={onReject}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Run Agent Modal ───────────────────────────────────────────────────────────

function RunAgentModal({ agent, onClose, onRun }: { agent: any; onClose: () => void; onRun: (loanId: string) => void }) {
  const [loanId, setLoanId] = useState("");
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    if (!loanId.trim()) return;
    setRunning(true);
    await onRun(loanId.trim());
    setRunning(false);
  };

  const Icon = agent.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl ${agent.colorClass.bg} ${agent.colorClass.border} border flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${agent.colorClass.icon}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Run {agent.name}</h3>
            <p className="text-xs text-gray-500">First-pass analysis only · Human review required</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loan ID or Reference</label>
          <input
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRun()}
            placeholder="e.g. LN-3301 or loan UUID"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30 focus:border-[#800020]"
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1">The agent will call backend tools to gather data for this loan and produce a decision artifact.</p>
        </div>

        <div className="mb-5 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 mb-1.5">Tools this agent will use:</p>
          <div className="flex flex-wrap gap-1.5">
            {agent.tools.map((t: string) => (
              <span key={t} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono text-gray-600">{t}()</span>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={!loanId.trim() || running}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {running ? (
              <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Running Analysis...</>
            ) : (
              <><PlayIcon className="w-4 h-4" /> Run Analysis</>
            )}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────

function AgentCard({ agent, onRun, decisionCount }: { agent: any; onRun: () => void; decisionCount: number }) {
  const Icon = agent.icon;
  return (
    <div className={`bg-white rounded-2xl border ${agent.colorClass.border} shadow-sm hover:shadow-md transition-shadow flex flex-col`}>
      <div className={`${agent.colorClass.bg} rounded-t-2xl px-5 py-4 flex items-start justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-white border ${agent.colorClass.border} flex items-center justify-center shadow-sm`}>
            <Icon className={`w-5 h-5 ${agent.colorClass.icon}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{agent.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{decisionCount} decisions</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-500">idle</span>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{agent.description}</p>
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Capabilities</p>
          <ul className="space-y-1">
            {agent.capabilities.map((c: string) => (
              <li key={c} className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckCircleIcon className={`w-3.5 h-3.5 ${agent.colorClass.icon} shrink-0`} /> {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tools</p>
          <div className="flex flex-wrap gap-1">
            {agent.tools.map((t: string) => (
              <span key={t} className="px-1.5 py-0.5 bg-gray-50 border border-gray-100 rounded text-xs font-mono text-gray-500">{t}()</span>
            ))}
          </div>
        </div>
      </div>
      <div className="px-5 pb-5">
        <button
          onClick={onRun}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#800020] text-white text-sm font-semibold rounded-xl hover:bg-[#6a001a] transition-colors"
        >
          <PlayIcon className="w-4 h-4" /> Run Analysis
        </button>
      </div>
    </div>
  );
}

// ── Decision List Item ────────────────────────────────────────────────────────

function DecisionRow({ decision, onClick }: { decision: any; onClick: () => void }) {
  const triggered = decision.rules_triggered?.filter((r: any) => r.result === "triggered").length || 0;
  const pct = Math.round((decision.confidence || 0) * 100);
  const statusColor = decision.status === "completed"
    ? "bg-emerald-100 text-emerald-700"
    : decision.status === "needs_review"
    ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";
  const confColor = pct >= 95 ? "text-emerald-600" : pct >= 80 ? "text-amber-600" : "text-red-600";

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{decision.agent_name}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs font-mono text-gray-500">{decision.loan_ref || decision.loan_id}</span>
            {triggered > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">{triggered} rule{triggered > 1 ? "s" : ""} triggered</span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate pr-4">{decision.recommended_action}</p>
        </div>
        <div className="text-right shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor} block mb-1`}>
            {decision.status?.replace("_", " ")}
          </span>
          <span className={`text-xs font-bold ${confColor}`}>{pct}%</span>
          <span className="text-xs text-gray-400 block">{new Date(decision.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AgentConsolePage() {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDecision, setSelectedDecision] = useState<any>(null);
  const [runModal, setRunModal] = useState<any>(null);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDecisions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/agent-console/decisions`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDecisions(data.decisions || []);
      }
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchDecisions(); }, [fetchDecisions]);

  const decisionCountByAgent = (agentId: string) =>
    decisions.filter((d) => d.agent === agentId).length;

  const handleRun = async (loanId: string) => {
    if (!runModal) return;
    setRunningAgent(runModal.id);
    try {
      const res = await fetch(`${API_BASE}/api/agent-console/agents/${runModal.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ loan_id: loanId }),
      });
      const data = await res.json();
      if (res.ok && data.decision) {
        setDecisions((prev) => [data.decision, ...prev]);
        setSelectedDecision(data.decision);
        showToast(`${runModal.name} completed analysis for ${loanId}`);
      } else {
        showToast(data.error || "Agent run failed", "err");
      }
    } catch (err: any) {
      showToast(err.message || "Network error", "err");
    }
    setRunningAgent(null);
    setRunModal(null);
  };

  const pendingCount = decisions.filter((d) => d.requires_human_approval && d.status === "needs_review").length;
  const completedCount = decisions.filter((d) => d.status === "completed").length;

  return (
    <div className="min-h-screen bg-[#f9f8f6] p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SparklesIcon className="w-5 h-5 text-[#800020]" />
              <span className="text-xs font-semibold text-[#800020] uppercase tracking-wider">Phase 2 · AI Work Layer</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Agent Console</h1>
            <p className="text-sm text-gray-500 mt-1">Tool-using AI workers for first-pass servicing analysis. Every decision is transparent and requires human review before execution.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
              <div className="text-xs text-gray-500">Pending Review</div>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{completedCount}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-[#800020]">{AGENTS.length}</div>
              <div className="text-xs text-gray-500">Active Agents</div>
            </div>
          </div>
        </div>

        {/* Phase 2 info bar */}
        <div className="mt-5 p-4 bg-[#800020]/5 border border-[#800020]/15 rounded-xl flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-[#800020] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#800020]">Human-in-the-Loop by Design</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Each agent performs first-pass analysis using tool calls (fetchLoan, validateFreddieRule, classifyInspectionItem, etc.) and produces a structured Decision Artifact with sources, triggered rules, confidence score, recommended action, and approval path. No write action executes without human approval.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left: Agent Cards */}
        <div className="xl:col-span-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Registered Agents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onRun={() => setRunModal(agent)}
                decisionCount={decisionCountByAgent(agent.id)}
              />
            ))}
          </div>

          {/* Decision Transparency explainer */}
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Decision Transparency Format</h3>
            <p className="text-xs text-gray-500 mb-4">Every AI decision artifact contains all five transparency components required for audit and regulatory compliance:</p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {[
                { label: "Source Documents", desc: "Every document the agent consulted", icon: DocumentTextIcon, color: "text-blue-600 bg-blue-50" },
                { label: "Rules Triggered", desc: "GSE/Freddie Mac rules tested with pass/fail", icon: ScaleIcon, color: "text-red-600 bg-red-50" },
                { label: "Confidence Score", desc: "0–100% with tier (auto/review/escalate)", icon: SparklesIcon, color: "text-amber-600 bg-amber-50" },
                { label: "Recommended Action", desc: "Specific, actionable next step", icon: ArrowRightIcon, color: "text-emerald-600 bg-emerald-50" },
                { label: "Approval Path", desc: "Required human approvers in sequence", icon: CheckCircleIcon, color: "text-[#800020] bg-rose-50" },
              ].map((item) => {
                const ItemIcon = item.icon;
                return (
                  <div key={item.label} className="text-center p-3 bg-gray-50 rounded-xl">
                    <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center mx-auto mb-2`}>
                      <ItemIcon className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-tight">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Decision Feed */}
        <div className="xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Decisions</h2>
            <button onClick={fetchDecisions} className="text-xs text-[#800020] font-semibold hover:underline flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-10 text-center">
                <div className="w-8 h-8 border-2 border-[#800020] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Loading decisions...</p>
              </div>
            ) : decisions.length === 0 ? (
              <div className="p-10 text-center">
                <SparklesIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No decisions yet.</p>
                <p className="text-xs text-gray-300 mt-1">Run an agent to generate your first decision artifact.</p>
              </div>
            ) : (
              <div>
                {decisions.map((d) => (
                  <DecisionRow
                    key={d.id}
                    decision={d}
                    onClick={() => setSelectedDecision(d)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Decision queue stats */}
          {decisions.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Needs Review", val: decisions.filter((d) => d.status === "needs_review").length, color: "text-amber-600 bg-amber-50 border-amber-100" },
                { label: "Completed", val: decisions.filter((d) => d.status === "completed").length, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                { label: "Triggered", val: decisions.reduce((acc, d) => acc + (d.rules_triggered?.filter((r: any) => r.result === "triggered").length || 0), 0), color: "text-red-600 bg-red-50 border-red-100" },
              ].map((s) => (
                <div key={s.label} className={`p-3 rounded-xl border text-center ${s.color}`}>
                  <p className="text-lg font-bold">{s.val}</p>
                  <p className="text-xs font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Decision Panel */}
      {selectedDecision && (
        <DecisionPanel
          decision={selectedDecision}
          onClose={() => setSelectedDecision(null)}
          onApprove={() => { showToast("Action approved — routing to workflow queue"); setSelectedDecision(null); }}
          onReject={() => { showToast("Action rejected", "err"); setSelectedDecision(null); }}
        />
      )}

      {/* Run Agent Modal */}
      {runModal && (
        <RunAgentModal
          agent={runModal}
          onClose={() => setRunModal(null)}
          onRun={handleRun}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold
          ${toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
        >
          {toast.type === "ok" ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
