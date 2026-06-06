import React, { useState } from "react";

const DOC_TYPES = ["All", "Rent Roll", "Financials", "Insurance", "Inspection", "Appraisal", "Environmental", "Legal"];

const DOCUMENTS = [
  { id: 1, name: "Westside Commons - Rent Roll Q1 2025", type: "Rent Roll", property: "Westside Commons", date: "Mar 15, 2025", status: "Analyzed", size: "428 KB", aiSummary: "94.2% occupancy confirmed. 3 units below market rent by >15%. All covenant thresholds met." },
  { id: 2, name: "Summit Industrial - Insurance Policy 2025", type: "Insurance", property: "Summit Industrial Park", date: "Jan 2, 2025", status: "Analyzed", size: "1.2 MB", aiSummary: "Coverage: $18.7M replacement. No gaps detected. Renewal due Jan 2026." },
  { id: 3, name: "Northgate Retail - Annual Inspection Mar 2025", type: "Inspection", property: "Northgate Retail Center", date: "Mar 22, 2025", status: "Reviewed", size: "3.4 MB", aiSummary: "2 moderate findings: HVAC maintenance needed, parking lot resurfacing recommended. Est. $42,000." },
  { id: 4, name: "Westside Commons - Operating Statement 2024", type: "Financials", property: "Westside Commons", date: "Feb 28, 2025", status: "Analyzed", size: "215 KB", aiSummary: "NOI: $4.2M. DSCR: 1.34x — compliant. Utilities expense elevated +18% YoY." },
];

const STATUS_COLORS = { Analyzed: "#16a34a", Reviewed: "#2563eb", Processing: "#d97706", Pending: "#94a3b8" };

export default function DocumentsPage() {
  const [typeFilter, setTypeFilter] = useState("All");
  const [expandedDoc, setExpandedDoc] = useState(null);

  const filtered = typeFilter === "All" ? DOCUMENTS : DOCUMENTS.filter((d) => d.type === typeFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Document Center</h2>
          <p className="text-sm text-gray-500 mt-0.5">Upload documents and get instant AI analysis.</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "#800020" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Document
        </button>
      </div>

      {/* Upload drop zone */}
      <div className="mb-6 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 hover:bg-gray-50 transition cursor-pointer">
        <div className="text-3xl mb-2">📄</div>
        <p className="text-sm font-medium text-gray-700">Drop files here or click to upload</p>
        <p className="text-xs text-gray-400 mt-1">Supports PDF, DOCX, XLSX, CSV · AI analysis runs automatically</p>
      </div>

      {/* Type filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
        {DOC_TYPES.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition ${typeFilter === t ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            style={typeFilter === t ? { background: "#800020" } : {}}>
            {t}
          </button>
        ))}
      </div>

      {/* Documents list */}
      <div className="space-y-3">
        {filtered.map((doc) => (
          <div key={doc.id}
            className={`bg-white rounded-xl border transition-all cursor-pointer ${expandedDoc === doc.id ? "border-red-200 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
            onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm">📄</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                  <p className="text-xs text-gray-400">{doc.type} · {doc.property} · {doc.date} · {doc.size}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: STATUS_COLORS[doc.status] + "18", color: STATUS_COLORS[doc.status] }}>
                  {doc.status}
                </span>
                <svg className={`w-4 h-4 text-gray-300 transition-transform ${expandedDoc === doc.id ? "rotate-90" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            {expandedDoc === doc.id && (
              <div className="px-4 pb-4 pt-0 border-t border-gray-100 mt-0">
                <div className="bg-gray-50 rounded-lg p-3 mt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">🤖 AI Summary</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{doc.aiSummary}</p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    View Full Analysis
                  </button>
                  <button className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    Download
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
