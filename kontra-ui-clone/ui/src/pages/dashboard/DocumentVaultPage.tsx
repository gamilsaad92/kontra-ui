/**
 * Document Vault — Centralized CRE loan document repository
 * Route: /document-vault (Lender portal)
 *
 * Organizes all loan documents by category:
 * - Origination docs (appraisals, title, environmental)
 * - Ongoing compliance (rent rolls, operating statements, insurance)
 * - Legal files (loan agreements, deeds of trust, modifications)
 * - Inspection reports (draw inspection packages)
 */

import { useState } from "react";
import {
  FolderIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

const CATEGORIES = [
  { id: "all", label: "All Documents", count: 24 },
  { id: "origination", label: "Origination", count: 8 },
  { id: "compliance", label: "Ongoing Compliance", count: 7 },
  { id: "legal", label: "Legal Files", count: 5 },
  { id: "inspections", label: "Inspections", count: 4 },
];

const DOCUMENTS = [
  { id: "d1",  name: "Appraisal Report — 412 Meridian Blvd",       loan: "LN-2847", category: "origination",  date: "2024-09-10", status: "approved",  size: "4.2 MB" },
  { id: "d2",  name: "Phase I Environmental Report",                loan: "LN-2847", category: "origination",  date: "2024-09-08", status: "approved",  size: "2.1 MB" },
  { id: "d3",  name: "Title Commitment — First American",           loan: "LN-2847", category: "origination",  date: "2024-09-12", status: "approved",  size: "0.8 MB" },
  { id: "d4",  name: "Loan Agreement — Signed",                     loan: "LN-2847", category: "legal",        date: "2024-09-15", status: "approved",  size: "1.5 MB" },
  { id: "d5",  name: "Deed of Trust — Recorded",                   loan: "LN-2847", category: "legal",        date: "2024-09-16", status: "approved",  size: "0.6 MB" },
  { id: "d6",  name: "Q1 2026 Rent Roll",                          loan: "LN-2847", category: "compliance",   date: "2026-04-10", status: "approved",  size: "0.3 MB" },
  { id: "d7",  name: "March 2026 Operating Statement",             loan: "LN-2847", category: "compliance",   date: "2026-04-08", status: "review",    size: "0.4 MB" },
  { id: "d8",  name: "Property Insurance — Policy Renewal",        loan: "LN-2847", category: "compliance",   date: "",           status: "missing",   size: "—" },
  { id: "d9",  name: "Draw #4 Inspection Package",                 loan: "LN-2847", category: "inspections",  date: "2026-03-28", status: "approved",  size: "6.8 MB" },
  { id: "d10", name: "Draw #5 Inspection Package",                 loan: "LN-2847", category: "inspections",  date: "",           status: "pending",   size: "—" },
  { id: "d11", name: "Appraisal Report — 789 Harbor View",         loan: "LN-3012", category: "origination",  date: "2025-02-14", status: "approved",  size: "5.1 MB" },
  { id: "d12", name: "Annual Financial Statements 2025",           loan: "LN-3012", category: "compliance",   date: "2026-03-28", status: "approved",  size: "1.2 MB" },
  { id: "d13", name: "Loan Agreement — Signed",                    loan: "LN-3012", category: "legal",        date: "2025-02-20", status: "approved",  size: "1.4 MB" },
  { id: "d14", name: "Guaranty Agreement",                         loan: "LN-3012", category: "legal",        date: "2025-02-20", status: "approved",  size: "0.5 MB" },
  { id: "d15", name: "Q4 2025 Rent Roll",                          loan: "LN-3012", category: "compliance",   date: "2026-01-12", status: "approved",  size: "0.4 MB" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircleIcon }> = {
  approved: { label: "Approved",  color: "text-emerald-600 bg-emerald-50 border border-emerald-200", icon: CheckCircleIcon },
  review:   { label: "In Review", color: "text-blue-600 bg-blue-50 border border-blue-200",           icon: ClockIcon },
  pending:  { label: "Pending",   color: "text-amber-600 bg-amber-50 border border-amber-200",        icon: ClockIcon },
  missing:  { label: "Missing",   color: "text-red-600 bg-red-50 border border-red-200",              icon: ExclamationTriangleIcon },
};

export default function DocumentVaultPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = DOCUMENTS.filter(doc => {
    const matchesCat = activeCategory === "all" || doc.category === activeCategory;
    const matchesSearch = !search.trim() || doc.name.toLowerCase().includes(search.toLowerCase()) || doc.loan.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const missingCount = DOCUMENTS.filter(d => d.status === "missing").length;
  const reviewCount = DOCUMENTS.filter(d => d.status === "review").length;
  const approvedCount = DOCUMENTS.filter(d => d.status === "approved").length;

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Documents", value: DOCUMENTS.length, color: "text-slate-900" },
          { label: "Approved",        value: approvedCount,    color: "text-emerald-600" },
          { label: "Under Review",    value: reviewCount,      color: "text-blue-600" },
          { label: "Missing / Due",   value: missingCount,     color: "text-red-600" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents or loan number…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
          <ArrowUpTrayIcon className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      <div className="flex gap-6">
        {/* Category sidebar */}
        <aside className="hidden w-48 shrink-0 space-y-1 sm:block">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                activeCategory === cat.id
                  ? "bg-slate-900 text-white font-medium"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderIcon className="h-4 w-4" />
                {cat.label}
              </span>
              <span className={`text-xs ${activeCategory === cat.id ? "text-slate-300" : "text-slate-400"}`}>
                {cat.count}
              </span>
            </button>
          ))}
        </aside>

        {/* Document list */}
        <div className="flex-1 space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center">
              <DocumentTextIcon className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">No documents found</p>
            </div>
          ) : (
            filtered.map(doc => {
              const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-slate-300"
                >
                  <DocumentTextIcon className="h-5 w-5 shrink-0 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-400">{doc.loan} · {doc.size} {doc.date ? `· ${new Date(doc.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</p>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
