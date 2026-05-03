import { useState } from "react";
import { api } from "../../../lib/apiClient";
import { useServicingContext } from "./ServicingContext";
import {
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentArrowUpIcon,
} from "@heroicons/react/24/outline";

type AiDocResult = {
  doc_type: string;
  summary: string;
  metrics: {
    dscr?: number | null;
    noi?: number | null;
    occupancy?: number | null;
    gross_revenue?: number | null;
    total_expenses?: number | null;
    net_income?: number | null;
  };
  covenants: { name: string; threshold: string; actual: string; status: string }[];
  risk_flags: string[];
  recommendations: string[];
  notice?: string;
};

export default function ServicingBorrowerFinancialsPage() {
  const { addAlert, addTask, logAudit, requestApproval } = useServicingContext();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]   = useState<AiDocResult | null>(null);
  const [uploadError, setUploadError] = useState<string>("");

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Select a borrower financial file before uploading.");
      return;
    }
    setUploadError("");
    setResult(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const { data } = await api.post<AiDocResult>("/ai/analyze", formData);

      if (data) {
        setResult(data);
        const hasBreach = data.covenants?.some((c) => c.status === "breach");
        const hasHighRisk = data.risk_flags?.length > 0;

        addAlert({
          id: `alert-fin-${Date.now()}`,
          title: `AI analysis complete — ${data.doc_type}`,
          detail: hasBreach
            ? "Covenant breach detected. Review required before next payment cycle."
            : data.summary.slice(0, 100),
          severity: hasBreach ? "high" : hasHighRisk ? "medium" : "low",
          category: "Borrower Financials",
        });
        addTask({
          id: `task-fin-${Date.now()}`,
          title: `Review AI financial summary — ${selectedFile.name}`,
          detail: `${data.doc_type} uploaded. ${data.risk_flags?.length || 0} risk flags detected. Human review required.`,
          status: "open",
          category: "Borrower Financials",
          requiresApproval: hasBreach,
        });
        logAudit({
          id: `audit-fin-${Date.now()}`,
          action: "Borrower financials analyzed by AI",
          detail: `${selectedFile.name} — ${data.doc_type}. DSCR: ${data.metrics?.dscr ?? "N/A"}. ${data.risk_flags?.length || 0} risk flags.`,
          timestamp: new Date().toISOString(),
          status: hasBreach ? "pending-approval" : "logged",
        });
      }
    } catch (err) {
      setUploadError("AI analysis failed. Please try again.");
      console.error("Financial analysis failed.", err);
    } finally {
      setUploading(false);
    }
  };

  const handleRequestClarification = () => {
    requestApproval(
      "Send borrower clarification request",
      "Request follow-up on revenue variance and vacancy assumptions."
    );
  };

  const metricColor = (val: number | null | undefined, good: number, warn: number, higher = true) => {
    if (val == null) return "text-slate-500";
    return higher
      ? val >= good ? "text-emerald-600" : val >= warn ? "text-amber-600" : "text-red-600"
      : val <= good ? "text-emerald-600" : val <= warn ? "text-amber-600" : "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* ── Upload Panel ── */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <SparklesIcon className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-slate-900">AI Borrower Financials Analysis</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Upload any borrower financial document — income statement, rent roll, or operating statement.
          GPT-4o will extract DSCR, NOI, occupancy, covenant status, and risk flags automatically.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xls,.pdf,.doc,.docx"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            onChange={(e) => {
              setSelectedFile(e.target.files?.[0] ?? null);
              setResult(null);
              setUploadError("");
            }}
          />
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="flex items-center gap-2 rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-800 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <><SparklesIcon className="h-4 w-4 animate-pulse" /> Analyzing…</>
            ) : (
              <><DocumentArrowUpIcon className="h-4 w-4" /> Upload & Analyze</>
            )}
          </button>
        </div>
        {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
      </section>

      {/* ── AI Result ── */}
      {result && (
        <section className="rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="border-b border-violet-100 bg-violet-50 px-6 py-4 flex items-center gap-3">
            <SparklesIcon className="h-5 w-5 text-violet-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">AI Extraction Complete — {result.doc_type}</h3>
              <p className="text-xs text-slate-500">{selectedFile?.name}</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Summary */}
            <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>

            {/* Key Metrics */}
            {Object.values(result.metrics || {}).some((v) => v != null) && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Extracted Metrics</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {result.metrics.dscr != null && (
                    <div className={`rounded-lg border p-3 text-center ${Number(result.metrics.dscr) >= 1.25 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">DSCR</p>
                      <p className={`text-2xl font-black mt-1 ${metricColor(result.metrics.dscr, 1.25, 1.1)}`}>{result.metrics.dscr}x</p>
                    </div>
                  )}
                  {result.metrics.occupancy != null && (
                    <div className={`rounded-lg border p-3 text-center ${Number(result.metrics.occupancy) >= 90 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Occupancy</p>
                      <p className={`text-2xl font-black mt-1 ${metricColor(result.metrics.occupancy, 90, 80)}`}>{result.metrics.occupancy}%</p>
                    </div>
                  )}
                  {result.metrics.noi != null && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Annual NOI</p>
                      <p className="text-lg font-black text-slate-800 mt-1">${Number(result.metrics.noi).toLocaleString()}</p>
                    </div>
                  )}
                  {result.metrics.gross_revenue != null && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Gross Revenue</p>
                      <p className="text-lg font-black text-slate-800 mt-1">${Number(result.metrics.gross_revenue).toLocaleString()}</p>
                    </div>
                  )}
                  {result.metrics.total_expenses != null && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Expenses</p>
                      <p className="text-lg font-black text-slate-800 mt-1">${Number(result.metrics.total_expenses).toLocaleString()}</p>
                    </div>
                  )}
                  {result.metrics.net_income != null && (
                    <div className={`rounded-lg border p-3 text-center ${Number(result.metrics.net_income) >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Net Income</p>
                      <p className={`text-lg font-black mt-1 ${Number(result.metrics.net_income) >= 0 ? "text-emerald-700" : "text-red-600"}`}>${Number(result.metrics.net_income).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Covenant Status */}
            {result.covenants?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Covenant Compliance</p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                  {result.covenants.map((c, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 ${c.status === "breach" ? "bg-red-50" : c.status === "watch" ? "bg-amber-50" : "bg-white"}`}>
                      <span className="text-sm font-semibold text-slate-700">{c.name}</span>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-500">floor: <strong>{c.threshold}</strong></span>
                        <span className="font-bold text-slate-900">{c.actual}</span>
                        <span className={`rounded-full px-2.5 py-0.5 font-black uppercase ${c.status === "breach" ? "bg-red-100 text-red-700" : c.status === "watch" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{c.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Flags */}
            {result.risk_flags?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Risk Flags</p>
                <ul className="space-y-2">
                  {result.risk_flags.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Servicer Recommendations</p>
                <ol className="space-y-2">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-700">{i + 1}</span>
                      {r}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {result.notice && (
              <p className="text-xs text-slate-400 italic">{result.notice}</p>
            )}

            {/* Action Row */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={handleRequestClarification}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Request Borrower Clarification
              </button>
              <button
                onClick={() => requestApproval("Approve financial package", `Approve ${selectedFile?.name} for covenant compliance.`)}
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 transition-colors"
              >
                <CheckCircleIcon className="h-4 w-4" /> Approve Package
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Hardcoded variance/risk context (shown before any upload) ── */}
      {!result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Typical Variance Drivers</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2"><span className="text-amber-500 font-bold">·</span> Rent collections down due to seasonal turnover</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold">·</span> Utilities expense increases from HVAC replacements</li>
              <li className="flex gap-2"><span className="text-amber-500 font-bold">·</span> Capex draw timing shifts</li>
            </ul>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Common Risk Flags</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2"><ExclamationTriangleIcon className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> DSCR trending below 1.20x covenant floor</li>
              <li className="flex gap-2"><ExclamationTriangleIcon className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Occupancy decline in consecutive quarters</li>
              <li className="flex gap-2"><ExclamationTriangleIcon className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /> Lease renewal pipeline stalled</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
