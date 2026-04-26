/**
 * Audit Log — Full Off-chain + On-chain Trail
 *
 * Kontra maintains a tamper-evident dual audit trail:
 *   — Off-chain: every action in the Kontra platform (KYC events, allocation
 *     decisions, governance votes, distribution records) stored in a write-once log
 *   — On-chain: corresponding token events (transfers, distribution events,
 *     compliance state changes) stored as immutable on-chain records with tx hashes
 *
 * The audit log proves:
 *   — Who owns what, under which exemption, from when to when
 *   — Every compliance check performed before any transfer or allocation
 *   — Every distribution calculated and paid, tied to a servicing payment
 *   — Every governance decision, who voted, and the result
 *
 * Audit-ready for:
 *   — SEC examination (books and records Rule 17a-4)
 *   — FINRA review
 *   — Lender / investor due diligence
 *   — Internal compliance review
 */

import { useState } from "react";
import {
  CheckCircleIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  ScaleIcon,
  UserIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
type EventType = "kyc" | "transfer" | "distribution" | "governance" | "compliance" | "issuance";

interface AuditEvent {
  id: string;
  timestamp: string;
  event_type: EventType;
  title: string;
  actor: string;
  actor_role: string;
  investor?: string;
  token?: string;
  loan_ref?: string;
  off_chain_ref: string;
  on_chain_tx?: string;
  result: "success" | "blocked" | "flagged" | "pending";
  detail: string;
}

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_EVENTS: AuditEvent[] = [
  {
    id: "audit-001", timestamp: "2026-04-23T11:04:22Z",
    event_type: "transfer", title: "Transfer Blocked — Reg D Lockup",
    actor: "Kontra Compliance Engine", actor_role: "System",
    investor: "Meridian Capital Partners LLC", token: "KTRA-2847", loan_ref: "LN-2847",
    off_chain_ref: "TX-2847-20260423-001",
    on_chain_tx: undefined,
    result: "blocked",
    detail: "Transfer of 1,500 KTRA-2847 blocked. Reg D 12-month lockup active until 2027-02-01. Transfer hook reverted before execution.",
  },
  {
    id: "audit-002", timestamp: "2026-04-23T09:15:00Z",
    event_type: "governance", title: "Governance Vote Cast",
    actor: "Blackstone Real Estate Partners XII LP", actor_role: "Investor",
    investor: "Blackstone Real Estate Partners XII LP", token: "KTRA-4108", loan_ref: "LN-4108",
    off_chain_ref: "GOV-4108-20260423-001",
    on_chain_tx: "0xabc1...d3f9",
    result: "success",
    detail: "Vote 'For' cast on Proposal PROP-001 (Covenant Waiver — LN-4108). Voting power: 15,000 tokens. Vote recorded on-chain.",
  },
  {
    id: "audit-003", timestamp: "2026-04-22T14:30:00Z",
    event_type: "kyc", title: "KYC Verification Completed",
    actor: "Sumsub", actor_role: "KYC Provider",
    investor: "Sunrise Investment Group LLC",
    off_chain_ref: "KYC-20260422-005",
    result: "success",
    detail: "KYC/AML verification completed via Sumsub. Status: Verified. Accreditation type: Reg D 506(c). Wallet 0x2B7E...D9C3 added to investor whitelist.",
  },
  {
    id: "audit-004", timestamp: "2026-04-22T09:15:00Z",
    event_type: "transfer", title: "Transfer Approved & Executed",
    actor: "Kontra Transfer Agent", actor_role: "System",
    investor: "Blackstone Real Estate Partners XII LP", token: "KTRA-2847", loan_ref: "LN-2847",
    off_chain_ref: "TX-2847-20260422-001",
    on_chain_tx: "0x7ef3...b1a2",
    result: "success",
    detail: "Transfer of 3,000 KTRA-2847 from Blackstone to Pacific Ventures Capital LP approved. Compliance checks passed (whitelist ✓, lockup ✓, holder count ✓). Cap table updated.",
  },
  {
    id: "audit-005", timestamp: "2026-04-21T16:45:00Z",
    event_type: "compliance", title: "OFAC Screening — AML Flag",
    actor: "Persona", actor_role: "KYC Provider",
    investor: "Marcus Chen (Individual)",
    off_chain_ref: "KYC-20260421-003",
    result: "flagged",
    detail: "OFAC SDN list match identified for investor Marcus Chen. KYC blocked. SAR filing recommended. Wallet 0x4A9F...E2B8 blocked from whitelist. Incident escalated to compliance officer.",
  },
  {
    id: "audit-006", timestamp: "2026-04-20T10:00:00Z",
    event_type: "issuance", title: "Token Allocation — Reg S Investor",
    actor: "Kontra Platform", actor_role: "System",
    investor: "Harrington Global Fund (Cayman Islands)", token: "KTRA-0728", loan_ref: "LN-0728",
    off_chain_ref: "ALLOC-0728-20260420-001",
    on_chain_tx: "0x3fa9...c2e1",
    result: "success",
    detail: "10,000 KTRA-0728 allocated to Harrington Global Fund under Reg S exemption. KYC: Verified (Persona). Jurisdiction: Cayman Islands. 40-day distribution compliance period initiated. 12-month Reg S holding period clock started.",
  },
  {
    id: "audit-007", timestamp: "2026-04-01T09:00:00Z",
    event_type: "distribution", title: "Distribution Completed — April 2026",
    actor: "Kontra Servicing Engine", actor_role: "System",
    token: "KTRA-2847", loan_ref: "LN-2847",
    off_chain_ref: "PMT-2026-04-2847",
    on_chain_tx: "0x9cd2...f4b7",
    result: "success",
    detail: "$31,750 distributed to 3 KTRA-2847 holders for the April 2026 payment period. P&I: $12,500 principal + $19,250 interest. Servicing record PMT-2026-04-2847 reconciled. On-chain distribution event logged.",
  },
  {
    id: "audit-008", timestamp: "2026-04-01T09:05:00Z",
    event_type: "distribution", title: "Distribution Completed — April 2026",
    actor: "Kontra Servicing Engine", actor_role: "System",
    token: "KTRA-3201", loan_ref: "LN-3201",
    off_chain_ref: "PMT-2026-04-3201",
    on_chain_tx: "0x4ab1...e8c3",
    result: "success",
    detail: "$63,542 distributed to 1 KTRA-3201 holder for the April 2026 payment period. P&I: $25,000 principal + $38,542 interest. Servicing record PMT-2026-04-3201 reconciled.",
  },
  {
    id: "audit-009", timestamp: "2026-04-15T12:00:00Z",
    event_type: "governance", title: "Governance Proposal Passed — Maturity Extension",
    actor: "Kontra Platform", actor_role: "System",
    token: "KTRA-2847", loan_ref: "LN-2847",
    off_chain_ref: "GOV-2847-20260415-001",
    on_chain_tx: "0x6de5...a9f2",
    result: "success",
    detail: "Proposal PROP-002 (Maturity Extension — LN-2847) passed with 91% of votes in favor. Quorum: 100% (51% required). Passed. Lender co-signature required before execution. Governance event recorded on-chain.",
  },
  {
    id: "audit-010", timestamp: "2026-01-15T09:00:00Z",
    event_type: "issuance", title: "Token Issuance — KTRA-2847",
    actor: "Kontra Platform", actor_role: "System",
    token: "KTRA-2847", loan_ref: "LN-2847",
    off_chain_ref: "ISSUE-2847-20260115",
    on_chain_tx: "0x1bc4...d7a8",
    result: "success",
    detail: "42,000 KTRA-2847 tokens issued under Reg D 506(c) exemption. Smart contract deployed with whitelist-only transfer restriction and 12-month Reg D lockup. Linked to Loan LN-2847 servicing record. 12-month lockup period started 2026-01-15.",
  },
];

const EVENT_CONFIG: Record<EventType, { label: string; icon: typeof CheckCircleIcon; color: string }> = {
  kyc:          { label: "KYC / AML",    icon: ShieldCheckIcon,    color: "bg-violet-100 text-violet-700" },
  transfer:     { label: "Transfer",     icon: ArrowsRightLeftIcon, color: "bg-blue-100 text-blue-700" },
  distribution: { label: "Distribution", icon: BanknotesIcon,       color: "bg-emerald-100 text-emerald-700" },
  governance:   { label: "Governance",   icon: ScaleIcon,           color: "bg-amber-100 text-amber-700" },
  compliance:   { label: "Compliance",   icon: ExclamationTriangleIcon, color: "bg-red-100 text-red-700" },
  issuance:     { label: "Issuance",     icon: UserIcon,            color: "bg-slate-100 text-slate-700" },
};

const RESULT_BADGE: Record<string, { label: string; classes: string }> = {
  success: { label: "Success", classes: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  blocked: { label: "Blocked", classes: "bg-red-50 text-red-700 border border-red-200" },
  flagged: { label: "Flagged", classes: "bg-amber-50 text-amber-700 border border-amber-200" },
  pending: { label: "Pending", classes: "bg-slate-100 text-slate-600" },
};

export default function OnchainAuditPage() {
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
  const [resultFilter, setResultFilter] = useState<"all" | "success" | "blocked" | "flagged">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = DEMO_EVENTS.filter((e) => {
    const matchType = typeFilter === "all" || e.event_type === typeFilter;
    const matchResult = resultFilter === "all" || e.result === resultFilter;
    return matchType && matchResult;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Audit Log</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Full dual audit trail — every token operation recorded off-chain in Kontra and on-chain as a verifiable event. Audit-ready for SEC examination, FINRA review, and investor due diligence.
          </p>
        </div>
        <button
          onClick={() => alert("Audit report exported. Full off-chain + on-chain event log downloaded as CSV. Report includes: who owns what, under which exemption, from when to when.")}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Export Report
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Events", value: DEMO_EVENTS.length, color: "text-slate-900" },
          { label: "On-chain Events", value: DEMO_EVENTS.filter(e => e.on_chain_tx).length, color: "text-violet-700" },
          { label: "Blocked Events", value: DEMO_EVENTS.filter(e => e.result === "blocked").length, color: "text-red-700" },
          { label: "AML Flags", value: DEMO_EVENTS.filter(e => e.result === "flagged").length, color: "text-amber-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className={`text-3xl font-black mt-1 tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <FunnelIcon className="h-4 w-4 text-slate-400 shrink-0" />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${typeFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            All Types
          </button>
          {(Object.keys(EVENT_CONFIG) as EventType[]).map((t) => {
            const cfg = EVENT_CONFIG[t];
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${typeFilter === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "success", "blocked", "flagged"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setResultFilter(r)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
                resultFilter === r
                  ? r === "blocked" ? "bg-red-700 text-white" : r === "flagged" ? "bg-amber-600 text-white" : "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {r === "all" ? "All Results" : r}
            </button>
          ))}
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-2">
        {filtered.map((ev) => {
          const cfg = EVENT_CONFIG[ev.event_type];
          const EvIcon = cfg.icon;
          const resultBadge = RESULT_BADGE[ev.result];
          const isExpanded = expanded === ev.id;

          return (
            <div
              key={ev.id}
              className={`rounded-xl border bg-white overflow-hidden ${
                ev.result === "blocked" ? "border-red-200" :
                ev.result === "flagged" ? "border-amber-200" : "border-slate-200"
              }`}
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : ev.id)}
                className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
              >
                {/* Event type icon */}
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                  <EvIcon className="h-4 w-4" />
                </div>

                {/* Core info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{ev.title}</p>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${resultBadge.classes}`}>
                      {resultBadge.label}
                    </span>
                    {ev.token && (
                      <span className="text-xs font-mono font-bold text-slate-400">{ev.token}</span>
                    )}
                    {ev.loan_ref && (
                      <span className="text-xs text-slate-400">{ev.loan_ref}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className="text-xs text-slate-500">
                      {new Date(ev.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {new Date(ev.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-xs text-slate-500">{ev.actor} <span className="text-slate-400">({ev.actor_role})</span></p>
                    {ev.investor && (
                      <p className="text-xs text-slate-500">Investor: {ev.investor}</p>
                    )}
                  </div>
                </div>

                {/* On-chain indicator */}
                <div className="shrink-0 flex items-center gap-2">
                  {ev.on_chain_tx ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                      <LinkIcon className="h-3 w-3" />
                      On-chain
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Off-chain only</span>
                  )}
                  <span className="text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed">{ev.detail}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-widest">Off-chain Ref</p>
                      <p className="text-slate-700 font-mono mt-0.5">{ev.off_chain_ref}</p>
                    </div>
                    {ev.on_chain_tx && (
                      <div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest">On-chain Tx</p>
                        <p className="text-violet-700 font-mono mt-0.5">{ev.on_chain_tx}</p>
                      </div>
                    )}
                    {ev.loan_ref && (
                      <div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest">Loan Reference</p>
                        <p className="text-slate-700 font-mono mt-0.5">{ev.loan_ref}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-widest">Event Type</p>
                      <p className="text-slate-700 mt-0.5 capitalize">{ev.event_type}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Regulatory footer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-xs font-bold text-slate-600 mb-1">Audit Standards Compliance</p>
        <p className="text-xs text-slate-500">
          Kontra's audit trail is designed to satisfy SEC Rule 17a-4 books and records requirements for broker-dealers and investment advisers. All records are stored in a write-once format. On-chain events provide cryptographic proof of ownership, transfers, and distributions. The dual off-chain/on-chain trail enables regulators, auditors, and investors to independently verify: (1) who owns what position, (2) under which securities exemption, (3) the history of every transfer with compliance rationale, and (4) every distribution tied to a servicing payment record.
        </p>
      </div>
    </div>
  );
}
