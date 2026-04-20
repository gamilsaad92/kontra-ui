/**
 * Loan Syndication & Capital Stack — Stage 4
 * Route: /portfolio/syndication
 *
 * The "Nasdaq for CRE" piece — structure funded loans into tradeable tranches,
 * issue participation certificates, track investor allocations, and simulate
 * the payment distribution waterfall across the capital stack.
 *
 * Capital stack structure:
 *   Senior A Tranche   → First-loss protection, lowest rate
 *   Senior B Tranche   → Slightly subordinate
 *   Mezzanine          → Subordinate debt, higher yield
 *   Preferred Equity   → JROC position
 *   Common Equity      → Sponsor equity
 *
 * Kontra issues ERC-1400 security tokens for each tranche position.
 */

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  UserGroupIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
type TrancheClass = "A" | "B" | "Mez" | "PrefEquity" | "Equity";
type TrancheStatus = "open" | "subscribed" | "closed" | "funded";

interface Investor {
  name: string;
  allocation: number;
  token_balance: number;
  committed_date: string;
  status: "funded" | "committed" | "pending";
}

interface Tranche {
  id: string;
  class: TrancheClass;
  label: string;
  size: number;
  rate: number;
  ltv_band: string;
  priority: number;
  status: TrancheStatus;
  token_symbol: string;
  investors: Investor[];
  description: string;
}

interface SyndicatedLoan {
  loan_ref: string;
  borrower: string;
  property: string;
  property_type: string;
  total_loan: number;
  appraised_value: number;
  ltv: number;
  dscr: number;
  tranches: Tranche[];
  distribution_history: { date: string; total: number; breakdown: { tranche: TrancheClass; amount: number }[] }[];
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const LOANS: SyndicatedLoan[] = [
  {
    loan_ref: "LN-2847",
    borrower: "Cedar Grove Partners",
    property: "412 Meridian Blvd — Multifamily 24 Units",
    property_type: "Multifamily",
    total_loan: 4_112_500,
    appraised_value: 5_875_000,
    ltv: 70.0,
    dscr: 1.138,
    tranches: [
      {
        id: "t1", class: "A", label: "Senior A", size: 2_057_000, rate: 7.25, ltv_band: "0–35%", priority: 1,
        status: "funded", token_symbol: "KTRA-2847-A",
        description: "First-priority mortgage lien. Lowest risk position in the capital stack.",
        investors: [
          { name: "Apex Institutional Fund I", allocation: 1_200_000, token_balance: 1_200_000, committed_date: "2025-06-01", status: "funded" },
          { name: "Meridian Life Insurance Co.", allocation:   857_000, token_balance:   857_000, committed_date: "2025-06-01", status: "funded" },
        ],
      },
      {
        id: "t2", class: "B", label: "Senior B", size: 1_234_500, rate: 8.50, ltv_band: "35–65%", priority: 2,
        status: "funded", token_symbol: "KTRA-2847-B",
        description: "Second-priority lien. Pari passu with Senior A in default; subordinate in cash flow priority.",
        investors: [
          { name: "Cornerstone Capital Partners", allocation:   750_000, token_balance:   750_000, committed_date: "2025-06-15", status: "funded" },
          { name: "Harbor Bridge Credit Fund", allocation:   484_500, token_balance:   484_500, committed_date: "2025-06-18", status: "funded" },
        ],
      },
      {
        id: "t3", class: "Mez", label: "Mezzanine", size: 617_000, rate: 11.00, ltv_band: "65–75%", priority: 3,
        status: "subscribed", token_symbol: "KTRA-2847-MEZ",
        description: "Subordinate debt. Intercreditor agreement in place. Cure rights granted.",
        investors: [
          { name: "Redwood Mezz Capital LLC", allocation: 617_000, token_balance: 617_000, committed_date: "2025-07-02", status: "committed" },
        ],
      },
      {
        id: "t4", class: "PrefEquity", label: "Preferred Equity", size: 204_000, rate: 14.00, ltv_band: "75–78.5%", priority: 4,
        status: "open", token_symbol: "KTRA-2847-PE",
        description: "Preferred return before common equity distributions. Conversion rights at maturity.",
        investors: [],
      },
    ],
    distribution_history: [
      { date: "Apr 2026", total: 29_987, breakdown: [{ tranche:"A", amount:12_426 }, { tranche:"B", amount:8_744 }, { tranche:"Mez", amount:5_656 }, { tranche:"PrefEquity", amount:2_380 }] },
      { date: "Mar 2026", total: 29_987, breakdown: [{ tranche:"A", amount:12_426 }, { tranche:"B", amount:8_744 }, { tranche:"Mez", amount:5_656 }, { tranche:"PrefEquity", amount:2_380 }] },
      { date: "Feb 2026", total: 29_987, breakdown: [{ tranche:"A", amount:12_426 }, { tranche:"B", amount:8_744 }, { tranche:"Mez", amount:5_656 }, { tranche:"PrefEquity", amount:2_380 }] },
    ],
  },
  {
    loan_ref: "LN-3201",
    borrower: "Metro Development LLC",
    property: "55 Commerce Blvd — Industrial 48,000 SF",
    property_type: "Industrial",
    total_loan: 5_520_000,
    appraised_value: 7_100_000,
    ltv: 77.7,
    dscr: 1.189,
    tranches: [
      {
        id: "t1", class: "A", label: "Senior A", size: 3_000_000, rate: 7.00, ltv_band: "0–42%", priority: 1,
        status: "funded", token_symbol: "KTRA-3201-A",
        description: "First-priority mortgage lien on industrial facility.",
        investors: [
          { name: "National Bank of Commerce", allocation: 3_000_000, token_balance: 3_000_000, committed_date: "2025-09-01", status: "funded" },
        ],
      },
      {
        id: "t2", class: "B", label: "Senior B", size: 1_720_000, rate: 8.75, ltv_band: "42–66%", priority: 2,
        status: "funded", token_symbol: "KTRA-3201-B",
        description: "Pari passu with Senior A. Institutional participation.",
        investors: [
          { name: "Titan Credit Opportunities", allocation: 1_000_000, token_balance: 1_000_000, committed_date: "2025-09-10", status: "funded" },
          { name: "Summit Yield Fund", allocation:   720_000, token_balance:   720_000, committed_date: "2025-09-12", status: "funded" },
        ],
      },
      {
        id: "t3", class: "Mez", label: "Mezzanine", size: 800_000, rate: 12.50, ltv_band: "66–78%", priority: 3,
        status: "open", token_symbol: "KTRA-3201-MEZ",
        description: "Mezzanine bridge position. 18-month term with extension option.",
        investors: [
          { name: "Bluestone Mezz Partners", allocation: 500_000, token_balance: 500_000, committed_date: "2025-10-01", status: "committed" },
        ],
      },
    ],
    distribution_history: [
      { date: "Apr 2026", total: 41_270, breakdown: [{ tranche:"A", amount:17_500 }, { tranche:"B", amount:12_542 }, { tranche:"Mez", amount:8_333 }] },
      { date: "Mar 2026", total: 41_270, breakdown: [{ tranche:"A", amount:17_500 }, { tranche:"B", amount:12_542 }, { tranche:"Mez", amount:8_333 }] },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(3)}M`;

const TRANCHE_COLORS: Record<TrancheClass, { bar: string; badge: string; text: string }> = {
  A:         { bar: "bg-slate-800",   badge: "bg-slate-100 text-slate-700",   text: "text-slate-800" },
  B:         { bar: "bg-blue-600",    badge: "bg-blue-100 text-blue-700",     text: "text-blue-700" },
  Mez:       { bar: "bg-violet-600",  badge: "bg-violet-100 text-violet-700", text: "text-violet-700" },
  PrefEquity:{ bar: "bg-amber-500",   badge: "bg-amber-100 text-amber-700",   text: "text-amber-700" },
  Equity:    { bar: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-700",text: "text-emerald-700" },
};

const STATUS_BADGE: Record<TrancheStatus, string> = {
  funded:     "bg-emerald-100 text-emerald-700",
  subscribed: "bg-blue-100 text-blue-700",
  open:       "bg-amber-100 text-amber-700",
  closed:     "bg-slate-100 text-slate-500",
};

const INV_STATUS_BADGE: Record<Investor["status"], string> = {
  funded:    "bg-emerald-100 text-emerald-700",
  committed: "bg-blue-100 text-blue-700",
  pending:   "bg-amber-100 text-amber-700",
};

export default function LoanSyndicationPage() {
  const [selectedRef, setSelectedRef] = useState(LOANS[0].loan_ref);
  const [expandedTranche, setExpandedTranche] = useState<string | null>("t1");
  const [showDistributions, setShowDistributions] = useState(false);

  const loan = LOANS.find(l => l.loan_ref === selectedRef) ?? LOANS[0];
  const totalSubscribed = loan.tranches.reduce((s, t) => s + t.investors.reduce((a, i) => a + i.allocation, 0), 0);
  const totalCapacity = loan.tranches.reduce((s, t) => s + t.size, 0);
  const pctFilled = (totalSubscribed / totalCapacity) * 100;

  return (
    <div className="space-y-6">
      {/* Loan selector */}
      <div className="flex flex-wrap gap-2">
        {LOANS.map(l => (
          <button key={l.loan_ref} onClick={() => { setSelectedRef(l.loan_ref); setExpandedTranche("t1"); }}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${selectedRef === l.loan_ref ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}
          >
            {l.loan_ref} — {l.property_type}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{loan.borrower}</h2>
          <p className="text-sm text-slate-500">{loan.property}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDistributions(d => !d)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <ArrowPathIcon className="h-4 w-4" />
            {showDistributions ? "Hide" : "Show"} Distributions
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <DocumentArrowDownIcon className="h-4 w-4" />
            Export Participation Certs
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"Total Loan",     value: fmtM(loan.total_loan),          icon: BanknotesIcon },
          { label:"Appraised Value",value: fmtM(loan.appraised_value),     icon: ChartBarIcon },
          { label:"LTV",            value: `${loan.ltv.toFixed(1)}%`,      icon: ShieldCheckIcon },
          { label:"Subscribed",     value: `${pctFilled.toFixed(1)}%`,     icon: UserGroupIcon },
        ].map(kpi => (
          <div key={kpi.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <kpi.icon className="h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className="text-base font-bold text-slate-900 tabular-nums">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Capital stack + tranches */}
        <div className="space-y-4">
          {/* Visual capital stack */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Capital Stack — {fmtM(loan.total_loan)} Total</p>
            <div className="space-y-1.5">
              {[...loan.tranches].sort((a, b) => b.priority - a.priority).map(t => {
                const pct = (t.size / loan.total_loan) * 100;
                const colors = TRANCHE_COLORS[t.class];
                const subscribed = t.investors.reduce((s, i) => s + i.allocation, 0);
                const subPct = t.size > 0 ? (subscribed / t.size) * 100 : 0;
                return (
                  <div key={t.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-semibold ${colors.text}`}>{t.label}</span>
                      <span className="text-slate-500">{t.ltv_band} LTV · {fmtM(t.size)} · {t.rate}%</span>
                    </div>
                    <div className="relative h-8 w-full overflow-hidden rounded-lg bg-slate-100">
                      <div className={`h-full rounded-lg ${colors.bar} opacity-20`} style={{ width:`${pct}%` }} />
                      <div className={`absolute inset-y-0 left-0 rounded-lg ${colors.bar}`} style={{ width:`${(subPct/100)*pct}%` }} />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-xs font-semibold text-white drop-shadow">{subPct.toFixed(0)}% subscribed</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tranche detail cards */}
          <div className="space-y-3">
            {loan.tranches.map(t => {
              const colors = TRANCHE_COLORS[t.class];
              const subscribed = t.investors.reduce((s, i) => s + i.allocation, 0);
              const remaining = t.size - subscribed;
              const isOpen = expandedTranche === t.id;

              return (
                <div key={t.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {/* Tranche header */}
                  <button
                    onClick={() => setExpandedTranche(isOpen ? null : t.id)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${colors.badge}`}>{t.class}</span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{t.label}</p>
                        <p className="text-xs text-slate-500">{t.token_symbol} · {t.rate}% · {t.ltv_band} LTV</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 tabular-nums">{fmtM(t.size)}</p>
                        <p className="text-xs text-slate-400">{remaining > 0 ? `${fmtM(remaining)} available` : "Fully subscribed"}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[t.status]}`}>
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>
                      {isOpen ? <ChevronUpIcon className="h-4 w-4 text-slate-400" /> : <ChevronDownIcon className="h-4 w-4 text-slate-400" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 pb-4 pt-3">
                      <p className="mb-3 text-xs text-slate-500">{t.description}</p>

                      {/* Investors table */}
                      {t.investors.length > 0 ? (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Investors ({t.investors.length})</p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                <th className="pb-1.5 text-left">Investor</th>
                                <th className="pb-1.5 text-right">Allocation</th>
                                <th className="pb-1.5 text-right">Tokens</th>
                                <th className="pb-1.5 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {t.investors.map((inv, i) => (
                                <tr key={i}>
                                  <td className="py-1.5 font-medium text-slate-900">{inv.name}</td>
                                  <td className="py-1.5 text-right tabular-nums text-slate-700">{fmt(inv.allocation)}</td>
                                  <td className="py-1.5 text-right tabular-nums text-slate-500">{inv.token_balance.toLocaleString()}</td>
                                  <td className="py-1.5 text-right">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${INV_STATUS_BADGE[inv.status]}`}>
                                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center">
                          <p className="text-xs text-slate-400">No investors subscribed yet</p>
                          <p className="text-xs text-slate-400">{fmtM(t.size)} available at {t.rate}%</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-3 flex gap-2">
                        {t.status === "open" && (
                          <button className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition">
                            <PlusIcon className="h-3.5 w-3.5" />
                            Add Investor
                          </button>
                        )}
                        <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
                          <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                          Participation Agreement
                        </button>
                        <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
                          Token Registry
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel — distribution waterfall */}
        <div className="space-y-4">
          {/* Subscription progress */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Subscription Progress</p>
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Subscribed</span>
                <span className="font-bold text-slate-900">{pctFilled.toFixed(1)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${pctFilled}%` }} />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {loan.tranches.map(t => {
                const sub = t.investors.reduce((s, i) => s + i.allocation, 0);
                const pct = t.size > 0 ? (sub / t.size) * 100 : 0;
                const colors = TRANCHE_COLORS[t.class];
                return (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <span className={`inline-flex w-8 shrink-0 items-center justify-center rounded-full py-0.5 text-[10px] font-bold ${colors.badge}`}>{t.class}</span>
                    <div className="flex-1">
                      <div className="h-1.5 w-full rounded bg-slate-100">
                        <div className={`h-full rounded ${colors.bar}`} style={{ width:`${pct}%` }} />
                      </div>
                    </div>
                    <span className="w-8 text-right tabular-nums text-slate-500">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distribution waterfall */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Distribution Waterfall</p>
            <p className="text-xs text-slate-400 mb-3">Monthly payment flows through tranches by priority</p>
            <div className="space-y-2">
              {loan.tranches.map(t => {
                const monthly = Math.round((t.size * t.rate / 100) / 12);
                const colors = TRANCHE_COLORS[t.class];
                return (
                  <div key={t.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${colors.badge}`}>P{t.priority}</span>
                        <span className="text-xs font-semibold text-slate-800">{t.label}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900 tabular-nums">{fmt(monthly)}/mo</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{t.rate}% × {fmtM(t.size)} ÷ 12</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-700">Total monthly to investors</span>
                <span className="text-slate-900 tabular-nums">
                  {fmt(loan.tranches.reduce((s, t) => s + Math.round((t.size * t.rate / 100) / 12), 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Distribution history */}
          {showDistributions && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Distribution History</p>
              {loan.distribution_history.map((d, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                    <span>{d.date}</span><span>{fmt(d.total)}</span>
                  </div>
                  {d.breakdown.map(b => {
                    const colors = TRANCHE_COLORS[b.tranche];
                    return (
                      <div key={b.tranche} className="flex justify-between text-xs">
                        <span className={colors.text}>{b.tranche === "Mez" ? "Mezzanine" : b.tranche === "PrefEquity" ? "Pref. Equity" : `Senior ${b.tranche}`}</span>
                        <span className="tabular-nums text-slate-600">{fmt(b.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
