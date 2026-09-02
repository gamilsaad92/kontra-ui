/**
 * AI Deal Screener / Underwriting Engine — Stage 4
 * Route: /portfolio/underwriting
 *
 * The "Stripe for CRE" decisioning layer — real-time AI underwriting for new loan requests.
 * Analysts submit a deal; the engine auto-scores it against market comps, stress-tests
 * the cash flow, benchmarks the rate, and emits a risk rating + automated term sheet.
 *
 * AI analysis layers:
 *   1. Market Comp Analysis     — nearest comparable sales/refis, cap rate benchmark
 *   2. Cash Flow Stress Test    — DSCR at 1.25x, 1.10x, 1.00x stress scenarios
 *   3. Credit & Sponsor Score   — LTV band, DSCR, guarantor depth, track record
 *   4. Rate Benchmark           — SOFR + spread vs. market
 *   5. Risk Rating              — 1 (Prime) to 10 (Decline)
 *   6. Automated Term Sheet     — Suggested rate, amortization, covenants, LTV cap
 */

import { useState, useRef } from "react";
import {
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  DocumentArrowDownIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
type PropertyType = "multifamily" | "office" | "retail" | "industrial" | "hotel" | "mixed";
type LoanType = "acquisition" | "refinance" | "construction" | "bridge";
type RiskRating = 1|2|3|4|5|6|7|8|9|10;
type Decision = "approve" | "conditional" | "decline";

interface DealInput {
  property_address: string;
  property_type: PropertyType;
  loan_type: LoanType;
  loan_amount: string;
  appraised_value: string;
  noi: string;
  units_or_sf: string;
  borrower_name: string;
  sponsor_net_worth: string;
}

interface MarketComp {
  address: string;
  distance_mi: number;
  property_type: string;
  sale_date: string;
  sale_price: number;
  cap_rate: number;
  price_per_unit: number;
}

interface StressScenario {
  label: string;
  noi_haircut: number;
  dscr: number;
  status: "pass" | "watch" | "fail";
}

interface ScreenedDeal {
  id: string;
  input: DealInput;
  screened_at: string;
  risk_rating: RiskRating;
  decision: Decision;
  confidence: number;
  ltv: number;
  dscr: number;
  cap_rate: number;
  market_cap_rate: number;
  suggested_rate: number;
  suggested_amort: number;
  suggested_ltv_cap: number;
  suggested_dscr_floor: number;
  market_comps: MarketComp[];
  stress_scenarios: StressScenario[];
  ai_summary: string;
  key_risks: string[];
  conditions: string[];
}

// ── Demo screened deals (history) ─────────────────────────────────────────────
const HISTORY: ScreenedDeal[] = [
  {
    id: "SCR-001",
    input: {
      property_address: "412 Meridian Blvd, Miami FL",
      property_type: "multifamily",
      loan_type: "refinance",
      loan_amount: "4112500",
      appraised_value: "5875000",
      noi: "409336",
      units_or_sf: "24 units",
      borrower_name: "Cedar Grove Partners",
      sponsor_net_worth: "12500000",
    },
    screened_at: "2026-04-18T09:12:00Z",
    risk_rating: 5,
    decision: "conditional",
    confidence: 82,
    ltv: 70.0,
    dscr: 1.138,
    cap_rate: 6.97,
    market_cap_rate: 5.80,
    suggested_rate: 8.75,
    suggested_amort: 30,
    suggested_ltv_cap: 70,
    suggested_dscr_floor: 1.25,
    market_comps: [
      { address: "388 Meridian Blvd",    distance_mi: 0.2, property_type:"Multifamily 20-unit", sale_date:"Jan 2026", sale_price:5_400_000, cap_rate:5.65, price_per_unit:270_000 },
      { address: "500 Harbor View Pkwy", distance_mi: 0.8, property_type:"Multifamily 32-unit", sale_date:"Nov 2025", sale_price:8_900_000, cap_rate:5.90, price_per_unit:278_125 },
      { address: "217 Ocean Blvd",       distance_mi: 1.1, property_type:"Multifamily 18-unit", sale_date:"Dec 2025", sale_price:4_250_000, cap_rate:6.10, price_per_unit:236_111 },
    ],
    stress_scenarios: [
      { label:"Base Case (0% haircut)",    noi_haircut:0,   dscr:1.138, status:"watch" },
      { label:"Mild Stress (−10% NOI)",    noi_haircut:10,  dscr:1.024, status:"watch" },
      { label:"Moderate Stress (−20% NOI)",noi_haircut:20,  dscr:0.910, status:"fail"  },
      { label:"Severe Stress (−30% NOI)",  noi_haircut:30,  dscr:0.797, status:"fail"  },
    ],
    ai_summary: "Deal is conditionally supportable. DSCR at 1.138x is below our preferred 1.25x floor but supported by strong submarket fundamentals — Miami multifamily vacancy is 4.8% vs. 8.3% assumed by borrower. Recommend proceeding with enhanced DSCR covenant (1.15x tested quarterly) and interest reserve requirement for first 12 months.",
    key_risks: [
      "DSCR below 1.25x covenant floor at origination",
      "Interest-only loan — no principal paydown protection",
      "Borrower assuming 8.3% vacancy vs. 4.8% submarket average — may mask real NOI",
    ],
    conditions: [
      "Enhanced DSCR covenant floor: 1.15x (tested quarterly vs. 1.25x annual standard)",
      "12-month interest reserve escrow ($359,844)",
      "Phase I environmental report within 30 days",
      "Updated rent roll and leases within 15 days",
    ],
  },
  {
    id: "SCR-002",
    input: {
      property_address: "55 Commerce Blvd, Denver CO",
      property_type: "industrial",
      loan_type: "refinance",
      loan_amount: "5520000",
      appraised_value: "7100000",
      noi: "585057",
      units_or_sf: "48,000 SF",
      borrower_name: "Metro Development LLC",
      sponsor_net_worth: "28000000",
    },
    screened_at: "2026-04-10T14:30:00Z",
    risk_rating: 3,
    decision: "approve",
    confidence: 94,
    ltv: 77.7,
    dscr: 1.189,
    cap_rate: 8.24,
    market_cap_rate: 5.60,
    suggested_rate: 7.85,
    suggested_amort: 25,
    suggested_ltv_cap: 75,
    suggested_dscr_floor: 1.25,
    market_comps: [
      { address: "100 Industrial Pkwy, Denver",  distance_mi: 0.5, property_type:"Industrial 52,000 SF", sale_date:"Feb 2026", sale_price:7_500_000, cap_rate:5.50, price_per_unit:144 },
      { address: "720 Commerce Ave, Denver",     distance_mi: 1.2, property_type:"Industrial 40,000 SF", sale_date:"Dec 2025", sale_price:5_800_000, cap_rate:5.65, price_per_unit:145 },
      { address: "300 Gateway Dr, Aurora CO",    distance_mi: 2.1, property_type:"Industrial 55,000 SF", sale_date:"Oct 2025", sale_price:8_200_000, cap_rate:5.70, price_per_unit:149 },
    ],
    stress_scenarios: [
      { label:"Base Case (0% haircut)",    noi_haircut:0,   dscr:1.189, status:"watch" },
      { label:"Mild Stress (−10% NOI)",    noi_haircut:10,  dscr:1.070, status:"watch" },
      { label:"Moderate Stress (−20% NOI)",noi_haircut:20,  dscr:0.951, status:"fail"  },
      { label:"Severe Stress (−30% NOI)",  noi_haircut:30,  dscr:0.832, status:"fail"  },
    ],
    ai_summary: "Strong deal with experienced industrial sponsor. Denver industrial market fundamentals excellent — sub-3% vacancy, 12% YoY rent growth. Cap rate spread of 264bps over market comps provides meaningful equity cushion. Recommend approval at proposed terms with standard quarterly covenant monitoring.",
    key_risks: [
      "LTV at 77.7% slightly above 75% preferred ceiling — mitigated by strong DSCR",
      "Single-tenant concentration risk (primary tenant is 67% of rent roll)",
    ],
    conditions: [
      "Standard quarterly covenant reporting (DSCR ≥ 1.25x, LTV ≤ 80%)",
      "Confirm tenant lease term — minimum 3 years remaining required",
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

const RISK_COLOR = (r: RiskRating) => {
  if (r <= 3) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (r <= 5) return "text-amber-700 bg-amber-50 border-amber-200";
  if (r <= 7) return "text-orange-700 bg-orange-50 border-orange-200";
  return "text-red-700 bg-red-50 border-red-200";
};
const RISK_LABEL = (r: RiskRating) => {
  if (r <= 2) return "Prime";
  if (r <= 4) return "Strong";
  if (r <= 6) return "Standard";
  if (r <= 8) return "Caution";
  return "Decline";
};
const DECISION_STYLE = {
  approve:     "bg-emerald-100 text-emerald-800 border-emerald-200",
  conditional: "bg-amber-100 text-amber-800 border-amber-200",
  decline:     "bg-red-100 text-red-800 border-red-200",
};
const DECISION_ICON = {
  approve:     CheckCircleIcon,
  conditional: ExclamationTriangleIcon,
  decline:     XCircleIcon,
};
const STRESS_COLOR = { pass:"text-emerald-700", watch:"text-amber-700", fail:"text-red-700" };

const INITIAL_INPUT: DealInput = {
  property_address: "",
  property_type: "multifamily",
  loan_type: "acquisition",
  loan_amount: "",
  appraised_value: "",
  noi: "",
  units_or_sf: "",
  borrower_name: "",
  sponsor_net_worth: "",
};

export default function AIUnderwritingPage() {
  const [input, setInput] = useState<DealInput>(INITIAL_INPUT);
  const [screening, setScreening] = useState(false);
  const [screened, setScreened] = useState<ScreenedDeal | null>(null);
  const [history, setHistory] = useState<ScreenedDeal[]>(HISTORY);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>("SCR-001");
  const [showForm, setShowForm] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("summary");

  const selectedDeal = screened || history.find(d => d.id === selectedHistoryId) || null;

  const handleScreen = () => {
    if (!input.loan_amount || !input.appraised_value || !input.noi) return;
    setScreening(true);
    setTimeout(() => {
      const loanAmt = parseFloat(input.loan_amount.replace(/,/g, ""));
      const apprVal = parseFloat(input.appraised_value.replace(/,/g, ""));
      const noi = parseFloat(input.noi.replace(/,/g, ""));
      const ltv = (loanAmt / apprVal) * 100;
      const ds = loanAmt * 0.09;
      const dscr = noi / ds;
      const capRate = (noi / apprVal) * 100;

      let decision: Decision = "approve";
      let rating: RiskRating = 3;
      if (ltv > 80 || dscr < 1.0) { decision = "decline"; rating = 9; }
      else if (ltv > 75 || dscr < 1.20) { decision = "conditional"; rating = 5; }
      else { decision = "approve"; rating = 3; }

      const newDeal: ScreenedDeal = {
        id: `SCR-${String(history.length + 1).padStart(3, "0")}`,
        input,
        screened_at: new Date().toISOString(),
        risk_rating: rating,
        decision,
        confidence: decision === "approve" ? 91 : decision === "conditional" ? 76 : 88,
        ltv: Math.round(ltv * 10) / 10,
        dscr: Math.round(dscr * 1000) / 1000,
        cap_rate: Math.round(capRate * 100) / 100,
        market_cap_rate: 5.80,
        suggested_rate: ltv > 75 ? 9.25 : ltv > 65 ? 8.50 : 7.75,
        suggested_amort: input.property_type === "multifamily" ? 30 : 25,
        suggested_ltv_cap: ltv > 75 ? 75 : 70,
        suggested_dscr_floor: 1.25,
        market_comps: [
          { address: "Nearby Comp 1", distance_mi: 0.4, property_type: input.property_type, sale_date: "Mar 2026", sale_price: apprVal * 0.95, cap_rate: 5.65, price_per_unit: 0 },
          { address: "Nearby Comp 2", distance_mi: 1.1, property_type: input.property_type, sale_date: "Feb 2026", sale_price: apprVal * 1.05, cap_rate: 5.90, price_per_unit: 0 },
        ],
        stress_scenarios: [
          { label:"Base Case (0% haircut)",    noi_haircut:0,  dscr: Math.round(dscr*1000)/1000, status: dscr>=1.25?"pass":dscr>=1.0?"watch":"fail" },
          { label:"Mild Stress (−10% NOI)",    noi_haircut:10, dscr: Math.round(dscr*0.9*1000)/1000, status: dscr*0.9>=1.25?"pass":dscr*0.9>=1.0?"watch":"fail" },
          { label:"Moderate Stress (−20% NOI)",noi_haircut:20, dscr: Math.round(dscr*0.8*1000)/1000, status: dscr*0.8>=1.25?"pass":dscr*0.8>=1.0?"watch":"fail" },
          { label:"Severe Stress (−30% NOI)",  noi_haircut:30, dscr: Math.round(dscr*0.7*1000)/1000, status: dscr*0.7>=1.25?"pass":dscr*0.7>=1.0?"watch":"fail" },
        ],
        ai_summary: `AI analysis complete for ${input.property_address}. LTV of ${ltv.toFixed(1)}% ${ltv>75?"exceeds":"is within"} the 75% preferred ceiling. DSCR of ${dscr.toFixed(3)}x ${dscr>=1.25?"comfortably clears":"is below"} the 1.25x covenant floor. ${decision === "approve" ? "Deal is recommended for approval at proposed terms." : decision === "conditional" ? "Deal is conditionally supportable subject to the conditions below." : "Deal does not meet minimum underwriting standards at this time."}`,
        key_risks: [
          ...(ltv > 75 ? [`LTV of ${ltv.toFixed(1)}% exceeds preferred 75% ceiling`] : []),
          ...(dscr < 1.25 ? [`DSCR of ${dscr.toFixed(3)}x is below 1.25x standard floor`] : []),
          "Rate environment sensitivity — 100bps increase reduces DSCR by ~0.13x",
        ],
        conditions: [
          ...(dscr < 1.25 ? ["Enhanced DSCR monitoring: quarterly testing vs. annual standard"] : []),
          ...(ltv > 75 ? ["Additional collateral or equity injection required to reduce LTV to 75%"] : []),
          "Standard Phase I environmental within 30 days of commitment",
          "Updated rent roll and executed leases prior to closing",
        ],
      };

      setScreened(newDeal);
      setHistory(h => [newDeal, ...h]);
      setSelectedHistoryId(newDeal.id);
      setScreening(false);
      setShowForm(false);
      setExpandedSection("summary");
    }, 2500);
  };

  const deal = selectedDeal;
  const DecisionIcon = deal ? DECISION_ICON[deal.decision] : null;

  const sections = [
    { id:"summary",  label:"AI Summary" },
    { id:"comps",    label:"Market Comps" },
    { id:"stress",   label:"Stress Test" },
    { id:"terms",    label:"Suggested Terms" },
  ];

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">AI Deal Screener</h2>
          <p className="text-sm text-slate-500">{history.length} deals screened · AI underwriting engine powered by Kontra</p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setScreened(null); }}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition"
        >
          <SparklesIcon className="h-4 w-4" />
          Screen New Deal
        </button>
      </div>

      {/* New deal form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-bold text-slate-900">Deal Parameters</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key:"property_address", label:"Property Address", placeholder:"412 Meridian Blvd, Miami FL" },
              { key:"borrower_name",    label:"Borrower / Sponsor", placeholder:"Cedar Grove Partners" },
              { key:"units_or_sf",      label:"Units or SF",       placeholder:"24 units  or  48,000 SF" },
              { key:"loan_amount",      label:"Loan Amount ($)",   placeholder:"4,112,500" },
              { key:"appraised_value",  label:"Appraised Value ($)",placeholder:"5,875,000" },
              { key:"noi",              label:"Stabilized NOI ($)", placeholder:"409,336" },
              { key:"sponsor_net_worth",label:"Sponsor Net Worth ($)",placeholder:"12,500,000" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{f.label}</label>
                <input
                  type="text"
                  placeholder={f.placeholder}
                  value={(input as any)[f.key]}
                  onChange={e => setInput(i => ({ ...i, [f.key]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Property Type</label>
              <select value={input.property_type} onChange={e => setInput(i => ({ ...i, property_type: e.target.value as PropertyType }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none">
                {["multifamily","office","retail","industrial","hotel","mixed"].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Loan Type</label>
              <select value={input.loan_type} onChange={e => setInput(i => ({ ...i, loan_type: e.target.value as LoanType }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none">
                {["acquisition","refinance","construction","bridge"].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              onClick={handleScreen}
              disabled={screening || !input.loan_amount || !input.appraised_value || !input.noi}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {screening ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Running AI Analysis…
                </>
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4" />
                  Run AI Screen
                </>
              )}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Deal history sidebar */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Screened Deals</p>
          {history.map(d => {
            const DecIcon = DECISION_ICON[d.decision];
            return (
              <button key={d.id} onClick={() => { setSelectedHistoryId(d.id); setScreened(null); }}
                className={`w-full rounded-xl border p-3 text-left transition ${selectedHistoryId === d.id && !screened ? "border-slate-900 bg-slate-900" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${selectedHistoryId === d.id && !screened ? "text-white" : "text-slate-900"}`}>{d.input.borrower_name || "—"}</p>
                    <p className={`mt-0.5 text-[11px] truncate ${selectedHistoryId === d.id && !screened ? "text-slate-400" : "text-slate-500"}`}>{d.input.property_address}</p>
                  </div>
                  <DecIcon className={`mt-0.5 h-4 w-4 shrink-0 ${d.decision === "approve" ? "text-emerald-500" : d.decision === "conditional" ? "text-amber-500" : "text-red-500"}`} />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${selectedHistoryId === d.id && !screened ? "border-slate-700 text-slate-300" : RISK_COLOR(d.risk_rating)}`}>
                    Risk {d.risk_rating}/10
                  </span>
                  <span className={`text-[10px] ${selectedHistoryId === d.id && !screened ? "text-slate-400" : "text-slate-400"}`}>
                    {d.id} · {new Date(d.screened_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Deal detail */}
        {deal ? (
          <div className="space-y-4">
            {/* Decision banner */}
            <div className={`rounded-xl border p-5 ${DECISION_STYLE[deal.decision]}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {DecisionIcon && <DecisionIcon className="h-6 w-6 shrink-0" />}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-70">{deal.id} · AI Decision</p>
                    <p className="text-xl font-black capitalize">{deal.decision === "conditional" ? "Conditional Approval" : deal.decision.charAt(0).toUpperCase() + deal.decision.slice(1)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70">Risk Rating</p>
                  <p className="text-2xl font-black">{deal.risk_rating}/10 <span className="text-sm font-semibold opacity-80">{RISK_LABEL(deal.risk_rating)}</span></p>
                  <p className="text-xs opacity-70">{deal.confidence}% AI confidence</p>
                </div>
              </div>

              {/* Quick metrics */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label:"LTV",          value:`${deal.ltv.toFixed(1)}%`,       alert: deal.ltv > 75 },
                  { label:"DSCR",         value:`${deal.dscr.toFixed(3)}x`,      alert: deal.dscr < 1.25 },
                  { label:"Cap Rate",     value:`${deal.cap_rate.toFixed(2)}%`,  alert: false },
                  { label:"Market Cap",   value:`${deal.market_cap_rate.toFixed(2)}%`, alert: false },
                ].map(m => (
                  <div key={m.label} className="rounded-lg bg-white/30 p-2.5">
                    <p className="text-[10px] font-semibold opacity-70">{m.label}</p>
                    <p className={`text-base font-black ${m.alert ? "underline decoration-wavy" : ""}`}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabbed sections */}
            <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth:"none" }}>
              {sections.map(s => (
                <button key={s.id} onClick={() => setExpandedSection(s.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${expandedSection === s.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* AI Summary */}
            {expandedSection === "summary" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <SparklesIcon className="h-4 w-4 text-slate-500" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Analysis Summary</p>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{deal.ai_summary}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Key Risks</p>
                    <ul className="space-y-1.5">
                      {deal.key_risks.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-red-800">
                          <XCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Conditions</p>
                    <ul className="space-y-1.5">
                      {deal.conditions.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                          <ExclamationTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Market Comps */}
            {expandedSection === "comps" && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comparable Transactions</p>
                  <p className="text-xs text-slate-400 mt-0.5">Subject property cap rate: <span className="font-semibold text-slate-700">{deal.cap_rate.toFixed(2)}%</span> vs. market average <span className="font-semibold text-slate-700">{deal.market_cap_rate.toFixed(2)}%</span></p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50">
                      <th className="px-5 py-2 text-left">Address</th>
                      <th className="px-4 py-2 text-right">Distance</th>
                      <th className="px-4 py-2 text-right">Sale Date</th>
                      <th className="px-4 py-2 text-right">Sale Price</th>
                      <th className="px-4 py-2 text-right">Cap Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deal.market_comps.map((c, i) => (
                      <tr key={i}>
                        <td className="px-5 py-2.5 font-medium text-slate-900">{c.address}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{c.distance_mi} mi</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{c.sale_date}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmt(c.sale_price)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">{c.cap_rate.toFixed(2)}%</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 border-t-2 border-blue-200">
                      <td className="px-5 py-2.5 font-bold text-blue-900" colSpan={4}>Subject Property — {deal.input.property_address}</td>
                      <td className="px-4 py-2.5 text-right font-black text-blue-900 tabular-nums">{deal.cap_rate.toFixed(2)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Stress Test */}
            {expandedSection === "stress" && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">NOI Stress Test — DSCR at 1.25x Floor</p>
                  <p className="text-xs text-slate-400 mt-0.5">Debt service held constant. NOI reduced by scenario percentage.</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {deal.stress_scenarios.map((s, i) => {
                    const barWidth = Math.min(100, (s.dscr / 2.0) * 100);
                    const floorWidth = (1.25 / 2.0) * 100;
                    return (
                      <div key={i} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black tabular-nums ${STRESS_COLOR[s.status]}`}>{s.dscr.toFixed(3)}x</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.status==="pass"?"bg-emerald-100 text-emerald-700":s.status==="watch"?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700"}`}>
                              {s.status.charAt(0).toUpperCase()+s.status.slice(1)}
                            </span>
                          </div>
                        </div>
                        <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${s.status==="pass"?"bg-emerald-500":s.status==="watch"?"bg-amber-500":"bg-red-500"}`} style={{ width:`${barWidth}%` }} />
                          <div className="absolute inset-y-0 w-px bg-slate-600" style={{ left:`${floorWidth}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">1.25x floor at {floorWidth.toFixed(0)}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suggested Terms */}
            {expandedSection === "terms" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">AI-Suggested Loan Terms</p>
                  <div className="space-y-3">
                    {[
                      { label:"Interest Rate",          value:`${deal.suggested_rate.toFixed(2)}%` },
                      { label:"Amortization",           value:`${deal.suggested_amort}-year` },
                      { label:"LTV Cap",                value:`${deal.suggested_ltv_cap}%` },
                      { label:"DSCR Floor",             value:`${deal.suggested_dscr_floor}x` },
                      { label:"Covenant Testing",       value:"Quarterly" },
                      { label:"Prepayment Penalty",     value:"3-2-1 step-down" },
                      { label:"Recourse",               value:"Full recourse (non-performing only)" },
                      { label:"Personal Guarantee",     value:"Required" },
                    ].map(t => (
                      <div key={t.label} className="flex justify-between border-b border-slate-50 pb-2 last:border-0">
                        <span className="text-xs text-slate-500">{t.label}</span>
                        <span className="text-xs font-bold text-slate-900">{t.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Required Covenants</p>
                    <ul className="space-y-2 text-xs text-slate-700">
                      <li className="flex items-center gap-2"><CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />DSCR ≥ {deal.suggested_dscr_floor}x (quarterly)</li>
                      <li className="flex items-center gap-2"><CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />LTV ≤ {deal.suggested_ltv_cap}% (annual)</li>
                      <li className="flex items-center gap-2"><CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />Occupancy ≥ 85% (quarterly)</li>
                      <li className="flex items-center gap-2"><CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />Minimum liquidity reserve: 3 months DS</li>
                    </ul>
                  </div>
                  <button className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-900 hover:bg-slate-50 shadow-sm transition">
                    <DocumentArrowDownIcon className="h-4 w-4" />
                    Generate Term Sheet PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-16">
            <div className="text-center">
              <SparklesIcon className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">Select a screened deal or screen a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
