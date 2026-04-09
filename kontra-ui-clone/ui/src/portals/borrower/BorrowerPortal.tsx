/**
 * Borrower Portal — Operational, communication-driven interface.
 * Borrowers interact with their loan(s), submit required items, and communicate with the lender.
 * No servicing decisions are made here — all approvals go through the lender execution layer.
 */
import { useState } from "react";
import {
  HomeIcon,
  CreditCardIcon,
  FolderArrowDownIcon,
  WrenchScrewdriverIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PaperClipIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

// ── Demo loan data ─────────────────────────────────────────────
const LOAN = {
  loan_ref: "LN-2847",
  property_name: "The Meridian Apartments",
  property_address: "412 Meridian Blvd, Austin, TX 78701",
  property_type: "Multifamily — 24 units",
  origination_date: "2024-09-15",
  maturity_date: "2026-09-01",
  original_balance: 4_200_000,
  current_balance: 4_112_500,
  interest_rate: "8.75%",
  payment_type: "Interest Only",
  status: "Current",
  next_payment_date: "2026-05-01",
  next_payment_amount: 29_968.75,
  servicer_name: "Kontra Capital Servicing",
  servicer_contact: "servicing@kontraplatform.com",
};

const PAYMENTS = [
  { id:"p1", date:"2026-04-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid" },
  { id:"p2", date:"2026-03-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid" },
  { id:"p3", date:"2026-02-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid" },
  { id:"p4", date:"2026-01-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid" },
  { id:"p5", date:"2025-12-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid" },
];

const DOCUMENTS = [
  { id:"d1", name:"Monthly Operating Statement", due:"2026-04-30", status:"submitted", submitted_at:"2026-04-08", notes:"Under lender review" },
  { id:"d2", name:"Q1 2026 Rent Roll", due:"2026-04-15", status:"approved", submitted_at:"2026-04-10", notes:"" },
  { id:"d3", name:"Property Insurance Renewal", due:"2026-05-15", status:"pending", submitted_at:"", notes:"Policy expires May 31" },
  { id:"d4", name:"Environmental Compliance Certificate", due:"2026-06-01", status:"pending", submitted_at:"", notes:"Annual requirement" },
  { id:"d5", name:"Draw #5 Inspection Documentation", due:"2026-05-01", status:"pending", submitted_at:"", notes:"Required for next draw" },
  { id:"d6", name:"Annual Financial Statements 2025", due:"2026-03-31", status:"approved", submitted_at:"2026-03-28", notes:"" },
];

const DRAWS = [
  { id:"dr1", number:"Draw #4", amount:340000, purpose:"Phase 2 construction — unit renovation (units 13–18)", status:"funded", submitted_at:"2026-03-20", funded_at:"2026-04-01", inspector_approved:true },
  { id:"dr2", number:"Draw #3", amount:280000, purpose:"Phase 1 completion — units 7–12", status:"funded", submitted_at:"2026-02-10", funded_at:"2026-02-25", inspector_approved:true },
  { id:"dr3", number:"Draw #5 (Pending)", amount:310000, purpose:"Phase 3 — units 19–24 + common area upgrades", status:"pending_inspection", submitted_at:"2026-04-05", funded_at:"", inspector_approved:false },
];

const COVENANTS = [
  { id:"c1", name:"Minimum DSCR", requirement:"≥ 1.25x", current_value:"1.42x", status:"passing" },
  { id:"c2", name:"Maximum LTV", requirement:"≤ 75%", current_value:"68.2%", status:"passing" },
  { id:"c3", name:"Debt Service Reserve", requirement:"3 months", current_value:"3 months", status:"passing" },
  { id:"c4", name:"Insurance Coverage", requirement:"Full replacement cost", current_value:"See renewal notice", status:"attention" },
  { id:"c5", name:"Minimum Occupancy", requirement:"≥ 85%", current_value:"91.7%", status:"passing" },
];

const NOTICES = [
  { id:"n1", type:"informational", subject:"Draw #5 Inspection Scheduled", body:"An inspection for Draw #5 has been scheduled for April 22, 2026. Please ensure site access is available. Inspector: TRC Engineering.", date:"2026-04-08", from:"Kontra Servicing" },
  { id:"n2", type:"action_required", subject:"Monthly Operating Statement Due", body:"Your Monthly Operating Statement for March 2026 is due by April 30. Please upload via the Document Center.", date:"2026-04-01", from:"Kontra Servicing" },
  { id:"n3", type:"informational", subject:"Draw #4 Funded — $340,000", body:"Draw #4 in the amount of $340,000 has been funded to your construction account. Please acknowledge receipt.", date:"2026-04-01", from:"Kontra Servicing" },
  { id:"n4", type:"informational", subject:"Q1 2026 Rent Roll Approved", body:"Your Q1 2026 Rent Roll has been reviewed and approved. Occupancy of 91.7% confirmed, exceeding covenant floor of 85%.", date:"2026-04-10", from:"Kontra Servicing" },
];

const MESSAGES = [
  { id:"m1", from:"lender", author:"Maria Chen (Master Servicer)", text:"Hi — I wanted to confirm that Draw #5 inspection is scheduled for April 22. Please have the contractor available on site from 9am–12pm.", ts:"2026-04-08T14:30:00Z" },
  { id:"m2", from:"borrower", author:"You", text:"Confirmed — I'll have our GC, David Park, available. His number is (512) 555-0182.", ts:"2026-04-08T15:45:00Z" },
  { id:"m3", from:"lender", author:"Maria Chen (Master Servicer)", text:"Perfect, thanks. Also, please don't forget the Operating Statement is due April 30.", ts:"2026-04-08T16:00:00Z" },
];

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:2 }).format(n ?? 0);
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";

const DOC_STATUS: Record<string, { label: string; color: string; icon: typeof CheckCircleIcon }> = {
  pending:   { label:"Required",  color:"text-amber-600 bg-amber-50 border border-amber-200", icon: ClockIcon },
  submitted: { label:"Submitted", color:"text-blue-600 bg-blue-50 border border-blue-200",   icon: ClockIcon },
  approved:  { label:"Approved",  color:"text-emerald-600 bg-emerald-50 border border-emerald-200", icon: CheckCircleIcon },
};

const DRAW_STATUS: Record<string, { label: string; color: string }> = {
  funded:             { label:"Funded",              color:"bg-emerald-50 text-emerald-700 border border-emerald-200" },
  pending_inspection: { label:"Awaiting Inspection", color:"bg-amber-50 text-amber-700 border border-amber-200" },
  under_review:       { label:"Under Review",        color:"bg-blue-50 text-blue-700 border border-blue-200" },
  denied:             { label:"Denied",              color:"bg-brand-50 text-brand-700 border border-brand-200" },
};

const COVENANT_STATUS: Record<string, string> = {
  passing:   "text-emerald-600 bg-emerald-50 border border-emerald-200",
  attention: "text-amber-600 bg-amber-50 border border-amber-200",
  breach:    "text-brand-600 bg-brand-50 border border-brand-200",
};

type Section = "myloans" | "payments" | "documents" | "draws" | "notices" | "messages";

const NAV: { key: Section; label: string; icon: typeof HomeIcon; badge?: number }[] = [
  { key:"myloans",   label:"My Loan",         icon: HomeIcon },
  { key:"payments",  label:"Payments",         icon: CreditCardIcon },
  { key:"documents", label:"Document Center",  icon: FolderArrowDownIcon, badge: DOCUMENTS.filter((d) => d.status === "pending").length },
  { key:"draws",     label:"Draw Requests",    icon: WrenchScrewdriverIcon },
  { key:"notices",   label:"Notices",          icon: BellIcon, badge: NOTICES.filter((n) => n.type === "action_required").length },
  { key:"messages",  label:"Messages",         icon: ChatBubbleLeftRightIcon },
];

export default function BorrowerPortal() {
  const [section, setSection] = useState<Section>("myloans");
  const [message, setMessage] = useState("");
  const [localMessages, setLocalMessages] = useState(MESSAGES);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [newDrawOpen, setNewDrawOpen] = useState(false);
  const [drawForm, setDrawForm] = useState({ amount:"", purpose:"", milestone:"" });

  const pendingDocs = DOCUMENTS.filter((d) => d.status === "pending").length;

  const sendMessage = () => {
    if (!message.trim()) return;
    setLocalMessages((m) => [...m, { id:`m${m.length+1}`, from:"borrower", author:"You", text:message.trim(), ts:new Date().toISOString() }]);
    setMessage("");
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-slate-50">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-black text-white text-sm">K</div>
          <div>
            <p className="text-sm font-bold text-slate-900">Kontra</p>
            <p className="text-xs text-slate-500 font-medium">Borrower Portal</p>
          </div>
        </div>

        {/* Loan card */}
        <div className="mx-4 mt-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Active Loan</p>
          <p className="mt-1 text-sm font-black text-slate-900">{LOAN.loan_ref}</p>
          <p className="text-xs text-slate-500 truncate">{LOAN.property_name}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="text-xs font-semibold text-emerald-700">{LOAN.status}</p>
          </div>
        </div>

        {/* Next payment callout */}
        <div className="mx-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Next Payment</p>
          <p className="mt-0.5 text-base font-black text-amber-900">{fmt(LOAN.next_payment_amount)}</p>
          <p className="text-xs text-amber-600">Due {fmtDate(LOAN.next_payment_date)}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                  active
                    ? "bg-slate-900 text-white font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4">
          <p className="text-xs text-slate-400">Questions? Contact your servicer:</p>
          <p className="text-xs font-medium text-slate-700 mt-0.5">{LOAN.servicer_contact}</p>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">

          {/* ── MY LOAN ── */}
          {section === "myloans" && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">My Loan</p>
                <h1 className="text-2xl font-black text-slate-900 mt-1">{LOAN.property_name}</h1>
                <p className="text-sm text-slate-500">{LOAN.property_address}</p>
              </div>

              {/* Loan details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label:"Loan Reference",    value: LOAN.loan_ref },
                  { label:"Current Balance",   value: fmt(LOAN.current_balance) },
                  { label:"Interest Rate",     value: LOAN.interest_rate },
                  { label:"Payment Type",      value: LOAN.payment_type },
                  { label:"Maturity Date",     value: fmtDate(LOAN.maturity_date) },
                  { label:"Servicer",          value: LOAN.servicer_name },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Covenants */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h2 className="text-base font-bold text-slate-900">Covenant Tracker</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Your current covenant compliance status</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {COVENANTS.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-500">Required: {c.requirement}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-700 tabular-nums">{c.current_value}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${COVENANT_STATUS[c.status]}`}>
                          {c.status === "passing" ? "OK" : c.status === "attention" ? "Review Pending" : "Breach"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending action items */}
              {pendingDocs > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-900">Action Required: {pendingDocs} document{pendingDocs > 1 ? "s" : ""} overdue or upcoming</p>
                      <p className="text-xs text-amber-700 mt-1">Please upload required documents to avoid covenant cure periods. Go to Document Center.</p>
                      <button onClick={() => setSection("documents")} className="mt-2 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800 transition-colors">
                        Go to Document Center
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {section === "payments" && (
            <div className="space-y-6">
              <h1 className="text-2xl font-black text-slate-900">Payment History</h1>

              {/* Upcoming */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Next Payment Due</p>
                    <p className="text-2xl font-black text-white mt-1">{fmt(LOAN.next_payment_amount)}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{fmtDate(LOAN.next_payment_date)} · Interest Only</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Wire instructions sent to file on record</p>
                    <p className="text-xs text-slate-500 mt-1">Ref: {LOAN.loan_ref}-{LOAN.next_payment_date.slice(0,7)}</p>
                    <button className="mt-3 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">
                      Download Wire Instructions
                    </button>
                  </div>
                </div>
                <div className="px-6 py-3 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-700">Last 5 payments received on time — no late fees assessed</p>
                </div>
              </div>

              {/* Payment history table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h2 className="text-base font-bold text-slate-900">Payment History</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {["Date","Amount","Interest","Principal","Late Fee","Status"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {PAYMENTS.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-slate-900 font-semibold">{fmtDate(p.date)}</td>
                        <td className="px-5 py-3 text-slate-900 font-bold tabular-nums">{fmt(p.amount)}</td>
                        <td className="px-5 py-3 text-slate-700 tabular-nums">{fmt(p.interest)}</td>
                        <td className="px-5 py-3 text-slate-500 tabular-nums">{p.principal === 0 ? "—" : fmt(p.principal)}</td>
                        <td className="px-5 py-3 text-slate-500 tabular-nums">{p.late_fee === 0 ? "—" : fmt(p.late_fee)}</td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">Paid</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {section === "documents" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900">Document Center</h1>
                <p className="text-sm text-slate-500 mt-1">Upload required documents for your servicer's review. Approved items are automatically recorded.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Required Documents</h2>
                  <span className="text-xs text-slate-400">{DOCUMENTS.filter((d) => d.status === "approved").length}/{DOCUMENTS.length} complete</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {DOCUMENTS.map((doc) => {
                    const s = DOC_STATUS[doc.status];
                    const Icon = s.icon;
                    return (
                      <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${doc.status === "approved" ? "bg-emerald-100" : doc.status === "submitted" ? "bg-blue-100" : "bg-amber-100"}`}>
                          <Icon className={`h-4 w-4 ${doc.status === "approved" ? "text-emerald-600" : doc.status === "submitted" ? "text-blue-600" : "text-amber-600"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{doc.name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-xs text-slate-500">Due: {fmtDate(doc.due)}</p>
                            {doc.notes && <p className="text-xs text-slate-400">· {doc.notes}</p>}
                            {doc.submitted_at && <p className="text-xs text-slate-400">· Submitted {fmtDate(doc.submitted_at)}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.color}`}>{s.label}</span>
                          {doc.status === "pending" && (
                            <button
                              onClick={() => setUploadingDoc(doc.id === uploadingDoc ? null : doc.id)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                            >
                              <ArrowUpTrayIcon className="h-3.5 w-3.5" />
                              Upload
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upload area (shown when a doc is selected) */}
              {uploadingDoc && (
                <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <ArrowUpTrayIcon className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Drag & drop your file here, or click to browse</p>
                  <p className="text-xs text-slate-500 mt-1">PDF, Excel, or image files · Max 25 MB</p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors">
                      Choose File
                    </button>
                    <button onClick={() => setUploadingDoc(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                      Cancel
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    Once submitted, your document will route to your servicer for review. You'll receive a notice when it's approved.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── DRAWS ── */}
          {section === "draws" && (
            <div className="space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Draw Requests</h1>
                  <p className="text-sm text-slate-500 mt-1">Submit and track construction or renovation draws. Each draw requires inspection approval before funding.</p>
                </div>
                <button onClick={() => setNewDrawOpen(!newDrawOpen)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors">
                  + New Draw Request
                </button>
              </div>

              {/* New draw form */}
              {newDrawOpen && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 space-y-4">
                  <p className="text-sm font-bold text-slate-900">New Draw Request — {LOAN.loan_ref}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Draw Amount ($)</label>
                      <input
                        type="number" value={drawForm.amount}
                        onChange={(e) => setDrawForm((f) => ({ ...f, amount:e.target.value }))}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Milestone / Phase</label>
                      <input
                        type="text" value={drawForm.milestone}
                        onChange={(e) => setDrawForm((f) => ({ ...f, milestone:e.target.value }))}
                        placeholder="e.g. Phase 3 — Units 19-24"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Purpose / Description</label>
                      <textarea
                        value={drawForm.purpose}
                        onChange={(e) => setDrawForm((f) => ({ ...f, purpose:e.target.value }))}
                        rows={2}
                        placeholder="Describe what the draw will fund..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors">
                      Submit Draw Request
                    </button>
                    <button onClick={() => setNewDrawOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">Draw requests require inspection documentation and lender approval before funding. You'll receive a notice when the inspection is scheduled.</p>
                </div>
              )}

              {/* Draw history */}
              <div className="space-y-4">
                {DRAWS.map((d) => {
                  const s = DRAW_STATUS[d.status] ?? DRAW_STATUS.under_review;
                  return (
                    <div key={d.id} className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="text-base font-black text-slate-900">{d.number}</p>
                          <p className="text-sm text-slate-600 mt-0.5">{d.purpose}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-slate-900">{fmt(d.amount)}</p>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.color}`}>{s.label}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span>Submitted: {fmtDate(d.submitted_at)}</span>
                        {d.funded_at && <span>Funded: {fmtDate(d.funded_at)}</span>}
                        <span className={`flex items-center gap-1 ${d.inspector_approved ? "text-emerald-600" : "text-amber-600"}`}>
                          {d.inspector_approved
                            ? <><CheckCircleIcon className="h-3.5 w-3.5" /> Inspector approved</>
                            : <><ClockIcon className="h-3.5 w-3.5" /> Inspection pending</>
                          }
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── NOTICES ── */}
          {section === "notices" && (
            <div className="space-y-6">
              <h1 className="text-2xl font-black text-slate-900">Notices</h1>
              <div className="space-y-4">
                {NOTICES.map((n) => (
                  <div key={n.id} className={`rounded-xl border p-5 ${n.type === "action_required" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white shadow-sm"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${n.type === "action_required" ? "bg-amber-200" : "bg-slate-100"}`}>
                        {n.type === "action_required"
                          ? <ExclamationTriangleIcon className="h-4 w-4 text-amber-700" />
                          : <DocumentTextIcon className="h-4 w-4 text-slate-500" />
                        }
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {n.type === "action_required" && (
                            <span className="rounded-full bg-amber-700 px-2 py-0.5 text-xs font-black text-white uppercase tracking-wide">Action Required</span>
                          )}
                          <span className="text-xs text-slate-500">{fmtDate(n.date)} · From {n.from}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{n.subject}</p>
                        <p className="text-sm text-slate-600 mt-1">{n.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── MESSAGES ── */}
          {section === "messages" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900">Messages</h1>
                <p className="text-sm text-slate-500 mt-1">Direct communication with your servicing team</p>
              </div>

              {/* Thread */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4 bg-slate-50 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold">KS</div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Kontra Servicing Team</p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <p className="text-xs text-emerald-600 font-medium">Online · Usually responds within 1 business day</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 space-y-4 min-h-64">
                  {localMessages.map((m) => (
                    <div key={m.id} className={`flex ${m.from === "borrower" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-3 ${m.from === "borrower" ? "bg-slate-900 text-white rounded-tr-sm" : "bg-slate-100 text-slate-900 rounded-tl-sm"}`}>
                        <p className={`text-xs font-semibold mb-1 ${m.from === "borrower" ? "text-slate-400" : "text-slate-500"}`}>{m.author}</p>
                        <p className="text-sm">{m.text}</p>
                        <p className={`text-xs mt-1 ${m.from === "borrower" ? "text-slate-500" : "text-slate-400"}`}>
                          {new Date(m.ts).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 px-4 py-3 flex items-end gap-3">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message to your servicing team..."
                    rows={2}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  >
                    Send
                  </button>
                </div>
                <p className="px-6 pb-3 text-xs text-slate-400">Messages are logged to the servicing audit trail. For urgent matters, call {LOAN.servicer_contact}.</p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
