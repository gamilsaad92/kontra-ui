import { useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const STATUS_STYLES = {
  PASS:             { bg: "bg-green-900/30",  text: "text-green-400",  border: "border-green-700/40",  label: "Pass"              },
  WATCH:            { bg: "bg-amber-900/30",  text: "text-amber-400",  border: "border-amber-700/40",  label: "Watch"             },
  BREACH:           { bg: "bg-red-900/30",    text: "text-red-400",    border: "border-red-700/40",    label: "Breach"            },
  TECHNICAL_BREACH: { bg: "bg-orange-900/30", text: "text-orange-400", border: "border-orange-700/40", label: "Technical Breach"  },
};

const OVERALL_STYLES = {
  CLEAR:           { bg: "bg-green-900/20",  text: "text-green-400",  label: "All Clear",        icon: "✓" },
  MONITORING:      { bg: "bg-amber-900/20",  text: "text-amber-400",  label: "Monitoring",       icon: "◎" },
  ACTION_REQUIRED: { bg: "bg-red-900/20",    text: "text-red-400",    label: "Action Required",  icon: "!" },
};

const AGENT_STEPS = [
  { id: 1, label: "Data Parser Agent",       desc: "Reading loan terms and extracting covenant definitions" },
  { id: 2, label: "Compliance Checker Agent",desc: "Comparing current metrics against each threshold" },
  { id: 3, label: "Risk Assessor Agent",     desc: "Classifying breach severity and risk level" },
  { id: 4, label: "Report Writer Agent",     desc: "Drafting servicer memo and recommendations" },
];

export default function CovenantAgentPage() {
  const [stage, setStage]   = useState("idle"); // idle | running | done | error
  const [step, setStep]     = useState(0);
  const [result, setResult] = useState(null);
  const [err, setErr]       = useState("");

  async function runAgent() {
    setStage("running");
    setStep(0);
    setResult(null);
    setErr("");

    const stepInterval = setInterval(() => {
      setStep(s => {
        if (s >= 3) { clearInterval(stepInterval); return 3; }
        return s + 1;
      });
    }, 1600);

    try {
      const res = await fetch(`${API_BASE}/api/covenant-agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      clearInterval(stepInterval);
      setStep(4);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      setStage("done");
    } catch (e) {
      clearInterval(stepInterval);
      setErr(e.message || "Agent failed. Check that the API is running with a valid OPENAI_API_KEY.");
      setStage("error");
    }
  }

  const overall = result ? (OVERALL_STYLES[result.status] || OVERALL_STYLES.CLEAR) : null;

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Covenant Monitor Agent</h1>
            <p className="text-sm text-slate-400 mt-1">
              Four AI agents work in sequence to autonomously review every covenant — no manual review needed.
            </p>
          </div>
          {stage !== "running" && (
            <button
              onClick={runAgent}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold
                         transition hover:opacity-90"
              style={{ background: "#800020" }}
            >
              <span>▶</span>
              {stage === "done" ? "Re-run Agent" : "Run Agent"}
            </button>
          )}
        </div>

        {/* Agent pipeline visualization */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-4">Agent Pipeline</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {AGENT_STEPS.map((a, i) => {
              const isDone    = stage === "done" || step > i;
              const isActive  = stage === "running" && step === i;
              const isPending = stage === "idle" || (stage === "running" && step < i);
              return (
                <div key={a.id}
                     className={`rounded-xl border p-4 transition-all duration-500 ${
                       isDone   ? "bg-green-900/20 border-green-700/40" :
                       isActive ? "bg-slate-800 border-slate-500 shadow-lg shadow-slate-900" :
                                  "bg-slate-800/50 border-slate-700/50"
                     }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isDone   ? "bg-green-500/20 text-green-400" :
                      isActive ? "bg-white/10 text-white" :
                                 "bg-slate-700 text-slate-500"
                    }`}>
                      {isDone ? "✓" : isActive ? (
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                                  strokeDasharray="40" strokeDashoffset="10"/>
                        </svg>
                      ) : a.id}
                    </div>
                    <span className={`text-xs font-medium ${isDone ? "text-green-400" : isActive ? "text-white" : "text-slate-500"}`}>
                      Agent {a.id}
                    </span>
                  </div>
                  <p className={`text-xs leading-snug ${isDone ? "text-slate-300" : isActive ? "text-slate-200" : "text-slate-600"}`}>
                    {a.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {stage === "error" && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-red-300 text-sm">
            {err}
          </div>
        )}

        {/* Results */}
        {stage === "done" && result && (
          <div className="space-y-4">
            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`rounded-xl border p-4 ${overall.bg} border-slate-700/40`}>
                <p className="text-xs text-slate-400 mb-1">Overall Status</p>
                <p className={`text-lg font-bold ${overall.text}`}>{overall.icon} {overall.label}</p>
              </div>
              <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Passing</p>
                <p className="text-2xl font-bold text-green-400">{result.summary.pass}</p>
              </div>
              <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Watch</p>
                <p className="text-2xl font-bold text-amber-400">{result.summary.watch}</p>
              </div>
              <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Breaches</p>
                <p className="text-2xl font-bold text-red-400">{result.summary.breach}</p>
              </div>
            </div>

            {/* Loan info */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium text-sm">{result.property}</p>
                  <p className="text-slate-400 text-xs">{result.borrower}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium text-sm">${(result.balance / 1e6).toFixed(2)}M</p>
                  <p className="text-slate-400 text-xs">Loan balance</p>
                </div>
              </div>
            </div>

            {/* Covenant table */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-xs font-medium text-slate-300 uppercase tracking-wider">Covenant Results</p>
              </div>
              <div className="divide-y divide-slate-800">
                {result.covenants.map((c, i) => {
                  const s = STATUS_STYLES[c.status] || STATUS_STYLES.PASS;
                  return (
                    <div key={i} className="px-4 py-3 flex items-start justify-between gap-4 hover:bg-slate-800/40 transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">{c.name}</p>
                        {c.note && <p className="text-xs text-slate-400 mt-0.5 truncate">{c.note}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs capitalize text-slate-400`}>{c.severity || "—"}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}>
                          {s.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Servicer memo */}
            {result.memo && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">AI Servicer Memo</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-violet-900/30 text-violet-400 border border-violet-700/30">
                    Auto-generated
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{result.memo}</p>
                <p className="text-xs text-slate-600 mt-3">
                  Generated {new Date(result.runAt).toLocaleString()} · Kontra Covenant Agent v1
                </p>
              </div>
            )}
          </div>
        )}

        {/* Idle state */}
        {stage === "idle" && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl">🤖</div>
            <div>
              <p className="text-white font-medium text-sm">Ready to run</p>
              <p className="text-slate-400 text-xs mt-1 max-w-sm">
                Click "Run Agent" to launch all 4 agents. They'll autonomously check every covenant
                and produce a servicer memo in under 30 seconds.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
