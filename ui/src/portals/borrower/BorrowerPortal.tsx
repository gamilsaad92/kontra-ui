/**
 * Borrower Portal — dark emerald theme, matching Kontra's role-branded portal system.
 * Lender=burgundy · Servicer=amber · Investor=violet · Borrower=emerald
 *
 * Sections: My Loan · Payments · Covenant Scorecard · Document Center ·
 *           Draw Requests · Token Status · Notices · Messages
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";
import { api } from "../../lib/apiClient";
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
  ArrowRightStartOnRectangleIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  SparklesIcon,
  ShieldCheckIcon,
  CubeTransparentIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_LOAN = {
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

const DEMO_PAYMENTS = [
  { id:"p1", date:"2026-04-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid" },
  { id:"p2", date:"2026-03-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid" },
  { id:"p3", date:"2026-02-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid" },
  { id:"p4", date:"2026-01-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid" },
  { id:"p5", date:"2025-12-01", amount:29968.75, principal:0, interest:29968.75, late_fee:0, status:"paid" },
];

const DEMO_DOCUMENTS = [
  { id:"d1", name:"Monthly Operating Statement", due:"2026-04-30", status:"submitted", submitted_at:"2026-04-08", notes:"Under lender review" },
  { id:"d2", name:"Q1 2026 Rent Roll", due:"2026-04-15", status:"approved", submitted_at:"2026-04-10", notes:"" },
  { id:"d3", name:"Property Insurance Renewal", due:"2026-05-15", status:"pending", submitted_at:"", notes:"Policy expires May 31" },
  { id:"d4", name:"Environmental Compliance Certificate", due:"2026-06-01", status:"pending", submitted_at:"", notes:"Annual requirement" },
  { id:"d5", name:"Draw #5 Inspection Documentation", due:"2026-05-01", status:"pending", submitted_at:"", notes:"Required for next draw" },
  { id:"d6", name:"Annual Financial Statements 2025", due:"2026-03-31", status:"approved", submitted_at:"2026-03-28", notes:"" },
];

const DEMO_DRAWS = [
  { id:"dr1", number:"Draw #4", amount:340000, purpose:"Phase 2 construction — unit renovation (units 13–18)", status:"funded", submitted_at:"2026-03-20", funded_at:"2026-04-01", inspector_approved:true },
  { id:"dr2", number:"Draw #3", amount:280000, purpose:"Phase 1 completion — units 7–12", status:"funded", submitted_at:"2026-02-10", funded_at:"2026-02-25", inspector_approved:true },
  { id:"dr3", number:"Draw #5 (Pending)", amount:310000, purpose:"Phase 3 — units 19–24 + common area upgrades", status:"pending_inspection", submitted_at:"2026-04-05", funded_at:"", inspector_approved:false },
];

const DEMO_COVENANTS = [
  { id:"c1", name:"Minimum DSCR", requirement:"≥ 1.25×", current_value:"1.42×", raw:1.42, floor:1.25, max:2.0, status:"passing", detail:"Net Operating Income / Annual Debt Service. Calculated from your most recent operating statement." },
  { id:"c2", name:"Maximum LTV", requirement:"≤ 75%", current_value:"68.2%", raw:68.2, floor:0, max:75, status:"passing", detail:"Current outstanding balance as a % of appraised property value." },
  { id:"c3", name:"Debt Service Reserve", requirement:"3 months", current_value:"3 months funded", raw:3, floor:0, max:3, status:"passing", detail:"Escrow account covering 3 months of debt service payments. Fully funded." },
  { id:"c4", name:"Insurance Coverage", requirement:"Full replacement cost", current_value:"Review pending", raw:0, floor:0, max:1, status:"attention", detail:"Property insurance policy renewal is due May 31, 2026. Please upload the renewal certificate." },
  { id:"c5", name:"Minimum Occupancy", requirement:"≥ 85%", current_value:"91.7%", raw:91.7, floor:85, max:100, status:"passing", detail:"Physical occupancy confirmed from Q1 2026 rent roll. 22 of 24 units occupied." },
];

const DEMO_NOTICES = [
  { id:"n1", type:"action_required", subject:"Draw #5 Inspection Scheduled", body:"An inspection for Draw #5 has been scheduled for April 22, 2026. Please ensure site access is available. Inspector: TRC Engineering.", date:"2026-04-08", from:"Kontra Servicing" },
  { id:"n2", type:"action_required", subject:"Monthly Operating Statement Due", body:"Your Monthly Operating Statement for March 2026 is due by April 30. Please upload via the Document Center.", date:"2026-04-01", from:"Kontra Servicing" },
  { id:"n3", type:"informational", subject:"Draw #4 Funded — $340,000", body:"Draw #4 in the amount of $340,000 has been funded to your construction account. Please acknowledge receipt.", date:"2026-04-01", from:"Kontra Servicing" },
  { id:"n4", type:"informational", subject:"Q1 2026 Rent Roll Approved", body:"Your Q1 2026 Rent Roll has been reviewed and approved. Occupancy of 91.7% confirmed, exceeding covenant floor of 85%.", date:"2026-04-10", from:"Kontra Servicing" },
];

const DEMO_MESSAGES = [
  { id:"m1", from:"lender", author:"Maria Chen (Master Servicer)", text:"Hi — I wanted to confirm that Draw #5 inspection is scheduled for April 22. Please have the contractor available on site from 9am–12pm.", ts:"2026-04-08T14:30:00Z" },
  { id:"m2", from:"borrower", author:"You", text:"Confirmed — I'll have our GC, David Park, available. His number is (512) 555-0182.", ts:"2026-04-08T15:45:00Z" },
  { id:"m3", from:"lender", author:"Maria Chen (Master Servicer)", text:"Perfect, thanks. Also, please don't forget the Operating Statement is due April 30.", ts:"2026-04-08T16:00:00Z" },
];

// ── Types ──────────────────────────────────────────────────────────────────────
type LoanData = typeof DEMO_LOAN;
type Payment  = typeof DEMO_PAYMENTS[0];
type Doc      = typeof DEMO_DOCUMENTS[0];
type Draw     = typeof DEMO_DRAWS[0];
type Notice   = typeof DEMO_NOTICES[0];
type Message  = typeof DEMO_MESSAGES[0];

type AiDocResult = {
  doc_type: string; summary: string;
  metrics: { dscr?: number|null; noi?: number|null; occupancy?: number|null; gross_revenue?: number|null; total_expenses?: number|null };
  covenants: { name: string; threshold: string; actual: string; status: string }[];
  risk_flags: string[]; recommendations: string[]; notice?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:2 }).format(n ?? 0);
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";

// ── Status configs ─────────────────────────────────────────────────────────────
const DOC_STATUS: Record<string, { label: string; color: string; icon: typeof CheckCircleIcon }> = {
  pending:   { label:"Required",  color:"text-amber-400 bg-amber-900/40 border border-amber-700/40",    icon: ClockIcon },
  submitted: { label:"Submitted", color:"text-blue-400 bg-blue-900/40 border border-blue-700/40",       icon: ClockIcon },
  approved:  { label:"Approved",  color:"text-emerald-400 bg-emerald-900/40 border border-emerald-700/40", icon: CheckCircleIcon },
};

const DRAW_STATUS: Record<string, { label: string; color: string }> = {
  funded:             { label:"Funded",              color:"bg-emerald-900/50 text-emerald-400 border border-emerald-700/40" },
  pending_inspection: { label:"Awaiting Inspection", color:"bg-amber-900/50 text-amber-400 border border-amber-700/40" },
  under_review:       { label:"Under Review",        color:"bg-blue-900/50 text-blue-400 border border-blue-700/40" },
  denied:             { label:"Denied",              color:"bg-red-900/50 text-red-400 border border-red-700/40" },
};

type Section = "myloans" | "payments" | "covenants" | "documents" | "draws" | "tokenization" | "notices" | "messages";

const NAV_KEYS: { key: Section; label: string; icon: typeof HomeIcon; highlight?: boolean }[] = [
  { key:"myloans",       label:"My Loan",           icon: HomeIcon },
  { key:"payments",      label:"Payments",           icon: CreditCardIcon },
  { key:"covenants",     label:"Covenant Scorecard", icon: ShieldCheckIcon },
  { key:"documents",     label:"Document Center",    icon: FolderArrowDownIcon },
  { key:"draws",         label:"Draw Requests",      icon: WrenchScrewdriverIcon },
  { key:"tokenization",  label:"Token Status",       icon: CubeTransparentIcon, highlight: true },
  { key:"notices",       label:"Notices",            icon: BellIcon },
  { key:"messages",      label:"Messages",           icon: ChatBubbleLeftRightIcon },
];

// ── Covenant gauge ─────────────────────────────────────────────────────────────
function CovenantGauge({ cov }: { cov: typeof DEMO_COVENANTS[0] }) {
  const isAttention = cov.status === "attention";
  const isBreach    = cov.status === "breach";

  if (cov.id === "c3" || cov.id === "c4") {
    return (
      <div className={`rounded-xl border p-5 ${isBreach ? "border-red-700/50 bg-red-950/30" : isAttention ? "border-amber-700/50 bg-amber-950/30" : "border-emerald-800/40 bg-emerald-950/20"}`}>
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-bold text-white">{cov.name}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${isBreach ? "bg-red-900/60 text-red-400" : isAttention ? "bg-amber-900/60 text-amber-400" : "bg-emerald-900/60 text-emerald-400"}`}>
            {isBreach ? "Breach" : isAttention ? "Attention" : "OK"}
          </span>
        </div>
        <p className={`text-2xl font-black tabular-nums ${isBreach ? "text-red-400" : isAttention ? "text-amber-400" : "text-emerald-400"}`}>{cov.current_value}</p>
        <p className="text-xs text-slate-500 mt-1">Required: {cov.requirement}</p>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{cov.detail}</p>
      </div>
    );
  }

  const pctFill = cov.id === "c2"
    ? Math.min(100, (cov.raw / cov.max) * 100)
    : Math.min(100, ((cov.raw - cov.floor) / (cov.max - cov.floor)) * 100);

  const barColor = isBreach ? "bg-red-500" : isAttention ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className={`rounded-xl border p-5 ${isBreach ? "border-red-700/50 bg-red-950/30" : isAttention ? "border-amber-700/50 bg-amber-950/30" : "border-emerald-800/40 bg-emerald-950/20"}`}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-bold text-white">{cov.name}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${isBreach ? "bg-red-900/60 text-red-400" : isAttention ? "bg-amber-900/60 text-amber-400" : "bg-emerald-900/60 text-emerald-400"}`}>
          {isBreach ? "Breach" : isAttention ? "Attention" : "OK"}
        </span>
      </div>
      <p className={`text-2xl font-black tabular-nums mt-1 ${isBreach ? "text-red-400" : isAttention ? "text-amber-400" : "text-emerald-400"}`}>{cov.current_value}</p>
      <p className="text-xs text-slate-500 mt-0.5">Required: {cov.requirement}</p>
      <div className="mt-3">
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pctFill}%` }} />
        </div>
        {cov.id === "c2" && (
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0%</span><span className="text-amber-500">75% limit</span>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{cov.detail}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BorrowerPortal() {
  const { signOut } = useContext(AuthContext);
  const navigate    = useNavigate();
  const [section, setSection]           = useState<Section>("myloans");
  const [loan, setLoan]                 = useState<LoanData>(DEMO_LOAN);
  const [payments, setPayments]         = useState<Payment[]>(DEMO_PAYMENTS);
  const [documents, setDocuments]       = useState<Doc[]>(DEMO_DOCUMENTS);
  const [draws, setDraws]               = useState<Draw[]>(DEMO_DRAWS);
  const [notices, setNotices]           = useState<Notice[]>(DEMO_NOTICES);
  const [localMessages, setLocalMsgs]   = useState<Message[]>(DEMO_MESSAGES);
  const [message, setMessage]           = useState("");
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [newDrawOpen, setNewDrawOpen]   = useState(false);
  const [drawForm, setDrawForm]         = useState({ amount:"", purpose:"", milestone:"" });
  const [submittingDraw, setSubmittingDraw] = useState(false);
  const [sendingMsg, setSendingMsg]     = useState(false);
  const [expandedCov, setExpandedCov]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiDocResult, setAiDocResult]   = useState<AiDocResult | null>(null);
  const [aiDocLoading, setAiDocLoading] = useState(false);
  const [aiDocName, setAiDocName]       = useState<string>("");

  // ── Load live data ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const [lRes, pRes, dRes, drRes, nRes, mRes] = await Promise.allSettled([
      api.get<{ loan: LoanData }>("/borrower/loan"),
      api.get<{ payments: Payment[] }>("/borrower/payments"),
      api.get<{ documents: Doc[] }>("/borrower/documents"),
      api.get<{ draws: Draw[] }>("/borrower/draws"),
      api.get<{ notices: Notice[] }>("/borrower/notices"),
      api.get<{ messages: Message[] }>("/borrower/messages"),
    ]);
    if (lRes.status  === "fulfilled" && lRes.value.data?.loan)               setLoan(lRes.value.data.loan);
    if (pRes.status  === "fulfilled" && pRes.value.data?.payments?.length)   setPayments(pRes.value.data.payments);
    if (dRes.status  === "fulfilled" && dRes.value.data?.documents?.length)  setDocuments(dRes.value.data.documents);
    if (drRes.status === "fulfilled" && drRes.value.data?.draws?.length)     setDraws(drRes.value.data.draws);
    if (nRes.status  === "fulfilled" && nRes.value.data?.notices?.length)    setNotices(nRes.value.data.notices);
    if (mRes.status  === "fulfilled" && mRes.value.data?.messages?.length)   setLocalMsgs(mRes.value.data.messages);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const pendingDocs   = documents.filter(d => d.status === "pending").length;
  const actionNotices = notices.filter(n => n.type === "action_required").length;
  const attentionCovs = DEMO_COVENANTS.filter(c => c.status !== "passing").length;

  const NAV = NAV_KEYS.map(item => ({
    ...item,
    badge: item.key === "documents" ? (pendingDocs || undefined)
         : item.key === "notices"   ? (actionNotices || undefined)
         : item.key === "covenants" ? (attentionCovs || undefined)
         : undefined,
  }));

  // ── Actions ───────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!message.trim() || sendingMsg) return;
    const text = message.trim();
    setMessage("");
    setSendingMsg(true);
    const optimistic: Message = { id:`m${Date.now()}`, from:"borrower", author:"You", text, ts: new Date().toISOString() };
    setLocalMsgs(m => [...m, optimistic]);
    try { await api.post("/borrower/messages", { text }); } catch { }
    setSendingMsg(false);
  };

  const submitDraw = async () => {
    if (!drawForm.amount || !drawForm.purpose || submittingDraw) return;
    setSubmittingDraw(true);
    try {
      await api.post("/draws", { amount: Number(drawForm.amount), purpose: drawForm.purpose, milestone: drawForm.milestone, loan_ref: loan.loan_ref });
      setDrawForm({ amount:"", purpose:"", milestone:"" });
      setNewDrawOpen(false);
      await load();
    } catch { }
    setSubmittingDraw(false);
  };

  const handleAiAnalyze = async (file: File) => {
    setAiDocLoading(true);
    setAiDocResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<AiDocResult>("/ai/analyze", form);
      if (data) {
        setAiDocResult(data);
        if (uploadingDoc) {
          setDocuments(prev => prev.map(d => d.id === uploadingDoc ? { ...d, status:"submitted", submitted_at: new Date().toISOString().slice(0,10) } : d));
          setUploadingDoc(null);
        }
      }
    } catch {
      setAiDocResult({ doc_type:"Error", summary:"AI analysis unavailable. Document received.", metrics:{}, covenants:[], risk_flags:[], recommendations:[] });
    }
    setAiDocLoading(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background:"#060e09" }}>

      {/* ── SIDEBAR ── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/5" style={{ background:"#0a1810" }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 font-black text-white text-sm"
            style={{ background:"#059669", boxShadow:"0 0 16px rgba(5,150,105,0.4)" }}
          >K</div>
          <div>
            <p className="text-sm font-bold text-white" style={{ letterSpacing:"-0.02em" }}>Kontra</p>
            <p className="text-xs font-semibold" style={{ color:"#6ee7b7" }}>Borrower Portal</p>
          </div>
        </div>

        {/* Loan card */}
        <div className="mx-4 mt-4 rounded-xl border border-white/8 p-4" style={{ background:"rgba(5,150,105,0.08)" }}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Active Loan</p>
          <p className="mt-1 text-sm font-black text-white">{loan.loan_ref}</p>
          <p className="text-xs text-slate-400 truncate">{loan.property_name}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <p className="text-xs font-semibold text-emerald-400">{loan.status}</p>
          </div>
        </div>

        {/* Next payment */}
        <div className="mx-4 mt-2 rounded-xl border border-amber-800/40 p-3" style={{ background:"rgba(217,119,6,0.08)" }}>
          <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Next Payment</p>
          <p className="mt-0.5 text-base font-black text-amber-300">{fmt(loan.next_payment_amount)}</p>
          <p className="text-xs text-amber-600">Due {fmtDate(loan.next_payment_date)}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                  active ? "bg-white/10 text-white font-medium" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-emerald-400" : "text-slate-500"}`} />
                <span className="flex-1">{item.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />}
                {!active && item.badge ? (
                  <span className="rounded-full bg-amber-800/60 text-amber-300 border border-amber-700/40 px-1.5 py-0.5 text-xs font-bold">{item.badge}</span>
                ) : null}
                {!active && item.highlight && (
                  <span className="rounded-full bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 text-xs font-bold">NEW</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/5 p-4 space-y-3">
          <div>
            <p className="text-xs text-slate-500">Servicer contact:</p>
            <p className="text-xs font-medium text-slate-300 mt-0.5 truncate">{loan.servicer_contact}</p>
          </div>
          <button
            onClick={async () => { await signOut(); navigate("/login", { replace:true }); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-all text-left"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 overflow-y-auto" style={{ background:"#060e09" }}>
        <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">

          {/* ── MY LOAN ── */}
          {section === "myloans" && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">My Loan</p>
                <h1 className="text-2xl font-black text-white mt-1">{loan.property_name}</h1>
                <p className="text-sm text-slate-400">{loan.property_address} · {loan.property_type}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label:"Loan Reference",  value: loan.loan_ref },
                  { label:"Current Balance", value: fmt(loan.current_balance) },
                  { label:"Interest Rate",   value: loan.interest_rate },
                  { label:"Payment Type",    value: loan.payment_type },
                  { label:"Maturity Date",   value: fmtDate(loan.maturity_date) },
                  { label:"Servicer",        value: loan.servicer_name },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-white/6 p-4" style={{ background:"rgba(255,255,255,0.04)" }}>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                    <p className="mt-1.5 text-sm font-bold text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Covenant quick summary */}
              <div className="rounded-xl border border-white/6 overflow-hidden" style={{ background:"rgba(255,255,255,0.03)" }}>
                <div className="border-b border-white/6 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white">Covenant Health</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time compliance vs your loan agreement</p>
                  </div>
                  <button onClick={() => setSection("covenants")} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                    Full Scorecard →
                  </button>
                </div>
                <div className="divide-y divide-white/4">
                  {DEMO_COVENANTS.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-white/3 transition-colors">
                      <p className="text-sm text-slate-300">{c.name}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-white tabular-nums">{c.current_value}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${c.status === "passing" ? "bg-emerald-900/60 text-emerald-400 border border-emerald-800/50" : c.status === "attention" ? "bg-amber-900/60 text-amber-400 border border-amber-800/50" : "bg-red-900/60 text-red-400 border border-red-800/50"}`}>
                          {c.status === "passing" ? "OK" : c.status === "attention" ? "Attention" : "Breach"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {pendingDocs > 0 && (
                <div className="rounded-xl border border-amber-800/50 p-5" style={{ background:"rgba(217,119,6,0.08)" }}>
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-300">Action Required: {pendingDocs} document{pendingDocs > 1 ? "s" : ""} pending</p>
                      <p className="text-xs text-amber-600 mt-1">Missing documents can trigger covenant cure periods.</p>
                      <button onClick={() => setSection("documents")} className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition-colors">
                        Go to Document Center →
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
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Payments</p>
                <h1 className="text-2xl font-black text-white mt-1">Payment History</h1>
              </div>

              <div className="rounded-xl border border-white/6 overflow-hidden" style={{ background:"rgba(255,255,255,0.04)" }}>
                <div className="px-6 py-5 flex items-center justify-between" style={{ background:"rgba(5,150,105,0.12)" }}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Next Payment Due</p>
                    <p className="text-2xl font-black text-white mt-1">{fmt(loan.next_payment_amount)}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{fmtDate(loan.next_payment_date)} · Interest Only</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Wire to account on file</p>
                    <p className="text-xs text-slate-500 mt-1">Ref: {loan.loan_ref}-{loan.next_payment_date?.slice(0,7)}</p>
                    <button className="mt-3 rounded-lg border border-emerald-700/50 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-900/30 transition-colors">
                      Wire Instructions
                    </button>
                  </div>
                </div>
                <div className="px-6 py-3 border-t border-white/4 flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs font-semibold text-emerald-500">{payments.filter(p => p.status === "paid").length} consecutive on-time payments — no late fees assessed</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/6 overflow-hidden">
                <div className="border-b border-white/6 px-6 py-4" style={{ background:"rgba(255,255,255,0.03)" }}>
                  <h2 className="text-base font-bold text-white">Payment History</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/4" style={{ background:"rgba(255,255,255,0.03)" }}>
                      {["Date","Amount","Interest","Principal","Late Fee","Status"].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-5 py-3 text-white font-semibold">{fmtDate(p.date)}</td>
                        <td className="px-5 py-3 text-white font-bold tabular-nums">{fmt(p.amount)}</td>
                        <td className="px-5 py-3 text-slate-300 tabular-nums">{fmt(p.interest)}</td>
                        <td className="px-5 py-3 text-slate-500 tabular-nums">{p.principal === 0 ? "—" : fmt(p.principal)}</td>
                        <td className="px-5 py-3 text-slate-500 tabular-nums">{p.late_fee === 0 ? "—" : fmt(p.late_fee)}</td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-emerald-900/60 border border-emerald-700/40 px-2.5 py-0.5 text-xs font-bold text-emerald-400">Paid</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COVENANT SCORECARD ── */}
          {section === "covenants" && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Compliance</p>
                <h1 className="text-2xl font-black text-white mt-1">Covenant Scorecard</h1>
                <p className="text-sm text-slate-400 mt-1">
                  Live covenant readings calculated from your uploaded financials and servicer records. 
                  Any breach triggers a 60-day cure period per §8.2 of your loan agreement.
                </p>
              </div>

              {attentionCovs > 0 && (
                <div className="rounded-xl border border-amber-800/50 p-5" style={{ background:"rgba(217,119,6,0.08)" }}>
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-300">{attentionCovs} covenant{attentionCovs > 1 ? "s" : ""} need{attentionCovs === 1 ? "s" : ""} attention</p>
                      <p className="text-xs text-amber-600 mt-1">Please review and take action before the covenant cure deadline to avoid default provisions.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEMO_COVENANTS.map(c => <CovenantGauge key={c.id} cov={c} />)}
              </div>

              <div className="rounded-xl border border-white/5 p-5" style={{ background:"rgba(255,255,255,0.02)" }}>
                <p className="text-xs font-semibold text-slate-500 mb-1">What happens if a covenant is breached?</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Per §8.2 of your loan agreement: you have 60 days to cure after written notice. During the cure period, all draw requests are suspended. 
                  If the breach is not cured, the lender may declare a default event and activate cash trap provisions per §7.4(b). 
                  Your servicer (Kontra Servicing) will work with you proactively before any default action is taken.
                </p>
              </div>
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {section === "documents" && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Document Center</p>
                <h1 className="text-2xl font-black text-white mt-1">Required Documents</h1>
                <p className="text-sm text-slate-400 mt-1">Upload required documents for your servicer's review. AI extracts key metrics automatically on submission.</p>
              </div>

              <div className="rounded-xl border border-white/6 overflow-hidden">
                <div className="border-b border-white/6 px-6 py-4 flex items-center justify-between" style={{ background:"rgba(255,255,255,0.03)" }}>
                  <h2 className="text-base font-bold text-white">Document Checklist</h2>
                  <span className="text-xs text-slate-400">{documents.filter(d => d.status === "approved").length}/{documents.length} approved</span>
                </div>
                <div className="divide-y divide-white/4">
                  {documents.map(doc => {
                    const s = DOC_STATUS[doc.status] ?? DOC_STATUS.pending;
                    const Icon = s.icon;
                    return (
                      <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/2 transition-colors">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${doc.status === "approved" ? "bg-emerald-900/60" : doc.status === "submitted" ? "bg-blue-900/60" : "bg-amber-900/60"}`}>
                          <Icon className={`h-4 w-4 ${doc.status === "approved" ? "text-emerald-400" : doc.status === "submitted" ? "text-blue-400" : "text-amber-400"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{doc.name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-xs text-slate-500">Due: {fmtDate(doc.due)}</p>
                            {doc.notes && <p className="text-xs text-slate-600">· {doc.notes}</p>}
                            {doc.submitted_at && <p className="text-xs text-slate-600">· Submitted {fmtDate(doc.submitted_at)}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.color}`}>{s.label}</span>
                          {doc.status === "pending" && (
                            <button
                              onClick={() => setUploadingDoc(doc.id === uploadingDoc ? null : doc.id)}
                              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-1.5"
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

              {uploadingDoc && (
                <div className="rounded-xl border-2 border-dashed border-emerald-700/50 p-8 text-center" style={{ background:"rgba(5,150,105,0.05)" }}>
                  <ArrowUpTrayIcon className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-white">{aiDocName ? `Selected: ${aiDocName}` : "Drag & drop or click to choose a file"}</p>
                  <p className="text-xs text-slate-500 mt-1">PDF, Excel, CSV · Max 25 MB · AI will extract key metrics</p>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.xlsx,.xls,.csv,.txt,.doc,.docx"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setAiDocName(f.name); }} />
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors">Choose File</button>
                    {aiDocName && !aiDocLoading && (
                      <button onClick={() => { const f = fileInputRef.current?.files?.[0]; if (f) handleAiAnalyze(f); }}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 transition-colors flex items-center gap-2">
                        <SparklesIcon className="h-4 w-4" /> Submit & Analyze
                      </button>
                    )}
                    {aiDocLoading && <span className="flex items-center gap-2 text-sm text-emerald-400 font-semibold"><SparklesIcon className="h-4 w-4 animate-pulse" /> Analyzing…</span>}
                    <button onClick={() => { setUploadingDoc(null); setAiDocName(""); setAiDocResult(null); }}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-white/5 transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {aiDocResult && (
                <div className="rounded-xl border border-emerald-800/50 overflow-hidden" style={{ background:"rgba(5,150,105,0.06)" }}>
                  <div className="border-b border-emerald-800/30 px-6 py-4 flex items-center gap-3">
                    <SparklesIcon className="h-5 w-5 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">AI Document Analysis</h3>
                      <p className="text-xs text-slate-400">{aiDocResult.doc_type} · {aiDocName}</p>
                    </div>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-sm text-slate-300">{aiDocResult.summary}</p>
                    {Object.values(aiDocResult.metrics || {}).some(v => v != null) && (
                      <div className="grid grid-cols-3 gap-3">
                        {aiDocResult.metrics.dscr != null && (
                          <div className={`rounded-lg p-3 ${Number(aiDocResult.metrics.dscr) >= 1.25 ? "bg-emerald-900/40" : "bg-red-900/40"}`}>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">DSCR</p>
                            <p className={`text-xl font-black ${Number(aiDocResult.metrics.dscr) >= 1.25 ? "text-emerald-400" : "text-red-400"}`}>{aiDocResult.metrics.dscr}×</p>
                          </div>
                        )}
                        {aiDocResult.metrics.noi != null && (
                          <div className="rounded-lg p-3" style={{ background:"rgba(255,255,255,0.05)" }}>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Annual NOI</p>
                            <p className="text-xl font-black text-white">${Number(aiDocResult.metrics.noi).toLocaleString()}</p>
                          </div>
                        )}
                        {aiDocResult.metrics.occupancy != null && (
                          <div className={`rounded-lg p-3 ${Number(aiDocResult.metrics.occupancy) >= 90 ? "bg-emerald-900/40" : "bg-amber-900/40"}`}>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Occupancy</p>
                            <p className={`text-xl font-black ${Number(aiDocResult.metrics.occupancy) >= 90 ? "text-emerald-400" : "text-amber-400"}`}>{aiDocResult.metrics.occupancy}%</p>
                          </div>
                        )}
                      </div>
                    )}
                    {aiDocResult.risk_flags?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Risk Flags</p>
                        <ul className="space-y-1">
                          {aiDocResult.risk_flags.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <ExclamationTriangleIcon className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DRAWS ── */}
          {section === "draws" && (
            <div className="space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Construction</p>
                  <h1 className="text-2xl font-black text-white mt-1">Draw Requests</h1>
                  <p className="text-sm text-slate-400 mt-1">Submit and track construction draws. Each requires inspection approval before funding.</p>
                </div>
                <button onClick={() => setNewDrawOpen(!newDrawOpen)}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 transition-colors">
                  + New Draw
                </button>
              </div>

              {newDrawOpen && (
                <div className="rounded-xl border border-white/8 p-6 space-y-4" style={{ background:"rgba(255,255,255,0.04)" }}>
                  <p className="text-sm font-bold text-white">New Draw Request — {loan.loan_ref}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Draw Amount ($)</label>
                      <input type="number" value={drawForm.amount} onChange={e => setDrawForm(f => ({ ...f, amount:e.target.value }))}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-white/8 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-700/50"
                        style={{ background:"rgba(255,255,255,0.06)" }} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Milestone / Phase</label>
                      <input type="text" value={drawForm.milestone} onChange={e => setDrawForm(f => ({ ...f, milestone:e.target.value }))}
                        placeholder="Phase 3 — Units 19-24"
                        className="w-full rounded-lg border border-white/8 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-700/50"
                        style={{ background:"rgba(255,255,255,0.06)" }} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Purpose</label>
                      <textarea value={drawForm.purpose} onChange={e => setDrawForm(f => ({ ...f, purpose:e.target.value }))} rows={2}
                        placeholder="Describe what this draw funds..."
                        className="w-full rounded-lg border border-white/8 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-700/50 resize-none"
                        style={{ background:"rgba(255,255,255,0.06)" }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={submitDraw} disabled={submittingDraw || !drawForm.amount || !drawForm.purpose}
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                      {submittingDraw ? "Submitting…" : "Submit Draw Request"}
                    </button>
                    <button onClick={() => setNewDrawOpen(false)}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-white/5 transition-colors">Cancel</button>
                  </div>
                  <p className="text-xs text-slate-500">Draw requests require a site inspection by TRC Engineering before Kontra Servicing can release funds.</p>
                </div>
              )}

              <div className="space-y-4">
                {draws.map(d => {
                  const s = DRAW_STATUS[d.status] ?? DRAW_STATUS.under_review;
                  return (
                    <div key={d.id} className="rounded-xl border border-white/6 p-6" style={{ background:"rgba(255,255,255,0.03)" }}>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="text-base font-black text-white">{d.number}</p>
                          <p className="text-sm text-slate-400 mt-0.5">{d.purpose}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-white tabular-nums">{fmt(d.amount)}</p>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.color}`}>{s.label}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span>Submitted: {fmtDate(d.submitted_at)}</span>
                        {d.funded_at && <span className="text-emerald-500">Funded: {fmtDate(d.funded_at)}</span>}
                        <span className={`flex items-center gap-1 ${d.inspector_approved ? "text-emerald-500" : "text-amber-500"}`}>
                          {d.inspector_approved
                            ? <><CheckCircleIcon className="h-3.5 w-3.5" /> Inspector approved</>
                            : <><ClockIcon className="h-3.5 w-3.5" /> Inspection pending</>}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TOKEN STATUS ── */}
          {section === "tokenization" && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Capital Markets</p>
                <h1 className="text-2xl font-black text-white mt-1">Token Status</h1>
                <p className="text-sm text-slate-400 mt-1">
                  Your loan has been packaged as a digital token (KTRA-2847) and distributed to institutional investors on the Kontra marketplace.
                  Your loan obligations remain exactly the same — only the holder of your debt has changed.
                </p>
              </div>

              {/* Token identity card */}
              <div className="rounded-xl border border-emerald-700/30 p-6" style={{ background:"rgba(5,150,105,0.08)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">Token Symbol</p>
                    <p className="text-4xl font-black text-white mt-1 tracking-tight">KTRA-2847</p>
                    <p className="text-sm text-slate-400 mt-1">ERC-1400 Security Token · Ethereum Mainnet</p>
                    <p className="text-xs text-slate-500 mt-2 font-mono">0x1a2b…e3f4 (contract)</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">Current NAV</p>
                    <p className="text-4xl font-black text-emerald-400 mt-1 tabular-nums">$102.73</p>
                    <p className="text-xs text-slate-500 mt-1">per token (face value $100.00)</p>
                    <span className="mt-2 inline-block rounded-full bg-emerald-900/60 border border-emerald-700/40 px-3 py-1 text-xs font-bold text-emerald-400">
                      ↑ $2.73 premium
                    </span>
                  </div>
                </div>
              </div>

              {/* Token metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label:"Total Token Supply", value:"314,000", sub:"tokens issued", color:"text-white" },
                  { label:"Investors Holding", value:"10,290", sub:"verified accredited", color:"text-violet-400" },
                  { label:"Monthly Distribution", value:"$264,500", sub:"paid to token holders", color:"text-emerald-400" },
                  { label:"Annualized Yield", value:"7.62%", sub:"net to investors", color:"text-amber-400" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-white/6 p-4" style={{ background:"rgba(255,255,255,0.03)" }}>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
                    <p className={`mt-2 text-xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* What this means for you */}
              <div className="rounded-xl border border-white/6 p-6 space-y-4" style={{ background:"rgba(255,255,255,0.03)" }}>
                <h2 className="text-base font-bold text-white">What tokenization means for you</h2>
                <div className="space-y-3">
                  {[
                    { icon: CheckCircleIcon, color:"text-emerald-400", text:"Your loan terms are unchanged — same rate (8.75%), same maturity (Sep 2026), same payment schedule. Tokenization is a change in who holds your debt, not how it works." },
                    { icon: CheckCircleIcon, color:"text-emerald-400", text:"Your monthly payment of $29,968.75 goes to Kontra Servicing, which distributes it to token holders through the cash flow waterfall. Nothing changes on your end." },
                    { icon: CheckCircleIcon, color:"text-emerald-400", text:"Draw requests, covenant compliance, and document submissions still flow through your Kontra servicing team — tokenization doesn't change the servicing relationship." },
                    { icon: ShieldCheckIcon, color:"text-blue-400", text:"Token transfers between investors are governed by ERC-1400 transfer restrictions (Reg D 506(c)). Investors can only transfer to other verified accredited investors. You are not involved in these trades." },
                    { icon: ChartBarIcon, color:"text-violet-400", text:"The NAV premium ($102.73 vs $100 face) reflects strong DSCR (1.42×), good occupancy (91.7%), and on-time payment history. Maintaining covenant compliance directly supports this premium." },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${item.color}`} />
                        <p className="text-sm text-slate-300 leading-relaxed">{item.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Issuance timeline */}
              <div className="rounded-xl border border-white/6 p-6" style={{ background:"rgba(255,255,255,0.03)" }}>
                <h2 className="text-sm font-bold text-white mb-4">Token Issuance Timeline</h2>
                <div className="space-y-3">
                  {[
                    { date:"Sep 15, 2024", event:"Loan originated — LN-2847", note:"$4.2M multifamily bridge loan funded" },
                    { date:"Nov 3, 2024",  event:"Tokenization eligibility confirmed", note:"DSCR 1.38×, LTV 68.2%, all 5 readiness dimensions passed" },
                    { date:"Nov 20, 2024", event:"KTRA-2847 token deployed", note:"314,000 ERC-1400 tokens at $100.00 face value" },
                    { date:"Dec 1, 2024",  event:"Reg D 506(c) offering closed", note:"10,290 accredited investors, $31.4M raised" },
                    { date:"May 1, 2026",  event:"Latest distribution — $264,500", note:"7.62% annualized yield, NAV $102.73" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="w-28 shrink-0 text-xs text-slate-500 font-mono pt-0.5">{item.date}</div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-white">{item.event}</p>
                          <p className="text-xs text-slate-500">{item.note}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── NOTICES ── */}
          {section === "notices" && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Communications</p>
                <h1 className="text-2xl font-black text-white mt-1">Notices</h1>
              </div>
              <div className="space-y-4">
                {notices.map(n => (
                  <div key={n.id} className={`rounded-xl border p-5 ${n.type === "action_required" ? "border-amber-800/50" : "border-white/6"}`}
                    style={{ background: n.type === "action_required" ? "rgba(217,119,6,0.08)" : "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${n.type === "action_required" ? "bg-amber-900/60" : "bg-white/8"}`}>
                        {n.type === "action_required"
                          ? <ExclamationTriangleIcon className="h-4 w-4 text-amber-400" />
                          : <DocumentTextIcon className="h-4 w-4 text-slate-400" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {n.type === "action_required" && (
                            <span className="rounded-full bg-amber-700 px-2 py-0.5 text-xs font-black text-white uppercase tracking-wide">Action Required</span>
                          )}
                          <span className="text-xs text-slate-500">{fmtDate(n.date)} · From {n.from}</span>
                        </div>
                        <p className="text-sm font-bold text-white">{n.subject}</p>
                        <p className="text-sm text-slate-400 mt-1">{n.body}</p>
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
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Communications</p>
                <h1 className="text-2xl font-black text-white mt-1">Messages</h1>
                <p className="text-sm text-slate-400 mt-1">Direct channel to your servicing team</p>
              </div>

              <div className="rounded-xl border border-white/6 overflow-hidden">
                <div className="border-b border-white/6 px-6 py-4 flex items-center gap-3" style={{ background:"rgba(255,255,255,0.04)" }}>
                  <div className="h-8 w-8 rounded-full bg-emerald-800 flex items-center justify-center text-white text-xs font-bold">KS</div>
                  <div>
                    <p className="text-sm font-bold text-white">Kontra Servicing Team</p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <p className="text-xs text-emerald-500 font-medium">Online · Responds within 1 business day</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 space-y-4 min-h-64">
                  {localMessages.map(m => (
                    <div key={m.id} className={`flex ${m.from === "borrower" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-3 ${m.from === "borrower" ? "rounded-tr-sm text-white" : "rounded-tl-sm text-white"}`}
                        style={{ background: m.from === "borrower" ? "#059669" : "rgba(255,255,255,0.08)" }}>
                        <p className="text-xs font-semibold mb-1 opacity-60">{m.author}</p>
                        <p className="text-sm">{m.text}</p>
                        <p className="text-xs mt-1 opacity-40">{new Date(m.ts).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/6 px-4 py-3 flex items-end gap-3">
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message to your servicing team..."
                    rows={2}
                    className="flex-1 rounded-xl border border-white/8 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-700/50 resize-none"
                    style={{ background:"rgba(255,255,255,0.06)" }}
                  />
                  <button onClick={sendMessage} disabled={!message.trim() || sendingMsg}
                    className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors">
                    {sendingMsg ? "Sending…" : "Send"}
                  </button>
                </div>
                <p className="px-6 pb-3 text-xs text-slate-600">Messages are logged to the servicing audit trail.</p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
