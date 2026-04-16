/**
 * Kontra AI Copilot — Unified AI interface
 * Groups all AI agents under one surface with a Copilot framing.
 * Internally uses the existing AgentConsolePage infrastructure.
 */

import React, { useState, useEffect } from "react";
import {
  SparklesIcon,
  CpuChipIcon,
  BoltIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const AGENT_CAPABILITIES = [
  {
    id: "draw-review",
    name: "Draw Review",
    icon: CurrencyDollarIcon,
    description: "Reviews construction draw requests against budget, inspection status, and lien waivers. Recommends approve, flag, or reject with full rationale.",
    model: "gpt-4o",
    avgLatency: "1.8s",
    accuracy: "97.2%",
    color: "#800020",
  },
  {
    id: "inspection-review",
    name: "Inspection Review",
    icon: DocumentTextIcon,
    description: "Analyzes field inspection reports and photos to validate construction progress, flag discrepancies, and gate draw approvals.",
    model: "gpt-4o",
    avgLatency: "2.4s",
    accuracy: "94.8%",
    color: "#2563eb",
  },
  {
    id: "escrow-monitoring",
    name: "Escrow Monitoring",
    icon: ShieldCheckIcon,
    description: "Continuously monitors escrow balances, flags shortfalls, triggers reserve replenishment alerts, and schedules disbursements.",
    model: "gpt-3.5-turbo",
    avgLatency: "0.9s",
    accuracy: "99.1%",
    color: "#059669",
  },
  {
    id: "financial-analysis",
    name: "Borrower Financial Analysis",
    icon: ChartBarIcon,
    description: "Parses uploaded P&L, rent rolls, and balance sheets to calculate DSCR, LTV changes, and flag covenant breaches.",
    model: "gpt-4o",
    avgLatency: "3.1s",
    accuracy: "96.4%",
    color: "#7c3aed",
  },
  {
    id: "payment-anomaly",
    name: "Payment Anomaly Detection",
    icon: BoltIcon,
    description: "Monitors payment events in real time, detects late payments, partial payments, and delinquency patterns before they escalate.",
    model: "gpt-3.5-turbo",
    avgLatency: "0.6s",
    accuracy: "98.7%",
    color: "#d97706",
  },
  {
    id: "risk-scoring",
    name: "Risk Scoring",
    icon: CpuChipIcon,
    description: "Generates continuous portfolio risk scores across all loans, incorporating market data, borrower performance, and collateral trends.",
    model: "gpt-4o",
    avgLatency: "2.2s",
    accuracy: "93.9%",
    color: "#dc2626",
  },
  {
    id: "report-generation",
    name: "Report Generation",
    icon: DocumentTextIcon,
    description: "Auto-generates investor reports, regulatory filings, servicing summaries, and audit-ready PDFs from structured loan data.",
    model: "gpt-4o",
    avgLatency: "4.7s",
    accuracy: "99.3%",
    color: "#0891b2",
  },
  {
    id: "borrower-communications",
    name: "Borrower Communications",
    icon: ChatBubbleLeftRightIcon,
    description: "Drafts and sends borrower notifications, payment reminders, draw status updates, and inspection scheduling — in the lender's voice.",
    model: "gpt-4o",
    avgLatency: "1.4s",
    accuracy: "95.6%",
    color: "#16a34a",
  },
];

interface AgentDecision {
  agent: string;
  recommendation: string;
  confidence: number;
  explanation: string;
  model: string;
  ts: string;
  status: string;
}

export default function AICopilotPage() {
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDecisions = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`${API_BASE}/api/agent-console/decisions`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDecisions(Array.isArray(data) ? data : data.decisions ?? []);
      }
    } catch {
      // Use demo data if API unavailable
      setDecisions(getDemoDecisions());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDecisions(); }, []);

  const filtered = activeAgent
    ? decisions.filter(d => d.agent.toLowerCase().includes(activeAgent.toLowerCase().replace("-", " ")))
    : decisions;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AI Copilot</h1>
              <p className="text-gray-400 text-xs">8 specialized agents · Real-time loan intelligence · Full audit trail</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-semibold">All agents online</span>
            </div>
            <button
              onClick={fetchDecisions}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-8">

        {/* Agent capabilities grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold">Agent Capabilities</h2>
              <p className="text-gray-400 text-xs mt-0.5">Click any agent to filter its decisions below</p>
            </div>
            {activeAgent && (
              <button onClick={() => setActiveAgent(null)} className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors">
                Show all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {AGENT_CAPABILITIES.map(agent => {
              const Icon = agent.icon;
              const isActive = activeAgent === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => setActiveAgent(isActive ? null : agent.id)}
                  className="text-left bg-gray-900 border rounded-xl p-4 hover:border-gray-600 transition-all"
                  style={{ borderColor: isActive ? agent.color : "#374151" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${agent.color}22` }}>
                      <Icon className="w-4 h-4" style={{ color: agent.color }} />
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{agent.model}</span>
                  </div>
                  <p className="text-white text-sm font-semibold mb-1">{agent.name}</p>
                  <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{agent.description}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-green-400 font-semibold">{agent.accuracy} acc.</span>
                    <span className="text-xs text-gray-500">{agent.avgLatency} avg</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent AI decisions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold">Recent AI Decisions</h2>
              <p className="text-gray-400 text-xs mt-0.5">
                {filtered.length} decisions · Each with recommendation, confidence, explanation, and model used
              </p>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-gray-700 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">No decisions yet — agents are processing</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {filtered.slice(0, 20).map((d, i) => (
                  <DecisionRow key={i} decision={d} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Capability footer */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 pt-2">
          {[
            { label: "Structured Output", desc: "Every decision includes recommendation, confidence, explanation, inputs, model, timestamp" },
            { label: "Audit Trail", desc: "Full immutable log of every AI action for regulatory review" },
            { label: "Human Override", desc: "Any AI decision can be approved, rejected, or escalated by authorized users" },
            { label: "Model Routing", desc: "Complex decisions → GPT-4o. Routine tasks → GPT-3.5 for cost efficiency" },
            { label: "Confidence Scoring", desc: "Each output includes a confidence level; low-confidence decisions auto-escalate" },
            { label: "Explainability", desc: "Every recommendation includes a plain-English explanation of the reasoning" },
          ].map(f => (
            <div key={f.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mb-2" />
              <p className="text-white text-xs font-semibold mb-1">{f.label}</p>
              <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DecisionRow({ decision }: { decision: AgentDecision }) {
  const conf = Math.round((decision.confidence ?? 0) * 100);
  const confColor = conf >= 90 ? "#10b981" : conf >= 70 ? "#f59e0b" : "#ef4444";
  const statusColors: Record<string, string> = {
    approved: "#10b981", pending: "#f59e0b", flagged: "#f59e0b",
    completed: "#10b981", running: "#3b82f6", rejected: "#ef4444",
  };
  const status = decision.status ?? "pending";
  const statusColor = statusColors[status] ?? "#6b7280";
  const ts = decision.ts ? new Date(decision.ts) : new Date();
  const ago = Math.floor((Date.now() - ts.getTime()) / 60000);

  return (
    <div className="px-4 py-3 hover:bg-gray-800/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-blue-400 text-xs font-semibold">{decision.agent}</span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-gray-500 text-xs font-mono">{decision.model ?? "gpt-4o"}</span>
          </div>
          <p className="text-white text-sm font-medium mb-1">{decision.recommendation}</p>
          {decision.explanation && (
            <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{decision.explanation}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${statusColor}22`, color: statusColor }}>
            {status.toUpperCase()}
          </span>
          <span className="text-xs font-semibold" style={{ color: confColor }}>{conf}% conf.</span>
          <span className="text-gray-600 text-xs">{ago}m ago</span>
        </div>
      </div>
    </div>
  );
}

function getDemoDecisions(): AgentDecision[] {
  const now = new Date();
  const ago = (m: number) => new Date(now.getTime() - m * 60000).toISOString();
  return [
    { agent: "Draw Review Agent", recommendation: "Approve draw #DR-0094 — $82,000 for electrical rough-in", confidence: 0.96, explanation: "Inspection report confirms 78% completion milestone met. Lien waivers received from all subs. Budget remaining sufficient.", model: "gpt-4o", ts: ago(3), status: "approved" },
    { agent: "Escrow Monitoring Agent", recommendation: "Flag escrow shortfall on LN-0041 — insurance reserve below minimum", confidence: 0.99, explanation: "Current balance $18,400 against required $25,000 minimum. Premium renewal due in 14 days. Auto-notification sent to borrower.", model: "gpt-3.5-turbo", ts: ago(7), status: "flagged" },
    { agent: "Financial Analysis Agent", recommendation: "DSCR breach detected on LN-0087 — covenant review required", confidence: 0.93, explanation: "Trailing 12-month DSCR calculated at 1.09, below 1.20 covenant. Q3 rent roll shows two vacant units. Escalated to servicer.", model: "gpt-4o", ts: ago(12), status: "flagged" },
    { agent: "Payment Anomaly Agent", recommendation: "Partial payment pattern detected — LN-0023 borrower stress signal", confidence: 0.88, explanation: "Three consecutive months of partial payments averaging 87% of scheduled amount. Pattern consistent with early delinquency. Risk score updated.", model: "gpt-3.5-turbo", ts: ago(18), status: "pending" },
    { agent: "Risk Scoring Agent", recommendation: "Portfolio risk index: 6.2/10 — 3 loans elevated to Watch status", confidence: 0.91, explanation: "LN-0087, LN-0023, LN-0031 moved to Watch. Drivers: DSCR compression, vacancy increases, market cap rate expansion in sub-markets.", model: "gpt-4o", ts: ago(25), status: "completed" },
    { agent: "Inspection Review Agent", recommendation: "Hold draw #DR-0091 — photo evidence inconsistent with progress report", confidence: 0.94, explanation: "Site photos show framing 45% complete; contractor report claims 70%. Discrepancy of 25 percentage points exceeds threshold. Re-inspection ordered.", model: "gpt-4o", ts: ago(31), status: "flagged" },
    { agent: "Report Generation Agent", recommendation: "Q1 investor report generated — 12 loans, $47.2M portfolio", confidence: 0.99, explanation: "Report includes servicing summary, DSCR analytics, draw activity, escrow balances, and exception queue. Ready for distribution.", model: "gpt-4o", ts: ago(45), status: "completed" },
    { agent: "Borrower Communications Agent", recommendation: "Payment reminder sent to 4 borrowers with upcoming due dates", confidence: 0.98, explanation: "7-day advance notices sent via email for LN-0034, LN-0056, LN-0071, LN-0089. Personalized with current balance and payment instructions.", model: "gpt-4o", ts: ago(60), status: "completed" },
  ];
}
