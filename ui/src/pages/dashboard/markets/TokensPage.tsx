/**
 * ERC-1400 Security Token Registry
 * Route: /markets/tokens
 *
 * Institutional-grade on-chain compliance registry showing the full
 * lifecycle of Kontra's tokenized CRE debt instruments:
 *   - Token registry overview with live NAV & compliance status
 *   - Partition table (Senior A / Senior B / Mezzanine / Equity)
 *   - Beneficial owner whitelist (accreditation, KYC, jurisdiction)
 *   - Transfer compliance engine log (per-transfer restriction checks)
 *   - Controller audit trail (privileged controller actions + doc hashes)
 *
 * Falls back to rich demo data when API is unavailable.
 */
import { useState } from "react";
import {
  ShieldCheckIcon,
  CubeTransparentIcon,
  UserGroupIcon,
  ArrowsRightLeftIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

// ── Demo data ─────────────────────────────────────────────────────────────────

const TOKENS = [
  {
    id: "t1",
    symbol: "KTRA-2847",
    name: "Kontra CRE Debt Token — Meridian Apartments",
    loan_ref: "LN-2847",
    property: "The Meridian Apartments, Austin TX",
    standard: "ERC-1400",
    contract: "0x1A2b3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b",
    controller: "0xKontra_Controller_v2.1",
    nav: 102.73,
    face_value: 100.00,
    total_supply: 314_000,
    outstanding: 314_000,
    compliance_status: "compliant",
    offering_type: "Reg D Rule 506(c)",
    jurisdiction: "United States",
    deployed_at: "2024-11-20",
    last_controller_action: "2026-04-28T09:14:00Z",
    document_hash: "0x5f3a…c9b2",
    partitions: [
      { id:"p1", name:"Senior A",   tranche:"senior_a",  tokens: 188_400, pct: 59.9, yield_ann: 7.20, ltv_floor:  0, ltv_ceil: 60, investors: 6_180, distribution: "monthly", transfer_restriction: "Reg D 506(c) — verified accredited only" },
      { id:"p2", name:"Senior B",   tranche:"senior_b",  tokens:  75_360, pct: 24.0, yield_ann: 8.15, ltv_floor: 60, ltv_ceil: 70, investors: 2_890, distribution: "monthly", transfer_restriction: "Reg D 506(c) — verified accredited only" },
      { id:"p3", name:"Mezzanine",  tranche:"mezz",      tokens:  37_680, pct: 12.0, yield_ann: 9.80, ltv_floor: 70, ltv_ceil: 75, investors: 1_050, distribution: "quarterly", transfer_restriction: "Reg D 506(c) — QIB only per §4(a)(2)" },
      { id:"p4", name:"Equity",     tranche:"equity",    tokens:  12_560, pct:  4.0, yield_ann:14.50, ltv_floor: 75, ltv_ceil: 80, investors:   170, distribution: "on-exit",  transfer_restriction: "Transfer agent approval required — 12-month lockup" },
    ],
    owners: [
      { id:"o1",  wallet:"0x3f9a…e241", name:"Verified — Acct Investor #1",  kyc:"tier_3", accreditation:"individual_net_worth", jurisdiction:"US",  tokens: 12_000, partition:"Senior A", verified_at:"2024-11-18", status:"active" },
      { id:"o2",  wallet:"0x7c2d…b3f8", name:"Verified — Acct Investor #2",  kyc:"tier_3", accreditation:"individual_income",    jurisdiction:"US",  tokens:  8_500, partition:"Senior A", verified_at:"2024-11-19", status:"active" },
      { id:"o3",  wallet:"0xa1b5…4c9e", name:"Verified — QIB Fund #1",       kyc:"tier_4", accreditation:"qualified_purchaser",  jurisdiction:"US",  tokens: 40_000, partition:"Senior B", verified_at:"2024-11-15", status:"active" },
      { id:"o4",  wallet:"0xd8f1…7a2c", name:"Verified — QIB Fund #2",       kyc:"tier_4", accreditation:"qualified_purchaser",  jurisdiction:"US",  tokens: 25_000, partition:"Senior B", verified_at:"2024-11-16", status:"active" },
      { id:"o5",  wallet:"0x2e4b…c1d7", name:"Verified — RIA Managed Account",kyc:"tier_3", accreditation:"ria_discretionary",   jurisdiction:"US",  tokens:  6_200, partition:"Senior A", verified_at:"2024-12-01", status:"active" },
      { id:"o6",  wallet:"0x8a3c…f0e9", name:"Unverified — Transfer Blocked", kyc:"none",   accreditation:"none",                 jurisdiction:"Unknown", tokens: 0,  partition:"—",        verified_at:"—",          status:"blocked" },
    ],
    transfers: [
      { id:"tr1", ts:"2026-04-28T11:22:00Z", from:"0x7c2d…b3f8", to:"0x9f1e…d3a4", partition:"Senior A", amount:500,  result:"approved",  checks:["Reg D 506(c) ✓","Accreditation verified ✓","1-year holding satisfied ✓","Jurisdiction: US ✓"] },
      { id:"tr2", ts:"2026-04-27T14:08:00Z", from:"0xa1b5…4c9e", to:"0x8a3c…f0e9", partition:"Senior B", amount:2000, result:"rejected",  checks:["Reg D 506(c) ✗ — recipient not verified","KYC tier insufficient","Transfer blocked by controller"] },
      { id:"tr3", ts:"2026-04-25T09:45:00Z", from:"0x3f9a…e241", to:"0x5c8b…2f1d", partition:"Senior A", amount:750,  result:"approved",  checks:["Reg D 506(c) ✓","Accreditation verified ✓","1-year holding satisfied ✓","Jurisdiction: US ✓"] },
      { id:"tr4", ts:"2026-04-22T16:30:00Z", from:"0xd8f1…7a2c", to:"0xb4e7…9c3f", partition:"Mezzanine",amount:1000, result:"pending",   checks:["QIB status check in progress","Awaiting beneficial owner confirmation","Controller review required"] },
      { id:"tr5", ts:"2026-04-18T10:15:00Z", from:"0x2e4b…c1d7", to:"0x6a9d…1e8b", partition:"Senior A", amount:300,  result:"approved",  checks:["Reg D 506(c) ✓","Accreditation verified ✓","1-year holding satisfied ✓","Jurisdiction: US ✓"] },
    ],
    audit: [
      { id:"a1", ts:"2026-04-28T09:14:00Z", action:"distribute_yield",       controller:"Kontra Controller v2.1", params:"$264,500 distributed · 4 partitions · May 2026 period",  doc_hash:"0x4a2f…b9c1" },
      { id:"a2", ts:"2026-04-22T08:00:00Z", action:"block_transfer",          controller:"Kontra Controller v2.1", params:"Blocked: 0x8a3c…f0e9 — failed KYC tier check",            doc_hash:"0x7e3d…c8a2" },
      { id:"a3", ts:"2026-03-15T10:30:00Z", action:"update_nav",              controller:"Kontra Controller v2.1", params:"NAV updated: $101.84 → $102.73 (+$0.89 DSCR improvement)",doc_hash:"0x1b5c…d4e3" },
      { id:"a4", ts:"2026-02-01T09:00:00Z", action:"distribute_yield",       controller:"Kontra Controller v2.1", params:"$261,200 distributed · 4 partitions · Feb 2026 period",  doc_hash:"0x9c8b…a7f2" },
      { id:"a5", ts:"2024-11-20T12:00:00Z", action:"deploy_token",           controller:"Kontra Controller v2.1", params:"314,000 KTRA-2847 tokens issued · face value $100.00",   doc_hash:"0x3d7a…e6c5" },
      { id:"a6", ts:"2024-11-20T11:45:00Z", action:"set_offering_documents", controller:"Kontra Controller v2.1", params:"Reg D 506(c) offering circular + loan agreement registered",doc_hash:"0x2a9f…b1d4" },
    ],
  },
  {
    id: "t2",
    symbol: "KTRA-3201",
    name: "Kontra CRE Debt Token — Metro Industrial Denver",
    loan_ref: "LN-3201",
    property: "Metro Industrial Park, Denver CO",
    standard: "ERC-1400",
    contract: "0x7B8c9D0e1F2a3B4c5D6e7F8a9B0c1D2e3F4a5B6c",
    controller: "0xKontra_Controller_v2.1",
    nav: 99.42,
    face_value: 100.00,
    total_supply: 552_000,
    outstanding: 552_000,
    compliance_status: "watch",
    offering_type: "Reg D Rule 506(c)",
    jurisdiction: "United States",
    deployed_at: "2025-02-10",
    last_controller_action: "2026-04-20T14:22:00Z",
    document_hash: "0x8e1c…f3a7",
    partitions: [
      { id:"p5", name:"Senior A",   tranche:"senior_a",  tokens: 330_000, pct: 59.8, yield_ann: 7.00, ltv_floor:  0, ltv_ceil: 60, investors: 9_200, distribution: "monthly",   transfer_restriction: "Reg D 506(c) — verified accredited only" },
      { id:"p6", name:"Senior B",   tranche:"senior_b",  tokens: 132_480, pct: 24.0, yield_ann: 7.95, ltv_floor: 60, ltv_ceil: 70, investors: 3_400, distribution: "monthly",   transfer_restriction: "Reg D 506(c) — verified accredited only" },
      { id:"p7", name:"Mezzanine",  tranche:"mezz",      tokens:  66_240, pct: 12.0, yield_ann: 9.50, ltv_floor: 70, ltv_ceil: 75, investors:   890, distribution: "quarterly", transfer_restriction: "Reg D 506(c) — QIB only per §4(a)(2)" },
      { id:"p8", name:"Equity",     tranche:"equity",    tokens:  23_280, pct:  4.2, yield_ann:13.20, ltv_floor: 75, ltv_ceil: 80, investors:   210, distribution: "on-exit",   transfer_restriction: "Transfer agent approval required — 12-month lockup" },
    ],
    owners: [],
    transfers: [],
    audit: [],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type Token    = typeof TOKENS[0];
type Partition = Token["partitions"][0];
type Owner     = Token["owners"][0];
type Transfer  = Token["transfers"][0];
type AuditEntry = Token["audit"][0];

type Tab = "partitions" | "owners" | "transfers" | "audit";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (s: string) => s && s !== "—" ? new Date(s).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";
const fmtTime = (s: string) => s ? new Date(s).toLocaleString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }) : "—";
const fmtK   = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : n.toString();

const TRANCHE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  senior_a: { bg:"bg-blue-900/30",   text:"text-blue-300",   border:"border-blue-700/40" },
  senior_b: { bg:"bg-violet-900/30", text:"text-violet-300", border:"border-violet-700/40" },
  mezz:     { bg:"bg-amber-900/30",  text:"text-amber-300",  border:"border-amber-700/40" },
  equity:   { bg:"bg-rose-900/30",   text:"text-rose-300",   border:"border-rose-700/40" },
};

const KYC_LABELS: Record<string, string> = {
  tier_4: "Tier 4 — QIB",
  tier_3: "Tier 3 — Accredited",
  tier_2: "Tier 2 — Basic",
  none:   "None",
};

const ACCRED_LABELS: Record<string, string> = {
  qualified_purchaser:  "Qualified Purchaser",
  individual_net_worth: "Ind. Net Worth",
  individual_income:    "Ind. Income",
  ria_discretionary:    "RIA Discretionary",
  none:                 "None",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cfg = {
    compliant: "bg-emerald-900/50 text-emerald-400 border border-emerald-700/50",
    watch:     "bg-amber-900/50 text-amber-400 border border-amber-700/50",
    breach:    "bg-red-900/50 text-red-400 border border-red-700/50",
  }[status] ?? "bg-slate-800 text-slate-400 border border-slate-700";
  const label = { compliant:"Compliant", watch:"On Watch", breach:"Breach" }[status] ?? status;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg}`}>{label}</span>;
}

function TransferResult({ result }: { result: string }) {
  if (result === "approved") return (
    <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
      <CheckCircleIcon className="h-3.5 w-3.5" /> Approved
    </span>
  );
  if (result === "rejected") return (
    <span className="flex items-center gap-1 text-red-400 text-xs font-bold">
      <XCircleIcon className="h-3.5 w-3.5" /> Rejected
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-amber-400 text-xs font-bold">
      <ExclamationTriangleIcon className="h-3.5 w-3.5" /> Pending
    </span>
  );
}

function PartitionBar({ partitions }: { partitions: Partition[] }) {
  return (
    <div className="w-full">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {partitions.map(p => {
          const c = TRANCHE_COLORS[p.tranche] ?? TRANCHE_COLORS.equity;
          return (
            <div key={p.id} style={{ width:`${p.pct}%` }}
              className={`${c.bg.replace("/30","")} border-r border-black/20 last:border-0 transition-all`}
              title={`${p.name}: ${p.pct}%`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        {partitions.map(p => {
          const c = TRANCHE_COLORS[p.tranche] ?? TRANCHE_COLORS.equity;
          return (
            <div key={p.id} className="flex items-center gap-1.5 text-xs">
              <div className={`h-2 w-2 rounded-sm ${c.bg.replace("/30","")}`} />
              <span className={c.text}>{p.name}</span>
              <span className="text-slate-500">{p.pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Token Detail Panel ────────────────────────────────────────────────────────
function TokenDetail({ token }: { token: Token }) {
  const [tab, setTab] = useState<Tab>("partitions");

  const tabs: { key: Tab; label: string; icon: typeof ShieldCheckIcon; count?: number }[] = [
    { key:"partitions", label:"Partitions",  icon: CubeTransparentIcon,        count: token.partitions.length },
    { key:"owners",     label:"Owner Registry", icon: UserGroupIcon,            count: token.owners.length },
    { key:"transfers",  label:"Transfer Log",   icon: ArrowsRightLeftIcon,      count: token.transfers.length },
    { key:"audit",      label:"Controller Audit", icon: ClipboardDocumentListIcon, count: token.audit.length },
  ];

  return (
    <div className="rounded-xl border border-white/6 overflow-hidden" style={{ background:"rgba(255,255,255,0.02)" }}>
      {/* Token header */}
      <div className="border-b border-white/6 px-6 py-5" style={{ background:"rgba(255,255,255,0.03)" }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p className="text-2xl font-black text-white tracking-tight">{token.symbol}</p>
              <StatusPill status={token.compliance_status} />
              <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-xs font-mono text-slate-400">{token.standard}</span>
            </div>
            <p className="text-sm text-slate-400">{token.name}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">{token.contract}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Current NAV</p>
            <p className={`text-3xl font-black tabular-nums ${token.nav >= token.face_value ? "text-emerald-400" : "text-amber-400"}`}>
              ${token.nav.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500">face value ${token.face_value.toFixed(2)}</p>
            <p className={`text-xs font-bold mt-0.5 ${token.nav >= token.face_value ? "text-emerald-500" : "text-amber-500"}`}>
              {token.nav >= token.face_value ? "↑" : "↓"} ${Math.abs(token.nav - token.face_value).toFixed(2)} {token.nav >= token.face_value ? "premium" : "discount"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label:"Total Supply",    value: fmtK(token.total_supply) + " tokens" },
            { label:"Offering Type",   value: token.offering_type },
            { label:"Deployed",        value: fmtDate(token.deployed_at) },
            { label:"Last Action",     value: fmtTime(token.last_controller_action) },
          ].map(m => (
            <div key={m.label}>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{m.label}</p>
              <p className="text-xs text-white font-semibold mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        <PartitionBar partitions={token.partitions} />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/6">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${active ? "border-slate-100 text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
              <Icon className="h-4 w-4" />
              {t.label}
              {t.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${active ? "bg-white/15 text-white" : "bg-white/6 text-slate-400"}`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {/* ── Partitions ── */}
        {tab === "partitions" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              ERC-1400 partition table — each partition represents a tranche of the capital stack with distinct yield, seniority, and transfer restrictions.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {token.partitions.map(p => {
                const c = TRANCHE_COLORS[p.tranche] ?? TRANCHE_COLORS.equity;
                return (
                  <div key={p.id} className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className={`text-sm font-black ${c.text}`}>{p.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">LTV {p.ltv_floor}–{p.ltv_ceil}%</p>
                      </div>
                      <p className={`text-xl font-black tabular-nums ${c.text}`}>{p.yield_ann.toFixed(2)}%</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {[
                        { label:"Tokens",     value: fmtK(p.tokens) },
                        { label:"Share",      value: `${p.pct.toFixed(1)}%` },
                        { label:"Investors",  value: fmtK(p.investors) },
                      ].map(m => (
                        <div key={m.label}>
                          <p className="text-xs text-slate-500">{m.label}</p>
                          <p className="text-sm font-bold text-white mt-0.5">{m.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-white/10 pt-3 space-y-1">
                      <p className="text-xs text-slate-500">Distribution: <span className="text-slate-300 font-medium capitalize">{p.distribution}</span></p>
                      <p className="text-xs text-slate-600 leading-relaxed">{p.transfer_restriction}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Owners ── */}
        {tab === "owners" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Beneficial owner whitelist — only wallets that pass KYC/AML verification and accreditation checks may hold or receive transfers of {token.symbol} tokens.
            </p>
            {token.owners.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No owner data available for this token.</p>
            ) : (
              <div className="rounded-xl border border-white/6 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/6" style={{ background:"rgba(255,255,255,0.03)" }}>
                      {["Wallet","KYC Tier","Accreditation","Partition","Tokens","Status"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {token.owners.map(o => (
                      <tr key={o.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-slate-300">{o.wallet}</p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[160px]">{o.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${o.kyc === "none" ? "bg-red-900/40 text-red-400" : o.kyc === "tier_4" ? "bg-violet-900/40 text-violet-400" : "bg-blue-900/40 text-blue-400"}`}>
                            {KYC_LABELS[o.kyc] ?? o.kyc}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{ACCRED_LABELS[o.accreditation] ?? "—"}</td>
                        <td className="px-4 py-3">
                          {o.partition !== "—" ? (
                            <span className={`text-xs font-semibold ${TRANCHE_COLORS[token.partitions.find(p => p.name === o.partition)?.tranche ?? ""]?.text ?? "text-slate-400"}`}>
                              {o.partition}
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-white font-bold tabular-nums">{o.tokens.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {o.status === "active" ? (
                            <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                              <CheckCircleIcon className="h-3.5 w-3.5" /> Whitelisted
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-400 text-xs font-bold">
                              <XCircleIcon className="h-3.5 w-3.5" /> Blocked
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Transfers ── */}
        {tab === "transfers" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Every transfer of {token.symbol} tokens is routed through the Kontra compliance engine, which enforces Reg D 506(c) restrictions, 
              KYC tier requirements, holding period rules, and jurisdiction constraints before settlement.
            </p>
            {token.transfers.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No transfer history for this token yet.</p>
            ) : (
              <div className="space-y-3">
                {token.transfers.map(t => (
                  <div key={t.id} className={`rounded-xl border p-4 ${t.result === "approved" ? "border-emerald-800/40" : t.result === "rejected" ? "border-red-800/40" : "border-amber-800/40"}`}
                    style={{ background: t.result === "approved" ? "rgba(5,150,105,0.05)" : t.result === "rejected" ? "rgba(239,68,68,0.05)" : "rgba(217,119,6,0.05)" }}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <TransferResult result={t.result} />
                          <span className="text-xs text-slate-500">·</span>
                          <span className={`text-xs font-semibold ${TRANCHE_COLORS[token.partitions.find(p=>p.name===t.partition)?.tranche??""]?.text ?? "text-slate-400"}`}>{t.partition}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-mono">{t.from}</span>
                          <ArrowsRightLeftIcon className="h-3 w-3 text-slate-600" />
                          <span className="font-mono">{t.to}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-black text-white tabular-nums">{t.amount.toLocaleString()} <span className="text-xs text-slate-400">tokens</span></p>
                        <p className="text-xs text-slate-500 mt-0.5">{fmtTime(t.ts)}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {t.checks.map((check, i) => {
                        const ok = check.includes("✓");
                        const fail = check.includes("✗") || check.toLowerCase().includes("block") || check.toLowerCase().includes("insufficient");
                        return (
                          <div key={i} className="flex items-start gap-2">
                            <span className={`text-xs mt-0.5 ${ok ? "text-emerald-400" : fail ? "text-red-400" : "text-amber-400"}`}>
                              {ok ? "✓" : fail ? "✗" : "⋯"}
                            </span>
                            <span className={`text-xs ${ok ? "text-slate-400" : fail ? "text-red-400" : "text-amber-500"}`}>{check.replace("✓","").replace("✗","").trim()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Audit ── */}
        {tab === "audit" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Immutable controller audit trail — all privileged controller actions are logged with document hashes. 
              The controller is the Kontra compliance smart contract at {token.controller}.
            </p>
            {token.audit.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No audit entries for this token yet.</p>
            ) : (
              <div className="space-y-2">
                {token.audit.map(a => {
                  const actionColor: Record<string, string> = {
                    distribute_yield:    "text-emerald-400 bg-emerald-900/30 border-emerald-700/40",
                    block_transfer:      "text-red-400 bg-red-900/30 border-red-700/40",
                    update_nav:          "text-blue-400 bg-blue-900/30 border-blue-700/40",
                    deploy_token:        "text-violet-400 bg-violet-900/30 border-violet-700/40",
                    set_offering_documents: "text-amber-400 bg-amber-900/30 border-amber-700/40",
                  }[a.action] ?? "text-slate-400 bg-slate-900/30 border-slate-700/40";
                  const actionLabel: Record<string, string> = {
                    distribute_yield:       "Yield Distribution",
                    block_transfer:         "Transfer Blocked",
                    update_nav:             "NAV Update",
                    deploy_token:           "Token Deployment",
                    set_offering_documents: "Offering Docs Set",
                  }[a.action] ?? a.action;
                  return (
                    <div key={a.id} className="flex items-start gap-4 rounded-xl border border-white/5 p-4 hover:bg-white/2 transition-colors"
                      style={{ background:"rgba(255,255,255,0.02)" }}>
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-bold whitespace-nowrap ${actionColor}`}>
                        {actionLabel}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300 leading-relaxed">{a.params}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <p className="text-xs text-slate-500">{fmtTime(a.ts)}</p>
                          <span className="text-slate-700">·</span>
                          <p className="text-xs text-slate-500">Controller: <span className="font-mono text-slate-400">{a.controller}</span></p>
                          <span className="text-slate-700">·</span>
                          <p className="flex items-center gap-1 text-xs text-slate-500">
                            <DocumentTextIcon className="h-3 w-3" />
                            <span className="font-mono text-slate-500">{a.doc_hash}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TokensPage() {
  const [selectedId, setSelectedId] = useState<string>(TOKENS[0].id);
  const selected = TOKENS.find(t => t.id === selectedId) ?? TOKENS[0];

  // Aggregate stats
  const totalSupply = TOKENS.reduce((s, t) => s + t.total_supply, 0);
  const totalInvestors = TOKENS.reduce((s, t) => s + t.partitions.reduce((ps, p) => ps + p.investors, 0), 0);
  const avgNav = TOKENS.reduce((s, t) => s + t.nav, 0) / TOKENS.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheckIcon className="h-5 w-5 text-slate-400" />
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">ERC-1400 Security Token Registry</p>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Token Registry</h1>
          <p className="text-sm text-slate-500 mt-1">
            On-chain compliance registry for Kontra's tokenized CRE debt instruments — partition table, beneficial owner whitelist, transfer compliance engine, and controller audit trail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-700">Registry Synced</span>
          </span>
        </div>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:"Tokens Issued",     value: TOKENS.length.toString(),                 sub:"Active ERC-1400 instruments" },
          { label:"Total Token Supply",value: fmtK(totalSupply),                        sub:"Across all partitions" },
          { label:"Total Investors",   value: fmtK(totalInvestors),                     sub:"Whitelisted beneficial owners" },
          { label:"Avg Portfolio NAV", value: `$${avgNav.toFixed(2)}`,                  sub:"Weighted across all tokens" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className="mt-1.5 text-xl font-black text-slate-900 tabular-nums">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Token selector */}
      <div className="flex gap-3">
        {TOKENS.map(t => (
          <button key={t.id} onClick={() => setSelectedId(t.id)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${selectedId === t.id ? "border-slate-900 bg-slate-900 text-white shadow-lg" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:shadow-sm"}`}>
            <CubeTransparentIcon className={`h-4 w-4 ${selectedId === t.id ? "text-slate-300" : "text-slate-400"}`} />
            <div>
              <p className="text-sm font-black">{t.symbol}</p>
              <p className={`text-xs ${selectedId === t.id ? "text-slate-400" : "text-slate-500"}`}>{t.loan_ref} · {t.partitions.reduce((s,p)=>s+p.investors,0).toLocaleString()} investors</p>
            </div>
            <StatusPill status={t.compliance_status} />
            {selectedId === t.id && <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400 ml-1" />}
          </button>
        ))}
      </div>

      {/* Token detail */}
      <TokenDetail token={selected} />

      {/* Compliance framework note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">ERC-1400 Compliance Framework</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              All Kontra security tokens are issued under the ERC-1400 standard with mandatory transfer restrictions enforced at the smart contract level.
              Transfers are validated against: <span className="font-medium text-slate-700">Reg D 506(c) accreditation</span> · <span className="font-medium text-slate-700">KYC/AML tier requirements</span> · <span className="font-medium text-slate-700">holding period compliance</span> · <span className="font-medium text-slate-700">jurisdiction whitelist</span>.
              The Kontra Controller contract (v2.1) acts as the designated compliance authority under §3(c)(1) and maintains the beneficial owner whitelist.
              All controller actions are hash-anchored to the immutable audit trail displayed above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
