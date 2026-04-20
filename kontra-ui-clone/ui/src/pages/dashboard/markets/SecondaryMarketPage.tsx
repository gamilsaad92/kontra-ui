/**
 * Secondary Market — Loan Participation Trading
 * Route: /markets/secondary
 *
 * The "Nasdaq for CRE" trading layer. Lenders post loan participation interests;
 * investors bid on them. Kontra matches, settles via stablecoin, and updates the
 * token registry. Each position is a portion of a funded tranche represented by
 * an ERC-1400 security token.
 *
 * Market structure:
 *   - Sellers (lenders/investors) post positions with an asking yield spread
 *   - Buyers submit bids at a price / yield
 *   - Kontra matching engine clears at mid-market
 *   - Settlement T+1 in USDC via smart contract escrow
 */

import { useState } from "react";
import {
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronRightIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
type TrancheClass = "A" | "B" | "Mez" | "PE";
type PositionStatus = "active" | "bid_received" | "pending_settlement" | "settled";
type Side = "bid" | "ask";

interface Position {
  id: string;
  loan_ref: string;
  borrower: string;
  property_type: string;
  property_short: string;
  tranche: TrancheClass;
  token_symbol: string;
  face_value: number;
  outstanding: number;
  original_rate: number;
  seller: string;
  ask_price: number;
  ask_yield: number;
  ltv: number;
  dscr: number;
  maturity: string;
  posted_at: string;
  status: PositionStatus;
  bids: { bidder: string; price: number; yield: number; amount: number; ts: string }[];
}

interface Transaction {
  id: string;
  date: string;
  loan_ref: string;
  tranche: TrancheClass;
  property_short: string;
  seller: string;
  buyer: string;
  face_value: number;
  cleared_price: number;
  cleared_yield: number;
  settlement: "USDC" | "wire";
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const POSITIONS: Position[] = [
  {
    id: "POS-001", loan_ref: "LN-2847", borrower: "Cedar Grove Partners",
    property_type: "Multifamily", property_short: "412 Meridian Blvd, Miami FL",
    tranche: "B", token_symbol: "KTRA-2847-B",
    face_value: 484_500, outstanding: 484_500,
    original_rate: 8.50, seller: "Harbor Bridge Credit Fund",
    ask_price: 97.50, ask_yield: 8.72,
    ltv: 65.0, dscr: 1.138, maturity: "Jun 2028",
    posted_at: "2026-04-19T10:00:00Z", status: "bid_received",
    bids: [
      { bidder: "Summit Yield Partners", price: 97.00, yield: 8.76, amount: 484_500, ts: "2026-04-19T14:22:00Z" },
      { bidder: "Apex Secondary Fund", price: 96.50, yield: 8.81, amount: 250_000, ts: "2026-04-19T11:05:00Z" },
    ],
  },
  {
    id: "POS-002", loan_ref: "LN-3201", borrower: "Metro Development LLC",
    property_type: "Industrial", property_short: "55 Commerce Blvd, Denver CO",
    tranche: "A", token_symbol: "KTRA-3201-A",
    face_value: 1_500_000, outstanding: 1_500_000,
    original_rate: 7.00, seller: "National Bank of Commerce",
    ask_price: 99.00, ask_yield: 7.07,
    ltv: 42.0, dscr: 1.189, maturity: "Sep 2028",
    posted_at: "2026-04-18T08:30:00Z", status: "active",
    bids: [],
  },
  {
    id: "POS-003", loan_ref: "LN-4108", borrower: "Oakfield Group",
    property_type: "Retail", property_short: "810 Grand Ave, Chicago IL",
    tranche: "Mez", token_symbol: "KTRA-4108-MEZ",
    face_value: 750_000, outstanding: 750_000,
    original_rate: 12.00, seller: "Redwood Mezz Capital LLC",
    ask_price: 94.00, ask_yield: 12.77,
    ltv: 72.0, dscr: 1.05, maturity: "Mar 2027",
    posted_at: "2026-04-17T15:45:00Z", status: "active",
    bids: [
      { bidder: "Bluestone Distressed Fund", price: 92.00, yield: 13.04, amount: 750_000, ts: "2026-04-18T09:10:00Z" },
    ],
  },
  {
    id: "POS-004", loan_ref: "LN-5593", borrower: "Westridge Capital",
    property_type: "Office", property_short: "1200 Market St, Dallas TX",
    tranche: "A", token_symbol: "KTRA-5593-A",
    face_value: 2_200_000, outstanding: 2_050_000,
    original_rate: 7.50, seller: "Cornerstone Capital Partners",
    ask_price: 98.25, ask_yield: 7.63,
    ltv: 58.0, dscr: 1.31, maturity: "Dec 2029",
    posted_at: "2026-04-15T12:00:00Z", status: "pending_settlement",
    bids: [
      { bidder: "Titan Credit Opportunities", price: 98.25, yield: 7.63, amount: 2_050_000, ts: "2026-04-17T16:00:00Z" },
    ],
  },
];

const TRANSACTIONS: Transaction[] = [
  { id:"TXN-019", date:"Apr 18 2026", loan_ref:"LN-1892", tranche:"A",   property_short:"Tower Plaza, Houston TX",     seller:"Meridian Life Ins.",       buyer:"Apex Inst. Fund",   face_value:2_000_000, cleared_price:99.25, cleared_yield:6.82, settlement:"USDC" },
  { id:"TXN-018", date:"Apr 15 2026", loan_ref:"LN-3108", tranche:"B",   property_short:"Lakefront Apts, Orlando FL",  seller:"Harbor Bridge Fund",       buyer:"Summit Yield",      face_value:800_000,   cleared_price:97.00, cleared_yield:8.89, settlement:"USDC" },
  { id:"TXN-017", date:"Apr 12 2026", loan_ref:"LN-2200", tranche:"Mez", property_short:"Commerce Park, Phoenix AZ",   seller:"Redwood Mezz Capital",     buyer:"Bluestone Fund",    face_value:600_000,   cleared_price:93.50, cleared_yield:12.84, settlement:"wire" },
  { id:"TXN-016", date:"Apr 08 2026", loan_ref:"LN-0944", tranche:"A",   property_short:"Gateway Industrial, Denver",  seller:"National Bank",            buyer:"Titan Credit",      face_value:3_000_000, cleared_price:99.50, cleared_yield:6.65, settlement:"USDC" },
  { id:"TXN-015", date:"Apr 03 2026", loan_ref:"LN-4410", tranche:"B",   property_short:"Midtown Office, Atlanta GA",  seller:"Cornerstone Capital",      buyer:"Apex Secondary",    face_value:1_100_000, cleared_price:96.75, cleared_yield:9.02, settlement:"USDC" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
const fmtM = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : `$${(n/1_000).toFixed(0)}K`;

const TRANCHE_BADGE: Record<TrancheClass, string> = {
  A:   "bg-slate-100 text-slate-700",
  B:   "bg-blue-100 text-blue-700",
  Mez: "bg-violet-100 text-violet-700",
  PE:  "bg-amber-100 text-amber-700",
};

const STATUS_CONFIG: Record<PositionStatus, { label: string; color: string }> = {
  active:             { label: "Active",              color: "bg-emerald-100 text-emerald-700" },
  bid_received:       { label: "Bid Received",        color: "bg-blue-100 text-blue-700" },
  pending_settlement: { label: "Pending Settlement",  color: "bg-amber-100 text-amber-700" },
  settled:            { label: "Settled",             color: "bg-slate-100 text-slate-500" },
};

const PROP_ICON: Record<string, string> = {
  Multifamily: "🏢", Industrial: "🏭", Retail: "🏪", Office: "🏬", Hotel: "🏨", Mixed: "🏗️",
};

export default function SecondaryMarketPage() {
  const [selected, setSelected] = useState<Position | null>(POSITIONS[0]);
  const [filter, setFilter] = useState<TrancheClass | "all">("all");
  const [search, setSearch] = useState("");
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidPrice, setBidPrice] = useState("");
  const [bidAmount, setBidAmount] = useState("");

  const filtered = POSITIONS.filter(p => {
    if (filter !== "all" && p.tranche !== filter) return false;
    if (search && !p.loan_ref.toLowerCase().includes(search.toLowerCase()) &&
        !p.borrower.toLowerCase().includes(search.toLowerCase()) &&
        !p.property_short.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const bidYield = bidPrice ? ((selected?.original_rate ?? 0) / parseFloat(bidPrice) * 100).toFixed(2) : "—";
  const totalBidVolume = (selected?.bids ?? []).reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-5">
      {/* Market summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Active Positions",    value: POSITIONS.filter(p=>p.status==="active"||p.status==="bid_received").length.toString(), sub: "Listed today" },
          { label: "Total Face Value",    value: fmtM(POSITIONS.reduce((s,p)=>s+p.face_value,0)), sub: "Across all tranches" },
          { label: "MTD Volume (settled)",value: fmtM(TRANSACTIONS.filter(t=>t.date.startsWith("Apr")).reduce((s,t)=>s+t.face_value,0)), sub: "April 2026" },
          { label: "Avg Cleared Spread",  value: "+18 bps",  sub: "vs. par this month" },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className="mt-1 text-xl font-black text-slate-900">{m.value}</p>
            <p className="text-xs text-slate-400">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left — position list */}
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <MagnifyingGlassIcon className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Loan ref, borrower, property…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-40 text-xs text-slate-700 placeholder-slate-400 focus:outline-none"
              />
            </div>
            {(["all","A","B","Mez","PE"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter===f?"bg-slate-900 text-white":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                {f === "all" ? "All Tranches" : f === "Mez" ? "Mezzanine" : f === "PE" ? "Pref. Equity" : `Senior ${f}`}
              </button>
            ))}
          </div>

          {/* Position cards */}
          <div className="space-y-2">
            {filtered.map(pos => {
              const st = STATUS_CONFIG[pos.status];
              const isSelected = selected?.id === pos.id;
              return (
                <button key={pos.id} onClick={() => { setSelected(pos); setShowBidForm(false); }}
                  className={`w-full rounded-xl border p-4 text-left transition ${isSelected ? "border-slate-900 bg-slate-900" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isSelected ? "bg-white/10 text-white" : TRANCHE_BADGE[pos.tranche]}`}>
                          {pos.tranche === "Mez" ? "Mezzanine" : pos.tranche === "PE" ? "Pref. Equity" : `Senior ${pos.tranche}`}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isSelected ? "bg-white/10 text-slate-300" : st.color}`}>{st.label}</span>
                        <span className={`text-[10px] ${isSelected ? "text-slate-400" : "text-slate-400"}`}>{pos.id} · {pos.loan_ref}</span>
                      </div>
                      <p className={`text-sm font-bold ${isSelected ? "text-white" : "text-slate-900"}`}>
                        {PROP_ICON[pos.property_type]} {pos.borrower}
                      </p>
                      <p className={`text-xs ${isSelected ? "text-slate-400" : "text-slate-500"}`}>{pos.property_short}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-base font-black tabular-nums ${isSelected ? "text-white" : "text-slate-900"}`}>{fmtM(pos.face_value)}</p>
                      <p className={`text-xs font-semibold tabular-nums ${isSelected ? "text-emerald-400" : "text-emerald-700"}`}>{pos.ask_yield.toFixed(2)}% yield</p>
                      <p className={`text-xs ${isSelected ? "text-slate-400" : "text-slate-400"}`}>{pos.ask_price.toFixed(2)} / par</p>
                    </div>
                  </div>
                  <div className={`mt-2 flex gap-3 text-[10px] ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
                    <span>LTV {pos.ltv}%</span>
                    <span>DSCR {pos.dscr}x</span>
                    <span>Maturity {pos.maturity}</span>
                    {pos.bids.length > 0 && <span className={`font-semibold ${isSelected ? "text-blue-400" : "text-blue-600"}`}>{pos.bids.length} bid{pos.bids.length>1?"s":""}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Transaction history */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3 flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Settled Transactions</p>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 text-left">Ref</th>
                  <th className="px-4 py-2 text-left">Property</th>
                  <th className="px-4 py-2 text-right">Face</th>
                  <th className="px-4 py-2 text-right">Cleared</th>
                  <th className="px-4 py-2 text-right">Yield</th>
                  <th className="px-4 py-2 text-right">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {TRANSACTIONS.map(t => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 font-semibold text-slate-800">
                      <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${TRANCHE_BADGE[t.tranche]}`}>{t.tranche}</span>
                      {t.loan_ref}
                    </td>
                    <td className="px-4 py-2 text-slate-600 max-w-[140px] truncate">{t.property_short}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">{fmtM(t.face_value)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">{t.cleared_price.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700 font-semibold">{t.cleared_yield.toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${t.settlement==="USDC"?"bg-violet-100 text-violet-700":"bg-slate-100 text-slate-600"}`}>
                        {t.settlement}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right — position detail + bid */}
        {selected ? (
          <div className="space-y-3">
            {/* Position header */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{selected.id} · {selected.token_symbol}</p>
                  <p className="text-base font-black text-slate-900">{selected.borrower}</p>
                  <p className="text-xs text-slate-500">{selected.property_short}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CONFIG[selected.status].color}`}>
                  {STATUS_CONFIG[selected.status].label}
                </span>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label:"Face Value",    value: fmtM(selected.face_value) },
                  { label:"Ask Price",     value: `${selected.ask_price.toFixed(2)} / par` },
                  { label:"Ask Yield",     value: `${selected.ask_yield.toFixed(2)}%` },
                  { label:"Coupon Rate",   value: `${selected.original_rate.toFixed(2)}%` },
                  { label:"LTV",           value: `${selected.ltv}%` },
                  { label:"DSCR",          value: `${selected.dscr}x` },
                  { label:"Maturity",      value: selected.maturity },
                  { label:"Settlement",    value: "T+1 USDC" },
                ].map(m => (
                  <div key={m.label} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                    <p className="text-[10px] text-slate-400">{m.label}</p>
                    <p className="text-sm font-bold text-slate-900">{m.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-400">Seller: <span className="font-semibold text-slate-600">{selected.seller}</span></p>
            </div>

            {/* Bids */}
            {selected.bids.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                  Order Book ({selected.bids.length} bid{selected.bids.length>1?"s":""} · {fmtM(totalBidVolume)} total)
                </p>
                <div className="space-y-2">
                  {selected.bids.map((b, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{b.bidder}</p>
                        <p className="text-[10px] text-slate-400">{fmtM(b.amount)} · {new Date(b.ts).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">{b.price.toFixed(2)}</p>
                        <p className="text-xs font-semibold text-emerald-700">{b.yield.toFixed(2)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit bid */}
            {selected.status !== "pending_settlement" && selected.status !== "settled" && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button onClick={() => setShowBidForm(b => !b)}
                  className="flex w-full items-center justify-between px-5 py-4 text-sm font-bold text-slate-900 hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2">
                    <ArrowsRightLeftIcon className="h-4 w-4 text-slate-400" />
                    Submit Bid
                  </div>
                  <ChevronRightIcon className={`h-4 w-4 text-slate-400 transition-transform ${showBidForm ? "rotate-90" : ""}`} />
                </button>

                {showBidForm && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-3">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Bid Price (% of par)</label>
                        <input type="text" placeholder="e.g. 97.50"
                          value={bidPrice} onChange={e => setBidPrice(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
                        {bidPrice && <p className="mt-1 text-xs text-emerald-700">Implied yield: {bidYield}%</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ($)</label>
                        <input type="text" placeholder={`Max ${fmtM(selected.face_value)}`}
                          value={bidAmount} onChange={e => setBidAmount(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
                      </div>
                      <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
                        Settlement in USDC at T+1 via Kontra smart contract escrow. Position transfers to your Kontra wallet upon clearing.
                      </div>
                      <button
                        className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
                        disabled={!bidPrice || !bidAmount}>
                        Submit Bid — {bidPrice ? `${bidPrice} / par` : "Enter price"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selected.status === "pending_settlement" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
                <ClockIcon className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-800">Pending USDC Settlement</p>
                  <p className="text-xs text-amber-700">Smart contract escrow locked. Settlement expected within 24 hours.</p>
                </div>
              </div>
            )}

            {/* Post new position CTA */}
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center">
              <p className="text-xs font-semibold text-slate-700 mb-1">Have a participation to sell?</p>
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition">
                Post New Position
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-16">
            <p className="text-sm text-slate-500">Select a position to view details and submit a bid</p>
          </div>
        )}
      </div>
    </div>
  );
}
