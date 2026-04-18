import { useState, useRef, useCallback, useEffect } from "react";
  import {
    ArrowUpTrayIcon,
    DocumentTextIcon,
    DocumentChartBarIcon,
    PhotoIcon,
    ShieldCheckIcon,
    MagnifyingGlassIcon,
    ArrowDownTrayIcon,
    TrashIcon,
    XMarkIcon,
    FolderOpenIcon,
  } from "@heroicons/react/24/outline";
  import { CheckCircleIcon } from "@heroicons/react/24/solid";
  import { resolveApiBase } from "../../lib/api";

  const API = resolveApiBase();

  type DocType = "all" | "financial_statement" | "rent_roll" | "appraisal" | "insurance" | "draw_request" | "other";

  interface Doc {
    id: string;
    filename: string;
    doc_type: string;
    size_bytes: number;
    mime_type: string;
    loan_id: string | null;
    created_at: string;
  }

  const TYPE_LABELS: Record<string, string> = {
    financial_statement: "Financial Statement",
    rent_roll: "Rent Roll",
    appraisal: "Appraisal",
    insurance: "Insurance",
    draw_request: "Draw Request",
    other: "Other",
  };

  const TYPE_COLORS: Record<string, string> = {
    financial_statement: "bg-blue-100 text-blue-700",
    rent_roll: "bg-emerald-100 text-emerald-700",
    appraisal: "bg-violet-100 text-violet-700",
    insurance: "bg-amber-100 text-amber-700",
    draw_request: "bg-rose-100 text-rose-700",
    other: "bg-slate-100 text-slate-600",
  };

  function DocIcon({ type }: { type: string }) {
    if (type === "financial_statement" || type === "rent_roll") return <DocumentChartBarIcon className="h-5 w-5 text-blue-500" />;
    if (type === "appraisal") return <MagnifyingGlassIcon className="h-5 w-5 text-violet-500" />;
    if (type === "insurance") return <ShieldCheckIcon className="h-5 w-5 text-amber-500" />;
    if (type === "draw_request") return <DocumentTextIcon className="h-5 w-5 text-rose-500" />;
    return <DocumentTextIcon className="h-5 w-5 text-slate-400" />;
  }

  function fmtSize(bytes: number) {
    if (!bytes) return "–";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // ── Upload Modal ─────────────────────────────────────────────────────────────
  function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [docType, setDocType] = useState("other");
    const [loanId, setLoanId] = useState("");
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (f: File) => setFile(f);

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    }, []);

    const handleUpload = async () => {
      if (!file) return;
      setUploading(true);
      setError("");
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("doc_type", docType);
        if (loanId.trim()) form.append("loan_id", loanId.trim());

        const res = await fetch(`${API}/docs/upload`, { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");

        setSuccess(true);
        setTimeout(() => { onUploaded(); onClose(); }, 1200);
      } catch (err: any) {
        setError(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Upload Document</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="h-5 w-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            {/* Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
                dragging ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <input ref={inputRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">{fmtSize(file.size)}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ArrowUpTrayIcon className="h-8 w-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">Drop file here or click to browse</p>
                  <p className="text-xs text-slate-400">PDF, XLSX, DOCX, images — up to 50 MB</p>
                </div>
              )}
            </div>

            {/* Doc Type */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Document Type</label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Loan ID (optional) */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Loan ID <span className="font-normal normal-case text-slate-400">(optional)</span></label>
              <input
                value={loanId}
                onChange={e => setLoanId(e.target.value)}
                placeholder="e.g. 123e4567-e89b..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm font-medium text-emerald-600">Uploaded successfully!</p>}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading || success}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Page ─────────────────────────────────────────────────────────────────
  export default function DocumentVaultPage() {
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<DocType>("all");
    const [search, setSearch] = useState("");
    const [showUpload, setShowUpload] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const fetchDocs = useCallback(async () => {
      setLoading(true);
      try {
        const url = filter === "all" ? `${API}/docs` : `${API}/docs?doc_type=${filter}`;
        const res = await fetch(url);
        const json = await res.json();
        setDocs(Array.isArray(json) ? json : []);
      } catch {
        setDocs([]);
      } finally {
        setLoading(false);
      }
    }, [filter]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    const handleDownload = async (doc: Doc) => {
      setDownloadingId(doc.id);
      try {
        const res = await fetch(`${API}/docs/${doc.id}/download`);
        const { url, filename } = await res.json();
        if (url) {
          const a = document.createElement("a");
          a.href = url;
          a.download = filename || doc.filename;
          a.target = "_blank";
          a.click();
        }
      } catch {}
      finally { setDownloadingId(null); }
    };

    const handleDelete = async (doc: Doc) => {
      if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
      setDeletingId(doc.id);
      try {
        await fetch(`${API}/docs/${doc.id}`, { method: "DELETE" });
        setDocs(prev => prev.filter(d => d.id !== doc.id));
      } catch {}
      finally { setDeletingId(null); }
    };

    const filtered = docs.filter(d =>
      search === "" || d.filename.toLowerCase().includes(search.toLowerCase())
    );

    const tabs: { key: DocType; label: string }[] = [
      { key: "all", label: "All" },
      { key: "financial_statement", label: "Financials" },
      { key: "rent_roll", label: "Rent Rolls" },
      { key: "appraisal", label: "Appraisals" },
      { key: "insurance", label: "Insurance" },
      { key: "draw_request", label: "Draw Requests" },
      { key: "other", label: "Other" },
    ];

    const statCards = [
      { label: "Total Documents", value: docs.length, color: "text-slate-900" },
      { label: "Financial Statements", value: docs.filter(d => d.doc_type === "financial_statement").length, color: "text-blue-600" },
      { label: "Rent Rolls", value: docs.filter(d => d.doc_type === "rent_roll").length, color: "text-emerald-600" },
      { label: "Total Size", value: fmtSize(docs.reduce((s, d) => s + (d.size_bytes || 0), 0)), color: "text-violet-600" },
    ];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Document Vault</h1>
            <p className="mt-1 text-sm text-slate-500">Secure storage for all loan-related documents across your portfolio.</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 transition"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            Upload Document
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {statCards.map(s => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === t.key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >{t.label}</button>
            ))}
          </div>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-slate-400 focus:outline-none w-60"
            />
          </div>
        </div>

        {/* Document List */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading documents…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <FolderOpenIcon className="h-12 w-12 text-slate-200" />
              <p className="font-medium text-slate-500">No documents yet</p>
              <p className="text-sm text-slate-400">Upload the first document using the button above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Uploaded</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Loan ID</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <DocIcon type={doc.doc_type} />
                        <span className="font-medium text-slate-800 truncate max-w-[220px]" title={doc.filename}>{doc.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[doc.doc_type] ?? TYPE_COLORS.other}`}>
                        {TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{fmtSize(doc.size_bytes)}</td>
                    <td className="px-4 py-3.5 text-slate-500">{fmtDate(doc.created_at)}</td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs font-mono">{doc.loan_id ? doc.loan_id.slice(0, 8) + "…" : "–"}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition disabled:opacity-40"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={deletingId === doc.id}
                          className="rounded-lg border border-rose-100 p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-40"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showUpload && (
          <UploadModal onClose={() => setShowUpload(false)} onUploaded={fetchDocs} />
        )}
      </div>
    );
  }
  