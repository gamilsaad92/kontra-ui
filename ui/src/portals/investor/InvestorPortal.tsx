/**
 * Investor Portal — Read-only view of holdings, distributions, governance, and risk.
 * Investors CANNOT execute servicing actions. All servicing stays in the lender execution layer.
 * Treat this as a separate product on top of the same Kontra backend.
 */
import { useState, useEffect, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";
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
  ArrowsRightLeftIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  InformationCircleIcon,
  SparklesIcon,
  ShieldExclamationIcon,
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

// ── Marketplace types & demo data ─────────────────────────────
type OrderBookEntry = { price: number; qty: number; total: number };
type MarketTrade = { id: string; symbol: string; side: "buy"|"sell"; price: number; qty: number; fee: number; total: number; time: string };
type TokenNAV = { symbol: string; loan_ref: string; par: number; nav: number; premium_bps: number; ytm: number; dscr_adj: number; ltv_adj: number; delinquency_adj: number; last_price: number; last_time: string };
type MyOrder = { id: string; symbol: string; side: "buy"|"sell"; qty: number; price: number; status: "open"|"filled"|"cancelled" };

const DEMO_ORDERBOOK: Record<string, { bids: OrderBookEntry[]; asks: OrderBookEntry[] }> = {
  "KTRA-2847": {
    bids: [
      { price:102.50, qty:850,  total:87125  },
      { price:102.25, qty:1200, total:122700 },
      { price:102.00, qty:2000, total:204000 },
      { price:101.75, qty:500,  total:50875  },
      { price:101.50, qty:3000, total:304500 },
    ],
    asks: [
      { price:103.00, qty:650,  total:66950  },
      { price:103.25, qty:900,  total:92925  },
      { price:103.50, qty:1500, total:155250 },
      { price:103.75, qty:2000, total:207500 },
      { price:104.00, qty:1000, total:104000 },
    ],
  },
  "KTRA-3011": {
    bids: [
      { price:78.00, qty:2000, total:156000 },
      { price:77.50, qty:3500, total:271250 },
      { price:77.00, qty:5000, total:385000 },
      { price:76.50, qty:1200, total:91800  },
      { price:76.00, qty:8000, total:608000 },
    ],
    asks: [
      { price:80.00, qty:1800, total:144000 },
      { price:80.50, qty:2500, total:201250 },
      { price:81.00, qty:3000, total:243000 },
      { price:81.50, qty:1000, total:81500  },
      { price:82.00, qty:4000, total:328000 },
    ],
  },
  "KTRA-2741": {
    bids: [
      { price:101.00, qty:1500, total:151500 },
      { price:100.75, qty:2000, total:201500 },
      { price:100.50, qty:1000, total:100500 },
      { price:100.25, qty:3000, total:300750 },
      { price:100.00, qty:2500, total:250000 },
    ],
    asks: [
      { price:101.50, qty:800,  total:81200  },
      { price:101.75, qty:1200, total:122100 },
      { price:102.00, qty:2000, total:204000 },
      { price:102.25, qty:1500, total:153375 },
      { price:102.50, qty:1000, total:102500 },
    ],
  },
  "KTRA-3204": {
    bids: [
      { price:99.50, qty:1000, total:99500  },
      { price:99.25, qty:1500, total:148875 },
      { price:99.00, qty:2000, total:198000 },
      { price:98.75, qty:800,  total:79000  },
      { price:98.50, qty:3000, total:295500 },
    ],
    asks: [
      { price:100.00, qty:700,  total:70000  },
      { price:100.25, qty:1000, total:100250 },
      { price:100.50, qty:2000, total:201000 },
      { price:100.75, qty:1500, total:151125 },
      { price:101.00, qty:1000, total:101000 },
    ],
  },
};

const DEMO_MARKET_TRADES: MarketTrade[] = [
  { id:"t1", symbol:"KTRA-2847", side:"buy",  price:102.50, qty:500,  fee:76.88,  total:51250, time:"2026-04-12T15:23:00Z" },
  { id:"t2", symbol:"KTRA-3011", side:"sell", price:79.00,  qty:1000, fee:118.50, total:79000, time:"2026-04-12T14:45:00Z" },
  { id:"t3", symbol:"KTRA-2741", side:"buy",  price:101.25, qty:800,  fee:121.50, total:81000, time:"2026-04-12T14:10:00Z" },
  { id:"t4", symbol:"KTRA-2847", side:"buy",  price:102.25, qty:200,  fee:30.68,  total:20450, time:"2026-04-12T13:50:00Z" },
  { id:"t5", symbol:"KTRA-3204", side:"sell", price:99.75,  qty:400,  fee:59.85,  total:39900, time:"2026-04-12T13:30:00Z" },
];

const DEMO_NAV: TokenNAV[] = [
  { symbol:"KTRA-2847", loan_ref:"LN-2847", par:100, nav:102.73, premium_bps:273,   ytm:8.51,  dscr_adj:1.2,  ltv_adj:0.8,   delinquency_adj:0,    last_price:102.50, last_time:"2026-04-12T15:23:00Z" },
  { symbol:"KTRA-3011", loan_ref:"LN-3011", par:100, nav:79.25,  premium_bps:-2075, ytm:14.52, dscr_adj:-12.5, ltv_adj:-5.2,  delinquency_adj:-4.5, last_price:79.00,  last_time:"2026-04-12T14:45:00Z" },
  { symbol:"KTRA-2741", loan_ref:"LN-2741", par:100, nav:101.35, premium_bps:135,   ytm:7.79,  dscr_adj:2.1,  ltv_adj:1.5,   delinquency_adj:0,    last_price:101.25, last_time:"2026-04-12T15:10:00Z" },
  { symbol:"KTRA-3204", loan_ref:"LN-3204", par:100, nav:99.82,  premium_bps:-18,   ytm:9.12,  dscr_adj:0.2,  ltv_adj:0.1,   delinquency_adj:0,    last_price:99.75,  last_time:"2026-04-12T13:30:00Z" },
];

const DEMO_MY_ORDERS: MyOrder[] = [
  { id:"o1", symbol:"KTRA-2847", side:"buy",  qty:500,  price:102.00, status:"open" },
  { id:"o2", symbol:"KTRA-3204", side:"sell", qty:1000, price:100.50, status:"open" },
];

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(n ?? 0);
const fmtFull = (n: number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:2, maximumFractionDigits:2 }).format(n ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

const STATUS_DOT: Record<string, string> = {
  Current: "bg-emerald-500", "Special Servicing": "bg-red-500", Default: "bg-red-600", Paid: "bg-blue-500",
};
const RISK_COLOR: Record<string, string> = {
  Low: "text-emerald-700 bg-emerald-50 border border-emerald-200",
  Medium: "text-amber-700 bg-amber-50 border border-amber-200",
  High: "text-red-700 bg-red-50 border border-red-200",
};
const SEVERITY_COLOR: Record<string, string> = {
  high: "border-red-200 bg-red-50",
  medium: "border-amber-200 bg-amber-50",
  low: "border-gray-200 bg-gray-50",
};

type Section = "portfolio" | "distributions" | "cashflow" | "performance" | "governance" | "documents" | "alerts" | "ai" | "marketplace" | "pricing";

const NAV: { key: Section; label: string; icon: typeof ChartPieIcon; badge?: number; dividerBefore?: boolean }[] = [
  { key:"portfolio",     label:"Portfolio",           icon: ChartPieIcon },
  { key:"distributions", label:"Distributions",       icon: BanknotesIcon },
  { key:"cashflow",      label:"Cash Flow Waterfall", icon: ArrowTrendingUpIcon },
  { key:"performance",   label:"Loan Performance",    icon: ChartBarIcon },
  { key:"governance",    label:"Governance & Voting",  icon: ScaleIcon, badge: 2 },
  { key:"documents",     label:"Reports & Docs",      icon: DocumentTextIcon },
  { key:"alerts",        label:"Risk Alerts",         icon: ExclamationTriangleIcon, badge: 2 },
  { key:"ai",            label:"AI Portfolio Brief",  icon: SparklesIcon, dividerBefore: true },
  { key:"marketplace",   label:"Debt Exchange",       icon: ArrowsRightLeftIcon },
  { key:"pricing",       label:"Token NAV Pricing",   icon: CurrencyDollarIcon },
];

export default function InvestorPortal() {
  const { signOut } = useContext(AuthContext);
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("portfolio");
  const [holdings, setHoldings]     = useState<Holding[]>(DEMO_HOLDINGS);
  const [distributions, setDists]   = useState<Distribution[]>(DEMO_DISTRIBUTIONS);
  const [performance, setPerf]      = useState<LoanPerformance[]>(DEMO_PERFORMANCE);
  const [alerts, setAlerts]         = useState<RiskAlert[]>(DEMO_ALERTS);
  const [myVotes, setMyVotes]       = useState<Record<string, string>>({});
  const [mxToken, setMxToken]       = useState("KTRA-2847");
  const [mxSide, setMxSide]         = useState<"buy"|"sell">("buy");
  const [mxQty, setMxQty]           = useState("500");
  const [mxPrice, setMxPrice]       = useState("102.50");
  const [mxOrders, setMxOrders]     = useState<MyOrder[]>(DEMO_MY_ORDERS);
  const [mxSubmitted, setMxSubmitted] = useState(false);

  // ── AI Portfolio Brief state ──────────────────────────────────────────────
  type AiBrief = {
    brief: string; portfolio_score: number | null;
    signals: { type: "positive"|"negative"|"watch"; message: string }[];
    recommendations: string[];
    watchlist: { loan_ref: string; reason: string }[];
  };
  const [aiBrief, setAiBrief]         = useState<AiBrief | null>(null);
  const [aiBriefLoading, setAiBriefLoading] = useState(false);
  const [aiBriefError, setAiBriefError]   = useState<string | null>(null);

  const generateAiBrief = async () => {
    setAiBriefLoading(true);
    setAiBriefError(null);
    try {
      const { data } = await api.post<AiBrief>("/ai/portfolio-brief", {});
      if (data) setAiBrief(data);
      else setAiBriefError("No response from AI service.");
    } catch {
      setAiBriefError("AI service unavailable. Please try again.");
    } finally {
      setAiBriefLoading(false);
    }
  };

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
    <div className="flex h-screen bg-gray-50 text-slate-900 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
        {/* Logo area */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-200">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg font-black text-white text-sm" style={{ background: "#800020" }}>K</div>
          <div>
            <p className="text-sm font-bold text-gray-900">Kontra</p>
            <p className="text-xs text-violet-600 font-medium">Investor Portal</p>
          </div>
        </div>

        {/* Summary quick stats */}
        <div className="mx-4 mt-4 rounded-lg bg-violet-50 border border-violet-200 p-3 space-y-2">
          <div>
            <p className="text-xs text-violet-600">Total Invested</p>
            <p className="text-sm font-black text-gray-900">{fmt(totalInvested)}</p>
          </div>
          <div>
            <p className="text-xs text-violet-600">Token Balance</p>
            <p className="text-sm font-bold text-gray-900">{totalTokens.toLocaleString()} tokens</p>
          </div>
          <div>
            <p className="text-xs text-violet-600">Total Received</p>
            <p className="text-sm font-bold text-emerald-700">{fmt(totalReceived)}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <div key={item.key}>
                {item.dividerBefore && (
                  <div className="flex items-center gap-2 px-2 pt-3 pb-1">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Exchange</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                <button
                  onClick={() => setSection(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                    active
                      ? item.key === "marketplace" || item.key === "pricing"
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "bg-violet-50 text-violet-700 font-semibold"
                      : "text-gray-600 hover:bg-violet-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${active ? "bg-gray-200 text-gray-700" : "bg-gray-100 text-gray-500"}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 space-y-2">
          {highAlerts > 0 && (
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-600" />
              <p className="text-xs text-red-700 font-semibold">{highAlerts} high-risk alert{highAlerts > 1 ? "s" : ""}</p>
            </div>
          )}
          <button
            onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

          {/* ── PORTFOLIO ── */}
          {section === "portfolio" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-gray-900">Portfolio Overview</h1>
                <p className="text-sm text-gray-500 mt-1">Your loan participations, token positions, and investment performance</p>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label:"Capital Deployed", value: fmt(totalInvested), sub:"Across 4 loans" },
                  { label:"Total Received", value: fmt(totalReceived), sub:"Net distributions YTD" },
                  { label:"Next Distribution", value: fmt(nextDist), sub:"Scheduled next month", accent: true },
                  { label:"Token Holdings", value: totalTokens.toLocaleString(), sub:"Across 4 pools" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-5 ${s.accent ? "border-violet-200 bg-violet-50" : "border-gray-200 bg-white"}`}>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
                    <p className={`mt-2 text-2xl font-black tabular-nums ${s.accent ? "text-violet-700" : "text-gray-900"}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Holdings table */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900">Loan Participations</h2>
                  <span className="text-xs text-slate-500">{holdings.length} positions</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white/80">
                        {["Loan","Property","Type","Location","UPB","My Share","My Invest.","Tokens","Yield","Status","Maturity"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {holdings.map((h) => (
                        <tr key={h.loan_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-black text-violet-700 whitespace-nowrap">{h.loan_ref}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{h.property_name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{h.property_type}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{h.location}</td>
                          <td className="px-4 py-3 text-gray-700 tabular-nums">{fmt(h.upb)}</td>
                          <td className="px-4 py-3 text-gray-700 tabular-nums">{h.my_share_pct}%</td>
                          <td className="px-4 py-3 font-bold text-gray-900 tabular-nums">{fmt(h.my_share_usd)}</td>
                          <td className="px-4 py-3 text-violet-700 tabular-nums font-mono text-xs">{h.token_balance.toLocaleString()}</td>
                          <td className="px-4 py-3 text-emerald-700 font-bold tabular-nums">{h.yield_pct}%</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[h.status] ?? "bg-slate-400"}`} />
                              <span className="text-xs text-gray-600">{h.status}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(h.maturity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-gray-200 bg-white/60 px-6 py-3 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Total invested capital: <strong className="text-gray-900">{fmt(totalInvested)}</strong></p>
                  <p className="text-xs text-slate-500">Blended yield: <strong className="text-emerald-700">{(holdings.reduce((s, h) => s + h.yield_pct * h.my_share_usd, 0) / totalInvested).toFixed(2)}%</strong></p>
                </div>
              </div>

              {/* Token positions */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4">Token Positions (On-Chain)</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {holdings.map((h) => (
                    <div key={h.loan_id} className="rounded-lg border border-violet-200 bg-violet-50 p-4">
                      <p className="text-xs font-mono font-bold text-violet-700">{h.token_symbol}</p>
                      <p className="mt-1 text-xl font-black text-gray-900 tabular-nums">{h.token_balance.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{h.loan_ref} · {h.my_share_pct}%</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-xs text-emerald-700">On-chain verified</span>
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

          {/* ── CASH FLOW WATERFALL ── */}
          {section === "cashflow" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-gray-900">Cash Flow Waterfall</h1>
                <p className="text-sm text-slate-400 mt-1">
                  How rent becomes your yield — from tenant payment to token holder distribution.
                </p>
              </div>

              {/* Aggregate yield metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Blended Current Yield", value: "7.84%", sub: "Weighted by UPB", color: "text-emerald-700" },
                  { label: "Monthly Distribution", value: "$22,118", sub: "Net to your wallet", color: "text-violet-700" },
                  { label: "YTD Distributions", value: "$88,470", sub: "Jan–Apr 2026", color: "text-gray-900" },
                  { label: "Loans Distributing", value: "2 / 3", sub: "1 on hold — LN-3011", color: "text-amber-700" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{s.label}</p>
                    <p className={`mt-2 text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Waterfall per holding */}
              <div className="space-y-4">
                {[
                  {
                    ref: "LN-2847", name: "Meridian Apartments", tokens: 500, nav: 102.73,
                    grossRent: 287500, fee: 8625, reserve: 14375, dist: 264500,
                    myDist: 421.18, yield: 7.62, status: "distributing",
                  },
                  {
                    ref: "LN-2741", name: "Westgate Industrial Park", tokens: 250, nav: 101.35,
                    grossRent: 198400, fee: 5952, reserve: 9920, dist: 182528,
                    myDist: 200.24, yield: 8.10, status: "distributing",
                  },
                  {
                    ref: "LN-3011", name: "Harbor Point Mixed-Use", tokens: 300, nav: 79.25,
                    grossRent: 0, fee: 0, reserve: 0, dist: 0,
                    myDist: 0, yield: 0, status: "hold",
                  },
                ].map(h => {
                  const isHeld = h.status === "hold";
                  const total = h.grossRent || 1;
                  const pct = (v: number) => Math.round((v / total) * 100);
                  return (
                    <div key={h.ref} className={`rounded-xl border p-5 ${isHeld ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black font-mono text-gray-500">{h.ref}</span>
                            <span className={`text-xs rounded-full px-2 py-0.5 font-bold border ${isHeld ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                              {isHeld ? "On Hold" : "Distributing"}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{h.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">You hold {h.tokens.toLocaleString()} tokens · NAV ${h.nav.toFixed(2)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-500">Your monthly yield</p>
                          <p className={`text-2xl font-black tabular-nums ${isHeld ? "text-gray-400" : "text-emerald-700"}`}>
                            {isHeld ? "$0.00" : `$${h.myDist.toFixed(2)}`}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{isHeld ? "suspended" : `${h.yield.toFixed(2)}% annualized`}</p>
                        </div>
                      </div>

                      {isHeld ? (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                          ⛔ Cash trap active — 45d delinquent. No waterfall flows until the borrower cures. Governance vote GV-050 pending.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {[
                            { label: "Gross Rent", amount: h.grossRent, bar: 100, color: "bg-gray-400" },
                            { label: "Servicer Fee (3%)", amount: h.fee, bar: pct(h.fee), color: "bg-amber-500" },
                            { label: "Reserve Fund (5%)", amount: h.reserve, bar: pct(h.reserve), color: "bg-blue-500" },
                            { label: "→ Distribution Pool", amount: h.dist, bar: pct(h.dist), color: "bg-emerald-500" },
                          ].map((step, i) => (
                            <div key={step.label} className="flex items-center gap-3">
                              <div className="w-36 text-right text-xs text-gray-500 shrink-0">
                                {i > 0 && <span className="text-gray-400 mr-1">−</span>}{step.label}
                              </div>
                              <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                                <div className={`h-full rounded-full ${step.color}`} style={{ width: `${step.bar}%` }} />
                              </div>
                              <div className="w-24 text-right text-xs font-semibold tabular-nums text-gray-700">
                                ${step.amount.toLocaleString()}
                              </div>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                            <span>Your share of pool ({h.tokens} / total supply)</span>
                            <span className="font-bold text-emerald-700">+${h.myDist.toFixed(2)} / month</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-semibold text-gray-600 mb-1">Waterfall priority</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Distributions flow through the Kontra waterfall in priority order: (1) Servicer fee → (2) Liquidity reserve → (3) Net interest to token holders. Loans with DSCR below 1.20× or 30+ days delinquent are automatically cash-trapped per PSA §7.4(b). Your tokens remain transferable during hold periods (subject to Reg D lockup), but no yield flows until the borrower cures.
                </p>
              </div>
            </div>
          )}

          {/* ── DISTRIBUTIONS ── */}
          {section === "distributions" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-gray-900">Distributions</h1>
                <p className="text-sm text-slate-400 mt-1">Distribution history, upcoming payments, and waterfall summary</p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label:"Total Received (YTD)", value: fmtFull(totalReceived), color:"text-emerald-700" },
                  { label:"Gross Before Fees", value: fmtFull(paidDists.reduce((s,d) => s + d.gross_amount, 0)), color:"text-gray-900" },
                  { label:"Next Payment", value: fmtFull(nextDist), sub: "Scheduled May 1, 2026", color:"text-violet-700" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{s.label}</p>
                    <p className={`mt-2 text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                    {s.sub && <p className="text-xs text-gray-500 mt-1">{s.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Upcoming */}
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-6">
                <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-violet-600" />
                  Upcoming Distributions
                </h2>
                <div className="space-y-2">
                  {scheduled.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-violet-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{d.period} — {d.loan_ref}</p>
                        <p className="text-xs text-gray-500">{d.type} · {fmtDate(d.paid_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-violet-700">{fmtFull(d.net_amount)}</p>
                        <p className="text-xs text-gray-500">net of fees</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* History */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-base font-bold text-gray-900">Distribution History</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-white/80">
                      {["Period","Loan","Type","Gross","Net (after fees)","Date","Status"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paidDists.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-700">{d.period}</td>
                        <td className="px-5 py-3 font-bold text-violet-700">{d.loan_ref}</td>
                        <td className="px-5 py-3 text-gray-500">{d.type}</td>
                        <td className="px-5 py-3 text-gray-700 tabular-nums">{fmtFull(d.gross_amount)}</td>
                        <td className="px-5 py-3 font-bold text-emerald-700 tabular-nums">{fmtFull(d.net_amount)}</td>
                        <td className="px-5 py-3 text-gray-500">{fmtDate(d.paid_at)}</td>
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

          {/* ── PERFORMANCE ── */}
          {section === "performance" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-gray-900">Loan Performance</h1>
                <p className="text-sm text-slate-400 mt-1">Read-only performance metrics. Servicing actions are managed by the lender.</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-white/80">
                      {["Loan","Property","DSCR","LTV","Delinquency","Payment Status","Risk"].map((h) => (
                        <th key={h} className="px-5 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {performance.map((p) => (
                      <tr key={p.loan_ref} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 font-black text-violet-700">{p.loan_ref}</td>
                        <td className="px-5 py-4 text-gray-900 font-semibold whitespace-nowrap">{p.property}</td>
                        <td className={`px-5 py-4 font-bold tabular-nums ${p.dscr >= 1.25 ? "text-emerald-700" : p.dscr >= 1.0 ? "text-amber-700" : "text-red-700"}`}>
                          {p.dscr.toFixed(2)}x
                        </td>
                        <td className={`px-5 py-4 font-bold tabular-nums ${p.ltv <= 65 ? "text-emerald-700" : p.ltv <= 80 ? "text-amber-700" : "text-red-700"}`}>
                          {p.ltv.toFixed(1)}%
                        </td>
                        <td className="px-5 py-4 text-gray-700 tabular-nums">
                          {p.delinquency_days === 0 ? <span className="text-emerald-700">Current</span> : `${p.delinquency_days} days`}
                        </td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1.5 text-sm">
                            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[p.payment_status] ?? "bg-slate-400"}`} />
                            <span className="text-gray-600">{p.payment_status}</span>
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
              <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
                <p className="text-xs text-gray-500">
                  <strong className="text-gray-700">Important:</strong> Performance data is read-only for investors.
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
                <h1 className="text-2xl font-black text-gray-900">Governance & Voting</h1>
                <p className="text-sm text-slate-400 mt-1">Active proposals requiring your vote. Results are recorded on-chain.</p>
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Active Proposals</h2>
                {DEMO_GOV_PROPOSALS.filter((p) => p.status === "active").map((p) => (
                  <div key={p.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black text-gray-500 uppercase tracking-widest">{p.number}</span>
                          <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs text-violet-700">{p.type}</span>
                          {p.deadline_days > 0 && p.deadline_days <= 3 && (
                            <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-bold text-red-700">⚡ {p.deadline_days}d left</span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-gray-900">{p.title}</h3>
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
                                  v === "against" ? "bg-red-700 hover:bg-red-600 text-white" :
                                  "bg-gray-200 hover:bg-gray-300 text-gray-700"
                                }`}
                              >
                                {v.charAt(0).toUpperCase() + v.slice(1)}
                              </button>
                            ))}
                          </>
                        ) : (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">
                            ✓ Voted {myVotes[p.id].toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-6 py-4 space-y-2">
                      {[
                        { label:"FOR", pct: p.votes_for_pct, color:"bg-emerald-500", text:"text-emerald-700" },
                        { label:"AGAINST", pct: p.votes_against_pct, color:"bg-red-500", text:"text-red-700" },
                        { label:"ABSTAIN", pct: 100 - p.votes_for_pct - p.votes_against_pct, color:"bg-gray-300", text:"text-gray-500" },
                      ].map((bar) => (
                        <div key={bar.label} className="flex items-center gap-3">
                          <span className={`w-16 text-right text-xs font-bold ${bar.text}`}>{bar.label}</span>
                          <div className="flex-1 rounded-full bg-gray-200 h-2 overflow-hidden">
                            <div className={`h-full rounded-full ${bar.color}`} style={{ width:`${bar.pct}%` }} />
                          </div>
                          <span className={`w-12 text-xs font-bold ${bar.text} tabular-nums`}>{bar.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-3 pt-1">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold border ${p.quorum_met ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                          Quorum: {p.quorum_met ? "Met" : "Pending"}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold border ${p.votes_for_pct >= p.threshold_pct ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-100 border-gray-200 text-gray-500"}`}>
                          Threshold {p.threshold_pct}% {p.votes_for_pct >= p.threshold_pct ? "✓ Passing" : "Not met"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 pt-4">Past Results</h2>
                {DEMO_GOV_PROPOSALS.filter((p) => p.status !== "active").map((p) => (
                  <div key={p.id} className="rounded-xl border border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500">{p.number}</span>
                      <p className="text-sm font-semibold text-gray-700">{p.title}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize border ${p.status === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
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
              <h1 className="text-2xl font-black text-gray-900">Reports & Documents</h1>
              <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-200">
                {[
                  { name:"Q1 2026 Investor Report", type:"Quarterly Report", date:"2026-04-01", size:"2.4 MB" },
                  { name:"LN-2847 Loan Summary", type:"Loan Document", date:"2026-03-15", size:"840 KB" },
                  { name:"LN-2741 Appraisal Update", type:"Valuation", date:"2026-02-28", size:"1.1 MB" },
                  { name:"Portfolio Distribution Statement Q1", type:"Tax Document", date:"2026-01-31", size:"420 KB" },
                  { name:"Governance Proposal GV-047 — Outcome", type:"Governance", date:"2026-03-28", size:"190 KB" },
                  { name:"Annual Investor Report 2025", type:"Annual Report", date:"2026-01-15", size:"5.2 MB" },
                ].map((doc) => (
                  <div key={doc.name} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <DocumentTextIcon className="h-5 w-5 text-violet-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.type} · {fmtDate(doc.date)} · {doc.size}</p>
                      </div>
                    </div>
                    <button className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
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
              <h1 className="text-2xl font-black text-gray-900">Risk Alerts</h1>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`rounded-xl border p-5 ${SEVERITY_COLOR[alert.severity]}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className={`h-5 w-5 mt-0.5 shrink-0 ${alert.severity === "high" ? "text-red-600" : alert.severity === "medium" ? "text-amber-600" : "text-gray-400"}`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-black uppercase ${alert.severity === "high" ? "bg-red-100 text-red-700" : alert.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                              {alert.severity}
                            </span>
                            <span className="text-xs font-bold text-gray-600">{alert.loan_ref}</span>
                          </div>
                          <p className="text-sm text-gray-800">{alert.message}</p>
                          <p className="text-xs text-gray-500 mt-1">{fmtDate(alert.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
                <p className="text-xs text-gray-500">
                  Risk alerts are informational only. All enforcement and servicing responses are handled
                  by the lender/servicer. You may submit a governance proposal if a major economic decision is required.
                </p>
              </div>
            </div>
          )}

          {/* ── AI PORTFOLIO BRIEF ── */}
          {section === "ai" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                    <SparklesIcon className="h-6 w-6 text-violet-600" />
                    AI Portfolio Brief
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">GPT-4o analysis of your loan portfolio — risk signals, watchlist, and recommendations.</p>
                </div>
                <button
                  onClick={generateAiBrief}
                  disabled={aiBriefLoading}
                  className="flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-800 transition-colors disabled:opacity-60"
                >
                  <SparklesIcon className="h-4 w-4" />
                  {aiBriefLoading ? "Generating…" : aiBrief ? "Regenerate" : "Generate Brief"}
                </button>
              </div>

              {aiBriefError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
                  <p className="text-sm text-red-700">{aiBriefError}</p>
                </div>
              )}

              {!aiBrief && !aiBriefLoading && !aiBriefError && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-10 text-center">
                  <SparklesIcon className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">Click "Generate Brief" to run an AI analysis of your full portfolio.</p>
                  <p className="text-gray-400 text-xs mt-1">Powered by GPT-4o · Takes ~10 seconds</p>
                </div>
              )}

              {aiBriefLoading && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-10 text-center">
                  <SparklesIcon className="h-8 w-8 text-violet-600 mx-auto mb-3 animate-pulse" />
                  <p className="text-violet-700 text-sm font-semibold">Analyzing your portfolio…</p>
                  <p className="text-gray-500 text-xs mt-1">GPT-4o is reviewing all loan positions, DSCR, LTV, and covenant data</p>
                </div>
              )}

              {aiBrief && !aiBriefLoading && (
                <div className="space-y-5">
                  {/* Executive Summary */}
                  <div className="rounded-xl border border-gray-200 bg-white p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Executive Summary</p>
                        <p className="text-gray-700 text-sm leading-relaxed">{aiBrief.brief}</p>
                      </div>
                      {aiBrief.portfolio_score != null && (
                        <div className="shrink-0 text-center">
                          <div className={`flex h-16 w-16 items-center justify-center rounded-full border-4 ${aiBrief.portfolio_score >= 70 ? "border-emerald-500 bg-emerald-50" : aiBrief.portfolio_score >= 50 ? "border-amber-500 bg-amber-50" : "border-red-500 bg-red-50"}`}>
                            <span className={`text-xl font-black ${aiBrief.portfolio_score >= 70 ? "text-emerald-700" : aiBrief.portfolio_score >= 50 ? "text-amber-700" : "text-red-700"}`}>{aiBrief.portfolio_score}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Health Score</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Signals */}
                  {aiBrief.signals?.length > 0 && (
                    <div className="rounded-xl border border-gray-200 bg-white p-5">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Portfolio Signals</p>
                      <div className="space-y-2">
                        {aiBrief.signals.map((s, i) => (
                          <div key={i} className={`flex items-start gap-3 rounded-lg px-4 py-3 ${s.type === "positive" ? "bg-emerald-50 border border-emerald-200" : s.type === "negative" ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
                            <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${s.type === "positive" ? "bg-emerald-500" : s.type === "negative" ? "bg-red-500" : "bg-amber-500"}`} />
                            <p className="text-sm text-gray-700">{s.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Watchlist */}
                  {aiBrief.watchlist?.length > 0 && (
                    <div className="rounded-xl border border-gray-200 bg-white p-5">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <ShieldExclamationIcon className="h-4 w-4 text-amber-600" /> Watchlist
                      </p>
                      <div className="space-y-2">
                        {aiBrief.watchlist.map((w, i) => (
                          <div key={i} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                            <span className="text-xs font-black text-amber-700 shrink-0">{w.loan_ref}</span>
                            <p className="text-sm text-gray-700">{w.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {aiBrief.recommendations?.length > 0 && (
                    <div className="rounded-xl border border-gray-200 bg-white p-5">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Recommendations</p>
                      <ol className="space-y-2">
                        {aiBrief.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-700">{i + 1}</span>
                            {r}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── MARKETPLACE ── */}
          {section === "marketplace" && (() => {
            const book = DEMO_ORDERBOOK[mxToken] ?? { bids: [], asks: [] };
            const bestBid = book.bids[0]?.price ?? 0;
            const bestAsk = book.asks[0]?.price ?? 0;
            const spread  = bestAsk - bestBid;
            const qty     = parseFloat(mxQty) || 0;
            const price   = parseFloat(mxPrice) || 0;
            const notional = qty * price;
            const feeBps  = 15;
            const fee     = notional * feeBps / 10000;
            const symbols = Object.keys(DEMO_ORDERBOOK);
            const navEntry = DEMO_NAV.find((n) => n.symbol === mxToken);

            function placeOrder() {
              const newOrder: MyOrder = {
                id: `o${Date.now()}`, symbol: mxToken, side: mxSide,
                qty, price, status: "open",
              };
              setMxOrders((prev) => [newOrder, ...prev]);
              setMxSubmitted(true);
              setTimeout(() => setMxSubmitted(false), 3000);
            }

            return (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-black text-gray-900">Secondary Debt Exchange</h1>
                    <p className="text-sm text-gray-500 mt-1">Trade fractional loan participations peer-to-peer. Settlement in USDC on Base.</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-right">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Platform fee</p>
                    <p className="text-lg font-black text-gray-900">15 <span className="text-sm text-gray-500">bps</span></p>
                    <p className="text-xs text-gray-500">per trade notional</p>
                  </div>
                </div>

                {/* Token selector */}
                <div className="flex gap-2 flex-wrap">
                  {symbols.map((sym) => {
                    const n = DEMO_NAV.find((x) => x.symbol === sym);
                    const isDistressed = n && n.premium_bps < -500;
                    return (
                      <button
                        key={sym}
                        onClick={() => { setMxToken(sym); setMxPrice(String(n?.last_price ?? 100)); }}
                        className={`rounded-lg border px-4 py-2.5 text-left transition-colors ${
                          mxToken === sym
                            ? isDistressed ? "border-red-400 bg-red-50 text-red-700" : "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-900"
                        }`}
                      >
                        <p className="text-xs font-mono font-black">{sym}</p>
                        {n && (
                          <p className={`text-xs mt-0.5 font-bold ${n.premium_bps >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {n.premium_bps >= 0 ? "+" : ""}{(n.premium_bps / 100).toFixed(2)}%
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Market summary strip */}
                {navEntry && (
                  <div className="rounded-xl border border-gray-200 bg-white flex divide-x divide-gray-200 overflow-hidden text-center">
                    {[
                      { label:"Best Bid",    value:`$${bestBid.toFixed(2)}`, color:"text-emerald-700" },
                      { label:"Best Ask",    value:`$${bestAsk.toFixed(2)}`, color:"text-red-700" },
                      { label:"Spread",      value:`$${spread.toFixed(2)}`,  color:"text-amber-700" },
                      { label:"Last Trade",  value:`$${navEntry.last_price.toFixed(2)}`, color:"text-gray-900" },
                      { label:"NAV",         value:`$${navEntry.nav.toFixed(2)}`, color:"text-violet-700" },
                      { label:"YTM",         value:`${navEntry.ytm.toFixed(2)}%`,  color:"text-emerald-700" },
                    ].map((s) => (
                      <div key={s.label} className="flex-1 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{s.label}</p>
                        <p className={`text-base font-black tabular-nums mt-0.5 ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Order book + place order */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Order book */}
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-200">
                      <h2 className="text-sm font-bold text-gray-900">Order Book — {mxToken}</h2>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-200">
                      {/* Bids */}
                      <div>
                        <div className="grid grid-cols-3 px-4 py-2 border-b border-gray-200 bg-emerald-50">
                          {["Price","Qty","Total"].map((h) => (
                            <span key={h} className="text-xs font-bold uppercase text-emerald-700">{h}</span>
                          ))}
                        </div>
                        {book.bids.map((b, i) => (
                          <div key={i} className="relative grid grid-cols-3 px-4 py-1.5 hover:bg-emerald-50 transition-colors group">
                            <div
                              className="absolute inset-y-0 right-0 bg-emerald-100"
                              style={{ width: `${(b.qty / 8000) * 100}%` }}
                            />
                            <span className="text-emerald-700 font-bold tabular-nums text-sm relative">{b.price.toFixed(2)}</span>
                            <span className="text-gray-700 tabular-nums text-sm relative">{b.qty.toLocaleString()}</span>
                            <span className="text-gray-500 tabular-nums text-xs relative">${(b.total/1000).toFixed(0)}K</span>
                          </div>
                        ))}
                      </div>
                      {/* Asks */}
                      <div>
                        <div className="grid grid-cols-3 px-4 py-2 border-b border-gray-200 bg-red-50">
                          {["Price","Qty","Total"].map((h) => (
                            <span key={h} className="text-xs font-bold uppercase text-red-700">{h}</span>
                          ))}
                        </div>
                        {book.asks.map((a, i) => (
                          <div key={i} className="relative grid grid-cols-3 px-4 py-1.5 hover:bg-red-50 transition-colors">
                            <div
                              className="absolute inset-y-0 left-0 bg-red-100"
                              style={{ width: `${(a.qty / 4000) * 100}%` }}
                            />
                            <span className="text-red-700 font-bold tabular-nums text-sm relative">{a.price.toFixed(2)}</span>
                            <span className="text-gray-700 tabular-nums text-sm relative">{a.qty.toLocaleString()}</span>
                            <span className="text-gray-500 tabular-nums text-xs relative">${(a.total/1000).toFixed(0)}K</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Place order */}
                  <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
                    <h2 className="text-sm font-bold text-gray-900">Place Order</h2>

                    {/* Buy / Sell toggle */}
                    <div className="flex rounded-lg overflow-hidden border border-gray-300">
                      {(["buy","sell"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setMxSide(s)}
                          className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                            mxSide === s
                              ? s === "buy" ? "bg-emerald-700 text-white" : "bg-red-700 text-white"
                              : "bg-gray-100 text-gray-500 hover:text-gray-900"
                          }`}
                        >
                          {s === "buy" ? "▲ Buy" : "▼ Sell"}
                        </button>
                      ))}
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Token</label>
                        <select
                          value={mxToken}
                          onChange={(e) => { setMxToken(e.target.value); const n = DEMO_NAV.find((x) => x.symbol === e.target.value); setMxPrice(String(n?.last_price ?? 100)); }}
                          className="w-full rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2 text-sm"
                        >
                          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Quantity (tokens)</label>
                          <input
                            type="number" value={mxQty} onChange={(e) => setMxQty(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2 text-sm tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Limit Price ($)</label>
                          <input
                            type="number" step="0.01" value={mxPrice} onChange={(e) => setMxPrice(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2 text-sm tabular-nums"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Order summary */}
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
                      {[
                        { label:"Notional",    value: `$${notional.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}` },
                        { label:`Fee (${feeBps} bps)`, value: `$${fee.toFixed(2)}`, sub: true },
                        { label: mxSide === "buy" ? "Total Cost" : "Net Proceeds",
                          value: `$${(mxSide === "buy" ? notional + fee : notional - fee).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}`,
                          bold: true },
                      ].map((row) => (
                        <div key={row.label} className={`flex justify-between ${row.bold ? "border-t border-gray-200 pt-2" : ""}`}>
                          <span className={row.sub ? "text-gray-500 text-xs" : "text-gray-600"}>{row.label}</span>
                          <span className={row.bold ? "font-black text-gray-900" : row.sub ? "text-gray-500 text-xs" : "text-gray-700 font-semibold tabular-nums"}>{row.value}</span>
                        </div>
                      ))}
                    </div>

                    {mxSubmitted ? (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700">Order submitted to the exchange</span>
                      </div>
                    ) : (
                      <button
                        onClick={placeOrder}
                        disabled={qty <= 0 || price <= 0}
                        className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${
                          mxSide === "buy"
                            ? "bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40"
                            : "bg-red-700 hover:bg-red-600 text-white disabled:opacity-40"
                        }`}
                      >
                        {mxSide === "buy" ? "▲" : "▼"} Submit {mxSide.toUpperCase()} Order
                      </button>
                    )}
                  </div>
                </div>

                {/* My open orders */}
                {mxOrders.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-gray-900">My Open Orders</h2>
                      <span className="text-xs text-slate-500">{mxOrders.filter((o) => o.status === "open").length} open</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {["Token","Side","Qty","Limit Price","Notional","Fee","Status",""].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {mxOrders.map((o) => {
                          const n = o.qty * o.price;
                          const f = n * feeBps / 10000;
                          return (
                            <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-3 font-mono font-bold text-violet-700 text-xs">{o.symbol}</td>
                              <td className={`px-5 py-3 font-bold ${o.side === "buy" ? "text-emerald-700" : "text-red-700"}`}>{o.side.toUpperCase()}</td>
                              <td className="px-5 py-3 text-gray-700 tabular-nums">{o.qty.toLocaleString()}</td>
                              <td className="px-5 py-3 text-gray-700 tabular-nums">${o.price.toFixed(2)}</td>
                              <td className="px-5 py-3 text-gray-700 tabular-nums">${n.toLocaleString("en-US",{maximumFractionDigits:0})}</td>
                              <td className="px-5 py-3 text-gray-500 tabular-nums text-xs">${f.toFixed(2)}</td>
                              <td className="px-5 py-3">
                                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700">Open</span>
                              </td>
                              <td className="px-5 py-3">
                                <button
                                  onClick={() => setMxOrders((prev) => prev.map((x) => x.id === o.id ? { ...x, status:"cancelled" } : x).filter((x) => x.status !== "cancelled"))}
                                  className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Recent market trades */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-gray-900">Recent Platform Trades</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {["Token","Side","Price","Qty","Fee (15 bps)","Volume","Time"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {DEMO_MARKET_TRADES.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-mono font-bold text-violet-700 text-xs">{t.symbol}</td>
                          <td className={`px-5 py-3 font-bold text-xs ${t.side === "buy" ? "text-emerald-700" : "text-red-700"}`}>
                            {t.side === "buy" ? "▲ BUY" : "▼ SELL"}
                          </td>
                          <td className="px-5 py-3 text-gray-700 tabular-nums font-semibold">${t.price.toFixed(2)}</td>
                          <td className="px-5 py-3 text-gray-700 tabular-nums">{t.qty.toLocaleString()}</td>
                          <td className="px-5 py-3 text-emerald-700 tabular-nums font-semibold text-xs">${t.fee.toFixed(2)}</td>
                          <td className="px-5 py-3 text-gray-700 tabular-nums">${t.total.toLocaleString()}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{new Date(t.time).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-6 py-3 border-t border-gray-200 bg-white">
                    <p className="text-xs text-gray-500">
                      Platform earns <strong className="text-emerald-700">15 bps</strong> on every trade.
                      Example: $25B annual volume × 0.15% = <strong className="text-emerald-700">$37.5M transaction revenue</strong>
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── TOKEN NAV PRICING ── */}
          {section === "pricing" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-black text-gray-900">Token NAV Pricing Engine</h1>
                  <p className="text-sm text-gray-500 mt-1">Real-time net asset value per token — adjusted for DSCR, LTV, and delinquency risk.</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-700">Live Pricing</span>
                </div>
              </div>

              {/* NAV formula explanation */}
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 flex items-start gap-4">
                <InformationCircleIcon className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700 space-y-1">
                  <p className="font-bold text-gray-900">NAV Pricing Model</p>
                  <p className="text-gray-600 text-xs">
                    <strong className="text-violet-700">NAV = Par × (1 + DSCR premium) × (1 + LTV premium) × (1 − delinquency discount)</strong>
                  </p>
                  <p className="text-xs text-gray-500">
                    DSCR &gt; 1.25x adds premium · LTV &lt; 65% adds premium · Delinquency &gt; 0 days applies discount · Special servicing / default applies high-risk haircut
                  </p>
                </div>
              </div>

              {/* NAV cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {DEMO_NAV.map((n) => {
                  const isDistressed = n.premium_bps < -500;
                  const isPremium = n.premium_bps > 0;
                  const perf = performance.find((p) => p.loan_ref === n.loan_ref);
                  return (
                    <div
                      key={n.symbol}
                      className={`rounded-xl border p-5 space-y-4 ${
                        isDistressed ? "border-red-200 bg-red-50"
                        : isPremium  ? "border-emerald-200 bg-emerald-50"
                        : "border-gray-200 bg-white"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-mono font-black text-violet-700">{n.symbol}</p>
                          <p className="text-lg font-black text-gray-900 mt-0.5">{n.loan_ref}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-gray-900 tabular-nums">${n.nav.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">NAV per token</p>
                          <span className={`inline-flex items-center gap-1 text-xs font-bold mt-1 ${isPremium ? "text-emerald-700" : "text-red-700"}`}>
                            {isPremium
                              ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
                              : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />
                            }
                            {isPremium ? "+" : ""}{(n.premium_bps / 100).toFixed(2)}% vs par
                          </span>
                        </div>
                      </div>

                      {/* Adjustment waterfall */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">NAV Adjustment Waterfall</p>
                        {[
                          { label:"Par Value",        value:"$100.00",               color:"text-gray-700" },
                          { label:"DSCR Adjustment",  value:`${n.dscr_adj >= 0 ? "+" : ""}${n.dscr_adj.toFixed(2)}%`, color: n.dscr_adj >= 0 ? "text-emerald-700" : "text-red-700" },
                          { label:"LTV Adjustment",   value:`${n.ltv_adj >= 0 ? "+" : ""}${n.ltv_adj.toFixed(2)}%`,  color: n.ltv_adj >= 0 ? "text-emerald-700" : "text-red-700" },
                          { label:"Delinquency",      value:`${n.delinquency_adj.toFixed(2)}%`, color: n.delinquency_adj === 0 ? "text-gray-500" : "text-red-700" },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{row.label}</span>
                            <span className={`font-bold tabular-nums ${row.color}`}>{row.value}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-1.5">
                          <span className="font-bold text-gray-900">Indicated NAV</span>
                          <span className="font-black text-gray-900 tabular-nums">${n.nav.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Market vs NAV */}
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Market vs NAV</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>Last Trade ${n.last_price.toFixed(2)}</span>
                              <span>NAV ${n.nav.toFixed(2)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isDistressed ? "bg-red-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(100, (n.last_price / n.nav) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Market / NAV ratio</span>
                          <span className={`font-bold tabular-nums ${n.last_price >= n.nav ? "text-emerald-700" : "text-red-700"}`}>
                            {(n.last_price / n.nav).toFixed(3)}x
                          </span>
                        </div>
                      </div>

                      {/* YTM */}
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <div>
                          <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">Yield to Maturity</p>
                          {perf && (
                            <p className="text-xs text-gray-500 mt-0.5">DSCR {perf.dscr.toFixed(2)}x · LTV {perf.ltv.toFixed(1)}% · {perf.delinquency_days === 0 ? "Current" : `${perf.delinquency_days}d late`}</p>
                          )}
                        </div>
                        <p className={`text-xl font-black tabular-nums ${isDistressed ? "text-red-700" : "text-emerald-700"}`}>
                          {n.ytm.toFixed(2)}%
                        </p>
                      </div>

                      {/* CTA */}
                      <button
                        onClick={() => { setSection("marketplace"); setMxToken(n.symbol); setMxPrice(String(n.last_price)); }}
                        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
                          isDistressed
                            ? "border border-red-300 text-red-700 hover:bg-red-50"
                            : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        Trade {n.symbol} →
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Platform revenue model */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4">Revenue Model — Scenario B</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {[
                    { label:"SaaS ARR Target", value:"$40M", sub:"Lender + servicer subscriptions", color:"text-violet-700" },
                    { label:"Target Volume", value:"$25B+", sub:"Annual tokenized loan transactions", color:"text-emerald-700" },
                    { label:"Transaction Revenue", value:"$37.5M", sub:"$25B × 15 bps platform fee", color:"text-amber-700" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{s.label}</p>
                      <p className={`text-2xl font-black mt-2 ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-5 py-4">
                  <p className="text-sm text-emerald-800">
                    <strong className="text-gray-900">Combined ARR:</strong> $40M SaaS + $37.5M transaction fees = <strong className="text-emerald-700 text-base">~$77.5M total annual revenue</strong> — supporting unicorn valuation.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Kontra = Stripe (infrastructure rails) + Nasdaq (marketplace liquidity) + Black Knight (servicing backbone)</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
