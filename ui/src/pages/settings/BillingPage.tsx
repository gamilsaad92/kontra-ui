import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/apiClient";

type Pricing = {
  per_loan_price: number;
  transaction_fee_pct: number;
  billing_email: string | null;
  stripe_customer_id: string | null;
};

type Summary = {
  period: { start: string; end: string };
  pricing: Pricing;
  loan_count: number;
  loan_charges: number;
  transaction_volume: number;
  transaction_fees: number;
  total_amount: number;
  transaction_count: number;
};

type Transaction = {
  id: string;
  loan_id: string | null;
  transaction_amount: number;
  fee_amount: number;
  type: string;
  description: string | null;
  created_at: string;
};

type BillingRecord = {
  id: string;
  period_start: string;
  period_end: string;
  loan_count: number;
  loan_charges: number;
  transaction_volume: number;
  transaction_fees: number;
  total_amount: number;
  status: "draft" | "finalized" | "paid" | "overdue";
  stripe_invoice_id: string | null;
  created_at: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);

const fmtPct = (n: number) => `${((n ?? 0) * 100).toFixed(3)}%`;

const periodLabel = (start: string, end: string) => {
  const s = new Date(start + "T00:00:00");
  return s.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const statusStyle: Record<BillingRecord["status"], string> = {
  draft:     "bg-slate-100 text-slate-600",
  finalized: "bg-amber-50 text-amber-700 border border-amber-200",
  paid:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  overdue:   "bg-brand-50 text-brand-700 border border-brand-200",
};

const TX_TYPES = ["loan_payment", "draw", "escrow", "payoff", "other"];

export default function BillingPage() {
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [transactions, setTxns]       = useState<Transaction[]>([]);
  const [records, setRecords]         = useState<BillingRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // Pricing edit state
  const [editPricing, setEditPricing]   = useState(false);
  const [pricingForm, setPricingForm]   = useState({ per_loan_price: "50", transaction_fee_pct: "0.25", billing_email: "" });
  const [savingPricing, setSavingPricing] = useState(false);
  const [pricingMsg, setPricingMsg]     = useState<string | null>(null);

  // New transaction form
  const [showTxForm, setShowTxForm]   = useState(false);
  const [txForm, setTxForm]           = useState({ transaction_amount: "", type: "loan_payment", description: "", loan_id: "" });
  const [savingTx, setSavingTx]       = useState(false);
  const [txMsg, setTxMsg]             = useState<string | null>(null);

  // Run cycle
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleMsg, setCycleMsg]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, txRes, recRes] = await Promise.all([
        api.get<Summary>("/billing/summary"),
        api.get<{ transactions: Transaction[] }>("/billing/transactions", { params: { limit: "25" } }),
        api.get<{ records: BillingRecord[] }>("/billing/records"),
      ]);
      setSummary(sumRes.data);
      setTxns(txRes.data?.transactions ?? []);
      setRecords(recRes.data?.records ?? []);
      if (sumRes.data?.pricing) {
        setPricingForm({
          per_loan_price:      String(sumRes.data.pricing.per_loan_price ?? 50),
          transaction_fee_pct: String(((sumRes.data.pricing.transaction_fee_pct ?? 0.0025) * 100).toFixed(4)),
          billing_email:       sumRes.data.pricing.billing_email ?? "",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const savePricing = async () => {
    setSavingPricing(true);
    setPricingMsg(null);
    try {
      await api.patch("/billing/pricing", {
        per_loan_price:      parseFloat(pricingForm.per_loan_price),
        transaction_fee_pct: parseFloat(pricingForm.transaction_fee_pct) / 100,
        billing_email:       pricingForm.billing_email || null,
      });
      setPricingMsg("Pricing saved.");
      setEditPricing(false);
      load();
    } catch (e) {
      setPricingMsg(e instanceof Error ? e.message : "Failed to save pricing");
    } finally {
      setSavingPricing(false);
    }
  };

  const recordTransaction = async () => {
    if (!txForm.transaction_amount || isNaN(parseFloat(txForm.transaction_amount))) {
      setTxMsg("Enter a valid amount"); return;
    }
    setSavingTx(true);
    setTxMsg(null);
    try {
      await api.post("/billing/transactions", {
        transaction_amount: parseFloat(txForm.transaction_amount),
        type: txForm.type,
        description: txForm.description || null,
        loan_id: txForm.loan_id || null,
      });
      setTxMsg("Transaction recorded.");
      setShowTxForm(false);
      setTxForm({ transaction_amount: "", type: "loan_payment", description: "", loan_id: "" });
      load();
    } catch (e) {
      setTxMsg(e instanceof Error ? e.message : "Failed to record transaction");
    } finally {
      setSavingTx(false);
    }
  };

  const runCycle = async (finalize = false) => {
    setRunningCycle(true);
    setCycleMsg(null);
    try {
      const res = await api.post<{ record: BillingRecord }>("/billing/records/run-cycle", { finalize });
      const r = res.data?.record;
      setCycleMsg(`Cycle ${finalize ? "finalized" : "computed"}: ${fmt(r?.total_amount ?? 0)} total for ${periodLabel(r?.period_start ?? "", r?.period_end ?? "")}`);
      load();
    } catch (e) {
      setCycleMsg(e instanceof Error ? e.message : "Failed to run cycle");
    } finally {
      setRunningCycle(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <span className="text-sm text-slate-500">Loading billing data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-700">
        {error}
        <button onClick={load} className="ml-3 underline underline-offset-4 font-semibold">Retry</button>
      </div>
    );
  }

  const p = summary?.pricing ?? { per_loan_price: 50, transaction_fee_pct: 0.0025 };

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Settings</p>
          <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
          <p className="text-sm text-slate-500 mt-1">
            Hybrid pricing — monthly loan-based fees + transaction volume fees. Stripe-ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runCycle(false)}
            disabled={runningCycle}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {runningCycle ? "Computing…" : "Preview Cycle"}
          </button>
          <button
            onClick={() => runCycle(true)}
            disabled={runningCycle}
            className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            Finalize &amp; Invoice
          </button>
        </div>
      </header>

      {cycleMsg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex items-center justify-between">
          {cycleMsg}
          <button onClick={() => setCycleMsg(null)} className="text-slate-400 hover:text-slate-700 font-bold ml-4">✕</button>
        </div>
      )}

      {/* ── Current Period Summary ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Current Billing Period</p>
            <p className="text-lg font-bold text-slate-900">
              {summary ? periodLabel(summary.period.start, summary.period.end) : "—"}
            </p>
          </div>
          <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-700">
            In Progress
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-slate-100">
          {[
            { label: "Active Loans",       value: String(summary?.loan_count ?? 0),               sub: `@ ${fmt(p.per_loan_price)}/loan` },
            { label: "Loan Revenue",       value: fmt(summary?.loan_charges ?? 0),                sub: "Fixed monthly" },
            { label: "Tx Volume",          value: fmt(summary?.transaction_volume ?? 0),          sub: `${summary?.transaction_count ?? 0} transactions` },
            { label: "Tx Fees",            value: fmt(summary?.transaction_fees ?? 0),            sub: `@ ${fmtPct(p.transaction_fee_pct)}` },
            { label: "Total This Period",  value: fmt(summary?.total_amount ?? 0),                sub: "Loan + Tx fees", accent: true },
            { label: "Projected Monthly",  value: fmt(summary?.total_amount ?? 0),                sub: "Based on current pace" },
          ].map((stat) => (
            <div key={stat.label} className={`px-5 py-4 ${stat.accent ? "bg-brand-50" : ""}`}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className={`mt-1 text-xl font-black tabular-nums ${stat.accent ? "text-brand-700" : "text-slate-900"}`}>
                {stat.value}
              </p>
              <p className="text-xs text-slate-500">{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pricing Config ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Pricing configuration</h2>
            <p className="text-xs text-slate-500 mt-0.5">Configurable per organization — not hardcoded</p>
          </div>
          {!editPricing && (
            <button
              onClick={() => setEditPricing(true)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {!editPricing ? (
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Per-Loan Price</p>
                <p className="mt-2 text-3xl font-black text-slate-900 tabular-nums">{fmt(p.per_loan_price)}</p>
                <p className="text-xs text-slate-500 mt-1">Per active loan / month</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Transaction Fee</p>
                <p className="mt-2 text-3xl font-black text-slate-900 tabular-nums">{fmtPct(p.transaction_fee_pct)}</p>
                <p className="text-xs text-slate-500 mt-1">Of every platform transaction</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Billing Email</p>
                <p className="mt-2 text-sm font-semibold text-slate-800 break-all">
                  {summary?.pricing?.billing_email ?? <span className="text-slate-400 italic">Not set</span>}
                </p>
                <p className="text-xs text-slate-500 mt-1">Invoice recipient</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                    Per-Loan Price ($ / month)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingForm.per_loan_price}
                    onChange={(e) => setPricingForm((f) => ({ ...f, per_loan_price: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                    placeholder="50.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                    Transaction Fee (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={pricingForm.transaction_fee_pct}
                    onChange={(e) => setPricingForm((f) => ({ ...f, transaction_fee_pct: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                    placeholder="0.250"
                  />
                  <p className="mt-1 text-xs text-slate-400">Enter as percentage (e.g. 0.25 = 0.25%)</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={pricingForm.billing_email}
                    onChange={(e) => setPricingForm((f) => ({ ...f, billing_email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                    placeholder="billing@yourorg.com"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={savePricing}
                  disabled={savingPricing}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {savingPricing ? "Saving…" : "Save Pricing"}
                </button>
                <button
                  onClick={() => { setEditPricing(false); setPricingMsg(null); }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                {pricingMsg && <p className="text-sm text-slate-600">{pricingMsg}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stripe Readiness Banner ── */}
      <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white font-black text-sm">S</div>
        <div className="flex-1">
          <p className="font-bold text-slate-900 text-sm">Stripe payment integration ready</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Each billing record stores a <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">stripe_invoice_id</code> field.
            When you connect Stripe, finalized records will automatically create invoices via Stripe Billing.
            Organizations store a <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">stripe_customer_id</code> for direct customer mapping.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">Not Connected</span>
      </div>

      {/* ── Billing Records ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Billing history</h2>
          <span className="text-xs text-slate-400">{records.length} period{records.length !== 1 ? "s" : ""}</span>
        </div>
        {records.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No billing records yet. Run a billing cycle to generate the first record.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Period","Loans","Loan Revenue","Tx Volume","Tx Fees","Total","Status"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {periodLabel(r.period_start, r.period_end)}
                    </td>
                    <td className="px-5 py-3 text-slate-700 tabular-nums">{r.loan_count}</td>
                    <td className="px-5 py-3 text-slate-700 tabular-nums">{fmt(r.loan_charges)}</td>
                    <td className="px-5 py-3 text-slate-700 tabular-nums">{fmt(r.transaction_volume)}</td>
                    <td className="px-5 py-3 text-slate-700 tabular-nums">{fmt(r.transaction_fees)}</td>
                    <td className="px-5 py-3 font-bold text-slate-900 tabular-nums">{fmt(r.total_amount)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${statusStyle[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Transactions ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Platform transactions</h2>
          <button
            onClick={() => { setShowTxForm(!showTxForm); setTxMsg(null); }}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 transition-colors"
          >
            + Record Transaction
          </button>
        </div>

        {/* Record transaction form */}
        {showTxForm && (
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">New Transaction</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={txForm.transaction_amount}
                  onChange={(e) => setTxForm((f) => ({ ...f, transaction_amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
                <select
                  value={txForm.type}
                  onChange={(e) => setTxForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                >
                  {TX_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Loan ID (optional)</label>
                <input
                  value={txForm.loan_id}
                  onChange={(e) => setTxForm((f) => ({ ...f, loan_id: e.target.value }))}
                  placeholder="loan-xxx"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                <input
                  value={txForm.description}
                  onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional note"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                />
              </div>
            </div>
            {txForm.transaction_amount && !isNaN(parseFloat(txForm.transaction_amount)) && (
              <p className="mt-2 text-xs text-slate-500">
                Computed fee: <strong>{fmt(parseFloat(txForm.transaction_amount) * (p.transaction_fee_pct ?? 0.0025))}</strong>
                {" "}({fmtPct(p.transaction_fee_pct)} of {fmt(parseFloat(txForm.transaction_amount))})
              </p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={recordTransaction}
                disabled={savingTx}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {savingTx ? "Recording…" : "Record"}
              </button>
              <button
                onClick={() => { setShowTxForm(false); setTxMsg(null); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              {txMsg && <p className="text-sm text-slate-600">{txMsg}</p>}
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No transactions recorded yet this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Date","Type","Description","Loan","Amount","Fee"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 capitalize">
                        {tx.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700 max-w-[200px] truncate">{tx.description ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{tx.loan_id ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900 tabular-nums">{fmt(tx.transaction_amount)}</td>
                    <td className="px-5 py-3 text-brand-700 font-semibold tabular-nums">{fmt(tx.fee_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={4} className="px-5 py-3 text-xs font-bold text-slate-500">TOTALS (shown)</td>
                  <td className="px-5 py-3 font-bold text-slate-900 tabular-nums">
                    {fmt(transactions.reduce((s, t) => s + t.transaction_amount, 0))}
                  </td>
                  <td className="px-5 py-3 font-bold text-brand-700 tabular-nums">
                    {fmt(transactions.reduce((s, t) => s + t.fee_amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
