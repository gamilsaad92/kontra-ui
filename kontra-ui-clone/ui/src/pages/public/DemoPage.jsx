import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PublicLayout from "./PublicLayout";
import { DEMO_PACKS } from "../../lib/demoPacks";

// ── Generating steps ──────────────────────────────────────────────────────────
const GEN_STEPS = [
  { label: "Identifying transaction type",  detail: "Matching Workflow Pack to deal structure" },
  { label: "Configuring workflow stages",   detail: "Building lifecycle from term sheet to close" },
  { label: "Assigning participant roles",   detail: "Role permissions and visibility rules applied" },
  { label: "Building document checklist",  detail: "Required and optional items from pack definition" },
  { label: "Calibrating AI intelligence",  detail: "Benchmarks, risk thresholds, and scoring model loaded" },
];

const STATUS_META = {
  complete:    { label: "Complete",    cls: "bg-green-50 text-green-700 border border-green-100" },
  in_progress: { label: "In Progress", cls: "bg-amber-50 text-amber-700 border border-amber-100" },
  pending:     { label: "Pending",     cls: "bg-gray-50 text-gray-400 border border-gray-200" },
};

const RISK_META = {
  high:   { cls: "bg-red-50 text-red-700 border border-red-100" },
  medium: { cls: "bg-amber-50 text-amber-700 border border-amber-100" },
  low:    { cls: "bg-green-50 text-green-700 border border-green-100" },
};

const TABS = ["Overview", "Documents", "Participants", "Intelligence", "Closing"];

// ── Stage progress bar ────────────────────────────────────────────────────────
function StageBar({ stages, current }) {
  return (
    <div className="flex items-start w-full">
      {stages.map((s, i) => (
        <div key={s} className="flex flex-1 items-center">
          <div className="flex flex-col items-center flex-1">
            <div className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${
              i <= current
                ? "border-[#800020] bg-[#800020]"
                : "border-gray-300 bg-transparent"
            }`} />
            <span className={`text-[9px] mt-1 text-center leading-tight ${
              i === current ? "text-[#800020] font-semibold" : "text-gray-400"
            }`}>{s}</span>
          </div>
          {i < stages.length - 1 && (
            <div className={`h-px flex-1 mb-3.5 ${i < current ? "bg-[#800020]" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, grade }) {
  const r = 36, circ = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
        <motion.circle cx="48" cy="48" r={r} fill="none" stroke="#800020" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (score / 100) * circ }}
          transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-black text-gray-900" style={{ fontFamily: "monospace" }}>{score}</div>
        <div className="text-[10px] text-gray-400 font-semibold">{grade}</div>
      </div>
    </div>
  );
}

// ── Generating screen ─────────────────────────────────────────────────────────
function GeneratingScreen({ pack, onDone }) {
  const [completed, setCompleted] = useState([]);
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(false);
  const STEP_MS = 580;

  useEffect(() => {
    const timers = [];
    GEN_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setActive(i), i * STEP_MS));
      timers.push(setTimeout(() => setCompleted(p => [...p, i]), i * STEP_MS + 440));
    });
    timers.push(setTimeout(() => setDone(true), GEN_STEPS.length * STEP_MS + 180));
    timers.push(setTimeout(onDone, GEN_STEPS.length * STEP_MS + 860));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <PublicLayout>
      <div className="max-w-xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-[#800020] text-xs font-bold px-3 py-1 rounded-full mb-4">
            {pack.badge} Workflow Pack
          </span>
          <h2 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
            {pack.name}
          </h2>
          <p className="text-sm text-gray-500">
            Creating workspace for <strong className="text-gray-800">"{pack.sampleDealName}"</strong>
          </p>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3 mb-8">
          {GEN_STEPS.map((step, i) => {
            const isComplete = completed.includes(i);
            const isActive = active === i && !isComplete;
            return (
              <motion.div key={step.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: active >= i ? 1 : 0.35, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                  isComplete
                    ? "bg-red-50 border-red-100"
                    : isActive
                    ? "bg-white border-gray-200 shadow-sm"
                    : "bg-white border-gray-100"
                }`}>
                <div className="shrink-0 mt-0.5">
                  {isComplete ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="w-5 h-5 rounded-full bg-[#800020] flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.div>
                  ) : isActive ? (
                    <svg className="w-5 h-5 animate-spin text-[#800020]" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${(isComplete || isActive) ? "text-gray-900" : "text-gray-400"}`}>{step.label}</p>
                  {(isActive || isComplete) && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-gray-400 mt-0.5">{step.detail}</motion.p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <motion.div className="h-full rounded-full bg-[#800020]"
            initial={{ width: "0%" }}
            animate={{ width: done ? "100%" : `${(completed.length / GEN_STEPS.length) * 100}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
        {done && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="text-center text-xs font-semibold text-[#800020] mt-4">
            Workspace ready — launching…
          </motion.p>
        )}
      </div>
    </PublicLayout>
  );
}

// ── Workspace screen ──────────────────────────────────────────────────────────
function WorkspaceScreen({ pack, onBack }) {
  const [tab, setTab] = useState("Overview");
  const [uploaded, setUploaded] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    setUploaded(file);
    setAnalyzing(true);
    setTimeout(() => { setAnalyzing(false); setAnalyzed(true); setTab("Intelligence"); }, 2800);
  };

  const complete = pack.checklist.filter(i => i.status === "complete").length;
  const total = pack.checklist.length;
  const pct = Math.round((complete / total) * 100);

  // ── Overview ───────────────────────────────────────────────────────────────
  function Overview() {
    return (
      <div className="flex flex-col gap-6">
        {/* Stage progress */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Deal Name</p>
              <p className="text-base font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>{pack.sampleDealName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{pack.tagline}</p>
            </div>
            <span className="text-[10px] font-bold bg-red-50 text-[#800020] border border-red-100 px-2 py-0.5 rounded-full shrink-0">{pack.badge}</span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Lifecycle Progress</p>
          <StageBar stages={pack.stages} current={pack.currentStage} />
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: `${pct}%`, sub: "Checklist", detail: `${complete} of ${total} items` },
            { val: `${pack.roles.filter(r => r.invited).length}/${pack.roles.length}`, sub: "Participants", detail: "Roles invited" },
            { val: pack.insights.score, sub: "Deal Score", detail: pack.insights.grade },
          ].map(({ val, sub, detail }) => (
            <div key={sub} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-black text-gray-900" style={{ fontFamily: "monospace" }}>{val}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mt-0.5">{sub}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{detail}</p>
            </div>
          ))}
        </div>

        {/* Activity */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Recent Activity</p>
          {pack.audit.slice(0, 4).map((e, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#800020] opacity-60 mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800">{e.action}</p>
                <p className="text-[10px] text-gray-400">by {e.actor}</p>
              </div>
              <span className="text-[10px] text-gray-300 shrink-0">{e.time}</span>
            </div>
          ))}
          <button onClick={() => setTab("Closing")} className="text-xs text-gray-400 hover:text-gray-600 mt-3 block">
            View full audit trail →
          </button>
        </div>
      </div>
    );
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  function Documents() {
    return (
      <div className="flex flex-col gap-6">
        {/* Checklist */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Document Checklist</p>
            <span className="text-[10px] font-bold bg-red-50 text-[#800020] border border-red-100 px-2 py-0.5 rounded-full">{pack.badge} PACK</span>
          </div>
          {pack.checklist.map(item => {
            const m = STATUS_META[item.status];
            return (
              <div key={item.id} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  item.status === "complete"
                    ? "bg-[#800020] border-[#800020]"
                    : item.status === "in_progress"
                    ? "border-amber-400 bg-transparent"
                    : "border-gray-200 bg-transparent"
                }`}>
                  {item.status === "complete" && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.label}</p>
                  <p className="text-[10px] text-gray-400">{item.role}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.required && (
                    <span className="text-[9px] text-gray-300 border border-gray-200 rounded px-1 py-0.5">REQ</span>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Upload */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Upload Document</p>
          <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

          {analyzing ? (
            <div className="border-2 border-dashed border-red-100 rounded-xl p-8 text-center bg-red-50">
              <svg className="w-8 h-8 animate-spin text-[#800020] mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.2"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none"/>
              </svg>
              <p className="text-sm font-semibold text-gray-700">Analyzing <span className="text-[#800020]">{uploaded?.name}</span>…</p>
              <p className="text-xs text-gray-400 mt-1">Extracting data points and risk signals</p>
            </div>
          ) : analyzed ? (
            <div className="border border-green-100 bg-green-50 rounded-xl p-6 text-center">
              <div className="text-2xl mb-2">✓</div>
              <p className="text-sm font-semibold text-gray-800 mb-3">{uploaded?.name} analyzed</p>
              <button onClick={() => setTab("Intelligence")}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition"
                style={{ background: "#800020" }}>
                View AI Analysis →
              </button>
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-red-200 hover:bg-red-50/30 transition-colors">
              <div className="text-3xl mb-2">📎</div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Drag & drop or click to upload</p>
              <p className="text-xs text-gray-400 mb-4">PDF, Excel, or CSV — AI extracts and scores instantly</p>
              <button className="px-5 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90" style={{ background: "#800020" }}>
                Choose File →
              </button>
              <p className="text-[10px] text-gray-300 mt-3">
                File is stored securely and analyzed by AI. Retained per our{" "}
                <a href="/privacy" className="underline hover:text-gray-500">Privacy Policy</a>.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Participants ───────────────────────────────────────────────────────────
  function Participants() {
    return (
      <div className="flex flex-col gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Participant Roles</p>
          {pack.roles.map(role => (
            <div key={role.name} className="flex items-center gap-3 py-3 border-t border-gray-100 first:border-t-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-white"
                style={{ background: role.color }}>
                {role.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{role.name}</p>
                <p className="text-xs text-gray-400">{role.description}</p>
              </div>
              {role.invited ? (
                <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full shrink-0">✓ Invited</span>
              ) : (
                <button className="text-[10px] font-semibold text-gray-500 border border-gray-200 px-3 py-1 rounded-xl hover:bg-gray-50 shrink-0">
                  Invite
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Access Control</p>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl shrink-0">🔒</div>
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">OTP-Gated Access</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Every participant receives a unique invite link. Before accessing any deal room content,
                they verify via one-time passcode sent to their email. Kontra logs every verification
                event to the audit trail.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Intelligence ───────────────────────────────────────────────────────────
  function Intelligence() {
    if (!analyzed && !uploaded) {
      return (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div className="text-3xl mb-3">🧠</div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No document analyzed yet</p>
          <p className="text-xs text-gray-400 mb-4">Upload a document in the Documents tab to see AI analysis</p>
          <button onClick={() => setTab("Documents")}
            className="px-5 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50">
            Go to Documents
          </button>
        </div>
      );
    }

    const { insights } = pack;
    return (
      <div className="flex flex-col gap-6">
        {/* Score + summary */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">AI Deal Assessment</p>
          <div className="flex items-start gap-5">
            <ScoreRing score={insights.score} grade={insights.grade} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-bold text-gray-900">Deal Score</p>
                <span className="text-[10px] font-bold bg-red-50 text-[#800020] border border-red-100 px-2 py-0.5 rounded-full">{pack.badge}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{insights.summary}</p>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Key Metrics</p>
          <div className="grid grid-cols-2 gap-3">
            {insights.metrics.map(m => (
              <div key={m.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{m.label}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-base font-bold text-gray-800">{m.value}</p>
                  <span className={`text-sm ${m.good ? "text-green-600" : "text-red-500"}`}>
                    {m.trend === "up" ? "↑" : "↓"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk signals */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Risk Signals</p>
          {insights.risks.map((r, i) => (
            <div key={i} className="flex items-start gap-3 py-3 border-t border-gray-100 first:border-t-0">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${RISK_META[r.level].cls}`}>
                {r.level}
              </span>
              <div>
                <p className="text-xs font-semibold text-gray-800 mb-0.5">{r.title}</p>
                <p className="text-xs text-gray-400">{r.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Closing ────────────────────────────────────────────────────────────────
  function Closing() {
    const verified = pack.checklist.filter(i => i.status === "complete");
    const pending = pack.checklist.filter(i => i.status !== "complete");
    return (
      <div className="flex flex-col gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Verified Package</p>
            <button className="text-[10px] font-bold border border-gray-200 text-gray-500 px-3 py-1 rounded-xl hover:bg-gray-50">
              🔒 Share with Counterparty
            </button>
          </div>
          {verified.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
              <span className="text-sm text-green-600">✓</span>
              <span className="text-xs font-medium text-gray-800 flex-1">{item.label}</span>
              <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">Verified</span>
            </div>
          ))}
          {pending.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-3 pt-3 border-t border-gray-100">
              {pending.length} item{pending.length > 1 ? "s" : ""} still pending before close
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Audit Trail</p>
          {pack.audit.map((e, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#800020] opacity-50 mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800">{e.action}</p>
                <p className="text-[10px] text-gray-400">{e.actor} · {e.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const TAB_CONTENT = {
    Overview: <Overview />,
    Documents: <Documents />,
    Participants: <Participants />,
    Intelligence: <Intelligence />,
    Closing: <Closing />,
  };

  return (
    <PublicLayout>
      {/* Crimson deal header — identical to real deal rooms */}
      <div className="border-b px-6 py-3"
        style={{ background: "linear-gradient(90deg, #4a0010 0%, #800020 100%)", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
              style={{ background: "rgba(255,255,255,0.12)" }}>
              {pack.badge} · LIVE DEMO
            </span>
            <span className="text-sm font-semibold text-white truncate">{pack.sampleDealName}</span>
          </div>
          <button onClick={onBack}
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition hover:opacity-90 text-white/70 border border-white/20 hover:bg-white/10">
            ← Back
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="max-w-5xl mx-auto flex overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                tab === t
                  ? "border-[#800020] text-[#800020]"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
            {TAB_CONTENT[tab]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer CTA */}
      <div className="bg-gray-50 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 mt-8">
        <div>
          <p className="text-sm font-bold text-gray-900">Ready to run a real transaction?</p>
          <p className="text-xs text-gray-500">Create your workspace in 60 seconds — no setup required.</p>
        </div>
        <a href="/create-deal-room"
          className="shrink-0 px-6 py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
          style={{ background: "#800020" }}>
          Create Your Workspace — $499 →
        </a>
      </div>
    </PublicLayout>
  );
}

// ── Root DemoPage ─────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const packId = params.get("pack") || "acquisition";
  const pack = DEMO_PACKS[packId] || DEMO_PACKS.acquisition;
  const [screen, setScreen] = useState("generating");

  return (
    <AnimatePresence mode="wait">
      {screen === "generating" ? (
        <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <GeneratingScreen pack={pack} onDone={() => setScreen("workspace")} />
        </motion.div>
      ) : (
        <motion.div key="ws" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <WorkspaceScreen pack={pack} onBack={() => navigate("/")} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
