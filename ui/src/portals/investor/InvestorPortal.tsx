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
  ArrowsRightLeftIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  InformationCircleIcon,
  SparklesIcon,
  ShoppingBagIcon,
  XMarkIcon,
  Bars3Icon,
  MapPinIcon,
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

type AiBrief = { brief: string; portfolio_score: number | null; signals: { type: string; message: string }[]; recommendations: string[]; watchlist: { loan_ref: string; reason: string }[] };

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

type Section = "portfolio" | "distributions" | "performance" | "governance" | "documents" | "alerts" | "deal_flow" | "marketplace" | "pricing" | "ai";

const NAV: { key: Section; label: string; icon: typeof ChartPieIcon; badge?: number; dividerBefore?: boolean }[] = [
  { key:"portfolio",     label:"Portfolio",           icon: ChartPieIcon },
  { key:"distributions", label:"Distributions",       icon: BanknotesIcon },
  { key:"performance",   label:"Loan Performance",    icon: ChartBarIcon },
  { key:"governance",    label:"Governance & Voting",  icon: ScaleIcon, badge: 2 },
  { key:"documents",     label:"Reports & Docs",      icon: DocumentTextIcon },
  { key:"alerts",        label:"Risk Alerts",         icon: ExclamationTriangleIcon, badge: 2 },
  { key:"deal_flow",     label:"Deal Flow",           icon: ShoppingBagIcon, badge: 4, dividerBefore: true },
  { key:"marketplace",   label:"Debt Exchange",       icon: ArrowsRightLeftIcon },
  { key:"pricing",       label:"Token NAV Pricing",   icon: CurrencyDollarIcon },
  { key:"ai",            label:"AI Portfolio Brief",  icon: SparklesIcon, dividerBefore: true },
];

export default function InvestorPortal() {
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
    const [aiBrief, setAiBrief] = useState<AiBrief | null>(null);
    const [aiBriefLoading, setAiBriefLoading] = useState(false);
    const [aiBriefError, setAiBriefError] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    // Deal Flow state
    const [dfListings, setDfListings] = useState<any[]>([]);
    const [dfLoading, setDfLoading] = useState(false);
    const [dfSubscribeId, setDfSubscribeId] = useState<string | null>(null);
    const [dfAmount, setDfAmount] = useState("");
    const [dfEmail, setDfEmail] = useState("");
    const [dfSubmitting, setDfSubmitting] = useState(false);
    const [dfSuccess, setDfSuccess] = useState("");
    const [dfError, setDfError] = useState("");

    // Fetch deal flow listings when section becomes deal_flow
    useEffect(() => {
      if (section !== "deal_flow") return;
      setDfLoading(true);
      fetch((import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "") + "/market/listings")
        .then(r => r.json()).then(d => setDfListings(Array.isArray(d) ? d : [])).catch(() => setDfListings([]))
        .finally(() => setDfLoading(false));
    }, [section]);

    const handleDfSubscribe = async (listingId: string) => {
      const amt = Number(dfAmount);
      if (!amt || amt <= 0) return setDfError("Enter a valid amount");
      setDfSubmitting(true); setDfError("");
      try {
        const apiBase = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
        const res = await fetch(apiBase + "/market/listings/" + listingId + "/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amt, investor_email: dfEmail || undefined }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Subscription failed");
        setDfSuccess("Subscription submitted for " + json.listing_title + "!");
        setDfSubscribeId(null); setDfAmount(""); setDfEmail("");
        setTimeout(() => setDfSuccess(""), 4000);
      } catch (err: any) {
        setDfError(err.message);
      } finally { setDfSubmitting(false); }
    };

    const generateBrief = async () => {
      setAiBriefLoading(true); setAiBriefError(null);
      try {
        const { data } = await api.post<AiBrief>("/ai/portfolio-brief", {});
        if (data) setAiBrief(data);
        else setAiBriefError("No response from AI service.");
      } catch { setAiBriefError("AI service unavailable. Please try again."); }
      finally { setAiBriefLoading(false); }
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
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden relative">

      {/* ── Sidebar ── */}
      {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={() => setMobileMenuOpen(false)} />}
        <aside className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-800 bg-slate-900 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo area */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 font-black text-white text-sm">K</div>
          <div>
            <p className="text-sm font-bold text-white">Kontra</p>
            <p className="text-xs text-violet-400 font-medium">Investor Portal</p>
          </div>
          <button className="ml-auto md:hidden p-1 text-slate-500 hover:text-white" onClick={() => setMobileMenuOpen(false)}><XMarkIcon className="h-5 w-5" /></button>
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
              <div key={item.key}>
                {item.dividerBefore && (
                  <div className="flex items-center gap-2 px-2 pt-3 pb-1">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Exchange</span>
                    <div className="flex-1 h-px bg-slate-800" />
                  </div>
                )}
                <button
                  onClick={() => { setSection(item.key); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                    active
                      ? item.key === "marketplace" || item.key === "pricing"
                        ? "bg-emerald-700 text-white font-semibold"
                        : "bg-violet-600 text-white font-semibold"
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
              </div>
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
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">

          {/* ── PORTFOLIO ── */}
          {section === "portfolio" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-white">Portfolio Overview</h1>
                <p className="text-sm text-slate-400 mt-1">Your loan participations, token positions, and investment performance</p>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                    <h1 className="text-2xl font-black text-white">Secondary Debt Exchange</h1>
                    <p className="text-sm text-slate-400 mt-1">Trade fractional loan participations peer-to-peer. Settlement in USDC on Base.</p>
                  </div>
                  <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-4 py-2 text-right">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Platform fee</p>
                    <p className="text-lg font-black text-white">15 <span className="text-sm text-slate-400">bps</span></p>
                    <p className="text-xs text-slate-500">per trade notional</p>
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
                            ? isDistressed ? "border-brand-500 bg-brand-900/40 text-brand-300" : "border-emerald-500 bg-emerald-900/30 text-emerald-300"
                            : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white"
                        }`}
                      >
                        <p className="text-xs font-mono font-black">{sym}</p>
                        {n && (
                          <p className={`text-xs mt-0.5 font-bold ${n.premium_bps >= 0 ? "text-emerald-400" : "text-brand-400"}`}>
                            {n.premium_bps >= 0 ? "+" : ""}{(n.premium_bps / 100).toFixed(2)}%
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Market summary strip */}
                {navEntry && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900 flex divide-x divide-slate-800 overflow-hidden text-center">
                    {[
                      { label:"Best Bid",    value:`$${bestBid.toFixed(2)}`, color:"text-emerald-400" },
                      { label:"Best Ask",    value:`$${bestAsk.toFixed(2)}`, color:"text-brand-400" },
                      { label:"Spread",      value:`$${spread.toFixed(2)}`,  color:"text-amber-400" },
                      { label:"Last Trade",  value:`$${navEntry.last_price.toFixed(2)}`, color:"text-white" },
                      { label:"NAV",         value:`$${navEntry.nav.toFixed(2)}`, color:"text-violet-400" },
                      { label:"YTM",         value:`${navEntry.ytm.toFixed(2)}%`,  color:"text-emerald-400" },
                    ].map((s) => (
                      <div key={s.label} className="flex-1 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
                        <p className={`text-base font-black tabular-nums mt-0.5 ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Order book + place order */}
                <div className="grid grid-cols-1 lg:grid-cols-1 sm:grid-cols-2 gap-6">

                  {/* Order book */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800">
                      <h2 className="text-sm font-bold text-white">Order Book — {mxToken}</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-x divide-slate-800">
                      {/* Bids */}
                      <div>
                        <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 px-4 py-2 border-b border-slate-800">
                          {["Price","Qty","Total"].map((h) => (
                            <span key={h} className="text-xs font-bold uppercase text-emerald-500">{h}</span>
                          ))}
                        </div>
                        {book.bids.map((b, i) => (
                          <div key={i} className="relative grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 px-4 py-1.5 hover:bg-emerald-950/20 transition-colors group">
                            <div
                              className="absolute inset-y-0 right-0 bg-emerald-900/20"
                              style={{ width: `${(b.qty / 8000) * 100}%` }}
                            />
                            <span className="text-emerald-400 font-bold tabular-nums text-sm relative">{b.price.toFixed(2)}</span>
                            <span className="text-slate-300 tabular-nums text-sm relative">{b.qty.toLocaleString()}</span>
                            <span className="text-slate-500 tabular-nums text-xs relative">${(b.total/1000).toFixed(0)}K</span>
                          </div>
                        ))}
                      </div>
                      {/* Asks */}
                      <div>
                        <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 px-4 py-2 border-b border-slate-800">
                          {["Price","Qty","Total"].map((h) => (
                            <span key={h} className="text-xs font-bold uppercase text-brand-500">{h}</span>
                          ))}
                        </div>
                        {book.asks.map((a, i) => (
                          <div key={i} className="relative grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 px-4 py-1.5 hover:bg-brand-950/20 transition-colors">
                            <div
                              className="absolute inset-y-0 left-0 bg-brand-900/20"
                              style={{ width: `${(a.qty / 4000) * 100}%` }}
                            />
                            <span className="text-brand-400 font-bold tabular-nums text-sm relative">{a.price.toFixed(2)}</span>
                            <span className="text-slate-300 tabular-nums text-sm relative">{a.qty.toLocaleString()}</span>
                            <span className="text-slate-500 tabular-nums text-xs relative">${(a.total/1000).toFixed(0)}K</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Place order */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col gap-4">
                    <h2 className="text-sm font-bold text-white">Place Order</h2>

                    {/* Buy / Sell toggle */}
                    <div className="flex rounded-lg overflow-hidden border border-slate-700">
                      {(["buy","sell"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setMxSide(s)}
                          className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                            mxSide === s
                              ? s === "buy" ? "bg-emerald-700 text-white" : "bg-brand-700 text-white"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {s === "buy" ? "▲ Buy" : "▼ Sell"}
                        </button>
                      ))}
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Token</label>
                        <select
                          value={mxToken}
                          onChange={(e) => { setMxToken(e.target.value); const n = DEMO_NAV.find((x) => x.symbol === e.target.value); setMxPrice(String(n?.last_price ?? 100)); }}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm"
                        >
                          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Quantity (tokens)</label>
                          <input
                            type="number" value={mxQty} onChange={(e) => setMxQty(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Limit Price ($)</label>
                          <input
                            type="number" step="0.01" value={mxPrice} onChange={(e) => setMxPrice(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm tabular-nums"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Order summary */}
                    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 space-y-2 text-sm">
                      {[
                        { label:"Notional",    value: `$${notional.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}` },
                        { label:`Fee (${feeBps} bps)`, value: `$${fee.toFixed(2)}`, sub: true },
                        { label: mxSide === "buy" ? "Total Cost" : "Net Proceeds",
                          value: `$${(mxSide === "buy" ? notional + fee : notional - fee).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}`,
                          bold: true },
                      ].map((row) => (
                        <div key={row.label} className={`flex justify-between ${row.bold ? "border-t border-slate-700 pt-2" : ""}`}>
                          <span className={row.sub ? "text-slate-500 text-xs" : "text-slate-400"}>{row.label}</span>
                          <span className={row.bold ? "font-black text-white" : row.sub ? "text-slate-500 text-xs" : "text-slate-300 font-semibold tabular-nums"}>{row.value}</span>
                        </div>
                      ))}
                    </div>

                    {mxSubmitted ? (
                      <div className="rounded-lg bg-emerald-900/50 border border-emerald-700/40 px-4 py-3 flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-emerald-300">Order submitted to the exchange</span>
                      </div>
                    ) : (
                      <button
                        onClick={placeOrder}
                        disabled={qty <= 0 || price <= 0}
                        className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${
                          mxSide === "buy"
                            ? "bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40"
                            : "bg-brand-700 hover:bg-brand-600 text-white disabled:opacity-40"
                        }`}
                      >
                        {mxSide === "buy" ? "▲" : "▼"} Submit {mxSide.toUpperCase()} Order
                      </button>
                    )}
                  </div>
                </div>

                {/* My open orders */}
                {mxOrders.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-white">My Open Orders</h2>
                      <span className="text-xs text-slate-500">{mxOrders.filter((o) => o.status === "open").length} open</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800">
                          {["Token","Side","Qty","Limit Price","Notional","Fee","Status",""].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {mxOrders.map((o) => {
                          const n = o.qty * o.price;
                          const f = n * feeBps / 10000;
                          return (
                            <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-5 py-3 font-mono font-bold text-violet-400 text-xs">{o.symbol}</td>
                              <td className={`px-5 py-3 font-bold ${o.side === "buy" ? "text-emerald-400" : "text-brand-400"}`}>{o.side.toUpperCase()}</td>
                              <td className="px-5 py-3 text-slate-300 tabular-nums">{o.qty.toLocaleString()}</td>
                              <td className="px-5 py-3 text-slate-300 tabular-nums">${o.price.toFixed(2)}</td>
                              <td className="px-5 py-3 text-slate-300 tabular-nums">${n.toLocaleString("en-US",{maximumFractionDigits:0})}</td>
                              <td className="px-5 py-3 text-slate-500 tabular-nums text-xs">${f.toFixed(2)}</td>
                              <td className="px-5 py-3">
                                <span className="rounded-full bg-amber-900/40 border border-amber-700/30 px-2.5 py-0.5 text-xs font-bold text-amber-400">Open</span>
                              </td>
                              <td className="px-5 py-3">
                                <button
                                  onClick={() => setMxOrders((prev) => prev.map((x) => x.id === o.id ? { ...x, status:"cancelled" } : x).filter((x) => x.status !== "cancelled"))}
                                  className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
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
                <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800">
                    <h2 className="text-sm font-bold text-white">Recent Platform Trades</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {["Token","Side","Price","Qty","Fee (15 bps)","Volume","Time"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {DEMO_MARKET_TRADES.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-3 font-mono font-bold text-violet-400 text-xs">{t.symbol}</td>
                          <td className={`px-5 py-3 font-bold text-xs ${t.side === "buy" ? "text-emerald-400" : "text-brand-400"}`}>
                            {t.side === "buy" ? "▲ BUY" : "▼ SELL"}
                          </td>
                          <td className="px-5 py-3 text-slate-300 tabular-nums font-semibold">${t.price.toFixed(2)}</td>
                          <td className="px-5 py-3 text-slate-300 tabular-nums">{t.qty.toLocaleString()}</td>
                          <td className="px-5 py-3 text-emerald-400 tabular-nums font-semibold text-xs">${t.fee.toFixed(2)}</td>
                          <td className="px-5 py-3 text-slate-300 tabular-nums">${t.total.toLocaleString()}</td>
                          <td className="px-5 py-3 text-slate-500 text-xs">{new Date(t.time).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60">
                    <p className="text-xs text-slate-500">
                      Platform earns <strong className="text-emerald-400">15 bps</strong> on every trade.
                      Example: $25B annual volume × 0.15% = <strong className="text-emerald-400">$37.5M transaction revenue</strong>
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
                  <h1 className="text-2xl font-black text-white">Token NAV Pricing Engine</h1>
                  <p className="text-sm text-slate-400 mt-1">Real-time net asset value per token — adjusted for DSCR, LTV, and delinquency risk.</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-400">Live Pricing</span>
                </div>
              </div>

              {/* NAV formula explanation */}
              <div className="rounded-xl border border-violet-800/40 bg-violet-950/20 p-5 flex items-start gap-4">
                <InformationCircleIcon className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
                <div className="text-sm text-slate-300 space-y-1">
                  <p className="font-bold text-white">NAV Pricing Model</p>
                  <p className="text-slate-400 text-xs">
                    <strong className="text-violet-300">NAV = Par × (1 + DSCR premium) × (1 + LTV premium) × (1 − delinquency discount)</strong>
                  </p>
                  <p className="text-xs text-slate-500">
                    DSCR &gt; 1.25x adds premium · LTV &lt; 65% adds premium · Delinquency &gt; 0 days applies discount · Special servicing / default applies high-risk haircut
                  </p>
                </div>
              </div>

              {/* NAV cards */}
              <div className="grid grid-cols-1 lg:grid-cols-1 sm:grid-cols-2 gap-5">
                {DEMO_NAV.map((n) => {
                  const isDistressed = n.premium_bps < -500;
                  const isPremium = n.premium_bps > 0;
                  const perf = performance.find((p) => p.loan_ref === n.loan_ref);
                  return (
                    <div
                      key={n.symbol}
                      className={`rounded-xl border p-5 space-y-4 ${
                        isDistressed ? "border-brand-800/50 bg-brand-950/20"
                        : isPremium  ? "border-emerald-800/40 bg-emerald-950/15"
                        : "border-slate-800 bg-slate-900"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-mono font-black text-violet-400">{n.symbol}</p>
                          <p className="text-lg font-black text-white mt-0.5">{n.loan_ref}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-white tabular-nums">${n.nav.toFixed(2)}</p>
                          <p className="text-xs text-slate-400">NAV per token</p>
                          <span className={`inline-flex items-center gap-1 text-xs font-bold mt-1 ${isPremium ? "text-emerald-400" : "text-brand-400"}`}>
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
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">NAV Adjustment Waterfall</p>
                        {[
                          { label:"Par Value",        value:"$100.00",               color:"text-slate-300" },
                          { label:"DSCR Adjustment",  value:`${n.dscr_adj >= 0 ? "+" : ""}${n.dscr_adj.toFixed(2)}%`, color: n.dscr_adj >= 0 ? "text-emerald-400" : "text-brand-400" },
                          { label:"LTV Adjustment",   value:`${n.ltv_adj >= 0 ? "+" : ""}${n.ltv_adj.toFixed(2)}%`,  color: n.ltv_adj >= 0 ? "text-emerald-400" : "text-brand-400" },
                          { label:"Delinquency",      value:`${n.delinquency_adj.toFixed(2)}%`, color: n.delinquency_adj === 0 ? "text-slate-500" : "text-brand-400" },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">{row.label}</span>
                            <span className={`font-bold tabular-nums ${row.color}`}>{row.value}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-sm border-t border-slate-700 pt-1.5">
                          <span className="font-bold text-white">Indicated NAV</span>
                          <span className="font-black text-white tabular-nums">${n.nav.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Market vs NAV */}
                      <div className="rounded-lg bg-slate-800/60 p-3 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Market vs NAV</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Last Trade ${n.last_price.toFixed(2)}</span>
                              <span>NAV ${n.nav.toFixed(2)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isDistressed ? "bg-brand-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(100, (n.last_price / n.nav) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Market / NAV ratio</span>
                          <span className={`font-bold tabular-nums ${n.last_price >= n.nav ? "text-emerald-400" : "text-brand-400"}`}>
                            {(n.last_price / n.nav).toFixed(3)}x
                          </span>
                        </div>
                      </div>

                      {/* YTM */}
                      <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Yield to Maturity</p>
                          {perf && (
                            <p className="text-xs text-slate-500 mt-0.5">DSCR {perf.dscr.toFixed(2)}x · LTV {perf.ltv.toFixed(1)}% · {perf.delinquency_days === 0 ? "Current" : `${perf.delinquency_days}d late`}</p>
                          )}
                        </div>
                        <p className={`text-xl font-black tabular-nums ${isDistressed ? "text-brand-400" : "text-emerald-400"}`}>
                          {n.ytm.toFixed(2)}%
                        </p>
                      </div>

                      {/* CTA */}
                      <button
                        onClick={() => { setSection("marketplace"); setMxToken(n.symbol); setMxPrice(String(n.last_price)); }}
                        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
                          isDistressed
                            ? "border border-brand-700 text-brand-400 hover:bg-brand-900/30"
                            : "border border-emerald-700 text-emerald-400 hover:bg-emerald-900/20"
                        }`}
                      >
                        Trade {n.symbol} →
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Platform revenue model */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-base font-bold text-white mb-4">Revenue Model — Scenario B</h2>
                <div className="grid grid-cols-1 lg:grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label:"SaaS ARR Target", value:"$40M", sub:"Lender + servicer subscriptions", color:"text-violet-400" },
                    { label:"Target Volume", value:"$25B+", sub:"Annual tokenized loan transactions", color:"text-emerald-400" },
                    { label:"Transaction Revenue", value:"$37.5M", sub:"$25B × 15 bps platform fee", color:"text-amber-400" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
                      <p className={`text-2xl font-black mt-2 ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-emerald-950/30 border border-emerald-800/40 px-5 py-4">
                  <p className="text-sm text-emerald-300">
                    <strong className="text-white">Combined ARR:</strong> $40M SaaS + $37.5M transaction fees = <strong className="text-emerald-400 text-base">~$77.5M total annual revenue</strong> — supporting unicorn valuation.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Kontra = Stripe (infrastructure rails) + Nasdaq (marketplace liquidity) + Black Knight (servicing backbone)</p>
                </div>
              </div>
            </div>
          )}


              {section === "deal_flow" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-white">Deal Flow</h2>
                      <p className="text-sm text-slate-400 mt-1">Active loan participation opportunities open for investment.</p>
                    </div>
                  </div>

                  {dfSuccess && (
                    <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-5 py-3">
                      <p className="text-sm font-medium text-emerald-300">{dfSuccess}</p>
                    </div>
                  )}

                  {dfLoading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
                      <svg className="h-5 w-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/></svg>
                      Loading deals…
                    </div>
                  ) : dfListings.length === 0 ? (
                    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-12 text-center">
                      <p className="text-slate-400">No active deals available right now.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5">
                      {dfListings.map((deal: any) => {
                        const fillPct = Math.min(100, deal.fill_pct ?? 0);
                        const fillColor = fillPct >= 80 ? "bg-emerald-500" : fillPct >= 40 ? "bg-violet-500" : "bg-slate-500";
                        const isOpen = dfSubscribeId === deal.id;
                        const typeBadge: Record<string,string> = {
                          Multifamily:"bg-emerald-900/50 text-emerald-300",
                          Industrial:"bg-violet-900/50 text-violet-300",
                          Office:"bg-blue-900/50 text-blue-300",
                          Retail:"bg-amber-900/50 text-amber-300",
                          "Mixed-Use":"bg-rose-900/50 text-rose-300",
                        };
                        return (
                          <div key={deal.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-white">{deal.title}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{deal.location} · {deal.offering_type}</p>
                              </div>
                              <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${typeBadge[deal.property_type] ?? "bg-slate-700 text-slate-300"}`}>{deal.property_type}</span>
                            </div>

                            {deal.description && <p className="text-sm text-slate-400 line-clamp-2">{deal.description}</p>}

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-center">
                              {[
                                { l:"Target Raise", v: deal.target_raise >= 1e6 ? "$"+(deal.target_raise/1e6).toFixed(1)+"M" : "$"+deal.target_raise?.toLocaleString() },
                                { l:"Target Yield", v: deal.target_yield ? deal.target_yield+"%" : "–" },
                                { l:"LTV", v: deal.ltv ? deal.ltv+"%" : "–" },
                                { l:"Min Invest", v: deal.min_investment >= 1e6 ? "$"+(deal.min_investment/1e6).toFixed(1)+"M" : "$"+(deal.min_investment||0).toLocaleString() },
                              ].map(s => (
                                <div key={s.l} className="rounded-lg bg-slate-900/60 px-2 py-2.5">
                                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.l}</p>
                                  <p className="text-sm font-black text-white mt-1">{s.v}</p>
                                </div>
                              ))}
                            </div>

                            <div>
                              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                <span>{deal.raised_amount >= 1e6 ? "$"+(deal.raised_amount/1e6).toFixed(1)+"M" : "$"+(deal.raised_amount||0).toLocaleString()} committed</span>
                                <span className="text-emerald-400 font-bold">{fillPct}% funded</span>
                              </div>
                              <div className="h-2.5 rounded-full bg-slate-700 overflow-hidden">
                                <div className={`h-full rounded-full ${fillColor}`} style={{ width: fillPct+"%" }} />
                              </div>
                            </div>

                            {/* Subscribe toggle */}
                            {!isOpen ? (
                              <button
                                onClick={() => { setDfSubscribeId(deal.id); setDfAmount(String(deal.min_investment || "")); setDfError(""); }}
                                className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition-colors"
                              >
                                Subscribe / Invest
                              </button>
                            ) : (
                              <div className="rounded-xl border border-violet-700/40 bg-violet-950/30 p-4 space-y-3">
                                <p className="text-sm font-bold text-violet-300">Commit Capital</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wide">Amount ($)</label>
                                    <input type="number" value={dfAmount} onChange={e => setDfAmount(e.target.value)}
                                      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                                      placeholder={String(deal.min_investment || 100000)} />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wide">Your Email</label>
                                    <input type="email" value={dfEmail} onChange={e => setDfEmail(e.target.value)}
                                      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                                      placeholder="investor@fund.com" />
                                  </div>
                                </div>
                                {dfError && <p className="text-xs text-red-400">{dfError}</p>}
                                <div className="flex gap-3">
                                  <button onClick={() => { setDfSubscribeId(null); setDfError(""); }}
                                    className="flex-1 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition">Cancel</button>
                                  <button onClick={() => handleDfSubscribe(deal.id)} disabled={dfSubmitting}
                                    className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50 transition">
                                    {dfSubmitting ? "Submitting…" : "Confirm Subscription"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {section === "ai" && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <SparklesIcon className="h-6 w-6 text-violet-400" />
                  <h2 className="text-xl font-black text-white">AI Portfolio Brief</h2>
                </div>
                <p className="text-sm text-slate-400">Generate an AI-powered analysis of your entire portfolio — health score, risk signals, watchlist loans, and strategic recommendations.</p>
                <button
                  onClick={generateBrief}
                  disabled={aiBriefLoading}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-5 py-2.5 text-sm font-bold text-white transition-colors"
                >
                  <SparklesIcon className="h-4 w-4" />
                  {aiBriefLoading ? "Generating…" : aiBrief ? "Regenerate" : "Generate Brief"}
                </button>
                {aiBriefError && <p className="text-sm text-red-400">{aiBriefError}</p>}
                {!aiBrief && !aiBriefLoading && (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 md:p-8 text-center">
                    <SparklesIcon className="h-10 w-10 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400 text-sm">Click "Generate Brief" to run an AI analysis of your full portfolio.</p>
                  </div>
                )}
                {aiBriefLoading && (
                  <div className="rounded-xl border border-violet-800/40 bg-violet-950/20 p-4 md:p-8 text-center">
                    <SparklesIcon className="h-8 w-8 text-violet-400 mx-auto mb-3 animate-pulse" />
                    <p className="text-violet-300 text-sm font-medium">Analyzing portfolio…</p>
                  </div>
                )}
                {aiBrief && (
                  <div className="space-y-5">
                    {aiBrief.portfolio_score != null && (
                      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5 flex items-center gap-5">
                        <div className="text-5xl font-black text-violet-400">{aiBrief.portfolio_score}</div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Portfolio Health Score</p>
                          <p className="text-sm text-slate-300 mt-1">{aiBrief.brief}</p>
                        </div>
                      </div>
                    )}
                    {!aiBrief.portfolio_score && <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5"><p className="text-sm text-slate-300">{aiBrief.brief}</p></div>}
                    {aiBrief.signals?.length > 0 && (
                      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Portfolio Signals</h3>
                        <div className="space-y-2">
                          {aiBrief.signals.map((s, i) => (
                            <div key={i} className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${s.type === 'positive' ? 'bg-emerald-950/30 text-emerald-300' : s.type === 'negative' ? 'bg-red-950/30 text-red-300' : 'bg-amber-950/30 text-amber-300'}`}>
                              <span className="font-bold uppercase text-xs mt-0.5">{s.type}</span>
                              <span>{s.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiBrief.watchlist?.length > 0 && (
                      <div className="rounded-xl border border-red-800/30 bg-red-950/20 p-5">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3">Watchlist</h3>
                        {aiBrief.watchlist.map((w, i) => (
                          <div key={i} className="flex items-start gap-3 text-sm text-slate-300 mb-2">
                            <span className="font-bold text-white">{w.loan_ref}</span>
                            <span className="text-slate-400">{w.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiBrief.recommendations?.length > 0 && (
                      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Recommendations</h3>
                        <ul className="space-y-1">
                          {aiBrief.recommendations.map((r, i) => <li key={i} className="text-sm text-slate-300 flex gap-2"><span className="text-violet-400">→</span>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

  
        </div>
      </main>
    </div>
  );
}
