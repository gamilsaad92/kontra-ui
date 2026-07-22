import React, { useState, useRef, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const DOC_TYPES = ["All", "Rent Roll", "Financials", "Insurance", "Inspection", "Appraisal", "Environmental", "Legal"];
const STATUS_COLORS = { Analyzed: "#16a34a", Reviewed: "#2563eb", Processing: "#d97706", Pending: "#94a3b8" };

const SAMPLE_DOCS = [
  { id: "s1", name: "Westside Commons - Rent Roll Q1 2025", type: "Rent Roll", property: "Westside Commons", date: "Mar 15, 2025", status: "Analyzed", size: "428 KB", aiSummary: "94.2% occupancy confirmed. 3 units below market rent by >15%. All covenant thresholds met." },
  { id: "s2", name: "Summit Industrial - Insurance Policy 2025", type: "Insurance", property: "Summit Industrial Park", date: "Jan 2, 2025", status: "Analyzed", size: "1.2 MB", aiSummary: "Coverage: $18.7M replacement. No gaps detected. Renewal due Jan 2026." },
  { id: "s3", name: "Northgate Retail - Annual Inspection Mar 2025", type: "Inspection", property: "Northgate Retail Center", date: "Mar 22, 2025", status: "Reviewed", size: "3.4 MB", aiSummary: "2 moderate findings: HVAC maintenance needed, parking lot resurfacing recommended. Est. $42,000." },
  { id: "s4", name: "Westside Commons - Operating Statement 2024", type: "Financials", property: "Westside Commons", date: "Feb 28, 2025", status: "Analyzed", size: "215 KB", aiSummary: "NOI: $4.2M. DSCR: 1.34x — compliant. Utilities expense elevated +18% YoY." },
];

function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileType(name) {
  const lower = name.toLowerCase();
  if (lower.includes("rent") || lower.includes("roll")) return "Rent Roll";
  if (lower.includes("insurance") || lower.includes("policy")) return "Insurance";
  if (lower.includes("inspect")) return "Inspection";
  if (lower.includes("financial") || lower.includes("statement") || lower.includes("noi") || lower.includes("income")) return "Financials";
  if (lower.includes("apprais")) return "Appraisal";
  if (lower.includes("environ") || lower.includes("phase")) return "Environmental";
  if (lower.includes("lease") || lower.includes("legal") || lower.includes("contract")) return "Legal";
  return "Financials";
}

export default function DocumentsPage() {
  const { session } = useContext(AuthContext);
  const [typeFilter, setTypeFilter] = useState("All");
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [docs, setDocs] = useState(SAMPLE_DOCS);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef();

  const filtered = typeFilter === "All" ? docs : docs.filter((d) => d.type === typeFilter);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);

    for (const file of Array.from(files)) {
      const localDoc = {
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name.replace(/\.[^.]+$/, ""),
        type: fileType(file.name),
        property: "My Properties",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: "Processing",
        size: fileSize(file.size),
        aiSummary: null,
      };
      setDocs((prev) => [localDoc, ...prev]);
      setExpandedDoc(localDoc.id);

      try {
        const token = session?.access_token;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("docType", localDoc.type);

        const res = await fetch(`${API_BASE}/api/ai/analyze-document`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setDocs((prev) =>
            prev.map((d) =>
              d.id === localDoc.id
                ? { ...d, status: "Analyzed", aiSummary: data.summary || data.analysis || "Analysis complete." }
                : d
            )
          );
        } else {
          setDocs((prev) =>
            prev.map((d) =>
              d.id === localDoc.id
                ? { ...d, status: "Reviewed", aiSummary: "Document uploaded. AI analysis unavailable — API not configured." }
                : d
            )
          );
        }
      } catch {
        setDocs((prev) =>
          prev.map((d) =>
            d.id === localDoc.id
              ? { ...d, status: "Reviewed", aiSummary: "Document saved locally. Connect the API to enable AI analysis." }
              : d
          )
        );
      }
    }
    setUploading(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Document Center</h2>
          <p className="text-sm text-gray-500 mt-0.5">{docs.length} documents · Upload for instant AI analysis.</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "#800020" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {uploading ? "Analyzing…" : "Upload Document"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.docx,.xlsx,.csv,.doc,.xls,.txt"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Upload drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
          dragOver ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
        }`}>
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-red-800 rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-700">Uploading and analyzing…</p>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm font-medium text-gray-700">Drop files here or click to upload</p>
            <p className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX, CSV · AI analysis runs automatically</p>
          </>
        )}
      </div>

      {uploadError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{uploadError}</div>
      )}

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
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm font-medium">No {typeFilter === "All" ? "" : typeFilter + " "}documents yet</p>
            <p className="text-xs mt-1">Upload a document to get started</p>
          </div>
        )}
        {filtered.map((doc) => (
          <div key={doc.id}
            className={`bg-white rounded-xl border transition-all cursor-pointer ${expandedDoc === doc.id ? "border-red-200 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
            onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm shrink-0">
                  {doc.type === "Insurance" ? "🛡️" : doc.type === "Inspection" ? "🔍" : doc.type === "Financials" ? "💰" : doc.type === "Rent Roll" ? "📋" : "📄"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-400">{doc.type} · {doc.property} · {doc.date} · {doc.size}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${doc.status === "Processing" ? "animate-pulse" : ""}`}
                  style={{ background: STATUS_COLORS[doc.status] + "18", color: STATUS_COLORS[doc.status] }}>
                  {doc.status === "Processing" && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: STATUS_COLORS[doc.status] }} />}
                  {doc.status}
                </span>
                <svg className={`w-4 h-4 text-gray-300 transition-transform ${expandedDoc === doc.id ? "rotate-90" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            {expandedDoc === doc.id && (
              <div className="px-4 pb-4 border-t border-gray-100">
                <div className="bg-gray-50 rounded-lg p-3 mt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">🤖 AI Summary</p>
                  {doc.aiSummary ? (
                    <p className="text-sm text-gray-700 leading-relaxed">{doc.aiSummary}</p>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                      Analyzing document…
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
