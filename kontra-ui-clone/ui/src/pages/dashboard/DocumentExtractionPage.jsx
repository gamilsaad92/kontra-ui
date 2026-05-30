import { useState, useRef } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const MOCK_EXTRACTIONS = {
  "rent_roll": {
    type: "Rent Roll",
    fields: [
      { label: "Property Name",       value: "Westlake Commerce Center",  confidence: 99 },
      { label: "Total Units / Suites", value: "24 suites",                confidence: 97 },
      { label: "Gross Leasable Area",  value: "186,400 SF",               confidence: 99 },
      { label: "Occupied SF",          value: "172,100 SF",               confidence: 98 },
      { label: "Occupancy Rate",       value: "92.3%",                    confidence: 99 },
      { label: "Total Monthly Rent",   value: "$287,640",                 confidence: 97 },
      { label: "Annualized Revenue",   value: "$3,451,680",               confidence: 97 },
      { label: "Weighted Avg Lease Term", value: "3.7 years remaining",   confidence: 94 },
      { label: "Largest Tenant",       value: "Meridian Tech (28,000 SF)", confidence: 96 },
      { label: "Lease Expirations <12mo", value: "2 tenants (11,200 SF)", confidence: 95 },
    ],
  },
  "operating_statement": {
    type: "Operating Statement",
    fields: [
      { label: "Effective Gross Income",   value: "$3,298,400",  confidence: 99 },
      { label: "Operating Expenses",       value: "$987,200",    confidence: 98 },
      { label: "Net Operating Income",     value: "$2,311,200",  confidence: 99 },
      { label: "NOI Margin",               value: "70.1%",       confidence: 99 },
      { label: "Debt Service Coverage",    value: "1.42x",       confidence: 97 },
      { label: "Cap Rate (at cost)",       value: "6.8%",        confidence: 95 },
      { label: "Vacancy & Credit Loss",    value: "$153,040 (4.6%)", confidence: 96 },
      { label: "Mgmt Fee",                 value: "$98,720 (3%)", confidence: 99 },
      { label: "Real Estate Taxes",        value: "$241,600",    confidence: 99 },
      { label: "Insurance",                value: "$44,800",     confidence: 98 },
    ],
  },
  "appraisal": {
    type: "Appraisal Report",
    fields: [
      { label: "Appraised Value",         value: "$34,000,000",   confidence: 99 },
      { label: "Appraisal Date",          value: "March 12, 2025", confidence: 99 },
      { label: "Appraiser",               value: "CBRE Valuation", confidence: 98 },
      { label: "Approach (Primary)",      value: "Income Approach", confidence: 97 },
      { label: "Market Cap Rate",         value: "6.5% – 7.0%",   confidence: 95 },
      { label: "Comparable Sales (avg)",  value: "$34.2M (3 comps)", confidence: 92 },
      { label: "Per SF Value",            value: "$182/SF",        confidence: 99 },
      { label: "Loan-to-Value (proposed)", value: "62.5%",        confidence: 99 },
      { label: "As-Stabilized Value",     value: "$36,500,000",   confidence: 90 },
      { label: "Market Conditions",       value: "Stable — mild headwinds Q3", confidence: 88 },
    ],
  },
};

function ConfidenceBar({ pct }) {
  const color = pct >= 97 ? "bg-green-500" : pct >= 92 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function DocumentExtractionPage() {
  const [stage, setStage]       = useState("idle"); // idle | uploading | extracted
  const [docType, setDocType]   = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult]     = useState(null);
  const [tsStage, setTsStage]   = useState("idle"); // idle | loading | done | error
  const [termSheet, setTermSheet] = useState("");
  const fileRef = useRef();

  async function generateTermSheet() {
    if (!result) return;
    setTsStage("loading");
    setTermSheet("");
    try {
      const res = await fetch(`${API_BASE}/api/underwriting/term-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: result.fields, docType: result.type, fileName }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTermSheet(data.termSheet);
      setTsStage("done");
    } catch (e) {
      setTsStage("error");
      setTermSheet(e.message || "Failed to generate term sheet.");
    }
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    const detected = lower.includes("rent") || lower.includes("roll") ? "rent_roll"
      : lower.includes("operat") || lower.includes("income") || lower.includes("noi") ? "operating_statement"
      : lower.includes("apprais") ? "appraisal"
      : "rent_roll";
    setDocType(detected);
    runExtraction(detected, file.name);
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvt = { target: { files: [file] } };
      handleFile(fakeEvt);
    }
  }

  function runExtraction(type, name) {
    setStage("uploading");
    setResult(null);
    setTimeout(() => {
      setResult(MOCK_EXTRACTIONS[type] || MOCK_EXTRACTIONS["rent_roll"]);
      setStage("extracted");
    }, 2200);
  }

  function reset() {
    setStage("idle");
    setFileName("");
    setDocType("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-white">Document Extraction</h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload a rent roll, operating statement, or appraisal — AI extracts structured data instantly.
          </p>
        </div>

        {/* Supported types */}
        <div className="flex gap-2 flex-wrap">
          {["Rent Roll", "Operating Statement", "Appraisal", "Loan Agreement", "Title Commitment"].map(t => (
            <span key={t} className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300">
              {t}
            </span>
          ))}
        </div>

        {/* Upload zone */}
        {stage === "idle" && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-2xl p-12
                       flex flex-col items-center justify-center gap-4 cursor-pointer transition group"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-800 group-hover:bg-slate-700 transition
                            flex items-center justify-center text-2xl">
              📄
            </div>
            <div className="text-center">
              <p className="text-white font-medium text-sm">Drop your document here</p>
              <p className="text-slate-400 text-xs mt-1">or click to browse — PDF, XLSX, CSV, DOCX</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Powered by Ocrolus AI · 99%+ accuracy
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.xlsx,.csv,.docx" className="hidden" onChange={handleFile} />
          </div>
        )}

        {/* Processing */}
        {stage === "uploading" && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-10 flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-slate-700 flex items-center justify-center text-2xl">
                📄
              </div>
              <svg className="absolute inset-0 w-16 h-16 animate-spin -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="30" fill="none" stroke="#800020" strokeWidth="2.5"
                  strokeDasharray="100 88" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-medium text-sm">{fileName}</p>
              <p className="text-slate-400 text-xs mt-1">Extracting structured data with Ocrolus AI...</p>
            </div>
            <div className="w-full max-w-xs space-y-2 text-xs text-slate-400">
              {["Parsing document structure", "Identifying field types", "Extracting values", "Calculating confidence scores"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 animate-spin text-slate-600" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="30 40" fill="none"/>
                  </svg>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {stage === "extracted" && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-900/30 border border-green-700/40 flex items-center justify-center text-sm">✓</div>
                <div>
                  <p className="text-white font-medium text-sm">{fileName}</p>
                  <p className="text-xs text-green-400">
                    {result.type} · {result.fields.length} fields extracted · avg{" "}
                    {Math.round(result.fields.reduce((a, f) => a + f.confidence, 0) / result.fields.length)}% confidence
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => alert("In production, this populates the loan origination form automatically.")}
                  className="px-4 py-2 rounded-lg text-white text-xs font-medium transition hover:opacity-90"
                  style={{ background: "#800020" }}
                >
                  Populate Loan Model →
                </button>
                <button onClick={reset}
                        className="px-3 py-2 rounded-lg text-slate-300 text-xs border border-slate-700 hover:border-slate-500 transition">
                  New Upload
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-300 uppercase tracking-wider">Extracted Fields</p>
                <p className="text-xs text-slate-500">Confidence score per field</p>
              </div>
              <div className="divide-y divide-slate-800">
                {result.fields.map((f, i) => (
                  <div key={i} className="px-4 py-3 grid grid-cols-3 gap-4 items-center hover:bg-slate-800/40 transition">
                    <p className="text-xs text-slate-400">{f.label}</p>
                    <p className="text-sm font-medium text-white">{f.value}</p>
                    <ConfidenceBar pct={f.confidence} />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4 flex items-start gap-3">
              <span className="text-blue-400 text-sm mt-0.5">ℹ</span>
              <p className="text-xs text-blue-300">
                In production, these fields auto-populate the loan origination model, eliminating manual data entry.
                Supported by Ocrolus AI — trained on 100M+ financial documents.
              </p>
            </div>

            {/* ── Term Sheet Generation ── */}
            {tsStage === "idle" && (
              <button
                onClick={generateTermSheet}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold transition hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: "#4F46E5" }}
              >
                <span>✦</span>
                Generate AI Term Sheet →
              </button>
            )}

            {tsStage === "loading" && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col items-center gap-4">
                <svg className="w-7 h-7 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="40" strokeDashoffset="10"/>
                </svg>
                <p className="text-sm text-slate-300">GPT-4o is drafting your term sheet...</p>
                <p className="text-xs text-slate-500">Analyzing {result?.fields?.length} extracted fields · Applying market rate benchmarks</p>
              </div>
            )}

            {tsStage === "done" && termSheet && (
              <div className="bg-slate-900 border border-indigo-700/40 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-400">✦</span>
                    <p className="text-sm font-semibold text-white">AI-Generated Term Sheet</p>
                    <span className="px-2 py-0.5 rounded text-xs bg-indigo-900/40 text-indigo-400 border border-indigo-700/30">GPT-4o</span>
                  </div>
                  <button
                    onClick={() => { setTsStage("idle"); setTermSheet(""); }}
                    className="text-slate-500 hover:text-slate-300 text-xs transition"
                  >
                    Regenerate
                  </button>
                </div>
                <div className="px-5 py-5">
                  <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">{termSheet}</pre>
                </div>
                <div className="px-5 py-3 border-t border-slate-700 flex gap-2">
                  <button
                    onClick={() => alert("In production: exports to Word/PDF and creates a loan file.")}
                    className="px-4 py-2 rounded-lg text-white text-xs font-medium transition hover:opacity-90"
                    style={{ background: "#800020" }}
                  >
                    Export to Loan File →
                  </button>
                  <button
                    onClick={() => navigator.clipboard?.writeText(termSheet)}
                    className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs hover:border-slate-500 transition"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {tsStage === "error" && (
              <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 text-red-300 text-sm">
                {termSheet}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
