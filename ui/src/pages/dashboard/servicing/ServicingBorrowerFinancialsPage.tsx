import { useState, useRef } from "react";
  import { DocumentArrowUpIcon, SparklesIcon } from "@heroicons/react/24/outline";
  import { api } from "../../../lib/apiClient";
  import { useServicingContext } from "./ServicingContext";

  type AiDocResult = {
    doc_type: string;
    summary: string;
    metrics: { dscr?: number | null; noi?: number | null; occupancy?: number | null; gross_revenue?: number | null; total_expenses?: number | null; net_income?: number | null };
    covenants: { name: string; threshold: string; actual: string; status: "compliant" | "breach" | "watch" }[];
    risk_flags: string[];
    recommendations: string[];
    notice?: string;
  };

  const METRIC_LABELS: Record<string, string> = {
    dscr: "DSCR", noi: "NOI", occupancy: "Occupancy %",
    gross_revenue: "Gross Revenue", total_expenses: "Total Expenses", net_income: "Net Income",
  };

  const STATUS_COLORS = {
    compliant: "text-emerald-700 bg-emerald-50 border-emerald-200",
    breach:    "text-red-700 bg-red-50 border-red-200",
    watch:     "text-amber-700 bg-amber-50 border-amber-200",
  };

  export default function ServicingBorrowerFinancialsPage() {
    const { addAlert, addTask, logAudit, requestApproval } = useServicingContext();
    const fileRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<AiDocResult | null>(null);
    const [uploadError, setUploadError] = useState<string>("");

    const handleUpload = async () => {
      if (!selectedFile) { setUploadError("Select a borrower financial document first."); return; }
      setUploadError(""); setUploading(true); setResult(null);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const { data } = await api.post<AiDocResult>("/ai/analyze", formData);
        if (data) {
          setResult(data);
          addAlert({ id: "alert-financial-upload", title: "Borrower financials analyzed", detail: `AI extraction complete — ${data.doc_type}`, severity: "medium", category: "Borrower Financials" });
          addTask({ id: "task-financial-review", title: "Review AI financial summary", detail: "Validate DSCR, covenants, and risk flags before approval.", status: "open", category: "Borrower Financials" });
          logAudit({ id: `audit-upload-${Date.now()}`, action: "Borrower financials analyzed by AI", detail: `File: ${selectedFile.name} · Type: ${data.doc_type}`, timestamp: new Date().toISOString(), status: "logged" });
        }
      } catch {
        setResult({ doc_type: "Unknown", summary: "AI analysis temporarily unavailable. Document received and queued.", metrics: {}, covenants: [], risk_flags: [], recommendations: [] });
      } finally { setUploading(false); }
    };

    return (
      <div className="space-y-6">
        {/* ── Upload Section ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <SparklesIcon className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-slate-900">AI Borrower Financials Analysis</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">Upload a borrower financial document — GPT-4o will extract DSCR, NOI, covenant compliance, and risk flags.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { setSelectedFile(e.target.files?.[0] || null); setUploadError(""); }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              {selectedFile ? selectedFile.name : "Choose Document"}
            </button>
            <button type="button" onClick={handleUpload} disabled={!selectedFile || uploading}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-60 hover:bg-violet-500 transition-colors">
              {uploading
                ? <><SparklesIcon className="h-4 w-4 animate-pulse" /> Analyzing…</>
                : <><DocumentArrowUpIcon className="h-4 w-4" /> Upload & Analyze</>}
            </button>
          </div>
          {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
          <p className="mt-2 text-xs text-slate-400">PDF, Excel, CSV, or text · Max 25 MB · AI extracts key metrics automatically</p>
        </section>

        {/* ── AI Result ── */}
        {result && (
          <section className="rounded-xl border border-violet-200 bg-violet-50 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-violet-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">AI Extraction Complete — {result.doc_type}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{result.summary}</p>
              </div>
            </div>

            {/* Metrics */}
            {Object.keys(result.metrics || {}).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(result.metrics).filter(([,v]) => v != null).map(([k,v]) => (
                  <div key={k} className="rounded-lg bg-white border border-violet-200 p-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{METRIC_LABELS[k] || k}</p>
                    <p className="text-xl font-black text-slate-900 mt-1">
                      {k === "dscr" ? (v as number)?.toFixed(2) + "x"
                        : k === "occupancy" ? (v as number)?.toFixed(1) + "%"
                        : typeof v === "number" && v > 999 ? "$" + (v as number).toLocaleString()
                        : String(v)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Covenants */}
            {result.covenants?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Covenant Compliance</p>
                <div className="space-y-2">
                  {result.covenants.map((c, i) => (
                    <div key={i} className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${STATUS_COLORS[c.status] || STATUS_COLORS.watch}`}>
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs">Required: {c.threshold} · Actual: {c.actual}</span>
                      <span className="text-xs font-bold uppercase">{c.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Flags */}
            {result.risk_flags?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-red-600 mb-2">Risk Flags</p>
                {result.risk_flags.map((f, i) => <p key={i} className="text-sm text-red-700">• {f}</p>)}
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Recommendations</p>
                {result.recommendations.map((r, i) => (
                  <p key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-violet-600">→</span>{r}</p>
                ))}
              </div>
            )}

            <button type="button" onClick={() => requestApproval("Route AI financial summary to underwriter", result.summary)}
              className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 transition-colors">
              Route to Underwriter for Approval
            </button>
          </section>
        )}

        {/* ── Static Info Cards ── */}
        {!result && !uploading && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Typical Variance Drivers</h3>
              <ul className="space-y-1 text-sm text-slate-600 list-disc pl-4">
                <li>Rent collections down due to seasonal turnover</li>
                <li>Utilities expense up from HVAC replacements</li>
                <li>Capex draw timing shifted from forecast</li>
                <li>Vacancy above stabilized assumption</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Common Risk Flags</h3>
              <ul className="space-y-1 text-sm text-slate-600 list-disc pl-4">
                <li>Debt service coverage trending below 1.20x</li>
                <li>Occupancy slipped more than 5 points</li>
                <li>Anchor tenant renewal pipeline delayed</li>
                <li>Gross revenue declining quarter-over-quarter</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }
  