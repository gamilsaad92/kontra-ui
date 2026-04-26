import { useState } from "react";
import { useServicingContext } from "./ServicingContext";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

type PaymentStatus = "pending" | "ai_review" | "pass" | "short_pay" | "late" | "posted" | "returned";

type AllocationLine = { key: string; label: string; amount: number };

type IncomingPayment = {
  id: string;
  loan_ref: string;
  borrower: string;
  property: string;
  expected_amount: number;
  received_amount: number;
  received_date: string;
  due_date: string;
  remitter: string;
  status: PaymentStatus;
  days_late: number;
  ai_status: "pass" | "fail" | "needs_review" | null;
  ai_summary: string;
  ai_flags: { code: string; severity: "high" | "medium" | "low"; message: string }[];
  allocation: AllocationLine[];
  posting_notes: string;
};

const PAYMENTS: IncomingPayment[] = [
  {
    id: "pmt-001",
    loan_ref: "LN-2847",
    borrower: "Cedar Grove Partners",
    property: "The Meridian Apartments",
    expected_amount: 30_625,
    received_amount: 30_625,
    received_date: "2026-04-25",
    due_date: "2026-04-01",
    remitter: "Cedar Grove Partners LLC",
    days_late: 24,
    status: "ai_review",
    ai_status: "needs_review",
    ai_summary: "Payment received 24 days late. Remitter matches borrower entity. Late fee of $1,531 accrued per loan agreement §6.2. Amount otherwise reconciles to monthly P&I schedule.",
    ai_flags: [
      { code: "LATE_PAYMENT", severity: "high", message: "Payment received 24 DPD. Late charge of $1,531 applies per agreement §6.2." },
      { code: "LATE_FEE_OUTSTANDING", severity: "medium", message: "Late charge not included in this remittance. Servicer must bill separately or suspend from next payment." },
    ],
    allocation: [
      { key: "principal", label: "Principal", amount: 0 },
      { key: "interest", label: "Interest", amount: 30_625 },
      { key: "escrow", label: "Escrow", amount: 0 },
      { key: "late_fee", label: "Late Fee", amount: 1_531 },
      { key: "suspense", label: "Suspense", amount: 0 },
    ],
    posting_notes: "Post $30,625 to interest. Bill $1,531 late charge separately per §6.2.",
  },
  {
    id: "pmt-002",
    loan_ref: "LN-3201",
    borrower: "Metro Development LLC",
    property: "Westgate Industrial Park",
    expected_amount: 48_520,
    received_amount: 42_000,
    received_date: "2026-04-01",
    due_date: "2026-04-01",
    remitter: "Metro Development LLC",
    days_late: 0,
    status: "ai_review",
    ai_status: "fail",
    ai_summary: "Short pay of $6,520 detected. Received $42,000 against scheduled $48,520. Remitter matches but amount does not reconcile. Disbursement hold recommended until cure.",
    ai_flags: [
      { code: "SHORT_PAY", severity: "high", message: "Received $42,000 — short by $6,520 vs. scheduled $48,520. P&I + escrow required." },
      { code: "ESCROW_SHORTFALL", severity: "medium", message: "Escrow component ($2,967/mo) appears omitted from remittance." },
      { code: "SUSPENSE_CANDIDATE", severity: "low", message: "Recommend placing $42,000 in suspense pending borrower cure confirmation." },
    ],
    allocation: [
      { key: "principal", label: "Principal", amount: 0 },
      { key: "interest", label: "Interest", amount: 0 },
      { key: "escrow", label: "Escrow", amount: 0 },
      { key: "suspense", label: "Suspense", amount: 42_000 },
      { key: "late_fee", label: "Late Fee", amount: 0 },
    ],
    posting_notes: "Hold in suspense. Contact borrower for $6,520 cure. Do not apply until full payment received.",
  },
  {
    id: "pmt-003",
    loan_ref: "LN-5593",
    borrower: "Westridge Capital",
    property: "Summit Office Complex",
    expected_amount: 55_967,
    received_amount: 55_967,
    received_date: "2026-04-01",
    due_date: "2026-04-01",
    remitter: "Westridge Capital Partners",
    days_late: 0,
    status: "ai_review",
    ai_status: "pass",
    ai_summary: "Clean payment. Amount matches scheduled P&I and escrow exactly. Remitter name is a known alias for Westridge Capital — flagged for confirmation but not a concern.",
    ai_flags: [
      { code: "REMITTER_ALIAS", severity: "low", message: "Remitter 'Westridge Capital Partners' is an alias for 'Westridge Capital' — confirm entity match in file." },
    ],
    allocation: [
      { key: "principal", label: "Principal", amount: 18_400 },
      { key: "interest", label: "Interest", amount: 34_492 },
      { key: "escrow", label: "Escrow", amount: 3_075 },
      { key: "late_fee", label: "Late Fee", amount: 0 },
      { key: "suspense", label: "Suspense", amount: 0 },
    ],
    posting_notes: "Post as allocated. Confirm Westridge Capital Partners entity in file.",
  },
  {
    id: "pmt-004",
    loan_ref: "LN-0728",
    borrower: "Crestwood Logistics",
    property: "Crestwood Distribution Center",
    expected_amount: 58_333,
    received_amount: 58_333,
    received_date: "2026-04-02",
    due_date: "2026-04-01",
    remitter: "Crestwood Logistics Inc",
    days_late: 1,
    status: "posted",
    ai_status: "pass",
    ai_summary: "Payment received 1 day late — within grace period. Amount reconciles. Posted.",
    ai_flags: [],
    allocation: [
      { key: "principal", label: "Principal", amount: 12_500 },
      { key: "interest", label: "Interest", amount: 43_958 },
      { key: "escrow", label: "Escrow", amount: 1_875 },
      { key: "late_fee", label: "Late Fee", amount: 0 },
      { key: "suspense", label: "Suspense", amount: 0 },
    ],
    posting_notes: "Posted Apr 2, within 5-day grace period. No late fee applies.",
  },
  {
    id: "pmt-005",
    loan_ref: "LN-4108",
    borrower: "Oakfield Group",
    property: "Oakfield Retail Plaza",
    expected_amount: 23_042,
    received_amount: 23_042,
    received_date: "2026-04-01",
    due_date: "2026-04-01",
    remitter: "Oakfield Group LLC",
    days_late: 0,
    status: "ai_review",
    ai_status: "pass",
    ai_summary: "Clean on-time payment. All allocation lines verified. Ready to post.",
    ai_flags: [],
    allocation: [
      { key: "principal", label: "Principal", amount: 6_200 },
      { key: "interest", label: "Interest", amount: 15_342 },
      { key: "escrow", label: "Escrow", amount: 1_500 },
      { key: "late_fee", label: "Late Fee", amount: 0 },
      { key: "suspense", label: "Suspense", amount: 0 },
    ],
    posting_notes: "Ready to post. All items verified.",
  },
];

const statusConfig: Record<PaymentStatus, { label: string; bg: string; dot: string }> = {
  pending:   { label: "Pending",    bg: "bg-slate-100 text-slate-600",  dot: "bg-slate-400" },
  ai_review: { label: "AI Review",  bg: "bg-amber-100 text-amber-700",  dot: "bg-amber-500" },
  pass:      { label: "Pass",       bg: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  short_pay: { label: "Short Pay",  bg: "bg-red-100 text-red-700",      dot: "bg-red-500" },
  late:      { label: "Late",       bg: "bg-orange-100 text-orange-700",dot: "bg-orange-500" },
  posted:    { label: "Posted",     bg: "bg-slate-200 text-slate-600",  dot: "bg-slate-500" },
  returned:  { label: "Returned",   bg: "bg-red-100 text-red-700",      dot: "bg-red-600" },
};

const aiStatusIcon = (s: IncomingPayment["ai_status"]) => {
  if (s === "pass")         return <CheckCircleIcon className="h-4 w-4 text-emerald-600" />;
  if (s === "fail")         return <XCircleIcon className="h-4 w-4 text-red-600" />;
  if (s === "needs_review") return <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />;
  return null;
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const severityBg = (s: string) =>
  s === "high" ? "bg-red-50 text-red-700" : s === "medium" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600";

const FILTER_OPTIONS: { label: string; value: PaymentStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "AI Review", value: "ai_review" },
  { label: "Pass", value: "pass" },
  { label: "Short Pay / Late", value: "short_pay" },
  { label: "Posted", value: "posted" },
];

export default function ServicingPaymentsPage() {
  const { logAudit, addAlert, addTask } = useServicingContext();
  const [payments, setPayments] = useState<IncomingPayment[]>(PAYMENTS);
  const [selectedId, setSelectedId] = useState<string>(PAYMENTS[0].id);
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");
  const [allocation, setAllocation] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [runningAI, setRunningAI] = useState(false);

  const selected = payments.find(p => p.id === selectedId) ?? payments[0];

  const filtered = payments.filter(p => {
    if (filter === "all") return true;
    if (filter === "short_pay") return p.ai_status === "fail" || p.days_late > 5;
    return p.status === filter;
  });

  const handleSelect = (p: IncomingPayment) => {
    setSelectedId(p.id);
    setAllocation(Object.fromEntries(p.allocation.map(a => [a.key, a.amount])));
    setMessage(null);
  };

  const handleRunAI = async () => {
    setRunningAI(true);
    setMessage(null);
    await new Promise(r => setTimeout(r, 1100));
    setRunningAI(false);
    logAudit({
      id: `ai-pmt-${selected.id}-${Date.now()}`,
      action: `AI payment review run — ${selected.loan_ref}`,
      detail: `${selected.borrower} · ${fmt(selected.received_amount)} received`,
      timestamp: new Date().toISOString(),
      status: "logged",
    });
    setMessage(`AI review complete for ${selected.loan_ref}. ${selected.ai_flags.length} flag(s) identified.`);
  };

  const handlePost = () => {
    setPayments(prev => prev.map(p => p.id === selected.id ? { ...p, status: "posted" } : p));
    logAudit({
      id: `post-${selected.id}-${Date.now()}`,
      action: `Payment posted — ${selected.loan_ref}`,
      detail: `${selected.borrower} · ${fmt(selected.received_amount)}`,
      timestamp: new Date().toISOString(),
      status: "approved",
    });
    setMessage(`✅ Payment posted for ${selected.loan_ref}.`);
  };

  const handleReturn = () => {
    setPayments(prev => prev.map(p => p.id === selected.id ? { ...p, status: "returned" } : p));
    addAlert({
      id: `alert-return-${selected.id}`,
      title: `Short pay returned — ${selected.loan_ref}`,
      detail: `${selected.borrower} — ${fmt(selected.expected_amount - selected.received_amount)} cure required.`,
      severity: "high",
      category: "Payments",
    });
    addTask({
      id: `task-cure-${selected.id}`,
      title: `Borrower cure — ${selected.loan_ref}`,
      detail: `${fmt(selected.expected_amount - selected.received_amount)} outstanding. Contact within 3 business days.`,
      status: "open",
      category: "Payments",
      requiresApproval: false,
    });
    logAudit({
      id: `return-${selected.id}-${Date.now()}`,
      action: `Payment returned to borrower — ${selected.loan_ref}`,
      detail: `Short pay of ${fmt(selected.expected_amount - selected.received_amount)} — cure required`,
      timestamp: new Date().toISOString(),
      status: "pending-approval",
    });
    setMessage(`Payment returned. Cure notice queued for ${selected.borrower}.`);
  };

  const totalExpected = PAYMENTS.reduce((s, p) => s + p.expected_amount, 0);
  const totalReceived = PAYMENTS.reduce((s, p) => s + p.received_amount, 0);
  const pendingReview = PAYMENTS.filter(p => p.status === "ai_review").length;
  const posted = PAYMENTS.filter(p => p.status === "posted").length;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Expected (Apr)", value: fmt(totalExpected), color: "text-slate-900" },
          { label: "Total Received",       value: fmt(totalReceived), color: totalReceived >= totalExpected ? "text-emerald-700" : "text-red-700" },
          { label: "Pending AI Review",    value: pendingReview, color: pendingReview > 0 ? "text-amber-700" : "text-emerald-700" },
          { label: "Posted",               value: posted, color: "text-slate-900" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {message && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[260px_1fr_300px]">
        {/* Left: payment queue */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Incoming Payments
            </p>
            <button
              onClick={() => setFilter("all")}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Clear filter
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  filter === opt.value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.map(p => {
              const sc = statusConfig[p.status];
              const isSelected = p.id === selected.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-900"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${isSelected ? "text-white" : "text-slate-900"}`}>
                        {p.loan_ref}
                      </p>
                      <p className={`text-xs truncate ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                        {p.borrower}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${sc.bg}`}>
                      {sc.label}
                    </span>
                  </div>
                  <div className={`mt-2 flex items-center justify-between text-xs ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
                    <span>{fmt(p.received_amount)}</span>
                    {p.received_amount < p.expected_amount && (
                      <span className={`font-semibold ${isSelected ? "text-red-300" : "text-red-600"}`}>
                        -{fmt(p.expected_amount - p.received_amount)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center: payment detail + AI findings */}
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Payment Detail</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                {selected.loan_ref} — {selected.borrower}
              </h2>
              <p className="text-sm text-slate-500">{selected.property}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRunAI}
                disabled={runningAI || selected.status === "posted"}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 transition"
              >
                <ArrowPathIcon className={`h-4 w-4 ${runningAI ? "animate-spin" : ""}`} />
                {runningAI ? "Running AI…" : "Re-run AI"}
              </button>
              {selected.status !== "posted" && selected.ai_status === "pass" && (
                <button
                  onClick={handlePost}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition"
                >
                  <BanknotesIcon className="inline h-4 w-4 mr-1" />
                  Post Payment
                </button>
              )}
              {selected.status !== "posted" && selected.ai_status === "fail" && (
                <button
                  onClick={handleReturn}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition"
                >
                  Return to Borrower
                </button>
              )}
              {selected.status !== "posted" && selected.ai_status === "needs_review" && (
                <>
                  <button
                    onClick={handlePost}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    Override &amp; Post
                  </button>
                  <button
                    onClick={handleReturn}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
                  >
                    Return
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Payment summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
            {[
              { label: "Expected",     value: fmt(selected.expected_amount) },
              { label: "Received",     value: fmt(selected.received_amount),
                alert: selected.received_amount < selected.expected_amount },
              { label: "Due Date",     value: selected.due_date },
              { label: "Received Date",value: selected.received_date },
            ].map(m => (
              <div key={m.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs text-slate-400">{m.label}</p>
                <p className={`mt-0.5 font-bold ${(m as any).alert ? "text-red-700" : "text-slate-900"}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {selected.days_late > 0 && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${selected.days_late > 5 ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              <strong>{selected.days_late} days late</strong>
              {selected.days_late > 5
                ? " — Late charge accruing per loan agreement."
                : " — Within grace period. No late fee applies."}
            </div>
          )}

          {/* AI analysis */}
          {selected.ai_status && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                {aiStatusIcon(selected.ai_status)}
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">AI Analysis</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  selected.ai_status === "pass" ? "bg-emerald-100 text-emerald-700" :
                  selected.ai_status === "fail" ? "bg-red-100 text-red-700" :
                  "bg-amber-100 text-amber-700"
                }`}>
                  {selected.ai_status.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{selected.ai_summary}</p>

              {selected.ai_flags.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selected.ai_flags.map(flag => (
                    <div
                      key={flag.code}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${severityBg(flag.severity)} border-current/20`}
                    >
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide bg-current/10">
                        {flag.severity}
                      </span>
                      <p className="text-xs">{flag.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {selected.ai_flags.length === 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                  <p className="text-xs text-emerald-700 font-semibold">No exceptions. Clean payment — ready to post.</p>
                </div>
              )}
            </div>
          )}

          {selected.posting_notes && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Posting Note</p>
              <p className="text-sm text-slate-700">{selected.posting_notes}</p>
            </div>
          )}
        </section>

        {/* Right: allocation editor */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
              Payment Allocation
            </p>
            <div className="space-y-2">
              {selected.allocation.map(line => (
                <label key={line.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">{line.label}</span>
                  <input
                    type="number"
                    className="w-28 rounded-md border border-slate-200 px-2 py-1 text-right text-sm tabular-nums"
                    value={allocation[line.key] ?? line.amount}
                    onChange={e =>
                      setAllocation(prev => ({ ...prev, [line.key]: Number(e.target.value) }))
                    }
                    disabled={selected.status === "posted"}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 flex items-center justify-between text-sm font-bold">
              <span className="text-slate-700">Total Allocated</span>
              <span className={
                Object.values(allocation).reduce((s, v) => s + v, 0) === selected.received_amount
                  ? "text-emerald-700"
                  : "text-red-700"
              }>
                {fmt(Object.values(allocation).reduce((s, v) => s + v, 0))}
              </span>
            </div>
            {selected.status !== "posted" && (
              <button
                onClick={handlePost}
                disabled={selected.ai_status === "fail"}
                className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 hover:bg-slate-800 transition"
              >
                Approve &amp; Post
              </button>
            )}
            {selected.status === "posted" && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700">Posted</span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
              Remitter Detail
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Entity</dt>
                <dd className="font-medium text-slate-900 text-right">{selected.remitter}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Received</dt>
                <dd className="font-medium text-slate-900">{selected.received_date}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Due</dt>
                <dd className="font-medium text-slate-900">{selected.due_date}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Days Late</dt>
                <dd className={`font-bold ${selected.days_late > 5 ? "text-red-700" : selected.days_late > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {selected.days_late === 0 ? "On time" : `${selected.days_late} days`}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
