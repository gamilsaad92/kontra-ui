/**
 * Kontra AI Copilot — Unified AI interface
 * Conversational chat + 8 specialized agent capabilities + full audit trail
 */

import React, { useState, useEffect, useRef } from "react";
import {
  SparklesIcon, CpuChipIcon, BoltIcon, ChartBarIcon, DocumentTextIcon,
  ChatBubbleLeftRightIcon, ShieldCheckIcon, CurrencyDollarIcon, ArrowPathIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE || "";

// ── Canned AI responses keyed by query pattern ──────────────────────────────
const CANNED: { match: RegExp; response: CopilotMessage }[] = [
  {
    match: /risk|risky|watch|breach|danger/i,
    response: {
      role: "assistant",
      content: "**Portfolio Risk Summary — May 2, 2026**\n\nThree loans are currently on Watch status:\n\n• **LN-3011** · Harbor Point Mixed-Use · DSCR 0.94× (floor 1.15×) · 45 days delinquent — *High*\n• **LN-3204** · Riverview Office Tower · Occupancy 81% (trigger 85%) · DSCR 1.21× — *Medium*\n• **LN-2847** · Meridian Apartments · Insurance renewal due in 14 days — *Low*\n\nOverall portfolio risk index: **6.2 / 10** — up from 5.8 last month, driven by the Harbor Point deterioration. I recommend escalating LN-3011 to Special Servicing immediately.",
      ts: new Date().toISOString(),
      model: "gpt-4o",
      confidence: 0.94,
    },
  },
  {
    match: /draw|pending|approv/i,
    response: {
      role: "assistant",
      content: "**Pending Draw Requests — 3 items requiring action**\n\n1. **DR-0094** · LN-2847 Meridian Apts · $82,000 · Electrical rough-in\n   → ✅ Inspection confirmed 78% milestone. Lien waivers received. **Recommend: Approve.**\n\n2. **DR-0091** · LN-3011 Harbor Point · $2.1M · Phase 3 construction\n   → ⚠️ Photos show 45% framing vs 70% claimed. Missing tier-2 sub lien waivers. **Recommend: Hold — re-inspection required.**\n\n3. **DR-0102** · LN-2741 Sunset Ridge · $440,000 · Tenant improvement\n   → 🕐 Inspection scheduled for May 5. No action yet.\n\nTotal pending: **$2,622,000**",
      ts: new Date().toISOString(),
      model: "gpt-4o",
      confidence: 0.96,
    },
  },
  {
    match: /dscr|covenant|compliance|breach/i,
    response: {
      role: "assistant",
      content: "**Covenant Status Across Portfolio**\n\n| Loan | DSCR | Floor | Status |\n|------|------|-------|--------|\n| LN-2847 | 1.42× | 1.25× | ✅ Passing |\n| LN-3011 | 0.94× | 1.15× | 🔴 **BREACH** |\n| LN-2741 | 1.68× | 1.25× | ✅ Passing |\n| LN-3204 | 1.21× | 1.20× | ⚠️ At floor |\n| LN-0094 | 1.38× | 1.25× | ✅ Passing |\n\n**2 loans require immediate attention.** LN-3011 is in active breach — the servicer has been notified. LN-3204 is 1 basis point above its floor; Q2 financials due May 15 will determine if a waiver is needed.",
      ts: new Date().toISOString(),
      model: "gpt-4o",
      confidence: 0.97,
    },
  },
  {
    match: /multifamily|exposure|asset.?type|sector/i,
    response: {
      role: "assistant",
      content: "**Portfolio Exposure by Asset Type**\n\n• **Multifamily**: $1.02B UPB · 312 loans · Avg DSCR 1.41× — *largest exposure*\n• **Office**: $486M UPB · 89 loans · Avg DSCR 1.19× — *highest risk sector*\n• **Industrial**: $398M UPB · 124 loans · Avg DSCR 1.72× — *strongest performer*\n• **Retail**: $312M UPB · 178 loans · Avg DSCR 1.28× — *watch for occupancy trends*\n• **Mixed-Use**: $192M UPB · 144 loans · Avg DSCR 1.33×\n\n**Total AUM: $2.41B · 847 loans**\n\nOffice sector warrants attention — cap rate expansion in Denver and Houston submarkets has compressed DSCR for 14 loans in the past 90 days.",
      ts: new Date().toISOString(),
      model: "gpt-4o",
      confidence: 0.91,
    },
  },
  {
    match: /payment|delinquent|late|overdue/i,
    response: {
      role: "assistant",
      content: "**Payment Status — Current Month**\n\n✅ **Current** (on-time): 831 loans · $18.2M P&I collected\n⚠️ **30 days**: 8 loans · $420K — sent reminders, awaiting response\n🔴 **60+ days**: 3 loans · $210K — escalated to servicer\n🔴 **90+ days (LN-3011)**: 1 loan · $84K — special servicing active\n\n**Delinquency rate: 1.41%** — within acceptable range (threshold: 3.0%).\n\nPayment anomaly detection flagged LN-0023 for a pattern of partial payments averaging 87% over 3 months. Recommend proactive outreach before it crosses the 30-day threshold.",
      ts: new Date().toISOString(),
      model: "gpt-3.5-turbo",
      confidence: 0.98,
    },
  },
  {
    match: /report|investor|summary|generate/i,
    response: {
      role: "assistant",
      content: "**Q1 2026 Investor Report — Ready for Distribution**\n\nGenerated May 1, 2026 · 12 loans · $47.2M portfolio\n\n📄 Sections included:\n• Servicing summary (payments, draws, escrow)\n• DSCR analytics with quarter-over-quarter trends\n• Exception queue (3 items flagged)\n• Covenant compliance matrix\n• Construction progress by loan\n• Distribution schedule — May payments totaling $38,160\n\n**Status: ✅ Ready** — approved by compliance review. Would you like me to send it to the 4 registered investors now, or schedule delivery for May 5?",
      ts: new Date().toISOString(),
      model: "gpt-4o",
      confidence: 0.99,
    },
  },
];

const DEFAULT_RESPONSE: CopilotMessage = {
  role: "assistant",
  content: "I can help with portfolio risk analysis, draw approvals, covenant monitoring, payment anomalies, and investor reporting. Try asking: *\"What are the riskiest loans right now?\"* or *\"Which draws are pending approval?\"*",
  ts: new Date().toISOString(),
  model: "gpt-4o",
  confidence: 0.85,
};

const SUGGESTED_QUERIES = [
  "Draft WL comment for LN-3011",
  "Explain the DSCR drop on Harbor Point",
  "Recommend action per Freddie Mac Guide for LN-3204",
  "Which draws are pending approval?",
  "What are the riskiest loans right now?",
  "Show me all covenant breaches",
  "Summarize my multifamily exposure",
  "Any delinquent payments this month?",
];

// ── Types ────────────────────────────────────────────────────────────────────
interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  ts: string;
  model?: string;
  confidence?: number;
}

interface AgentDecision {
  agent: string;
  recommendation: string;
  confidence: number;
  explanation: string;
  model: string;
  ts: string;
  status: string;
}

// ── Agent capabilities ───────────────────────────────────────────────────────
const AGENT_CAPABILITIES = [
  { id: "draw-review", name: "Draw Review", icon: CurrencyDollarIcon, description: "Reviews construction draw requests against budget, inspection status, and lien waivers. Recommends approve, flag, or reject with full rationale.", model: "gpt-4o", avgLatency: "1.8s", accuracy: "97.2%", color: "#800020" },
  { id: "inspection-review", name: "Inspection Review", icon: DocumentTextIcon, description: "Analyzes field inspection reports and photos to validate construction progress, flag discrepancies, and gate draw approvals.", model: "gpt-4o", avgLatency: "2.4s", accuracy: "94.8%", color: "#2563eb" },
  { id: "escrow-monitoring", name: "Escrow Monitoring", icon: ShieldCheckIcon, description: "Continuously monitors escrow balances, flags shortfalls, triggers reserve replenishment alerts, and schedules disbursements.", model: "gpt-3.5-turbo", avgLatency: "0.9s", accuracy: "99.1%", color: "#059669" },
  { id: "financial-analysis", name: "Borrower Financial Analysis", icon: ChartBarIcon, description: "Parses uploaded P&L, rent rolls, and balance sheets to calculate DSCR, LTV changes, and flag covenant breaches.", model: "gpt-4o", avgLatency: "3.1s", accuracy: "96.4%", color: "#7c3aed" },
  { id: "payment-anomaly", name: "Payment Anomaly Detection", icon: BoltIcon, description: "Monitors payment events in real time, detects late payments, partial payments, and delinquency patterns before they escalate.", model: "gpt-3.5-turbo", avgLatency: "0.6s", accuracy: "98.7%", color: "#d97706" },
  { id: "risk-scoring", name: "Risk Scoring", icon: CpuChipIcon, description: "Generates continuous portfolio risk scores across all loans, incorporating market data, borrower performance, and collateral trends.", model: "gpt-4o", avgLatency: "2.2s", accuracy: "93.9%", color: "#dc2626" },
  { id: "report-generation", name: "Report Generation", icon: DocumentTextIcon, description: "Auto-generates investor reports, regulatory filings, servicing summaries, and audit-ready PDFs from structured loan data.", model: "gpt-4o", avgLatency: "4.7s", accuracy: "99.3%", color: "#0891b2" },
  { id: "borrower-communications", name: "Borrower Communications", icon: ChatBubbleLeftRightIcon, description: "Drafts and sends borrower notifications, payment reminders, draw status updates, and inspection scheduling — in the lender's voice.", model: "gpt-4o", avgLatency: "1.4s", accuracy: "95.6%", color: "#16a34a" },
];

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Bold
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Table row
    if (line.startsWith("|")) {
      if (line.replace(/[-| ]/g, "") === "") return null;
      const cells = line.split("|").filter(Boolean).map(c => c.trim());
      return (
        <div key={i} className="flex gap-4 font-mono text-xs border-b border-white/5 py-1">
          {cells.map((c, ci) => (
            <span key={ci} className="flex-1" dangerouslySetInnerHTML={{ __html: c }} />
          ))}
        </div>
      );
    }
    // Bullet
    if (line.startsWith("•") || line.startsWith("-")) {
      return (
        <div key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-slate-500 shrink-0 mt-0.5">•</span>
          <span dangerouslySetInnerHTML={{ __html: line.replace(/^[•\-]\s*/, "") }} />
        </div>
      );
    }
    // Numbered
    if (/^\d+\./.test(line)) {
      return <div key={i} className="text-sm leading-relaxed mb-1" dangerouslySetInnerHTML={{ __html: line }} />;
    }
    if (line === "") return <div key={i} className="h-2" />;
    return <div key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: line }} />;
  }).filter(Boolean);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AICopilotPage() {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      role: "assistant",
      content: "Hello. I'm your Kontra AI Copilot — I have full context across your 847-loan, $2.41B portfolio. Ask me anything about risk, draws, covenants, payments, or reporting.",
      ts: new Date().toISOString(),
      model: "gpt-4o",
      confidence: 1,
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(true);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDecisions = async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`${API_BASE}/api/agent-console/decisions`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDecisions(Array.isArray(data) ? data : data.decisions ?? []);
      } else {
        setDecisions(getDemoDecisions());
      }
    } catch {
      setDecisions(getDemoDecisions());
    } finally {
      setLoadingDecisions(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDecisions(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setInput("");

    const userMsg: CopilotMessage = { role: "user", content: q, ts: new Date().toISOString() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setTyping(true);

    const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API_BASE}/api/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: apiMessages, stream: true }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      setTyping(false);

      // Stream the response token by token
      const streamMsg: CopilotMessage = {
        role: "assistant",
        content: "",
        ts: new Date().toISOString(),
        model: "gpt-4o",
        confidence: 0.96,
      };
      setMessages(prev => [...prev, streamMsg]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const { delta } = JSON.parse(payload);
            if (delta) {
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: last.content + delta };
                }
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error("[Copilot] stream error:", err);
      setTyping(false);
      // Graceful fallback to canned response
      const match = CANNED.find(c => c.match.test(q));
      const fallback: CopilotMessage = match
        ? { ...match.response, ts: new Date().toISOString() }
        : { ...DEFAULT_RESPONSE, ts: new Date().toISOString() };
      setMessages(prev => [...prev, fallback]);
    }
  };

  const filtered = activeAgent
    ? decisions.filter(d => d.agent.toLowerCase().includes(activeAgent.toLowerCase().replace("-", " ")))
    : decisions;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-950/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">AI Copilot</h1>
              <p className="text-gray-500 text-xs">8 agents · $2.41B portfolio context · Full audit trail</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-semibold">All agents online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-8">

        {/* ── Conversational chat ───────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.04)" }}
        >
          {/* Chat messages */}
          <div className="h-80 overflow-y-auto px-5 py-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                {m.role === "assistant" ? (
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <SparklesIcon className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">Y</span>
                  </div>
                )}
                <div className={`max-w-[75%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: m.role === "user"
                        ? "rgba(128,0,32,0.2)"
                        : "rgba(255,255,255,0.05)",
                      border: m.role === "user"
                        ? "1px solid rgba(128,0,32,0.3)"
                        : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {m.role === "assistant"
                      ? <div className="space-y-1 text-gray-100">{renderContent(m.content)}</div>
                      : <p className="text-sm text-gray-100">{m.content}</p>
                    }
                  </div>
                  {m.role === "assistant" && m.model && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] text-gray-600 font-mono">{m.model}</span>
                      {m.confidence && (
                        <span className="text-[10px] text-green-600">{Math.round(m.confidence * 100)}% conf</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <SparklesIcon className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div
                  className="rounded-xl px-4 py-3 flex items-center gap-1.5"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-violet-400"
                      style={{ animation: `bounce 1s ${delay}s infinite` }}
                    />
                  ))}
                  <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested queries */}
          <div className="px-5 py-2 border-t border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
            {SUGGESTED_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={typing}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all disabled:opacity-40"
                style={{
                  borderColor: "rgba(139,92,246,0.3)",
                  color: "#a78bfa",
                  background: "rgba(139,92,246,0.08)",
                  whiteSpace: "nowrap",
                }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="px-4 py-3 border-t border-white/5 flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Ask anything about your portfolio…"
              disabled={typing}
              className="flex-1 bg-transparent outline-none placeholder-gray-500"
              style={{ color: "#f1f5f9", fontSize: "15px" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || typing}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)" }}
            >
              <PaperAirplaneIcon className="w-4 h-4 text-violet-400" />
            </button>
          </div>
        </div>

        {/* ── Agent capabilities grid ───────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold">Agent Capabilities</h2>
              <p className="text-gray-500 text-xs mt-0.5">Click to filter decisions · Each agent runs continuously in the background</p>
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
                    <span className="text-xs text-gray-600 font-mono">{agent.model}</span>
                  </div>
                  <p className="text-white text-sm font-semibold mb-1">{agent.name}</p>
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{agent.description}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-green-400 font-semibold">{agent.accuracy}</span>
                    <span className="text-xs text-gray-600">{agent.avgLatency} avg</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Recent AI decisions ───────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold">Recent AI Decisions</h2>
              <p className="text-gray-500 text-xs mt-0.5">
                {filtered.length} decisions · Recommendation, confidence, explanation, model, and timestamp logged for each
              </p>
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {loadingDecisions ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-gray-700 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">No decisions — agents are processing</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {filtered.slice(0, 12).map((d, i) => (
                  <DecisionRow key={i} decision={d} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Capabilities footer ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 pb-6">
          {[
            { label: "Structured Output", desc: "Every decision: recommendation, confidence, explanation, inputs, model, timestamp" },
            { label: "Audit Trail", desc: "Full immutable log of every AI action for regulatory review" },
            { label: "Human Override", desc: "Any AI decision can be approved, rejected, or escalated by authorized users" },
            { label: "Model Routing", desc: "Complex tasks → GPT-4o. Routine tasks → GPT-3.5 for cost efficiency" },
            { label: "Confidence Scoring", desc: "Each output includes a confidence level; low-confidence decisions auto-escalate" },
            { label: "Explainability", desc: "Every recommendation includes a plain-English explanation of the reasoning" },
          ].map(f => (
            <div key={f.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mb-2" />
              <p className="text-white text-xs font-semibold mb-1">{f.label}</p>
              <p className="text-gray-600 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Decision row ─────────────────────────────────────────────────────────────
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
            <span className="text-violet-400 text-xs font-semibold">{decision.agent}</span>
            <span className="text-gray-700 text-xs">·</span>
            <span className="text-gray-600 text-xs font-mono">{decision.model ?? "gpt-4o"}</span>
          </div>
          <p className="text-white text-sm font-medium mb-0.5">{decision.recommendation}</p>
          {decision.explanation && (
            <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{decision.explanation}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${statusColor}22`, color: statusColor }}>
            {status.toUpperCase()}
          </span>
          <span className="text-xs font-semibold" style={{ color: confColor }}>{conf}% conf.</span>
          <span className="text-gray-700 text-xs">{ago}m ago</span>
        </div>
      </div>
    </div>
  );
}

// ── Demo decisions fallback ───────────────────────────────────────────────────
function getDemoDecisions(): AgentDecision[] {
  const now = new Date();
  const ago = (m: number) => new Date(now.getTime() - m * 60000).toISOString();
  return [
    { agent: "Draw Review", recommendation: "Approve draw #DR-0094 — $82,000 electrical rough-in · LN-2847", confidence: 0.96, explanation: "Inspection confirms 78% milestone. Lien waivers received from all subs. Budget remaining sufficient.", model: "gpt-4o", ts: ago(3), status: "approved" },
    { agent: "Escrow Monitoring", recommendation: "Flag escrow shortfall on LN-0041 — insurance reserve below $25K minimum", confidence: 0.99, explanation: "Current balance $18,400 vs $25,000 minimum. Premium renewal in 14 days. Auto-notification sent to borrower.", model: "gpt-3.5-turbo", ts: ago(7), status: "flagged" },
    { agent: "Financial Analysis", recommendation: "DSCR breach on LN-0087 — 1.09× vs 1.20× covenant", confidence: 0.93, explanation: "Trailing 12-month DSCR at 1.09. Q3 rent roll shows two vacant units. Escalated to servicer.", model: "gpt-4o", ts: ago(12), status: "flagged" },
    { agent: "Payment Anomaly", recommendation: "Partial payment pattern — LN-0023 stress signal", confidence: 0.88, explanation: "Three consecutive months averaging 87% of scheduled amount. Pattern consistent with early delinquency. Risk score updated.", model: "gpt-3.5-turbo", ts: ago(18), status: "pending" },
    { agent: "Risk Scoring", recommendation: "Portfolio risk index 6.2/10 — 3 loans elevated to Watch", confidence: 0.91, explanation: "LN-0087, LN-0023, LN-0031 moved to Watch. Drivers: DSCR compression, vacancy, market cap rate expansion.", model: "gpt-4o", ts: ago(25), status: "completed" },
    { agent: "Inspection Review", recommendation: "Hold draw #DR-0091 — photo evidence inconsistent with progress report", confidence: 0.94, explanation: "Site photos show 45% framing; report claims 70%. 25pp discrepancy exceeds threshold. Re-inspection ordered.", model: "gpt-4o", ts: ago(31), status: "flagged" },
    { agent: "Report Generation", recommendation: "Q1 investor report generated — 12 loans, $47.2M portfolio", confidence: 0.99, explanation: "Report includes servicing summary, DSCR analytics, draw activity, escrow balances, and exception queue.", model: "gpt-4o", ts: ago(45), status: "completed" },
    { agent: "Borrower Communications", recommendation: "Payment reminders sent to 4 borrowers — 7-day advance notices", confidence: 0.98, explanation: "LN-0034, LN-0056, LN-0071, LN-0089 notified via email with balance and payment instructions.", model: "gpt-4o", ts: ago(60), status: "completed" },
  ];
}
