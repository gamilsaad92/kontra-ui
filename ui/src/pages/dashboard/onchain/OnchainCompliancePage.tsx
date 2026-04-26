/**
 * Compliance Rules Engine
 *
 * Admin-configurable rule set that governs all token transfers and issuances.
 * Rules are enforced at two layers:
 *   1. Smart contract transfer hooks — pre-transfer whitelist and lockup checks
 *   2. Kontra off-chain rules engine — jurisdiction screening, OFAC checks,
 *      holder limits, and SEC/agency rule updates
 *
 * Supported regulatory frameworks:
 *   — SEC Reg D Rule 506(b) / 506(c) — private placement, accredited investors
 *   — SEC Reg S — offshore distribution exemption
 *   — Rule 144 — resale of restricted securities
 *   — Section 12(g) — 2,000-holder registration trigger
 *   — OFAC SDN List — automatic jurisdiction blocks
 */

import { useState } from "react";
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  LockClosedIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ComplianceRule {
  id: string;
  name: string;
  category: "transfer_restriction" | "holder_limit" | "jurisdiction" | "kyc_aml" | "resale";
  framework: string;
  description: string;
  status: "active" | "inactive" | "review";
  enforced_at: "smart_contract" | "off_chain" | "both";
  last_updated: string;
  configurable: boolean;
}

interface JurisdictionRule {
  jurisdiction: string;
  flag: string;
  status: "allowed" | "restricted" | "blocked";
  reason: string;
}

interface RuleEvent {
  id: string;
  timestamp: string;
  event: string;
  rule: string;
  investor: string;
  token: string;
  result: "passed" | "blocked" | "flagged";
}

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_RULES: ComplianceRule[] = [
  {
    id: "r-001", name: "Reg D 12-Month Transfer Lock", category: "transfer_restriction",
    framework: "SEC Reg D Rule 506(b) / 506(c)",
    description: "Securities issued under Reg D exemption may not be resold for 12 months from acquisition date without registration. Enforced by transfer hook: all transfers from locked wallets are reverted at contract level.",
    status: "active", enforced_at: "both", last_updated: "2026-01-01", configurable: false,
  },
  {
    id: "r-002", name: "Whitelist-Only Transfers", category: "transfer_restriction",
    framework: "SEC Rule 502 / Private Placement",
    description: "Token transfers are restricted to wallets registered in the Kontra verified investor whitelist. Any transfer to an unregistered wallet is blocked by the smart contract transfer hook before execution.",
    status: "active", enforced_at: "smart_contract", last_updated: "2026-01-01", configurable: false,
  },
  {
    id: "r-003", name: "Accredited Investor Requirement (506c)", category: "kyc_aml",
    framework: "SEC Reg D Rule 506(c)",
    description: "All Reg D 506(c) investors must have third-party verified accreditation status on file prior to receiving any token allocation. Self-certification is not sufficient for 506(c) offerings.",
    status: "active", enforced_at: "off_chain", last_updated: "2026-02-15", configurable: true,
  },
  {
    id: "r-004", name: "Reg S Offshore Holding Period", category: "transfer_restriction",
    framework: "SEC Reg S Rule 903 / 904",
    description: "Offshore investors (non-US persons) under Reg S exemption are subject to a 40-day distribution compliance period and a 12-month restricted period before tokens may be sold back into U.S. markets.",
    status: "active", enforced_at: "both", last_updated: "2026-01-01", configurable: false,
  },
  {
    id: "r-005", name: "2,000-Holder Section 12(g) Cap", category: "holder_limit",
    framework: "Exchange Act Section 12(g) / JOBS Act",
    description: "Automatically blocks new token issuances or transfers that would cause total holder count to exceed 2,000 (1,999 safety buffer). If limit is approached, admin receives an alert and new allocations require manual approval.",
    status: "active", enforced_at: "smart_contract", last_updated: "2026-01-01", configurable: true,
  },
  {
    id: "r-006", name: "OFAC SDN Screening", category: "jurisdiction",
    framework: "OFAC / BSA / FinCEN",
    description: "All wallets and counterparties are screened against the OFAC Specially Designated Nationals list and FINCEN advisories. Matches result in an automatic block and SAR filing prompt.",
    status: "active", enforced_at: "off_chain", last_updated: "2026-04-01", configurable: false,
  },
  {
    id: "r-007", name: "KYC/AML Re-verification (Annual)", category: "kyc_aml",
    framework: "BSA / FinCEN AML Program Requirements",
    description: "All investors must re-verify KYC/AML status annually. Wallets with expired KYC status are automatically moved to 'suspended' in the whitelist and cannot receive or send tokens until re-verified.",
    status: "active", enforced_at: "off_chain", last_updated: "2026-01-01", configurable: true,
  },
  {
    id: "r-008", name: "Rule 144 Resale Volume Limits", category: "resale",
    framework: "SEC Rule 144",
    description: "Investors seeking to resell restricted securities via the secondary market are subject to Rule 144 volume limitations (1% of outstanding or average weekly trading volume). Configurable by admin for evolving guidance.",
    status: "review", enforced_at: "off_chain", last_updated: "2026-03-10", configurable: true,
  },
];

const DEMO_JURISDICTIONS: JurisdictionRule[] = [
  { jurisdiction: "United States", flag: "🇺🇸", status: "allowed",    reason: "Primary market — Reg D / Reg S applies" },
  { jurisdiction: "United Kingdom", flag: "🇬🇧", status: "allowed",    reason: "Reg S offshore — holding period applies" },
  { jurisdiction: "Cayman Islands", flag: "🇰🇾", status: "allowed",    reason: "Reg S offshore — holding period applies" },
  { jurisdiction: "Singapore",      flag: "🇸🇬", status: "allowed",    reason: "Reg S offshore — holding period applies" },
  { jurisdiction: "Canada",         flag: "🇨🇦", status: "restricted", reason: "OSC review required — pending admin approval" },
  { jurisdiction: "Iran",           flag: "🇮🇷", status: "blocked",    reason: "OFAC Comprehensive Sanctions — automatic block" },
  { jurisdiction: "North Korea",    flag: "🇰🇵", status: "blocked",    reason: "OFAC Comprehensive Sanctions — automatic block" },
  { jurisdiction: "Cuba",           flag: "🇨🇺", status: "blocked",    reason: "OFAC Comprehensive Sanctions — automatic block" },
  { jurisdiction: "Russia",         flag: "🇷🇺", status: "blocked",    reason: "OFAC Russia/Belarus sanctions — automatic block" },
  { jurisdiction: "Syria",          flag: "🇸🇾", status: "blocked",    reason: "OFAC Comprehensive Sanctions — automatic block" },
];

const DEMO_EVENTS: RuleEvent[] = [
  { id: "ev-001", timestamp: "2026-04-23T11:04:00Z", event: "Transfer Attempt",   rule: "Reg D 12-Month Lock",      investor: "Meridian Capital Partners LLC",          token: "KTRA-2847", result: "blocked" },
  { id: "ev-002", timestamp: "2026-04-22T14:30:00Z", event: "KYC Verification",   rule: "KYC/AML Re-verification",  investor: "Sunrise Investment Group LLC",           token: "—",         result: "passed"  },
  { id: "ev-003", timestamp: "2026-04-22T09:15:00Z", event: "Transfer Approved",  rule: "Whitelist-Only Transfers", investor: "Blackstone Real Estate Partners XII LP", token: "KTRA-2847", result: "passed"  },
  { id: "ev-004", timestamp: "2026-04-21T16:45:00Z", event: "OFAC Screening",     rule: "OFAC SDN Screening",       investor: "Marcus Chen (Individual)",               token: "—",         result: "flagged" },
  { id: "ev-005", timestamp: "2026-04-20T10:00:00Z", event: "Allocation",         rule: "Accredited Investor Check", investor: "Harrington Global Fund (Cayman Islands)","token": "KTRA-0728", result: "passed"  },
];

const RESULT_BADGE: Record<string, { label: string; classes: string; icon: typeof CheckCircleIcon }> = {
  passed:  { label: "Passed",  classes: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircleIcon },
  blocked: { label: "Blocked", classes: "bg-red-50 text-red-700 border border-red-200",           icon: XCircleIcon },
  flagged: { label: "Flagged", classes: "bg-amber-50 text-amber-700 border border-amber-200",     icon: ExclamationTriangleIcon },
};

const STATUS_BADGE: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-slate-100 text-slate-500",
  review:   "bg-amber-50 text-amber-700 border border-amber-200",
};

const CATEGORY_ICON: Record<string, typeof ShieldCheckIcon> = {
  transfer_restriction: LockClosedIcon,
  holder_limit:         ExclamationTriangleIcon,
  jurisdiction:         GlobeAltIcon,
  kyc_aml:              ShieldCheckIcon,
  resale:               ClockIcon,
};

export default function OnchainCompliancePage() {
  const [activeTab, setActiveTab] = useState<"rules" | "jurisdictions" | "events">("rules");
  const [editRule, setEditRule] = useState<string | null>(null);

  const editingRule = DEMO_RULES.find((r) => r.id === editRule);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Compliance Rules Engine</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Admin-configurable rule set enforcing SEC, OFAC, and agency guidance on all token operations. Rules are applied at both the smart contract and off-chain layers.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          <CheckCircleIcon className="h-4 w-4" />
          All rules active · Last updated Apr 23, 2026
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {(["rules", "jurisdictions", "events"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors ${
              activeTab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "rules" ? "Active Rules" : t === "jurisdictions" ? "Jurisdiction Map" : "Compliance Events"}
          </button>
        ))}
      </div>

      {/* Active Rules */}
      {activeTab === "rules" && (
        <div className="space-y-3">
          {DEMO_RULES.map((rule) => {
            const Icon = CATEGORY_ICON[rule.category] ?? ShieldCheckIcon;
            return (
              <div key={rule.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-800">{rule.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[rule.status]}`}>
                          {rule.status.charAt(0).toUpperCase() + rule.status.slice(1)}
                        </span>
                        <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-xs">
                          {rule.enforced_at === "both" ? "Smart Contract + Off-chain" : rule.enforced_at === "smart_contract" ? "Smart Contract" : "Off-chain"}
                        </span>
                      </div>
                      <p className="text-xs text-violet-700 font-semibold">{rule.framework}</p>
                      <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">{rule.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rule.configurable && (
                      <button
                        onClick={() => setEditRule(rule.id)}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <Cog6ToothIcon className="h-3.5 w-3.5" />
                        Configure
                      </button>
                    )}
                    {!rule.configurable && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <LockClosedIcon className="h-3 w-3" /> Fixed rule
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Jurisdiction Map */}
      {activeTab === "jurisdictions" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-600">
            Jurisdiction rules are applied at onboarding and on every transfer. OFAC-blocked jurisdictions trigger an automatic block and are non-configurable. Restricted jurisdictions require admin review before any investor can be onboarded.
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {["Jurisdiction", "Status", "Rule / Reason"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {DEMO_JURISDICTIONS.map((j) => (
                  <tr key={j.jurisdiction} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-800 font-semibold">
                      {j.flag} {j.jurisdiction}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                        j.status === "allowed"     ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        j.status === "restricted"  ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                     "bg-red-50 text-red-700 border border-red-200"
                      }`}>
                        {j.status.charAt(0).toUpperCase() + j.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{j.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compliance Events */}
      {activeTab === "events" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {["Timestamp", "Event", "Rule Triggered", "Investor", "Token", "Result"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {DEMO_EVENTS.map((ev) => {
                const badge = RESULT_BADGE[ev.result];
                const BadgeIcon = badge.icon;
                return (
                  <tr key={ev.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                      {new Date(ev.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {new Date(ev.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800 font-semibold whitespace-nowrap">{ev.event}</td>
                    <td className="px-4 py-3 text-xs text-violet-700 font-semibold whitespace-nowrap">{ev.rule}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{ev.investor}</td>
                    <td className="px-4 py-3 text-xs font-mono font-bold text-slate-700">{ev.token}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.classes}`}>
                        <BadgeIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Configure Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-lg space-y-5">
            <div>
              <h3 className="text-lg font-black text-slate-900">Configure Rule</h3>
              <p className="text-sm text-violet-700 font-semibold mt-0.5">{editingRule.name}</p>
              <p className="text-sm text-slate-500 mt-1">{editingRule.framework}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Rule changes are logged to the compliance audit trail and require 2-admin approval before taking effect.
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>Under Review</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Notes (reason for change)</label>
                <textarea rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" placeholder="SEC no-action letter reference, legal memo, etc." />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setEditRule(null); alert("Rule change submitted for admin approval. Change is logged to compliance audit trail."); }}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 transition-colors"
              >
                Submit for Approval
              </button>
              <button onClick={() => setEditRule(null)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
