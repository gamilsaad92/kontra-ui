/**
 * Investor Portal — Read-only view of holdings, distributions, governance, and risk.
 * Investors CANNOT execute servicing actions. All servicing stays in the lender execution layer.
 * Treat this as a separate product on top of the same Kontra backend.
 */
import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/apiClient";
import {
  ChartPieIcon,
  BanknotesIcon,
  ChartBarIcon,
  ScaleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ArrowRightStartOnRectangleIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

// ── Types ─────────────────────────────────────────────────────
type Holding = {
  loan_id: string; loan_ref: string; property_name: string; property_type: string;
  location: string; upb: number; my_share_pct: number; my_share_usd: number;
  token_balance: number; token_symbol: string; status: string; yield_pct: number;
  maturity: string;
};
type Distribution = {
  id: string; period: string; loan_ref: string; gross_amount: number;
  net_amount: number; type: string; paid_at: string; status: string;
};
type LoanPerformance = {
  loan_ref: string; property: string; dscr: number; ltv: number;
  delinquency_days: number; payment_status: string; risk_label: string;
};
type RiskAlert = {
  id: string; severity: "high" | "medium" | "low"; loan_ref: string;
  message: string; created_at: string;
};

// ── Demo data ─────────────────────────────────────────────────
const DEMO_HOLDINGS: Holding[] = [
  { loan_id:"ln1", loan_ref:"LN-2847", property_name:"The Meridian Apartments", property_type:"Multifamily", location:"Austin, TX", upb:4200000, my_share_pct:24.5, my_share_usd:1029000, token_balance:10290, token_symbol:"KTRA-2847", status:"Current", yield_pct:8.75, maturity:"2026-09-01" },
  { loan_id:"ln2", loan_ref:"LN-3011", property_name:"Harbor Blvd Retail", property_type:"Retail", location:"San Diego, CA", upb:2800000, my_share_pct:24.5, my_share_usd:686000, token_balance:6860, token_symbol:"KTRA-3011", status:"Special Servicing", yield_pct:11.5, maturity:"2025-12-01" },
  { loan_id:"ln3", loan_ref:"LN-2741", property_name:"Westgate Industrial Park", property_type:"Industrial", location:"Phoenix, AZ", upb:6100000, my_share_pct:24.5, my_share_usd:1494500, token_balance:14945, token_symbol:"KTRA-2741", status:"Current", yield_pct:7.9, maturity:"2027-03-01" },
  { loan_id:"ln4", loan_ref:"LN-3204", property_name:"Summit Office Complex", property_type:"Office", location:"Denver, CO", upb:3500000, my_share_pct:24.5, my_share_usd:857500, token_balance:8575, token_symbol:"KTRA-3204", status:"Current", yield_pct:9.1, maturity:"2026-06-01" },
];

const DEMO_DISTRIBUTIONS: Distribution[] = [
  { id:"d1", period:"April 2026", loan_ref:"LN-2847", gross_amount:8920.63, net_amount:8027.00, type:"Interest", paid_at:"2026-04-01", status:"paid" },
  { id:"d2", period:"April 2026", loan_ref:"LN-2741", gross_amount:12150.00, net_amount:10935.00, type:"Interest", paid_at:"2026-04-01", status:"paid" },
  { id:"d3", period:"April 2026", loan_ref:"LN-3204", gross_amount:6885.42, net_amount:6196.88, type:"Interest", paid_at:"2026-04-01", status:"paid" },
  { id:"d4", period:"March 2026", loan_ref:"LN-2847", gross_amount:8920.63, net_amount:8027.00, type:"Interest", paid_at:"2026-03-01", status:"paid" },
  { id:"d5", period:"March 2026", loan_ref:"LN-2741", gross_amount:12150.00, net_amount:10935.00, type:"Interest", paid_at:"2026-03-01", status:"paid" },
  { id:"d6", period:"Q1 2026", loan_ref:"ALL", gross_amount:5400.00, net_amount:4860.00, type:"Principal Return", paid_at:"2026-03-31", status:"paid" },
  { id:"d7", period:"May 2026", loan_ref:"LN-2847", gross_amount:8920.63, net_amount:8027.00, type:"Interest", paid_at:"2026-05-01", status:"scheduled" },
  { id:"d8", period:"May 2026", loan_ref:"LN-2741", gross_amount:12150.00, net_amount:10935.00, type:"Interest", paid_at:"2026-05-01", status:"scheduled" },
];

const DEMO_PERFORMANCE: LoanPerformance[] = [
  { loan_ref:"LN-2847", property:"Meridian Apartments", dscr:1.42, ltv:68.2, delinquency_days:0, payment_status:"Current", risk_label:"Low" },
  { loan_ref:"LN-3011", property:"Harbor Blvd Retail", dscr:0.94, ltv:88.5, delinquency_days:45, payment_status:"Default", risk_label:"High" },
  { loan_ref:"LN-2741", property:"Westgate Industrial", dscr:1.68, ltv:52.1, delinquency_days:0, payment_status:"Current", risk_label:"Low" },
  { loan_ref:"LN-3204", property:"Summit Office", dscr:1.21, ltv:74.8, delinquency_days:0, payment_status:"Current", risk_label:"Medium" },
];

const DEMO_ALERTS: RiskAlert[] = [
  { id:"a1", severity:"high", loan_ref:"LN-3011", message:"Loan in special servicing — 45 days delinquent. Foreclosure proceedings initiated. Governance proposal GV-050 active for collateral disposition.", created_at:"2026-04-06T08:00:00Z" },
  { id:"a2", severity:"medium", loan_ref:"LN-3204", message:"DSCR declined to 1.21x (covenant floor 1.20x). Borrower submitted updated financials. Under review by asset manager.", created_at:"2026-04-02T10:30:00Z" },
  { id:"a3", severity:"low", loan_ref:"LN-2847", message:"Construction draw #4 of 6 funded ($340,000). Project 71% complete. On schedule.", created_at:"2026-04-01T14:15:00Z" },
];

const DEMO_GOV_PROPOSALS = [
  { id:"p1", number:"GV-051", title:"Extend LN-2847 Maturity by 18 Months", type:"Loan Extension", votes_for_pct:78.3, votes_against_pct:12.4, threshold_pct:66.7, quorum_met:true, deadline_days:7, status:"active" },
  { id:"p2", number:"GV-050", title:"Release REO Parcel — Harbor Blvd", type:"Collateral Disposition", votes_for_pct:62.1, votes_against_pct:28.6, threshold_pct:75.0, quorum_met:true, deadline_days:3, status:"active" },
  { id:"p4", number:"GV-047", title:"Extend LN-2741 Maturity by 12 Months", type:"Loan Extension", votes_for_pct:82.1, votes_against_pct:10.2, threshold_pct:66.7, quorum_met:true, deadline_days:-10, status:"approved" },
];

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(n ?? 0);
const fmtFull = (n: number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:2, maximumFractionDigits:2 }).format(n ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

const STATUS_DOT: Record<string, string> = {
  Current: "bg-emerald-500", "Special Servicing": "bg-brand-500", Default: "bg-brand-600", Paid: "bg-blue-500",
};
const RISK_COLOR: Record<string, string> = {
  Low: "text-emerald-600 bg-emerald-50 border border-emerald-200",
  Medium: "text-amber-600 bg-amber-50 border border-amber-200",
  High: "text-brand-600 bg-brand-50 border border-brand-200",
};
const SEVERITY_COLOR: Record<string, string> = {
  high: "border-brand-300 bg-brand-50",
  medium: "border-amber-200 bg-amber-50",
  low: "border-slate-200 bg-slate-50",
};

type Section = "portfolio" | "distributions" | "performance" | "governance" | "documents" | "alerts";

const NAV: { key: Section; label: string; icon: typeof ChartPieIcon; badge?: number }[] = [
  { key:"portfolio",     label:"Portfolio",          icon: ChartPieIcon },
  { key:"distributions", label:"Distributions",      icon: BanknotesIcon },
  { key:"performance",   label:"Loan Performance",   icon: ChartBarIcon },
  { key:"governance",    label:"Governance & Voting", icon: ScaleIcon, badge: 2 },
  { key:"documents",     label:"Reports & Docs",     icon: DocumentTextIcon },
  { key:"alerts",        label:"Risk Alerts",        icon: ExclamationTriangleIcon, badge: 2 },
];

export default function InvestorPortal() {
  const [section, setSection] = useState<Section>("portfolio");
  const [holdings, setHoldings]     = useState<Holding[]>(DEMO_HOLDINGS);
  const [distributions, setDists]   = useState<Distribution[]>(DEMO_DISTRIBUTIONS);
  const [performance, setPerf]      = useState<LoanPerformance[]>(DEMO_PERFORMANCE);
  const [alerts, setAlerts]         = useState<RiskAlert[]>(DEMO_ALERTS);
  const [myVotes, setMyVotes]       = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [hRes, dRes, pRes, aRes] = await Promise.allSettled([
      api.get<{ holdings: Holding[] }>("/investor/holdings"),
      api.get<{ distributions: Distribution[] }>("/investor/distributions"),
      api.get<{ performance: LoanPerformance[] }>("/investor/performance"),
      api.get<{ alerts: RiskAlert[] }>("/investor/alerts"),
    ]);
    if (hRes.status === "fulfilled" && hRes.value.data?.holdings?.length) setHoldings(hRes.value.data.holdings);
    if (dRes.status === "fulfilled" && dRes.value.data?.distributions?.length) setDists(dRes.value.data.distributions);
    if (pRes.status === "fulfilled" && pRes.value.data?.performance?.length) setPerf(pRes.value.data.performance);
    if (aRes.status === "fulfilled" && aRes.value.data?.alerts?.length) setAlerts(aRes.value.data.alerts);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalInvested = holdings.reduce((s, h) => s + h.my_share_usd, 0);
  const totalTokens   = holdings.reduce((s, h) => s + h.token_balance, 0);
  const paidDists     = distributions.filter((d) => d.status === "paid");
  const totalReceived = paidDists.reduce((s, d) => s + d.net_amount, 0);
  const scheduled     = distributions.filter((d) => d.status === "scheduled");
  const nextDist      = scheduled.reduce((s, d) => s + d.net_amount, 0);
  const highAlerts    = alerts.filter((a) => a.severity === "high").length;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="flex w-60 flex-col border-r border-slate-800 bg-slate-900">
        {/* Logo area */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 font-black text-white text-sm">K</div>
          <div>
            <p className="text-sm font-bold text-white">Kontra</p>
            <p className="text-xs text-violet-400 font-medium">Investor Portal</p>
          </div>
        </div>

        {/* Summary quick stats */}
        <div className="mx-4 mt-4 rounded-lg bg-violet-950/60 border border-violet-800/40 p-3 space-y-2">
          <div>
            <p className="text-xs text-violet-400">Total Invested</p>
            <p className="text-sm font-black text-white">{fmt(totalInvested)}</p>
          </div>
          <div>
            <p className="text-xs text-violet-400">Token Balance</p>
            <p className="text-sm font-bold text-white">{totalTokens.toLocaleString()} tokens</p>
          </div>
          <div>
            <p className="text-xs text-violet-400">Total Received</p>
            <p className="text-sm font-bold text-emerald-400">{fmt(totalReceived)}</p>
          </div>
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
                    ? "bg-violet-600 text-white font-semibold"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${active ? "bg-white/20 text-white" : "bg-slate-700 text-slate-300"}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4">
          {highAlerts > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-brand-900/60 border border-brand-700/40 px-3 py-2">
              <ExclamationTriangleIcon className="h-3.5 w-3.5 text-brand-400" />
              <p className="text-xs text-brand-300 font-semibold">{highAlerts} high-risk alert{highAlerts > 1 ? "s" : ""}</p>
            </div>
          )}
          <button
            onClick={() => setSection("governance")}
            className="w-full flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            Return to lender dashboard
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

          {/* ── PORTFOLIO ── */}
          {section === "portfolio" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white">Portfolio Overview</h1>
                <p className="text-sm text-slate-400 mt-1">Your loan participations, token positions, and investment performance</p>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label:"Capital Deployed", value: fmt(totalInvested), sub:"Across 4 loans" },
                  { label:"Total Received", value: fmt(totalReceived), sub:"Net distributions YTD" },
                  { label:"Next Distribution", value: fmt(nextDist), sub:"Scheduled next month", accent: true },
                  { label:"Token Holdings", value: totalTokens.toLocaleString(), sub:"Across 4 pools" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-5 ${s.accent ? "border-violet-700 bg-violet-950/60" : "border-slate-800 bg-slate-900"}`}>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
                    <p className={`mt-2 text-2xl font-black tabular-nums ${s.accent ? "text-violet-300" : "text-white"}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Holdings table */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">Loan Participations</h2>
                  <span className="text-xs text-slate-500">{holdings.length} positions</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80">
                        {["Loan","Property","Type","Location","UPB","My Share","My Invest.","Tokens","Yield","Status","Maturity"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {holdings.map((h) => (
                        <tr key={h.loan_id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-black text-violet-400 whitespace-nowrap">{h.loan_ref}</td>
                          <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{h.property_name}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{h.property_type}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{h.location}</td>
                          <td className="px-4 py-3 text-slate-300 tabular-nums">{fmt(h.upb)}</td>
                          <td className="px-4 py-3 text-slate-300 tabular-nums">{h.my_share_pct}%</td>
                          <td className="px-4 py-3 font-bold text-white tabular-nums">{fmt(h.my_share_usd)}</td>
                          <td className="px-4 py-3 text-violet-300 tabular-nums font-mono text-xs">{h.token_balance.toLocaleString()}</td>
                          <td className="px-4 py-3 text-emerald-400 font-bold tabular-nums">{h.yield_pct}%</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[h.status] ?? "bg-slate-500"}`} />
                              <span className="text-xs text-slate-300">{h.status}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(h.maturity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-800 bg-slate-900/60 px-6 py-3 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Total invested capital: <strong className="text-white">{fmt(totalInvested)}</strong></p>
                  <p className="text-xs text-slate-500">Blended yield: <strong className="text-emerald-400">{(holdings.reduce((s, h) => s + h.yield_pct * h.my_share_usd, 0) / totalInvested).toFixed(2)}%</strong></p>
                </div>
              </div>

              {/* Token positions */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-base font-bold text-white mb-4">Token Positions (On-Chain)</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {holdings.map((h) => (
                    <div key={h.loan_id} className="rounded-lg border border-violet-800/40 bg-violet-950/30 p-4">
                      <p className="text-xs font-mono font-bold text-violet-400">{h.token_symbol}</p>
                      <p className="mt-1 text-xl font-black text-white tabular-nums">{h.token_balance.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 mt-1">{h.loan_ref} · {h.my_share_pct}%</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs text-emerald-400">On-chain verified</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Token contracts record ownership only — servicing decisions remain exclusively in the Kontra execution layer.
                </p>
              </div>
            </div>
          )}

          {/* ── DISTRIBUTIONS ── */}
          {section === "distributions" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white">Distributions</h1>
                <p className="text-sm text-slate-400 mt-1">Distribution history, upcoming payments, and waterfall summary</p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label:"Total Received (YTD)", value: fmtFull(totalReceived), color:"text-emerald-400" },
                  { label:"Gross Before Fees", value: fmtFull(paidDists.reduce((s,d) => s + d.gross_amount, 0)), color:"text-white" },
                  { label:"Next Payment", value: fmtFull(nextDist), sub: "Scheduled May 1, 2026", color:"text-violet-300" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
                    <p className={`mt-2 text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                    {s.sub && <p className="text-xs text-slate-500 mt-1">{s.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Upcoming */}
              <div className="rounded-xl border border-violet-800/40 bg-violet-950/30 p-6">
                <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-violet-400" />
                  Upcoming Distributions
                </h2>
                <div className="space-y-2">
                  {scheduled.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-violet-800/30 bg-violet-900/20 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{d.period} — {d.loan_ref}</p>
                        <p className="text-xs text-slate-400">{d.type} · {fmtDate(d.paid_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-violet-300">{fmtFull(d.net_amount)}</p>
                        <p className="text-xs text-slate-500">net of fees</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* History */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800">
                  <h2 className="text-base font-bold text-white">Distribution History</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80">
                      {["Period","Loan","Type","Gross","Net (after fees)","Date","Status"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paidDists.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3 text-slate-300">{d.period}</td>
                        <td className="px-5 py-3 font-bold text-violet-400">{d.loan_ref}</td>
                        <td className="px-5 py-3 text-slate-400">{d.type}</td>
                        <td className="px-5 py-3 text-slate-300 tabular-nums">{fmtFull(d.gross_amount)}</td>
                        <td className="px-5 py-3 font-bold text-emerald-400 tabular-nums">{fmtFull(d.net_amount)}</td>
                        <td className="px-5 py-3 text-slate-400">{fmtDate(d.paid_at)}</td>
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

          {/* ── PERFORMANCE ── */}
          {section === "performance" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white">Loan Performance</h1>
                <p className="text-sm text-slate-400 mt-1">Read-only performance metrics. Servicing actions are managed by the lender.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80">
                      {["Loan","Property","DSCR","LTV","Delinquency","Payment Status","Risk"].map((h) => (
                        <th key={h} className="px-5 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {performance.map((p) => (
                      <tr key={p.loan_ref} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 font-black text-violet-400">{p.loan_ref}</td>
                        <td className="px-5 py-4 text-white font-semibold whitespace-nowrap">{p.property}</td>
                        <td className={`px-5 py-4 font-bold tabular-nums ${p.dscr >= 1.25 ? "text-emerald-400" : p.dscr >= 1.0 ? "text-amber-400" : "text-brand-400"}`}>
                          {p.dscr.toFixed(2)}x
                        </td>
                        <td className={`px-5 py-4 font-bold tabular-nums ${p.ltv <= 65 ? "text-emerald-400" : p.ltv <= 80 ? "text-amber-400" : "text-brand-400"}`}>
                          {p.ltv.toFixed(1)}%
                        </td>
                        <td className="px-5 py-4 text-slate-300 tabular-nums">
                          {p.delinquency_days === 0 ? <span className="text-emerald-400">Current</span> : `${p.delinquency_days} days`}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`flex items-center gap-1.5 text-sm ${STATUS_DOT[p.payment_status] ? "" : ""}`}>
                            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[p.payment_status] ?? "bg-slate-500"}`} />
                            <span className="text-slate-300">{p.payment_status}</span>
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${RISK_COLOR[p.risk_label]}`}>{p.risk_label}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-4">
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-300">Important:</strong> Performance data is read-only for investors.
                  Forbearance, modifications, enforcement, and all servicing decisions are made exclusively
                  by the lender/servicer through the Kontra execution layer. You may influence major economic
                  outcomes through governance proposals.
                </p>
              </div>
            </div>
          )}

          {/* ── GOVERNANCE ── */}
          {section === "governance" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white">Governance & Voting</h1>
                <p className="text-sm text-slate-400 mt-1">Active proposals requiring your vote. Results are recorded on-chain.</p>
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Active Proposals</h2>
                {DEMO_GOV_PROPOSALS.filter((p) => p.status === "active").map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{p.number}</span>
                          <span className="rounded-full bg-violet-900/60 border border-violet-700/40 px-2 py-0.5 text-xs text-violet-300">{p.type}</span>
                          {p.deadline_days > 0 && p.deadline_days <= 3 && (
                            <span className="rounded-full bg-brand-900/60 border border-brand-700/40 px-2 py-0.5 text-xs font-bold text-brand-300">⚡ {p.deadline_days}d left</span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white">{p.title}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {!myVotes[p.id] ? (
                          <>
                            {(["for","against","abstain"] as const).map((v) => (
                              <button
                                key={v}
                                onClick={() => setMyVotes((m) => ({ ...m, [p.id]: v }))}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                                  v === "for" ? "bg-emerald-700 hover:bg-emerald-600 text-white" :
                                  v === "against" ? "bg-brand-700 hover:bg-brand-600 text-white" :
                                  "bg-slate-700 hover:bg-slate-600 text-slate-300"
                                }`}
                              >
                                {v.charAt(0).toUpperCase() + v.slice(1)}
                              </button>
                            ))}
                          </>
                        ) : (
                          <span className="rounded-full bg-emerald-900/60 border border-emerald-700/40 px-3 py-1.5 text-xs font-bold text-emerald-300">
                            ✓ Voted {myVotes[p.id].toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-6 py-4 space-y-2">
                      {[
                        { label:"FOR", pct: p.votes_for_pct, color:"bg-emerald-500", text:"text-emerald-400" },
                        { label:"AGAINST", pct: p.votes_against_pct, color:"bg-brand-500", text:"text-brand-400" },
                        { label:"ABSTAIN", pct: 100 - p.votes_for_pct - p.votes_against_pct, color:"bg-slate-600", text:"text-slate-400" },
                      ].map((bar) => (
                        <div key={bar.label} className="flex items-center gap-3">
                          <span className={`w-16 text-right text-xs font-bold ${bar.text}`}>{bar.label}</span>
                          <div className="flex-1 rounded-full bg-slate-800 h-2 overflow-hidden">
                            <div className={`h-full rounded-full ${bar.color}`} style={{ width:`${bar.pct}%` }} />
                          </div>
                          <span className={`w-12 text-xs font-bold ${bar.text} tabular-nums`}>{bar.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-3 pt-1">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${p.quorum_met ? "bg-emerald-900/60 border border-emerald-700/40 text-emerald-300" : "bg-amber-900/60 border border-amber-700/40 text-amber-300"}`}>
                          Quorum: {p.quorum_met ? "Met" : "Pending"}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${p.votes_for_pct >= p.threshold_pct ? "bg-emerald-900/60 border border-emerald-700/40 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                          Threshold {p.threshold_pct}% {p.votes_for_pct >= p.threshold_pct ? "✓ Passing" : "Not met"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 pt-4">Past Results</h2>
                {DEMO_GOV_PROPOSALS.filter((p) => p.status !== "active").map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500">{p.number}</span>
                      <p className="text-sm font-semibold text-slate-300">{p.title}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${p.status === "approved" ? "bg-emerald-900/60 border border-emerald-700/40 text-emerald-300" : "bg-brand-900/60 border border-brand-700/40 text-brand-300"}`}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {section === "documents" && (
            <div className="space-y-6">
              <h1 className="text-2xl font-black text-white">Reports & Documents</h1>
              <div className="rounded-xl border border-slate-800 bg-slate-900 divide-y divide-slate-800">
                {[
                  { name:"Q1 2026 Investor Report", type:"Quarterly Report", date:"2026-04-01", size:"2.4 MB" },
                  { name:"LN-2847 Loan Summary", type:"Loan Document", date:"2026-03-15", size:"840 KB" },
                  { name:"LN-2741 Appraisal Update", type:"Valuation", date:"2026-02-28", size:"1.1 MB" },
                  { name:"Portfolio Distribution Statement Q1", type:"Tax Document", date:"2026-01-31", size:"420 KB" },
                  { name:"Governance Proposal GV-047 — Outcome", type:"Governance", date:"2026-03-28", size:"190 KB" },
                  { name:"Annual Investor Report 2025", type:"Annual Report", date:"2026-01-15", size:"5.2 MB" },
                ].map((doc) => (
                  <div key={doc.name} className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <DocumentTextIcon className="h-5 w-5 text-violet-400 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-white">{doc.name}</p>
                        <p className="text-xs text-slate-500">{doc.type} · {fmtDate(doc.date)} · {doc.size}</p>
                      </div>
                    </div>
                    <button className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors">
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ALERTS ── */}
          {section === "alerts" && (
            <div className="space-y-6">
              <h1 className="text-2xl font-black text-white">Risk Alerts</h1>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`rounded-xl border p-5 ${SEVERITY_COLOR[alert.severity]}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className={`h-5 w-5 mt-0.5 shrink-0 ${alert.severity === "high" ? "text-brand-500" : alert.severity === "medium" ? "text-amber-500" : "text-slate-400"}`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-black uppercase ${alert.severity === "high" ? "bg-brand-100 text-brand-700" : alert.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                              {alert.severity}
                            </span>
                            <span className="text-xs font-bold text-slate-600">{alert.loan_ref}</span>
                          </div>
                          <p className="text-sm text-slate-800">{alert.message}</p>
                          <p className="text-xs text-slate-500 mt-1">{fmtDate(alert.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-4">
                <p className="text-xs text-slate-500">
                  Risk alerts are informational only. All enforcement and servicing responses are handled
                  by the lender/servicer. You may submit a governance proposal if a major economic decision is required.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
