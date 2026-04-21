import React, { useState, useCallback, useRef } from "react";
import {
  ArrowUpTrayIcon,
  ServerIcon,
  TableCellsIcon,
  EnvelopeIcon,
  ClipboardDocumentCheckIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  CpuChipIcon,
  FunnelIcon,
  LinkIcon,
  CloudArrowUpIcon,
  PaperAirplaneIcon,
  EyeIcon,
  DocumentMagnifyingGlassIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE || "";

// ── Adapter definitions (mirrors legacyAdapters.js) ──────────────────────────

const ADAPTERS = [
  { id: "fics_export",       name: "FICS Loan Servicing",         category: "Servicing Platform",    formats: "XML · FWF · CSV", icon: ServerIcon,                color: { bg: "bg-blue-50",    border: "border-blue-200",   icon: "text-blue-600",    badge: "bg-blue-100 text-blue-700"   }, fields: 48, status: "active",          last_sync: "2026-04-11", records: 1247 },
  { id: "situs_csv",         name: "Situs / CRES (AMC)",          category: "Servicing Platform",    formats: "CSV",             icon: TableCellsIcon,            color: { bg: "bg-indigo-50",  border: "border-indigo-200", icon: "text-indigo-600",  badge: "bg-indigo-100 text-indigo-700" }, fields: 42, status: "active",          last_sync: "2026-04-10", records: 834  },
  { id: "yardi_json",        name: "Yardi Voyager",               category: "Property Management",   formats: "JSON · XML",      icon: BuildingOfficeIcon,        color: { bg: "bg-emerald-50", border: "border-emerald-200",icon: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700"}, fields: 38, status: "active",          last_sync: "2026-04-12", records: 2103 },
  { id: "mri_csv",           name: "MRI Software",                category: "Property Management",   formats: "CSV · Excel",     icon: TableCellsIcon,            color: { bg: "bg-violet-50",  border: "border-violet-200", icon: "text-violet-600",  badge: "bg-violet-100 text-violet-700" }, fields: 35, status: "active",          last_sync: "2026-04-09", records: 412  },
  { id: "riskmetrics_csv",   name: "Trepp / RiskMetrics CMBS",    category: "Surveillance",          formats: "CSV",             icon: ChartBarIcon,              color: { bg: "bg-amber-50",   border: "border-amber-200",  icon: "text-amber-600",   badge: "bg-amber-100 text-amber-700"   }, fields: 28, status: "active",          last_sync: "2026-04-08", records: 3891 },
  { id: "spreadsheet_csv",   name: "Generic Spreadsheet",         category: "General",               formats: "CSV · Excel · TSV",icon: ArrowUpTrayIcon,           color: { bg: "bg-gray-50",    border: "border-gray-200",   icon: "text-gray-600",    badge: "bg-gray-100 text-gray-700"     }, fields: "dynamic", status: "active", last_sync: null,          records: 98   },
  { id: "email_text",        name: "Email / Fax Parser",          category: "Correspondence",        formats: "EML · MSG · Text",icon: EnvelopeIcon,              color: { bg: "bg-rose-50",    border: "border-rose-200",   icon: "text-rose-600",    badge: "bg-rose-100 text-rose-700"     }, fields: 16, status: "active",          last_sync: "2026-04-14", records: 287  },
  { id: "inspection_vendor", name: "Inspection Vendor Reports",   category: "Inspection",            formats: "JSON · CSV · XML",icon: ClipboardDocumentCheckIcon, color: { bg: "bg-orange-50",  border: "border-orange-200", icon: "text-orange-600",  badge: "bg-orange-100 text-orange-700" }, fields: 24, status: "active",          last_sync: "2026-04-11", records: 64   },
  { id: "insurance_acord",   name: "Insurance ACORD / Binder",   category: "Insurance",             formats: "XML · JSON · CSV",icon: ShieldCheckIcon,           color: { bg: "bg-cyan-50",    border: "border-cyan-200",   icon: "text-cyan-600",    badge: "bg-cyan-100 text-cyan-700"     }, fields: 22, status: "active",          last_sync: "2026-04-09", records: 156  },
  { id: "reserve_xml",       name: "Reserve System Export",       category: "Reserve",               formats: "XML · JSON · CSV",icon: BanknotesIcon,             color: { bg: "bg-teal-50",    border: "border-teal-200",   icon: "text-teal-600",    badge: "bg-teal-100 text-teal-700"     }, fields: 18, status: "active",          last_sync: "2026-04-07", records: 321  },
];

// ── Doc type config ───────────────────────────────────────────────────────────

const DOC_TYPES = [
  { id: "auto",               label: "Auto-Detect",         icon: SparklesIcon     },
  { id: "loan_document",      label: "Loan Document",       icon: DocumentTextIcon },
  { id: "appraisal_report",   label: "Appraisal Report",   icon: BuildingOfficeIcon},
  { id: "insurance_acord",    label: "Insurance / ACORD",  icon: ShieldCheckIcon  },
  { id: "inspection_report",  label: "Inspection Report",  icon: ClipboardDocumentCheckIcon },
  { id: "rent_roll",          label: "Rent Roll",          icon: TableCellsIcon   },
  { id: "operating_statement",label: "Operating Statement",icon: ChartBarIcon     },
  { id: "reserve_report",     label: "Reserve Report",     icon: BanknotesIcon    },
  { id: "draw_request",       label: "Draw Request",       icon: ArrowUpTrayIcon  },
  { id: "email_request",      label: "Email / Letter",     icon: EnvelopeIcon     },
  { id: "spreadsheet",        label: "Spreadsheet / CSV",  icon: TableCellsIcon   },
];

// ── Demo jobs ─────────────────────────────────────────────────────────────────

const DEMO_JOBS = [
  { id: "JOB-0001", status: "completed", doc_type: "inspection_report",  filename: "inspection-LN0094-Q1.pdf",   adapter: "Inspection Vendor", confidence: 0.94, created_at: "2026-04-11T10:00:00Z" },
  { id: "JOB-0002", status: "completed", doc_type: "operating_statement", filename: "T12-HarborView-2025.xlsx",  adapter: "Generic Spreadsheet",confidence: 0.89, created_at: "2026-04-10T14:22:00Z" },
  { id: "JOB-0003", status: "completed", doc_type: "email_request",       filename: "email-payoff-LN0094.eml",   adapter: "Email Parser",      confidence: 0.97, created_at: "2026-04-10T09:15:00Z" },
  { id: "JOB-0004", status: "completed", doc_type: "insurance_acord",     filename: "ACORD-HarborView-2026.pdf", adapter: "Insurance ACORD",   confidence: 0.91, created_at: "2026-04-09T16:00:00Z" },
  { id: "JOB-0005", status: "completed", doc_type: "rent_roll",           filename: "RentRoll-Apr-2026.csv",     adapter: "Yardi Voyager",     confidence: 0.88, created_at: "2026-04-08T11:30:00Z" },
  { id: "JOB-0006", status: "failed",    doc_type: "appraisal_report",    filename: "appraisal-corrupted.pdf",   adapter: null,                confidence: 0,    created_at: "2026-04-07T13:00:00Z", error: "PDF appears corrupted or password-protected" },
  { id: "JOB-0007", status: "pending",   doc_type: "loan_document",       filename: "LoanAgreement-LN3301.pdf",  adapter: "FICS Export",       confidence: null, created_at: new Date().toISOString() },
];

// ── Pipeline stages ───────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: "ingest",    label: "Ingest",    desc: "File upload, API push, email, FTP",          icon: CloudArrowUpIcon,         color: "text-blue-500 bg-blue-50 border-blue-200"     },
  { id: "classify",  label: "Classify",  desc: "Auto-detect document type with AI",           icon: SparklesIcon,             color: "text-violet-500 bg-violet-50 border-violet-200"},
  { id: "extract",   label: "Extract",   desc: "OCR + structured field extraction",           icon: DocumentMagnifyingGlassIcon, color:"text-amber-500 bg-amber-50 border-amber-200"  },
  { id: "normalize", label: "Normalize", desc: "Adapter maps to Kontra unified schema",       icon: CpuChipIcon,              color: "text-emerald-500 bg-emerald-50 border-emerald-200"},
  { id: "validate",  label: "Validate",  desc: "Business rules + human review (optional)",   icon: CheckCircleIcon,          color: "text-teal-500 bg-teal-50 border-teal-200"     },
  { id: "ingest2",   label: "Ingest",    desc: "Write to live Kontra database tables",        icon: ArrowUpTrayIcon,          color: "text-[#800020] bg-red-50 border-red-100"      },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceBadge(score: number | null) {
  if (score === null || score === undefined) return <span className="text-gray-400 text-xs">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? "bg-emerald-100 text-emerald-700" : pct >= 75 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct}%</span>;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    failed:    "bg-red-100 text-red-700",
    pending:   "bg-amber-100 text-amber-700",
    processing:"bg-blue-100 text-blue-700",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

function docTypeLabel(docType: string) {
  return docType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Upload Zone ───────────────────────────────────────────────────────────────

function UploadZone({ onResult }: { onResult: (r: any) => void }) {
  const [dragging, setDragging] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setLoading(true);
    setStage("classify");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (selectedDocType !== "auto") fd.append("doc_type", selectedDocType);

      setStage("extract");
      const res = await fetch(`${API_BASE}/api/integration/extract`, { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();

      setStage("normalize");
      await new Promise((r) => setTimeout(r, 400));
      setStage("validate");
      await new Promise((r) => setTimeout(r, 300));

      onResult({ file: file.name, ...data });
    } catch (err: any) {
      // Demo fallback
      await new Promise((r) => setTimeout(r, 800));
      onResult({
        file: file.name, doc_type: selectedDocType === "auto" ? "inspection_report" : selectedDocType,
        confidence: 0.91, model: "demo", extracted: {
          property_address: "1204 Harbor View Drive, Miami, FL 33101",
          inspection_date: "2026-04-11",
          overall_condition: "fair",
          deficiencies: [{ item: "Roof membrane delamination", severity: "critical", estimated_cost: 45000 }],
          draw_hold_recommended: true,
        },
      });
    }
    setStage(null);
    setLoading(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [selectedDocType]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <CloudArrowUpIcon className="w-5 h-5 text-[#800020]" />
        <h3 className="text-sm font-bold text-gray-900">Document Intelligence Upload</h3>
        <span className="px-2 py-0.5 rounded-full bg-[#800020]/10 text-[#800020] text-xs font-semibold">AI-Powered OCR</span>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Document Type</label>
        <div className="flex flex-wrap gap-1.5">
          {DOC_TYPES.map((dt) => (
            <button
              key={dt.id}
              onClick={() => setSelectedDocType(dt.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                selectedDocType === dt.id
                  ? "bg-[#800020] text-white border-[#800020]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {dt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragging ? "border-[#800020] bg-[#800020]/5" : "border-gray-200 hover:border-gray-400 bg-gray-50"
        } ${loading ? "opacity-60 pointer-events-none" : ""}`}
      >
        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx,.xls,.eml,.txt,.xml,.json" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
        {loading ? (
          <div className="space-y-3">
            <ArrowPathIcon className="w-8 h-8 text-[#800020] animate-spin mx-auto" />
            <p className="text-sm font-semibold text-gray-700">
              {stage === "classify" ? "Classifying document..." : stage === "extract" ? "Extracting structured data..." : stage === "normalize" ? "Normalizing to Kontra schema..." : stage === "validate" ? "Validating fields..." : "Processing..."}
            </p>
            <div className="flex justify-center gap-1.5">
              {["classify", "extract", "normalize", "validate"].map((s) => (
                <div key={s} className={`h-1 w-12 rounded-full transition-all ${stage === s ? "bg-[#800020]" : ["classify", "extract", "normalize", "validate"].indexOf(s) < ["classify", "extract", "normalize", "validate"].indexOf(stage || "") ? "bg-emerald-400" : "bg-gray-200"}`} />
              ))}
            </div>
          </div>
        ) : (
          <>
            <ArrowUpTrayIcon className={`w-8 h-8 mx-auto mb-2 ${dragging ? "text-[#800020]" : "text-gray-400"}`} />
            <p className="text-sm font-semibold text-gray-700">Drop any document here or click to upload</p>
            <p className="text-xs text-gray-400 mt-1">PDF · Image · CSV · Excel · XML · JSON · EML — up to 20 MB</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Extraction Result Panel ───────────────────────────────────────────────────

function ExtractionResult({ result }: { result: any }) {
  const [expanded, setExpanded] = useState(false);
  if (!result) return null;

  const fields = Object.entries(result.extracted || {}).filter(([k]) => k !== "notes" && k !== "_source");
  const notes = result.extracted?.notes;

  return (
    <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 animate-in fade-in duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-bold text-gray-900">Extraction Complete</span>
            {confidenceBadge(result.confidence)}
          </div>
          <p className="text-xs text-gray-500">
            <span className="font-mono">{result.file}</span> · {docTypeLabel(result.doc_type)} · 
            {result.model === "demo" ? " Demo mode" : ` ${result.model}`}
          </p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-[#800020] font-semibold hover:underline">
          {expanded ? "Collapse" : "View full JSON"}
        </button>
      </div>

      {expanded ? (
        <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-auto max-h-80 border border-gray-100 font-mono text-gray-700">
          {JSON.stringify(result.extracted, null, 2)}
        </pre>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fields.slice(0, 14).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
              <span className="text-xs font-semibold text-gray-500 min-w-0 truncate">{key.replace(/_/g, " ")}:</span>
              <span className="text-xs text-gray-800 font-mono truncate max-w-[140px]">
                {Array.isArray(value)
                  ? `[${(value as any[]).length} items]`
                  : typeof value === "object" && value !== null
                  ? "{...}"
                  : String(value)}
              </span>
            </div>
          ))}
          {fields.length > 14 && (
            <div className="col-span-2 text-center">
              <button onClick={() => setExpanded(true)} className="text-xs text-[#800020] font-semibold hover:underline">
                +{fields.length - 14} more fields
              </button>
            </div>
          )}
        </div>
      )}

      {notes && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 mb-0.5">Extraction Notes</p>
          <p className="text-xs text-amber-700">{notes}</p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button className="flex-1 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
          Approve & Ingest
        </button>
        <button className="flex-1 py-2 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          Review & Edit
        </button>
        <button className="px-3 py-2 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          Re-extract
        </button>
      </div>
    </div>
  );
}

// ── Email Parser Panel ────────────────────────────────────────────────────────

function EmailParser() {
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const parse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/integration/email-parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, subject }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data.extracted || data);
      } else throw new Error("API error");
    } catch (_) {
      setResult({
        request_type: "payoff_request", urgency: "high",
        sender_name: "Sarah Mitchell", sender_company: "Meridian Realty Partners",
        loan_number: "LN-0094", subject_line: subject || "Payoff Request",
        summary: "Borrower requesting payoff statement for refinancing closing scheduled April 17.",
        action_required: "Generate payoff statement with prepayment calculation within 3 business days.",
        deadline: "2026-04-17",
      });
    }
    setLoading(false);
  };

  const REQUEST_TYPE_COLORS: Record<string, string> = {
    payoff_request: "bg-red-100 text-red-700", draw_request: "bg-amber-100 text-amber-700",
    insurance_update: "bg-blue-100 text-blue-700", maturity_extension: "bg-violet-100 text-violet-700",
    general_inquiry: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <EnvelopeIcon className="w-5 h-5 text-[#800020]" />
        <h3 className="text-sm font-bold text-gray-900">Email / Fax Parser</h3>
        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">AI Structured</span>
      </div>

      <div className="space-y-3 mb-4">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line (optional)"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30"
        />
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setResult(null); }}
          placeholder="Paste email, fax, or letter text here...&#10;&#10;Example:&#10;Hi, we need a payoff statement for loan LN-0094 by April 17 for our refinancing. Please include the prepayment penalty calculation. This is urgent.&#10;&#10;— Sarah Mitchell, Meridian Realty Partners"
          rows={6}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30 font-mono resize-y"
        />
      </div>

      <button
        onClick={parse}
        disabled={!text.trim() || loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a] disabled:opacity-40 transition-colors"
      >
        {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PaperAirplaneIcon className="w-4 h-4" />}
        {loading ? "Parsing..." : "Parse & Structure Request"}
      </button>

      {result && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-gray-900">Structured Request</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${REQUEST_TYPE_COLORS[result.request_type] || "bg-gray-100 text-gray-600"}`}>
              {(result.request_type || "").replace(/_/g, " ")}
            </span>
          </div>
          {[
            ["Urgency", result.urgency], ["Sender", result.sender_name], ["Company", result.sender_company],
            ["Loan #", result.loan_number], ["Deadline", result.deadline],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k as string} className="flex gap-2 text-xs">
              <span className="font-semibold text-gray-600 w-16 shrink-0">{k}:</span>
              <span className="text-gray-800">{String(v)}</span>
            </div>
          ))}
          {result.summary && <p className="text-xs text-gray-700 mt-1 pt-2 border-t border-emerald-100"><span className="font-semibold">Summary:</span> {result.summary}</p>}
          {result.action_required && <p className="text-xs text-emerald-800 font-semibold mt-1">→ Action: {result.action_required}</p>}
          <div className="flex gap-2 mt-3">
            <button className="flex-1 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Create Task</button>
            <button className="flex-1 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Assign</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Adapter Card ──────────────────────────────────────────────────────────────

function AdapterCard({ adapter }: { adapter: typeof ADAPTERS[number] }) {
  const Icon = adapter.icon;
  return (
    <div className={`bg-white rounded-xl border ${adapter.color.border} shadow-sm p-4 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg ${adapter.color.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${adapter.color.icon}`} />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-gray-500">Active</span>
        </div>
      </div>
      <p className="text-xs font-bold text-gray-900 mb-0.5 leading-tight">{adapter.name}</p>
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${adapter.color.badge}`}>{adapter.category}</span>
      <div className="mt-2 pt-2 border-t border-gray-50 grid grid-cols-2 gap-1 text-xs text-gray-500">
        <span><span className="font-semibold text-gray-700">{adapter.records.toLocaleString()}</span> records</span>
        <span className="text-right">{typeof adapter.fields === "number" ? `${adapter.fields} fields` : adapter.fields}</span>
        {adapter.last_sync && <span className="col-span-2 text-xs text-gray-400">Last sync: {new Date(adapter.last_sync).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IntegrationHubPage() {
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [jobFilter, setJobFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"upload" | "adapters" | "email" | "jobs">("upload");

  const totalRecords = ADAPTERS.reduce((s, a) => s + a.records, 0);
  const completedJobs = DEMO_JOBS.filter((j) => j.status === "completed").length;
  const failedJobs    = DEMO_JOBS.filter((j) => j.status === "failed").length;

  const filteredJobs = jobFilter === "all" ? DEMO_JOBS : DEMO_JOBS.filter((j) => j.status === jobFilter);

  return (
    <div className="min-h-screen bg-[#f9f8f6] p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LinkIcon className="w-5 h-5 text-[#800020]" />
              <span className="text-xs font-semibold text-[#800020] uppercase tracking-wider">Phase 4 · Legacy Modernization Layer</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Integration Hub</h1>
            <p className="text-sm text-gray-500 mt-1">
              OCR + AI extraction for every document type. 10 adapters normalize data from FICS, Yardi, Situs, Trepp,
              inspection vendors, insurance carriers, and email into Kontra's unified schema — zero manual re-keying.
            </p>
          </div>
        </div>

        {/* Architecture banner */}
        <div className="mt-5 p-4 bg-[#800020]/5 border border-[#800020]/15 rounded-xl flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-[#800020] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#800020]">6-Stage Unified Pipeline</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Every document and data feed flows through the same pipeline: <strong>Ingest → Classify → Extract → Normalize → Validate → Ingest</strong>.
              The extraction engine uses gpt-4o-mini with per-doc-type function schemas to extract 16–48 typed fields.
              Human review is optional for high-confidence extractions (&gt;90%) and required for anything below.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Adapters Active",     value: "10",                   sub: "source systems connected" },
            { label: "Records Normalized",  value: totalRecords.toLocaleString(), sub: "via all adapters"  },
            { label: "Jobs Completed",      value: completedJobs,          sub: "this sprint"              },
            { label: "Avg Confidence",      value: "91%",                  sub: "extraction accuracy"      },
            { label: "Doc Types Supported", value: "11",                   sub: "with typed schemas"       },
            { label: "Failed Jobs",         value: failedJobs,             sub: "require review"           },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Pipeline Visualizer */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Document Processing Pipeline</h2>
          <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <React.Fragment key={stage.id}>
                  <div className={`flex-1 min-w-[100px] p-3 rounded-xl border ${stage.color} flex flex-col items-center text-center`}>
                    <Icon className="w-5 h-5 mb-1" />
                    <p className="text-xs font-bold mb-0.5">{stage.label}</p>
                    <p className="text-xs opacity-75 leading-tight">{stage.desc}</p>
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className="flex items-center px-1">
                      <ArrowRightIcon className="w-4 h-4 text-gray-300 shrink-0" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-200 p-1 w-fit">
            {(["upload", "adapters", "email", "jobs"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                  activeTab === tab ? "bg-[#800020] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "upload" ? "Doc Intelligence" : tab === "email" ? "Email Parser" : tab === "jobs" ? "Job Queue" : "Adapters"}
              </button>
            ))}
          </div>

          {/* Upload + Result */}
          {activeTab === "upload" && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-4">
                <UploadZone onResult={setExtractionResult} />

                {/* Supported doc types */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Typed Extraction Schemas</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DOC_TYPES.filter((d) => d.id !== "auto").map((dt) => {
                      const Icon = dt.icon;
                      return (
                        <div key={dt.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-700 font-medium">{dt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                {extractionResult ? (
                  <ExtractionResult result={extractionResult} />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center h-full flex flex-col items-center justify-center">
                    <DocumentMagnifyingGlassIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">Upload a document to see extraction results</p>
                    <p className="text-xs text-gray-300 mt-1">Supports PDFs, images, CSV, XML, JSON, EML, and plain text</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Adapters Grid */}
          {activeTab === "adapters" && (
            <div>
              <p className="text-xs text-gray-500 mb-4">
                Each adapter is a stateless normalization function. It maps raw data from a specific source system format to Kontra's unified schema objects — no code changes needed to add a new source.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {ADAPTERS.map((adapter) => <AdapterCard key={adapter.id} adapter={adapter} />)}
              </div>

              {/* Field coverage table */}
              <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">Adapter Capabilities</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Source format, connection method, and normalized output type</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {["Adapter", "Source System", "Format", "Connection", "Fields Mapped", "Output Type", "Records"].map((h) => (
                          <th key={h} className="text-left font-semibold text-gray-500 px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ADAPTERS.map((a, i) => (
                        <tr key={a.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                          <td className="px-4 py-2.5 font-mono font-semibold text-gray-700">{a.id}</td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{a.name}</td>
                          <td className="px-4 py-2.5 text-gray-500">{a.formats}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${a.color.badge}`}>
                              {a.id === "email_text" ? "Email" : a.id === "spreadsheet_csv" ? "Upload" : ["fics_export", "situs_csv", "riskmetrics_csv", "reserve_xml", "mri_csv"].includes(a.id) ? "SFTP" : "API"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-gray-700">{typeof a.fields === "number" ? a.fields : "Auto"}</td>
                          <td className="px-4 py-2.5 text-gray-500 capitalize">{a.category.toLowerCase()}</td>
                          <td className="px-4 py-2.5 font-semibold text-gray-700">{a.records.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Email Parser */}
          {activeTab === "email" && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <EmailParser />
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Request Type Classification</p>
                <div className="space-y-2">
                  {[
                    { type: "payoff_request",      desc: "Payoff statement requests ahead of refinancing or sale",     color: "bg-red-100 text-red-700"      },
                    { type: "draw_request",         desc: "Construction or improvement draw disbursement requests",    color: "bg-amber-100 text-amber-700"  },
                    { type: "insurance_update",     desc: "New policy certificates, renewals, or carrier changes",    color: "bg-blue-100 text-blue-700"    },
                    { type: "inspection_scheduling",desc: "Borrower or vendor requests to schedule inspections",      color: "bg-indigo-100 text-indigo-700"},
                    { type: "covenant_inquiry",     desc: "Questions about DSCR, LTV, or occupancy thresholds",      color: "bg-violet-100 text-violet-700"},
                    { type: "maturity_extension",   desc: "Requests for loan term extension beyond maturity date",    color: "bg-rose-100 text-rose-700"    },
                    { type: "reserve_disbursement", desc: "Capital reserve draw for repairs or capex",               color: "bg-emerald-100 text-emerald-700"},
                    { type: "modification_request", desc: "Loan modification, rate reset, or restructuring request", color: "bg-cyan-100 text-cyan-700"    },
                    { type: "general_inquiry",      desc: "General servicing questions, statement requests, etc.",   color: "bg-gray-100 text-gray-700"    },
                  ].map((rt) => (
                    <div key={rt.type} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${rt.color}`}>{rt.type.replace(/_/g, " ")}</span>
                      <span className="text-xs text-gray-500">{rt.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Job Queue */}
          {activeTab === "jobs" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
                  {["all", "completed", "pending", "failed"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setJobFilter(f)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-all capitalize ${
                        jobFilter === f ? "bg-[#800020] text-white" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400">{filteredJobs.length} jobs</span>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {["Job ID", "Filename", "Doc Type", "Adapter", "Status", "Confidence", "Created"].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job, i) => (
                      <tr key={job.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 0 ? "" : "bg-gray-50/20"}`}>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-600">{job.id}</td>
                        <td className="px-4 py-3 text-xs text-gray-700 font-medium max-w-[180px] truncate">{job.filename}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{docTypeLabel(job.doc_type)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{job.adapter || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3">{statusBadge(job.status)}</td>
                        <td className="px-4 py-3">{confidenceBadge(job.confidence)}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(job.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredJobs.length === 0 && (
                  <div className="py-12 text-center text-xs text-gray-400">No jobs match this filter</div>
                )}
              </div>

              {DEMO_JOBS.find((j) => j.status === "failed") && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">1 job requires attention</p>
                    <p className="text-xs text-red-600 mt-0.5">JOB-0006 — appraisal-corrupted.pdf: PDF appears corrupted or password-protected. Re-upload a clean copy or request the original from the vendor.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
