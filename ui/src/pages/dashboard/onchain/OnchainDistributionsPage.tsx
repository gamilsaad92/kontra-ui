/**
 * Distribution Engine
 *
 * Cash flows (P&I, fees) are allocated off-chain from the Kontra servicing engine
 * and pushed on-chain as verifiable distribution events. Investors receive their
 * pro-rata share based on token holdings at the distribution record date.
 *
 * Cash flow pipeline:
 *   Borrower pays → Servicer receives (wire/ACH) → Kontra waterfall engine
 *   allocates by priority (senior/mezz/equity) → Distribution event recorded
 *   → Payout: ACH/wire OR optional USDC stablecoin → Full ledger reconciliation
 *
 * Every distribution is:
 *   — Traceable to a specific loan payment record (P&I from servicing)
 *   — Verifiable on-chain as an event log with per-investor amounts
 *   — Reconciled against the off-chain servicing ledger
 */

import { useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Distribution {
  id: string;
  token_symbol: string;
  loan_ref: string;
  property_name: string;
  record_date: string;
  payment_date: string;
  period: string;
  total_principal: number;
  total_interest: number;
  total_fees: number;
  total_amount: number;
  per_token_amount: number;
  status: "scheduled" | "processing" | "completed" | "failed";
  payout_method: "ach_wire" | "usdc" | "both";
  servicing_record_id: string;
  allocations: { investor: string; tokens: number; amount: number; status: "paid" | "pending" | "failed" }[];
}

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_DISTRIBUTIONS: Distribution[] = [
  {
    id: "dist-001",
    token_symbol: "KTRA-2847", loan_ref: "LN-2847", property_name: "The Meridian Apartments",
    record_date: "2026-04-28", payment_date: "2026-05-01", period: "May 2026",
    total_principal: 12500, total_interest: 19250, total_fees: 0, total_amount: 31750,
    per_token_amount: 0.756, status: "scheduled", payout_method: "ach_wire",
    servicing_record_id: "PMT-2026-05-2847",
    allocations: [
      { investor: "Blackstone Real Estate Partners XII LP", tokens: 12500, amount: 9450,  status: "pending" },
      { investor: "Meridian Capital Partners LLC",          tokens: 5000,  amount: 3780,  status: "pending" },
      { investor: "David Park (Individual)",                tokens: 2500,  amount: 1890,  status: "pending" },
    ],
  },
  {
    id: "dist-002",
    token_symbol: "KTRA-0728", loan_ref: "LN-0728", property_name: "Pacific Vista Industrial",
    record_date: "2026-04-28", payment_date: "2026-05-01", period: "May 2026",
    total_principal: 18750, total_interest: 26250, total_fees: 0, total_amount: 45000,
    per_token_amount: 1.406, status: "scheduled", payout_method: "usdc",
    servicing_record_id: "PMT-2026-05-0728",
    allocations: [
      { investor: "Harrington Global Fund (Cayman Islands)", tokens: 10000, amount: 14060, status: "pending" },
    ],
  },
  {
    id: "dist-003",
    token_symbol: "KTRA-2847", loan_ref: "LN-2847", property_name: "The Meridian Apartments",
    record_date: "2026-03-31", payment_date: "2026-04-01", period: "April 2026",
    total_principal: 12500, total_interest: 19250, total_fees: 0, total_amount: 31750,
    per_token_amount: 0.756, status: "completed", payout_method: "ach_wire",
    servicing_record_id: "PMT-2026-04-2847",
    allocations: [
      { investor: "Blackstone Real Estate Partners XII LP", tokens: 12500, amount: 9450,  status: "paid" },
      { investor: "Meridian Capital Partners LLC",          tokens: 5000,  amount: 3780,  status: "paid" },
      { investor: "David Park (Individual)",                tokens: 2500,  amount: 1890,  status: "paid" },
    ],
  },
  {
    id: "dist-004",
    token_symbol: "KTRA-3201", loan_ref: "LN-3201", property_name: "Rosewood Medical Plaza",
    record_date: "2026-03-31", payment_date: "2026-04-01", period: "April 2026",
    total_principal: 25000, total_interest: 38542, total_fees: 0, total_amount: 63542,
    per_token_amount: 2.269, status: "completed", payout_method: "ach_wire",
    servicing_record_id: "PMT-2026-04-3201",
    allocations: [
      { investor: "Blackstone Real Estate Partners XII LP", tokens: 8000, amount: 18152, status: "paid" },
    ],
  },
];

const STATUS_CONFIG: Record<string, { label: string; classes: string; icon: typeof CheckCircleIcon }> = {
  scheduled:  { label: "Scheduled",   classes: "bg-blue-50 text-blue-700 border border-blue-200",   icon: ClockIcon },
  processing: { label: "Processing",  classes: "bg-amber-50 text-amber-700 border border-amber-200", icon: ArrowPathIcon },
  completed:  { label: "Completed",   classes: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircleIcon },
  failed:     { label: "Failed",      classes: "bg-red-50 text-red-700 border border-red-200",       icon: ExclamationTriangleIcon },
};

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtFull = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function OnchainDistributionsPage() {
  const [expandedId, setExpandedId] = useState<string | null>("dist-001");
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed">("all");

  const filtered = DEMO_DISTRIBUTIONS.filter((d) => filter === "all" || d.status === filter);

  const upcoming = DEMO_DISTRIBUTIONS.filter((d) => d.status === "scheduled");
  const totalUpcoming = upcoming.reduce((s, d) => s + d.total_amount, 0);
  const totalPaid = DEMO_DISTRIBUTIONS.filter((d) => d.status === "completed").reduce((s, d) => s + d.total_amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Distribution Engine</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          P&I cash flows allocated from the servicing engine and distributed pro-rata to token holders. Every distribution is tied to a servicing payment record and verifiable on-chain.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Upcoming (May 2026)", value: fmt(totalUpcoming), color: "text-slate-900" },
          { label: "Paid YTD",            value: fmt(totalPaid),     color: "text-emerald-700" },
          { label: "Active Tokens",        value: "4",               color: "text-slate-900" },
          { label: "Total Investors",      value: "4",               color: "text-slate-900" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className={`text-2xl font-black mt-1 tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "scheduled", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors capitalize ${
              filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "all" ? "All Distributions" : f === "scheduled" ? "Upcoming" : "Completed"}
          </button>
        ))}
      </div>

      {/* Distribution list */}
      <div className="space-y-4">
        {filtered.map((dist) => {
          const sc = STATUS_CONFIG[dist.status];
          const StatusIcon = sc.icon;
          const isExpanded = expandedId === dist.id;

          return (
            <div key={dist.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              {/* Distribution header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : dist.id)}
                className="w-full text-left px-6 py-4 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black tracking-widest text-slate-400">{dist.token_symbol}</span>
                    <span className="text-xs text-slate-400">{dist.loan_ref} · {dist.property_name}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${sc.classes}`}>
                      <StatusIcon className="h-3 w-3" />
                      {sc.label}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${dist.payout_method === "usdc" ? "bg-violet-50 text-violet-700 border border-violet-200" : "bg-slate-100 text-slate-600"}`}>
                      {dist.payout_method === "usdc" ? "USDC Stablecoin" : "ACH / Wire"}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {dist.period} Distribution — <span className="text-emerald-700">{fmt(dist.total_amount)} total</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Record Date {fmtDate(dist.record_date)} · Payment Date {fmtDate(dist.payment_date)} · {fmtFull(dist.per_token_amount)}/token · Servicing Ref: {dist.servicing_record_id}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">P&I Breakdown</p>
                    <p className="text-xs text-slate-600 font-mono">{fmt(dist.total_principal)} principal + {fmt(dist.total_interest)} interest</p>
                  </div>
                  <span className="text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Investor allocations */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Per-Investor Allocation</h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-white">
                        <tr>
                          {["Investor", "Token Holdings", "Distribution Amount", "Status"].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-widest text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {dist.allocations.map((a, i) => (
                          <tr key={i}>
                            <td className="px-4 py-3 text-sm text-slate-800">{a.investor}</td>
                            <td className="px-4 py-3 text-sm font-mono text-slate-700">{a.tokens.toLocaleString()} {dist.token_symbol}</td>
                            <td className="px-4 py-3 text-sm font-bold text-emerald-700 tabular-nums">{fmtFull(a.amount)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                a.status === "paid"    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                a.status === "pending" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                         "bg-red-50 text-red-700 border border-red-200"
                              }`}>
                                {a.status === "paid" ? <CheckCircleIcon className="h-3 w-3" /> : <ClockIcon className="h-3 w-3" />}
                                {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold">
                          <td className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-widest" colSpan={2}>Total</td>
                          <td className="px-4 py-3 text-sm font-black text-slate-900 tabular-nums">{fmt(dist.total_amount)}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {dist.status === "scheduled" && (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => alert(`Distribution triggered. ${dist.total_amount.toLocaleString("en-US", { style: "currency", currency: "USD" })} will be distributed to ${dist.allocations.length} investor(s) on ${fmtDate(dist.payment_date)}. On-chain event recorded.`)}
                        className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors"
                      >
                        <BanknotesIcon className="h-4 w-4" />
                        Trigger Distribution
                      </button>
                      <p className="text-xs text-slate-400">Distribution will be executed via {dist.payout_method === "usdc" ? "USDC stablecoin transfer" : "ACH/wire transfer"} on {fmtDate(dist.payment_date)}.</p>
                    </div>
                  )}

                  {dist.status === "completed" && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold">
                      <CheckCircleIcon className="h-4 w-4" />
                      Distribution completed and reconciled against servicing ledger record {dist.servicing_record_id}. On-chain event logged.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Regulatory footer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-xs font-bold text-slate-600 mb-1">Distribution Compliance</p>
        <p className="text-xs text-slate-500">
          Distributions are calculated from Kontra's off-chain servicing engine using verified P&I collection data. Reg S offshore investors are subject to the 40-day distribution compliance period — no distributions may be made to U.S. persons during this period. All distribution events are recorded on-chain and reconciled against the off-chain servicing ledger. USDC stablecoin payouts are processed via audited smart contract escrow.
        </p>
      </div>
    </div>
  );
}
