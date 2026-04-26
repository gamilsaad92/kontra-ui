/**
 * Investor Registry — KYC/AML and Accreditation Gating
 *
 * Every investor who receives tokens must pass:
 *   1. KYC/AML verification (via Persona or Sumsub)
 *   2. Accreditation verification matching the applicable exemption
 *      — Reg D 506(b): self-certified accredited investor
 *      — Reg D 506(c): third-party verified accredited investor
 *      — Reg S: offshore non-US person (verified jurisdiction)
 *      — Institutional: QIB / 144A qualified institutional buyer
 *
 * Eligibility status is stored per wallet and checked on every token transfer
 * via the smart contract transfer hook.
 */

import { useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
type KycStatus = "verified" | "pending" | "blocked" | "expired";
type AccredType = "reg_d_506b" | "reg_d_506c" | "reg_s" | "institutional";
type EligibilityStatus = "eligible" | "ineligible" | "review" | "suspended";

interface Investor {
  id: string;
  name: string;
  entity_type: "individual" | "entity" | "fund" | "qib";
  jurisdiction: string;
  wallet_address: string;
  kyc_provider: "Persona" | "Sumsub" | "Manual";
  kyc_status: KycStatus;
  kyc_verified_at: string | null;
  kyc_expires_at: string | null;
  accreditation_type: AccredType;
  accreditation_verified_at: string | null;
  accreditation_expires_at: string | null;
  eligibility_status: EligibilityStatus;
  tokens_held: { symbol: string; amount: number }[];
  flags: string[];
}

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_INVESTORS: Investor[] = [
  {
    id: "inv-001",
    name: "Blackstone Real Estate Partners XII LP",
    entity_type: "fund",
    jurisdiction: "United States",
    wallet_address: "0x3A4B...C8D1",
    kyc_provider: "Persona",
    kyc_status: "verified",
    kyc_verified_at: "2026-01-15",
    kyc_expires_at: "2027-01-15",
    accreditation_type: "institutional",
    accreditation_verified_at: "2026-01-15",
    accreditation_expires_at: "2027-01-15",
    eligibility_status: "eligible",
    tokens_held: [{ symbol: "KTRA-2847", amount: 12500 }, { symbol: "KTRA-3201", amount: 8000 }],
    flags: [],
  },
  {
    id: "inv-002",
    name: "Meridian Capital Partners LLC",
    entity_type: "entity",
    jurisdiction: "United States",
    wallet_address: "0x7F2A...B3E9",
    kyc_provider: "Persona",
    kyc_status: "verified",
    kyc_verified_at: "2026-02-01",
    kyc_expires_at: "2027-02-01",
    accreditation_type: "reg_d_506c",
    accreditation_verified_at: "2026-02-01",
    accreditation_expires_at: "2027-02-01",
    eligibility_status: "eligible",
    tokens_held: [{ symbol: "KTRA-2847", amount: 5000 }, { symbol: "KTRA-5593", amount: 3000 }],
    flags: [],
  },
  {
    id: "inv-003",
    name: "David Park (Individual)",
    entity_type: "individual",
    jurisdiction: "United States",
    wallet_address: "0x9C1D...F4A2",
    kyc_provider: "Sumsub",
    kyc_status: "verified",
    kyc_verified_at: "2025-11-10",
    kyc_expires_at: "2026-11-10",
    accreditation_type: "reg_d_506b",
    accreditation_verified_at: "2025-11-10",
    accreditation_expires_at: "2026-11-10",
    eligibility_status: "eligible",
    tokens_held: [{ symbol: "KTRA-2847", amount: 2500 }],
    flags: ["reg_d_lockup_active"],
  },
  {
    id: "inv-004",
    name: "Harrington Global Fund (Cayman Islands)",
    entity_type: "fund",
    jurisdiction: "Cayman Islands",
    wallet_address: "0x5E8C...A1F7",
    kyc_provider: "Persona",
    kyc_status: "verified",
    kyc_verified_at: "2026-01-22",
    kyc_expires_at: "2027-01-22",
    accreditation_type: "reg_s",
    accreditation_verified_at: "2026-01-22",
    accreditation_expires_at: "2027-01-22",
    eligibility_status: "eligible",
    tokens_held: [{ symbol: "KTRA-0728", amount: 10000 }],
    flags: ["reg_s_offshore", "holding_period_active"],
  },
  {
    id: "inv-005",
    name: "Sunrise Investment Group LLC",
    entity_type: "entity",
    jurisdiction: "United States",
    wallet_address: "0x2B7E...D9C3",
    kyc_provider: "Sumsub",
    kyc_status: "pending",
    kyc_verified_at: null,
    kyc_expires_at: null,
    accreditation_type: "reg_d_506c",
    accreditation_verified_at: null,
    accreditation_expires_at: null,
    eligibility_status: "review",
    tokens_held: [],
    flags: ["kyc_in_progress"],
  },
  {
    id: "inv-006",
    name: "Marcus Chen (Individual)",
    entity_type: "individual",
    jurisdiction: "United States",
    wallet_address: "0x4A9F...E2B8",
    kyc_provider: "Persona",
    kyc_status: "blocked",
    kyc_verified_at: null,
    kyc_expires_at: null,
    accreditation_type: "reg_d_506b",
    accreditation_verified_at: null,
    accreditation_expires_at: null,
    eligibility_status: "ineligible",
    tokens_held: [],
    flags: ["aml_flag", "kyc_blocked"],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const KYC_BADGE: Record<KycStatus, { label: string; classes: string; icon: typeof CheckCircleIcon }> = {
  verified: { label: "Verified", classes: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircleIcon },
  pending:  { label: "Pending",  classes: "bg-amber-50 text-amber-700 border border-amber-200",     icon: ClockIcon },
  blocked:  { label: "Blocked",  classes: "bg-red-50 text-red-700 border border-red-200",           icon: XCircleIcon },
  expired:  { label: "Expired",  classes: "bg-slate-100 text-slate-600 border border-slate-200",    icon: ExclamationTriangleIcon },
};

const ELIGIBILITY_BADGE: Record<EligibilityStatus, { label: string; classes: string }> = {
  eligible:   { label: "Eligible",   classes: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  ineligible: { label: "Ineligible", classes: "bg-red-50 text-red-700 border border-red-200" },
  review:     { label: "Under Review", classes: "bg-amber-50 text-amber-700 border border-amber-200" },
  suspended:  { label: "Suspended", classes: "bg-slate-100 text-slate-600 border border-slate-200" },
};

const ACCRED_LABEL: Record<AccredType, string> = {
  reg_d_506b: "Reg D 506(b)",
  reg_d_506c: "Reg D 506(c)",
  reg_s: "Reg S (Offshore)",
  institutional: "Institutional / QIB",
};

const FLAG_LABELS: Record<string, { label: string; color: string }> = {
  reg_d_lockup_active:   { label: "Reg D Lockup", color: "bg-violet-100 text-violet-700" },
  reg_s_offshore:        { label: "Reg S Offshore", color: "bg-blue-100 text-blue-700" },
  holding_period_active: { label: "Holding Period", color: "bg-amber-100 text-amber-700" },
  kyc_in_progress:       { label: "KYC In Progress", color: "bg-sky-100 text-sky-700" },
  aml_flag:              { label: "AML Flag", color: "bg-red-100 text-red-700" },
  kyc_blocked:           { label: "KYC Blocked", color: "bg-red-100 text-red-700" },
};

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function OnchainInvestorRegistryPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<KycStatus | "all">("all");
  const [inviting, setInviting] = useState(false);

  const filtered = DEMO_INVESTORS.filter((inv) => {
    const matchSearch = search === "" ||
      inv.name.toLowerCase().includes(search.toLowerCase()) ||
      inv.wallet_address.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || inv.kyc_status === filter;
    return matchSearch && matchFilter;
  });

  const stats = {
    total: DEMO_INVESTORS.length,
    eligible: DEMO_INVESTORS.filter((i) => i.eligibility_status === "eligible").length,
    pending: DEMO_INVESTORS.filter((i) => i.kyc_status === "pending").length,
    blocked: DEMO_INVESTORS.filter((i) => i.kyc_status === "blocked").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Investor Registry</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            KYC/AML verification and accreditation gating for all tokenized asset participants.
            Eligibility status is checked on every transfer via the smart contract whitelist.
          </p>
        </div>
        <button
          onClick={() => setInviting(true)}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors"
        >
          <UserPlusIcon className="h-4 w-4" />
          Invite Investor
        </button>
      </div>

      {/* KYC Provider Status */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-slate-600">Persona</span>
          <span className="text-xs text-slate-500">Connected · KYC/AML Provider</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-slate-600">Sumsub</span>
          <span className="text-xs text-slate-500">Connected · KYC/AML Provider</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheckIcon className="h-4 w-4 text-slate-400" />
          All wallets are gated — no transfer executes without verified eligibility
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Investors", value: stats.total, color: "text-slate-900" },
          { label: "Eligible",        value: stats.eligible, color: "text-emerald-700" },
          { label: "Pending KYC",     value: stats.pending, color: "text-amber-700" },
          { label: "Blocked",         value: stats.blocked, color: "text-red-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className={`text-3xl font-black mt-1 tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search investor name or wallet…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        {(["all", "verified", "pending", "blocked", "expired"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors capitalize ${
              filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Investor Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              {["Investor", "Jurisdiction", "Wallet", "KYC Status", "Accreditation", "Tokens Held", "Eligibility", "Flags", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.map((inv) => {
              const kycBadge = KYC_BADGE[inv.kyc_status];
              const eligBadge = ELIGIBILITY_BADGE[inv.eligibility_status];
              const KycIcon = kycBadge.icon;
              return (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        {inv.entity_type === "fund" || inv.entity_type === "entity" || inv.entity_type === "qib"
                          ? <BuildingOfficeIcon className="h-4 w-4 text-slate-500" />
                          : <GlobeAltIcon className="h-4 w-4 text-slate-500" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">{inv.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{inv.entity_type.replace("_", " ")}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{inv.jurisdiction}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">{inv.wallet_address}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${kycBadge.classes}`}>
                        <KycIcon className="h-3 w-3" />
                        {kycBadge.label}
                      </span>
                      {inv.kyc_verified_at && (
                        <p className="text-xs text-slate-400">via {inv.kyc_provider} · {fmtDate(inv.kyc_verified_at)}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-slate-700 whitespace-nowrap">{ACCRED_LABEL[inv.accreditation_type]}</p>
                    {inv.accreditation_expires_at && (
                      <p className="text-xs text-slate-400">Expires {fmtDate(inv.accreditation_expires_at)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {inv.tokens_held.length > 0 ? (
                      <div className="space-y-0.5">
                        {inv.tokens_held.map((t) => (
                          <p key={t.symbol} className="text-xs font-mono text-slate-700">
                            {t.amount.toLocaleString()} <span className="text-slate-400">{t.symbol}</span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${eligBadge.classes}`}>
                      {eligBadge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {inv.flags.map((f) => (
                        <span key={f} className={`rounded-full px-2 py-0.5 text-xs font-bold ${FLAG_LABELS[f]?.color ?? "bg-slate-100 text-slate-600"}`}>
                          {FLAG_LABELS[f]?.label ?? f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">View</button>
                      {inv.kyc_status !== "verified" && (
                        <button className="rounded-lg px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1">
                          <ArrowPathIcon className="h-3 w-3" />
                          Re-check
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Invite Modal (simplified inline) */}
      {inviting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-lg space-y-5">
            <div>
              <h3 className="text-lg font-black text-slate-900">Invite Investor</h3>
              <p className="text-sm text-slate-500 mt-1">Investor will receive a KYC/accreditation link via their selected provider. Token allocation is locked until eligibility is confirmed.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Full Legal Name / Entity Name</label>
                <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Blackstone Real Estate Partners XII LP" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                <input type="email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="investor@firm.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Jurisdiction</label>
                <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="United States" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Exemption Type</label>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                  <option>Reg D 506(c) — Verified Accredited</option>
                  <option>Reg D 506(b) — Self-Certified Accredited</option>
                  <option>Reg S — Offshore Non-US Person</option>
                  <option>Institutional / QIB (144A)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">KYC Provider</label>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                  <option>Persona</option>
                  <option>Sumsub</option>
                  <option>Manual (Upload)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Wallet Address (optional — can be added post-KYC)</label>
                <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="0x..." />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => { setInviting(false); alert("Invitation sent. KYC link delivered to investor. Token allocation is locked pending verification."); }}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 transition-colors"
              >
                Send KYC Invitation
              </button>
              <button onClick={() => setInviting(false)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Regulatory Footer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-xs font-bold text-slate-600 mb-1">Compliance Framework</p>
        <p className="text-xs text-slate-500">
          All token transfers are blocked at the smart contract level until the receiving wallet's eligibility status is confirmed.
          Reg D 506(c) requires third-party accreditation verification before any securities sale.
          Reg S offshore investors are subject to a 40-day distribution compliance period and a 12-month U.S. market restricted period.
          KYC/AML checks are performed by Persona and Sumsub; eligibility records are stored in Kontra's permissioned investor registry.
        </p>
      </div>
    </div>
  );
}
