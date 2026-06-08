import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const SAMPLE_OUTPUTS = {
  "Inspection Analyzer": [
    "Life Safety: 1 fire suppression deficiency (Section 4.2)",
    "Deferred Maintenance: $142K estimated (HVAC + Roof + Parking)",
    "Priority: Roof membrane replacement within 90 days",
  ],
  "Property Health Score": [
    "Property Score: 87/100 — Low Risk",
    "Drivers: Occupancy (↑ Strong), NOI (↑ Above market), Age (→ Neutral)",
    "Benchmark: Top 28% of comparable multifamily assets",
  ],
  "Insurance Policy Review": [
    "Coverage: $12.4M replacement cost — matches appraisal ✓",
    "Gap Detected: Flood rider missing (property is FEMA Zone AE)",
    "Expiration: Policy expires in 34 days — renew immediately",
  ],
  "Financial Statement Review": [
    "NOI: $2.14M YTD — 6.2% above budget ✓",
    "Anomaly: Utilities expense 22% above prior year (investigate)",
    "Occupancy: 94.2% — trending up from 91% prior quarter",
  ],
};

const MORE_TOOLS = [
  {
    icon: "📄", title: "Lease Abstraction", category: "Documents",
    desc: "Extract key lease terms, tenant obligations, renewal options, rent escalations, and termination clauses from any commercial lease.",
    output: ["Term: 5-year NNN with two 5-year renewal options", "Escalations: 3% annually on base rent", "Termination: Tenant may exit with 6-month notice after Year 3"],
    uploadLabel: "Upload Lease Agreement",
  },
  {
    icon: "📋", title: "Rent Roll Analyzer", category: "Financial",
    desc: "Validate rent roll accuracy, identify occupancy discrepancies, flag below-market units, and check covenant compliance thresholds.",
    output: ["Occupancy: 94.2% (234 units / 248 total)", "Below-Market: 3 units renting 15%+ below market rate", "Covenant Status: Compliant — minimum 85% threshold met"],
    uploadLabel: "Upload Rent Roll (Excel, CSV)",
  },
  {
    icon: "🔨", title: "Deferred Maintenance Tracker", category: "Inspections",
    desc: "Combine multiple inspection reports into a single prioritized maintenance plan with cost estimates and remediation timelines.",
    output: ["Open Items: 7 (3 Critical, 2 Moderate, 2 Minor)", "Total Estimated Cost: $287,000", "Highest Priority: Boiler replacement — life safety risk"],
    uploadLabel: "Upload Inspection Reports",
  },
  {
    icon: "✅", title: "Compliance Checklist Generator", category: "Compliance",
    desc: "Extract compliance requirements from loan documents, leases, and regulatory filings and generate a live checklist with due dates.",
    output: ["Generated: 18 compliance items across 4 categories", "Upcoming: Insurance renewal (32 days), Tax payment (61 days)", "Overdue: Annual financial reporting — 2 weeks past due"],
    uploadLabel: "Upload Loan Agreement",
  },
];

const CATEGORIES = ["All", "Inspections", "Financial", "Insurance", "Analytics", "Documents", "Compliance"];

// ── Real AI upload handler ─────────────────────────────────────────────────
async function callInspectionAnalyzer(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/ai/analyze-inspection", { method: "POST", body: fd });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.analysis;
}

async function callInsuranceReview(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/ai/review-insurance", { method: "POST", body: fd });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.analysis;
}

async function callFinancialReview(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/ai/review-financials", { method: "POST", body: fd });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.analysis;
}

// ── Format analysis result to terminal lines ───────────────────────────────
function formatInspectionResult(a) {
  const lines = [];
  if (a.overallCondition) lines.push(`Condition: ${a.overallCondition} — Score ${a.score || "N/A"}/100`);
  if (a.lifeSafetyFindings?.length) {
    lines.push(`Life Safety: ${a.lifeSafetyFindings.length} finding(s)${a.lifeSafetyFindings[0] ? ` — ${a.lifeSafetyFindings[0].item}` : ""}`);
  }
  if (a.totalDeferredCost) lines.push(`Deferred Maintenance: ${a.totalDeferredCost} estimated`);
  if (a.priorityActions?.[0]) lines.push(`Priority: ${a.priorityActions[0].action}`);
  if (a.summary) lines.push(`Summary: ${a.summary.slice(0, 100)}…`);
  return lines.length ? lines : [`Analysis complete — ${a.propertyType || "Property"} inspected`];
}

function formatInsuranceResult(a) {
  const lines = [];
  if (a.complianceStatus) lines.push(`Status: ${a.complianceStatus}`);
  if (a.coverageAmount) lines.push(`Coverage: ${a.coverageAmount}`);
  if (a.expiresInDays != null) lines.push(`Expires: in ${a.expiresInDays} days${a.expiresInDays < 45 ? " — renew immediately" : ""}`);
  if (a.coverageGaps?.length) lines.push(`Gaps: ${a.coverageGaps.length} found — ${a.coverageGaps[0]?.gap}`);
  return lines.length ? lines : ["Insurance review complete"];
}

function formatFinancialResult(a) {
  const lines = [];
  if (a.noi) lines.push(`NOI: ${a.noi}`);
  if (a.occupancy) lines.push(`Occupancy: ${a.occupancy}`);
  if (a.covenantStatus) lines.push(`Covenants: ${a.covenantStatus}`);
  if (a.anomalies?.length) lines.push(`Anomalies: ${a.anomalies.length} flagged — ${a.anomalies[0]?.item}`);
  if (a.summary) lines.push(`${a.summary.slice(0, 100)}…`);
  return lines.length ? lines : ["Financial review complete"];
}

// ── Property Score form ────────────────────────────────────────────────────
async function callPropertyScore(data) {
  const res = await fetch("/api/ai/score-property", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.analysis;
}

function formatScoreResult(a) {
  const lines = [];
  if (a.score != null) lines.push(`Score: ${a.score}/100 — ${a.riskLevel || ""} Risk`);
  if (a.benchmark) lines.push(`Benchmark: ${a.benchmark}`);
  if (a.strengths?.[0]) lines.push(`Strength: ${a.strengths[0]}`);
  if (a.risks?.[0]) lines.push(`Risk: ${a.risks[0]}`);
  return lines.length ? lines : ["Scoring complete"];
}

// ── Individual free tool card ──────────────────────────────────────────────
function InspectionCard() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    try {
      const analysis = await callInspectionAnalyzer(file);
      setResult(formatInspectionResult(analysis));
      setStatus("done");
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  return (
    <ToolCard
      icon="🔍" title="Inspection Analyzer" category="Inspections" free
      desc="Upload any physical inspection report. Get life safety findings, deferred maintenance items, cost estimates, and a prioritized action plan — instantly."
      hint="Accepts PDF, DOCX — results in under 30 seconds"
      sampleOutput={SAMPLE_OUTPUTS["Inspection Analyzer"]}
      status={status} result={result} errorMsg={errorMsg} fileName={fileName}
      onUploadClick={() => fileRef.current?.click()}
      uploadLabel="Upload Inspection Report"
    >
      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={handleFile} />
    </ToolCard>
  );
}

function InsuranceCard() {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    try {
      const analysis = await callInsuranceReview(file);
      setResult(formatInsuranceResult(analysis));
      setStatus("done");
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  return (
    <ToolCard
      icon="🛡️" title="Insurance Policy Review" category="Insurance" free
      desc="Upload a property insurance policy. AI reviews coverage amounts, flags endorsement gaps, identifies expiration dates, and checks against common lender requirements."
      hint="Works with any standard property insurance declaration page"
      sampleOutput={SAMPLE_OUTPUTS["Insurance Policy Review"]}
      status={status} result={result} errorMsg={errorMsg} fileName={fileName}
      onUploadClick={() => fileRef.current?.click()}
      uploadLabel="Upload Insurance Policy"
    >
      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={handleFile} />
    </ToolCard>
  );
}

function FinancialCard() {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    try {
      const analysis = await callFinancialReview(file);
      setResult(formatFinancialResult(analysis));
      setStatus("done");
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  return (
    <ToolCard
      icon="📊" title="Financial Statement Review" category="Financial" free
      desc="Upload an operating statement, T12, or budget vs. actual report. Get occupancy analysis, expense variance flags, year-over-year trends, and NOI validation."
      hint="Accepts Excel (.xlsx), PDF, or CSV format"
      sampleOutput={SAMPLE_OUTPUTS["Financial Statement Review"]}
      status={status} result={result} errorMsg={errorMsg} fileName={fileName}
      onUploadClick={() => fileRef.current?.click()}
      uploadLabel="Upload Financial Statement"
    >
      <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.docx,.txt" className="hidden" onChange={handleFile} />
    </ToolCard>
  );
}

function PropertyScoreCard() {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({ propertyType: "Multifamily", occupancy: "", noi: "", yearBuilt: "", units: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleScore = async () => {
    if (!form.occupancy) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    try {
      const analysis = await callPropertyScore(form);
      setResult(formatScoreResult(analysis));
      setStatus("done");
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden">
      <div className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="text-3xl">⚡</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-sm font-bold text-gray-900">Property Health Score</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Free</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Analytics</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Input occupancy rate, NOI, year built, and any inspection findings. Get a 0–100 composite risk score with peer benchmarking against comparable assets.
            </p>
          </div>
        </div>

        {/* Mini form */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Type</label>
            <select value={form.propertyType} onChange={set("propertyType")}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-gray-400">
              {["Multifamily","Office","Industrial","Retail","Mixed-Use"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Occupancy %</label>
            <input value={form.occupancy} onChange={set("occupancy")} type="number" placeholder="e.g. 94"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-gray-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Year Built</label>
            <input value={form.yearBuilt} onChange={set("yearBuilt")} type="number" placeholder="e.g. 2005"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-gray-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Annual NOI ($)</label>
            <input value={form.noi} onChange={set("noi")} type="number" placeholder="e.g. 850000"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-gray-400" />
          </div>
        </div>

        {/* Terminal */}
        <TerminalOutput status={status} result={result} errorMsg={errorMsg} sampleOutput={SAMPLE_OUTPUTS["Property Health Score"]} />

        <p className="text-xs text-gray-400 mb-3">No document upload needed — just fill in the form</p>
        <button onClick={handleScore} disabled={status === "loading" || !form.occupancy}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "#800020" }}>
          {status === "loading" ? (
            <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Scoring…</>
          ) : status === "done" ? "Run Again" : "Get Health Score"}
        </button>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────
function TerminalOutput({ status, result, errorMsg, sampleOutput }) {
  const lines = status === "done" && result ? result : sampleOutput;
  const isReal = status === "done" && result;

  return (
    <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
        </div>
        <span className="text-gray-500 text-xs">
          {status === "loading" ? "Analyzing with GPT-4o…" : isReal ? "✓ AI Analysis Complete" : "Sample Output"}
        </span>
        {isReal && <span className="ml-auto px-1.5 py-0.5 rounded text-xs bg-green-900/50 text-green-400">Live</span>}
      </div>
      {status === "loading" ? (
        <div className="flex items-center gap-2 text-gray-400">
          <span className="w-3 h-3 border border-gray-600 border-t-gray-300 rounded-full animate-spin" />
          <span>Processing document…</span>
        </div>
      ) : status === "error" ? (
        <div className="text-red-400">⚠ {errorMsg || "Analysis failed"}</div>
      ) : (
        lines.map((line, j) => (
          <div key={j} className="mb-1">
            <span className={isReal ? "text-green-300" : "text-green-400"}>→ </span>
            <span className="text-gray-300">{line}</span>
          </div>
        ))
      )}
    </div>
  );
}

function ToolCard({ icon, title, category, free, desc, hint, sampleOutput, status, result, errorMsg, fileName, onUploadClick, uploadLabel, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden">
      <div className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="text-3xl">{icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-sm font-bold text-gray-900">{title}</h3>
              {free && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Free</span>}
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{category}</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
          </div>
        </div>

        <TerminalOutput status={status} result={result} errorMsg={errorMsg} sampleOutput={sampleOutput} />

        {fileName && status !== "idle" && (
          <p className="text-xs text-gray-400 mb-2 truncate">📎 {fileName}</p>
        )}
        <p className="text-xs text-gray-400 mb-3">{hint}</p>

        <button onClick={onUploadClick} disabled={status === "loading"}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "#800020" }}>
          {status === "loading" ? (
            <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Analyzing…</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {status === "done" ? "Upload Another" : uploadLabel}
            </>
          )}
        </button>
        {children}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AiToolsPage() {
  const [category, setCategory] = useState("All");
  const showFreeOnly = category === "All";
  const filtered = category === "All" ? MORE_TOOLS : MORE_TOOLS.filter((t) => t.category === category);

  return (
    <PublicLayout>
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-950 to-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-900/40 text-green-400 text-xs font-semibold mb-5 border border-green-800/40">
            ✓ 4 tools free — no account required
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">AI Tools for CRE Operators</h1>
          <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
            Upload a document. Get real AI analysis in seconds. Inspection reports, insurance policies, financial statements — powered by GPT-4o.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* ── Free tools ────────────────────────────────────────── */}
        {showFreeOnly && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Free — No Account Required</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <InspectionCard />
              <PropertyScoreCard />
              <InsuranceCard />
              <FinancialCard />
            </div>
          </div>
        )}

        {/* ── Category filter ───────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${category === cat ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              style={category === cat ? { background: "#800020" } : {}}>
              {cat}
            </button>
          ))}
        </div>

        {/* ── Workspace tools ───────────────────────────────────── */}
        {showFreeOnly && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">More Tools — Workspace Required</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              {MORE_TOOLS.map((tool) => (
                <div key={tool.title} className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="text-3xl">{tool.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-gray-900">{tool.title}</h3>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{tool.category}</span>
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed">{tool.desc}</p>
                      </div>
                    </div>
                    <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex gap-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        </div>
                        <span className="text-gray-500 text-xs">Sample Output</span>
                      </div>
                      {tool.output.map((line, j) => (
                        <div key={j} className="mb-1">
                          <span className="text-green-400">→ </span>
                          <span className="text-gray-300">{line}</span>
                        </div>
                      ))}
                    </div>
                    <Link to="/login"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                      {tool.uploadLabel} →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtered view */}
        {!showFreeOnly && (
          <div className="grid md:grid-cols-2 gap-5">
            {filtered.map((tool) => (
              <div key={tool.title} className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="text-3xl mb-3">{tool.icon}</div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{tool.title}</h3>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{tool.desc}</p>
                <Link to="/login"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                  {tool.uploadLabel} →
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-14 rounded-2xl text-white px-8 py-12 text-center" style={{ background: "#800020" }}>
          <h2 className="text-xl font-bold mb-2">Ready to run AI on your properties?</h2>
          <p className="text-red-200 text-sm mb-6 max-w-md mx-auto leading-relaxed">
            Start with the free tools. When you're ready, create a free account and connect tools to your property workspace — inspections, documents, compliance, all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login"
              className="px-6 py-3 rounded-xl bg-white text-sm font-semibold transition hover:bg-gray-100"
              style={{ color: "#800020" }}>
              Create Free Account
            </Link>
            <Link to="/properties"
              className="px-6 py-3 rounded-xl border border-red-300/50 bg-white/10 text-sm font-semibold text-white hover:bg-white/20 transition">
              Explore Properties
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
