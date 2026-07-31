import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { DEMO_PACKS } from "../../lib/demoPacks";

// ── Icons (inline SVG to avoid extra deps) ───────────────────────────────────
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SpinnerIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" style={{animation:"spin 1s linear infinite"}}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);
const ArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const RISK_COLORS = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" };
const STATUS_STYLES = {
  complete:    { label: "Complete",    bg: "rgba(16,185,129,0.1)",  color: "#10b981", border: "rgba(16,185,129,0.25)" },
  in_progress: { label: "In Progress", bg: "rgba(245,158,11,0.1)",  color: "#f59e0b", border: "rgba(245,158,11,0.25)" },
  pending:     { label: "Pending",     bg: "rgba(107,114,128,0.1)", color: "#9ca3af", border: "rgba(107,114,128,0.2)" },
};

const TABS = ["Overview", "Documents", "Participants", "Intelligence", "Closing"];

const GEN_STEPS = [
  { label: "Identifying transaction type",   detail: "Matching Workflow Pack to deal structure" },
  { label: "Configuring workflow stages",    detail: "Building lifecycle from term sheet to close" },
  { label: "Assigning participant roles",    detail: "Role permissions and visibility rules applied" },
  { label: "Building document checklist",   detail: "Required and optional items from pack definition" },
  { label: "Calibrating AI intelligence",   detail: "Benchmarks, risk thresholds, and scoring model loaded" },
];

// ── Stage progress ────────────────────────────────────────────────────────────
function StageBar({ stages, current }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, width:"100%" }}>
      {stages.map((s, i) => (
        <div key={s} style={{ display:"flex", flex:1, alignItems:"center" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
            <div style={{
              width:10, height:10, borderRadius:"50%",
              background: i <= current ? "#9f1239" : "transparent",
              border: `2px solid ${i <= current ? "#9f1239" : "#374151"}`,
              flexShrink:0,
            }} />
            <span style={{ fontSize:9, marginTop:4, color: i === current ? "#9f1239" : "#6b7280", textAlign:"center", lineHeight:1.2 }}>{s}</span>
          </div>
          {i < stages.length - 1 && (
            <div style={{ height:1, flex:1, background: i < current ? "#9f1239" : "#1f2937", marginBottom:14 }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, grade }) {
  const r = 38, circ = 2 * Math.PI * r;
  return (
    <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center", width:96, height:96 }}>
      <svg width="96" height="96" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="#1f2937" strokeWidth="7"/>
        <motion.circle cx="48" cy="48" r={r} fill="none" stroke="#9f1239" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (score / 100) * circ }}
          transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
        />
      </svg>
      <div style={{ position:"absolute", textAlign:"center" }}>
        <div style={{ fontSize:20, fontWeight:700, fontFamily:"monospace" }}>{score}</div>
        <div style={{ fontSize:11, color:"#9ca3af" }}>{grade}</div>
      </div>
    </div>
  );
}

// ── Generating screen ─────────────────────────────────────────────────────────
function GeneratingScreen({ pack, onDone }) {
  const [completed, setCompleted] = useState([]);
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(false);
  const STEP_MS = 600;

  useEffect(() => {
    const timers = [];
    GEN_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setActive(i), i * STEP_MS));
      timers.push(setTimeout(() => setCompleted(p => [...p, i]), i * STEP_MS + 460));
    });
    timers.push(setTimeout(() => setDone(true), GEN_STEPS.length * STEP_MS + 200));
    timers.push(setTimeout(onDone, GEN_STEPS.length * STEP_MS + 900));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 24px", background:"#0a0a0b" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} style={{ marginBottom:40, textAlign:"center" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, border:"1px solid #1f2937", borderRadius:20, padding:"5px 14px", marginBottom:14 }}>
          <span style={{ fontSize:11, fontFamily:"monospace", color:"#9ca3af" }}>{pack.badge} Workflow Pack</span>
        </div>
        <h2 style={{ fontSize:28, fontWeight:600, margin:"0 0 6px", fontFamily:"'Playfair Display', serif", color:"#e8e8ea" }}>{pack.name}</h2>
        <p style={{ color:"#6b7280", fontSize:13, margin:0 }}>
          Creating workspace for <strong style={{ color:"#e8e8ea" }}>"{pack.sampleDealName}"</strong>
        </p>
      </motion.div>

      <div style={{ width:"100%", maxWidth:420, display:"flex", flexDirection:"column", gap:10 }}>
        {GEN_STEPS.map((step, i) => {
          const isComplete = completed.includes(i);
          const isActive = active === i && !isComplete;
          return (
            <motion.div key={step.label}
              initial={{ opacity:0, x:-12 }} animate={{ opacity: active >= i ? 1 : 0.3, x:0 }}
              transition={{ duration:0.3, delay: i * 0.04 }}
              style={{
                display:"flex", alignItems:"flex-start", gap:12, padding:"14px 16px",
                borderRadius:10, border:`1px solid ${isComplete ? "rgba(159,18,57,0.3)" : "#1f2937"}`,
                background: isComplete ? "rgba(159,18,57,0.05)" : "rgba(19,19,22,0.8)",
              }}>
              <div style={{ flexShrink:0, marginTop:2 }}>
                {isComplete ? (
                  <motion.div initial={{ scale:0 }} animate={{ scale:1 }}
                    style={{ width:20, height:20, borderRadius:"50%", background:"rgba(159,18,57,0.2)", color:"#9f1239", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <CheckIcon/>
                  </motion.div>
                ) : isActive ? (
                  <div style={{ color:"#9f1239" }}><SpinnerIcon size={20}/></div>
                ) : (
                  <div style={{ width:20, height:20, borderRadius:"50%", border:"1px solid #374151" }}/>
                )}
              </div>
              <div>
                <p style={{ fontSize:13, fontWeight:500, margin:"0 0 2px", color: (isComplete||isActive) ? "#e8e8ea" : "#6b7280" }}>{step.label}</p>
                {(isActive || isComplete) && (
                  <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ fontSize:11, color:"#6b7280", margin:0 }}>{step.detail}</motion.p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{ width:"100%", maxWidth:420, marginTop:28, height:2, background:"#1f2937", borderRadius:2, overflow:"hidden" }}>
        <motion.div style={{ height:"100%", background:"#9f1239", borderRadius:2 }}
          initial={{ width:"0%" }}
          animate={{ width: done ? "100%" : `${(completed.length / GEN_STEPS.length) * 100}%` }}
          transition={{ duration:0.4 }}
        />
      </div>

      {done && (
        <motion.p initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} style={{ marginTop:16, fontSize:12, color:"#9f1239", fontWeight:500 }}>
          Workspace ready — launching…
        </motion.p>
      )}
    </div>
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

  // shared card style
  const card = { background:"#131316", border:"1px solid #1f2937", borderRadius:12 };
  const cardHead = { padding:"14px 20px", borderBottom:"1px solid #1f2937", display:"flex", alignItems:"center", justifyContent:"space-between" };
  const label = (t) => ({ fontSize:12, fontWeight:500, color:"#e8e8ea", display:"flex", alignItems:"center", gap:6 });
  const muted = { fontSize:11, color:"#6b7280" };

  const complete = pack.checklist.filter(i => i.status === "complete").length;
  const total = pack.checklist.length;

  function Overview() {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {/* Stage progress */}
        <div style={{ ...card, padding:24 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:24 }}>
            <div>
              <h3 style={{ fontSize:16, fontWeight:600, margin:"0 0 2px", fontFamily:"'Playfair Display', serif", color:"#e8e8ea" }}>{pack.name}</h3>
              <p style={{ ...muted, margin:0 }}>{pack.tagline}</p>
            </div>
            <span style={{ fontSize:10, fontFamily:"monospace", color:"#6b7280", border:"1px solid #1f2937", borderRadius:4, padding:"2px 8px" }}>
              Stage {pack.currentStage + 1}/{pack.stages.length}
            </span>
          </div>
          <StageBar stages={pack.stages} current={pack.currentStage}/>
        </div>

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          {[
            { val: `${Math.round((complete/total)*100)}%`, sub: "Checklist", detail: `${complete}/${total} items` },
            { val: `${pack.roles.filter(r=>r.invited).length}/${pack.roles.length}`, sub: "Participants", detail: "Roles invited" },
            { val: pack.insights.score, sub: "Deal Score", detail: "AI Assessment" },
          ].map(({ val, sub, detail }) => (
            <div key={sub} style={{ ...card, padding:"18px 12px", textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:700, fontFamily:"monospace", color:"#e8e8ea", marginBottom:2 }}>{val}</div>
              <div style={{ fontSize:11, color:"#9ca3af" }}>{sub}</div>
              <div style={{ fontSize:10, color:"#4b5563", marginTop:2 }}>{detail}</div>
            </div>
          ))}
        </div>

        {/* Audit preview */}
        <div style={card}>
          <div style={cardHead}><span style={label()}>Recent Activity</span></div>
          <div style={{ padding:"8px 0" }}>
            {pack.audit.slice(0, 4).map((e, i) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 20px" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"rgba(159,18,57,0.6)", marginTop:5, flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:12, color:"#e8e8ea" }}>{e.action}</span>
                  <span style={{ fontSize:11, color:"#6b7280", marginLeft:6 }}>by {e.actor}</span>
                </div>
                <span style={{ fontSize:10, color:"#4b5563", flexShrink:0 }}>{e.time}</span>
              </div>
            ))}
          </div>
          <div style={{ padding:"8px 20px 14px" }}>
            <button onClick={() => setTab("Closing")} style={{ fontSize:11, color:"#6b7280", background:"none", border:"none", cursor:"pointer", padding:0 }}>
              View full audit trail →
            </button>
          </div>
        </div>
      </div>
    );
  }

  function Documents() {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={card}>
          <div style={cardHead}>
            <span style={label()}>Document Checklist</span>
            <span style={{ fontSize:10, fontFamily:"monospace", color:"#6b7280", border:"1px solid #1f2937", borderRadius:4, padding:"2px 6px" }}>{pack.badge} PACK</span>
          </div>
          {pack.checklist.map((item) => {
            const s = STATUS_STYLES[item.status];
            return (
              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <div style={{
                  width:18, height:18, borderRadius:4, flexShrink:0,
                  background: item.status === "complete" ? "rgba(159,18,57,0.15)" : "transparent",
                  border: `1.5px solid ${item.status === "complete" ? "#9f1239" : item.status === "in_progress" ? "#f59e0b" : "#374151"}`,
                  display:"flex", alignItems:"center", justifyContent:"center", color:"#9f1239",
                }}>
                  {item.status === "complete" && <CheckIcon/>}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:12, margin:"0 0 1px", color:"#e8e8ea" }}>{item.label}</p>
                  <p style={{ ...muted, margin:0 }}>{item.role}</p>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  {item.required && <span style={{ fontSize:9, color:"#4b5563", border:"1px solid #1f2937", borderRadius:3, padding:"1px 5px" }}>REQ</span>}
                  <span style={{ fontSize:10, fontWeight:500, background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:4, padding:"2px 7px" }}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Upload */}
        <div style={card}>
          <div style={cardHead}><span style={label()}>Upload Document</span></div>
          <div style={{ padding:20 }}>
            <input ref={fileRef} type="file" style={{ display:"none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}/>
            {analyzing ? (
              <div style={{ border:"1px dashed rgba(159,18,57,0.4)", borderRadius:10, padding:"36px 24px", textAlign:"center" }}>
                <div style={{ color:"#9f1239", display:"flex", justifyContent:"center", marginBottom:12 }}><SpinnerIcon size={28}/></div>
                <p style={{ fontSize:13, color:"#9ca3af", margin:0 }}>Analyzing <strong style={{ color:"#e8e8ea" }}>{uploaded?.name}</strong>…</p>
                <p style={{ ...muted, marginTop:4 }}>Extracting data points and risk signals</p>
              </div>
            ) : analyzed ? (
              <div style={{ border:"1px dashed rgba(16,185,129,0.35)", background:"rgba(16,185,129,0.04)", borderRadius:10, padding:"28px 24px", textAlign:"center" }}>
                <div style={{ fontSize:24, marginBottom:8 }}>✓</div>
                <p style={{ fontSize:13, fontWeight:500, color:"#e8e8ea", margin:"0 0 10px" }}>{uploaded?.name} analyzed</p>
                <button onClick={() => setTab("Intelligence")} style={{ fontSize:11, color:"#9f1239", background:"none", border:"1px solid rgba(159,18,57,0.3)", borderRadius:6, padding:"5px 14px", cursor:"pointer" }}>
                  View AI Analysis →
                </button>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()} style={{ border:"2px dashed #1f2937", borderRadius:10, padding:"40px 24px", textAlign:"center", cursor:"pointer" }}
                onMouseEnter={e => e.currentTarget.style.borderColor="rgba(159,18,57,0.4)"}
                onMouseLeave={e => e.currentTarget.style.borderColor="#1f2937"}>
                <div style={{ fontSize:28, marginBottom:10 }}>↑</div>
                <p style={{ fontSize:13, fontWeight:500, color:"#e8e8ea", margin:"0 0 4px" }}>Drag & drop or click to upload</p>
                <p style={{ ...muted, margin:0 }}>PDF, Excel, or CSV — AI extracts and scores instantly</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function Participants() {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={card}>
          <div style={cardHead}><span style={label()}>Participant Roles</span></div>
          {pack.roles.map((role) => (
            <div key={role.name} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:role.color+"22", color:role.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600, flexShrink:0 }}>
                {role.initials}
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:500, margin:"0 0 1px", color:"#e8e8ea" }}>{role.name}</p>
                <p style={{ ...muted, margin:0 }}>{role.description}</p>
              </div>
              {role.invited ? (
                <span style={{ fontSize:11, color:"#10b981", display:"flex", alignItems:"center", gap:4 }}>✓ Invited</span>
              ) : (
                <button style={{ fontSize:11, color:"#9ca3af", background:"transparent", border:"1px solid #374151", borderRadius:6, padding:"4px 12px", cursor:"pointer" }}>
                  Invite
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ ...card, padding:20 }}>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ fontSize:18, marginTop:2 }}>🔒</div>
            <div>
              <p style={{ fontSize:13, fontWeight:500, margin:"0 0 6px", color:"#e8e8ea" }}>OTP-Gated Access</p>
              <p style={{ fontSize:12, color:"#6b7280", margin:0, lineHeight:1.6 }}>
                Every participant receives a unique invite link. Before accessing any deal room content, they verify via one-time passcode sent to their email. Kontra logs every verification event to the audit trail.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Intelligence() {
    if (!analyzed && !uploaded) return (
      <div style={{ ...card, padding:60, textAlign:"center" }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🧠</div>
        <p style={{ fontSize:13, fontWeight:500, color:"#e8e8ea", margin:"0 0 6px" }}>No document analyzed yet</p>
        <p style={{ ...muted, margin:"0 0 16px" }}>Upload a document in the Documents tab to see AI analysis</p>
        <button onClick={() => setTab("Documents")} style={{ fontSize:12, color:"#9ca3af", background:"transparent", border:"1px solid #374151", borderRadius:6, padding:"6px 16px", cursor:"pointer" }}>
          Go to Documents
        </button>
      </div>
    );
    const { insights } = pack;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ ...card, padding:24 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:24 }}>
            <ScoreRing score={insights.score} grade={insights.grade}/>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <h4 style={{ fontSize:15, fontWeight:600, margin:0, fontFamily:"'Playfair Display', serif", color:"#e8e8ea" }}>AI Deal Assessment</h4>
                <span style={{ fontSize:10, fontFamily:"monospace", color:"#6b7280", border:"1px solid #1f2937", borderRadius:3, padding:"1px 6px" }}>{pack.badge}</span>
              </div>
              <p style={{ fontSize:12, color:"#9ca3af", margin:0, lineHeight:1.6 }}>{insights.summary}</p>
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10 }}>
          {insights.metrics.map(m => (
            <div key={m.label} style={{ ...card, padding:"14px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em" }}>{m.label}</span>
                <span style={{ fontSize:11 }}>{m.trend === "up" ? (m.good ? "↑" : "↑") : (m.good ? "↓" : "↓")}</span>
              </div>
              <div style={{ fontSize:16, fontWeight:700, fontFamily:"monospace", color:"#e8e8ea" }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={cardHead}><span style={label()}>Risk Signals</span></div>
          {insights.risks.map((r, i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize:10, fontWeight:600, color:RISK_COLORS[r.level], background:RISK_COLORS[r.level]+"22", border:`1px solid ${RISK_COLORS[r.level]}44`, borderRadius:4, padding:"2px 7px", flexShrink:0, textTransform:"uppercase" }}>{r.level}</span>
              <div>
                <p style={{ fontSize:12, fontWeight:500, margin:"0 0 2px", color:"#e8e8ea" }}>{r.title}</p>
                <p style={{ ...muted, margin:0 }}>{r.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function Closing() {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={card}>
          <div style={cardHead}>
            <span style={label()}>Closing Package</span>
            <button style={{ fontSize:11, color:"#9ca3af", background:"transparent", border:"1px solid #374151", borderRadius:6, padding:"4px 12px", cursor:"pointer" }}>🔒 Share with Counterparty</button>
          </div>
          <div style={{ padding:"12px 20px", display:"flex", flexDirection:"column", gap:8 }}>
            {pack.checklist.filter(i => i.status === "complete").map(item => (
              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:"1px solid #1f2937" }}>
                <span style={{ color:"#10b981" }}>✓</span>
                <span style={{ fontSize:12, color:"#e8e8ea", flex:1 }}>{item.label}</span>
                <span style={{ fontSize:10, color:"#10b981", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:4, padding:"2px 7px" }}>Verified</span>
              </div>
            ))}
            {pack.checklist.filter(i => i.status !== "complete").length > 0 && (
              <p style={{ ...muted, margin:"4px 0 0", padding:"0 2px" }}>
                {pack.checklist.filter(i => i.status !== "complete").length} items still pending before close
              </p>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={cardHead}><span style={label()}>Audit Trail</span></div>
          {pack.audit.map((e, i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"12px 20px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"rgba(159,18,57,0.5)", marginTop:5, flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:12, color:"#e8e8ea", margin:"0 0 2px" }}>{e.action}</p>
                <p style={{ fontSize:11, color:"#6b7280", margin:0 }}>{e.actor} · {e.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const TAB_CONTENT = { Overview: <Overview/>, Documents: <Documents/>, Participants: <Participants/>, Intelligence: <Intelligence/>, Closing: <Closing/> };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0b", color:"#e8e8ea" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:20, background:"rgba(10,10,11,0.92)", backdropFilter:"blur(12px)", borderBottom:"1px solid #1f2937" }}>
        <div style={{ maxWidth:900, margin:"0 auto", padding:"0 24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0" }}>
            <button onClick={onBack} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", display:"flex", alignItems:"center", padding:0 }}>
              <ArrowLeft/>
            </button>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:10, fontFamily:"monospace", color:"#6b7280", border:"1px solid #1f2937", borderRadius:4, padding:"1px 6px" }}>{pack.badge}</span>
                <h1 style={{ fontSize:13, fontWeight:600, margin:0, color:"#e8e8ea" }}>{pack.sampleDealName}</h1>
              </div>
              <p style={{ fontSize:10, color:"#4b5563", margin:"2px 0 0" }}>Stage {pack.currentStage + 1}: {pack.stages[pack.currentStage]}</p>
            </div>
            <div style={{ display:"none" }} className="stage-bar-desktop"/>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:0, overflow:"auto" }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding:"10px 16px", fontSize:12, fontWeight:500, border:"none", background:"none", cursor:"pointer",
                borderBottom: `2px solid ${tab === t ? "#9f1239" : "transparent"}`,
                color: tab === t ? "#9f1239" : "#6b7280",
                whiteSpace:"nowrap",
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:900, margin:"0 auto", padding:"24px" }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }} transition={{ duration:0.18 }}>
            {TAB_CONTENT[tab]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Root DemoPage ─────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const packId = params.get("pack") || "acquisition";
  const pack = DEMO_PACKS[packId] || DEMO_PACKS.acquisition;
  const [screen, setScreen] = useState("generating"); // generating | workspace

  return (
    <AnimatePresence mode="wait">
      {screen === "generating" ? (
        <motion.div key="gen" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
          <GeneratingScreen pack={pack} onDone={() => setScreen("workspace")}/>
        </motion.div>
      ) : (
        <motion.div key="ws" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
          <WorkspaceScreen pack={pack} onBack={() => navigate("/")}/>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
