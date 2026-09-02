import { useState, useEffect, useCallback } from "react";
import { api } from "../../../lib/apiClient";
import { ScaleIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { LinkIcon } from "@heroicons/react/24/outline";

type Proposal = {
  id: string;
  proposal_number: string;
  proposal_type: string;
  title: string;
  description: string;
  proposed_by_role: string;
  threshold_pct: number;
  quorum_pct: number;
  voting_deadline: string;
  status: "draft" | "active" | "approved" | "rejected" | "expired" | "executed";
  votes_for_pct: number;
  votes_against_pct: number;
  votes_abstain_pct: number;
  quorum_met: boolean;
  blockchain_tx_hash?: string;
  loan_ref?: string;
};

type AuditEntry = {
  id: string;
  actor_role: string;
  action_type: string;
  decision_category: "servicing" | "governance";
  description: string;
  outcome?: string;
  loan_ref?: string;
  blockchain_tx_hash?: string;
  created_at: string;
};

type RoleAssignment = {
  id: string;
  user_name: string;
  email: string;
  role: string;
  voting_power: number;
  active: boolean;
};

// ── Rich demo data ────────────────────────────────────────────
const DEMO_PROPOSALS: Proposal[] = [
  {
    id: "p1",
    proposal_number: "GV-051",
    proposal_type: "loan_extension",
    title: "Extend LN-2847 Maturity by 18 Months",
    description:
      "Borrower has completed 70% of construction but requires additional runway due to permitting delays. Stabilization NOI projections remain intact. Special servicer recommends 18-month extension at +50bps.",
    proposed_by_role: "Master Servicer",
    threshold_pct: 66.7,
    quorum_pct: 50,
    voting_deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: "active",
    votes_for_pct: 78.3,
    votes_against_pct: 12.4,
    votes_abstain_pct: 9.3,
    quorum_met: true,
    loan_ref: "LN-2847",
  },
  {
    id: "p2",
    proposal_number: "GV-050",
    proposal_type: "collateral_disposition",
    title: "Release REO Parcel — 412 Harbor Blvd",
    description:
      "Post-foreclosure parcel. Offer received at $4.2M (87% of BPO). Recommend acceptance to minimize carrying costs and distributable proceeds to investors.",
    proposed_by_role: "Special Servicer",
    threshold_pct: 75,
    quorum_pct: 50,
    voting_deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
    status: "active",
    votes_for_pct: 62.1,
    votes_against_pct: 28.6,
    votes_abstain_pct: 9.3,
    quorum_met: true,
    loan_ref: "LN-3011",
  },
  {
    id: "p3",
    proposal_number: "GV-049",
    proposal_type: "distribution_policy",
    title: "Adjust Waterfall — Increase Reserve Threshold",
    description:
      "Raise the required liquidity reserve from 3% to 5% of outstanding UPB before distributions. Reduces near-term investor distributions but improves portfolio stability.",
    proposed_by_role: "Asset Manager",
    threshold_pct: 66.7,
    quorum_pct: 50,
    voting_deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
    status: "active",
    votes_for_pct: 44.8,
    votes_against_pct: 41.2,
    votes_abstain_pct: 14,
    quorum_met: false,
    loan_ref: undefined,
  },
  {
    id: "p4",
    proposal_number: "GV-047",
    proposal_type: "loan_extension",
    title: "Extend LN-2741 Maturity by 12 Months",
    description: "Bridge loan maturity extension. Borrower obtained construction lender commitment; take-out financing closes in Q3.",
    proposed_by_role: "Master Servicer",
    threshold_pct: 66.7,
    quorum_pct: 50,
    voting_deadline: new Date(Date.now() - 10 * 86400000).toISOString(),
    status: "approved",
    votes_for_pct: 82.1,
    votes_against_pct: 10.2,
    votes_abstain_pct: 7.7,
    quorum_met: true,
    blockchain_tx_hash: "0x3a8fc2d9e14f7b2a01c6d3e9a7f5b8c2e0d1f3a4",
    loan_ref: "LN-2741",
  },
  {
    id: "p5",
    proposal_number: "GV-045",
    proposal_type: "servicer_replacement",
    title: "Replace Primary Servicer — ABC Servicing Inc.",
    description: "Performance below SLA thresholds for 3 consecutive quarters. Proposed replacement: XYZ Capital Servicing.",
    proposed_by_role: "Asset Manager",
    threshold_pct: 60,
    quorum_pct: 40,
    voting_deadline: new Date(Date.now() - 30 * 86400000).toISOString(),
    status: "rejected",
    votes_for_pct: 48.3,
    votes_against_pct: 45.2,
    votes_abstain_pct: 6.5,
    quorum_met: true,
    loan_ref: undefined,
  },
];

const DEMO_AUDIT: AuditEntry[] = [
  {
    id: "a1",
    actor_role: "master_servicer",
    action_type: "payment_processed",
    decision_category: "servicing",
    description: "Monthly P&I payment of $84,500 collected and applied on LN-2847",
    outcome: "executed",
    loan_ref: "LN-2847",
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "a2",
    actor_role: "system",
    action_type: "proposal_approved",
    decision_category: "governance",
    description: "Proposal GV-047 approved with 82.1% FOR vote — 12-month extension on LN-2741",
    outcome: "approved",
    loan_ref: "LN-2741",
    blockchain_tx_hash: "0x3a8fc2d9e14f7b2a01c6d3e9a7f5b8c2e0d1f3a4",
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "a3",
    actor_role: "special_servicer",
    action_type: "default_notice_issued",
    decision_category: "servicing",
    description: "90-day default notice issued to borrower on LN-3011 — insufficient coverage",
    outcome: "executed",
    loan_ref: "LN-3011",
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: "a4",
    actor_role: "master_servicer",
    action_type: "escrow_disbursement",
    decision_category: "servicing",
    description: "Property tax escrow disbursement of $22,800 on LN-2741 — county tax authority",
    outcome: "executed",
    loan_ref: "LN-2741",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "a5",
    actor_role: "asset_manager",
    action_type: "proposal_created",
    decision_category: "governance",
    description: "Proposal GV-049 created — waterfall reserve threshold adjustment",
    outcome: "pending",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "a6",
    actor_role: "investor",
    action_type: "vote_cast",
    decision_category: "governance",
    description: "Investor voted FOR on GV-051 (loan extension LN-2847) — 8.3% voting power",
    outcome: "recorded",
    blockchain_tx_hash: "0x9f2e1c3b5a7d8e0f4b2c6a1d3e9f7b5c2a0d8e1f",
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "a7",
    actor_role: "lender_controller",
    action_type: "draw_approved",
    decision_category: "servicing",
    description: "Construction draw of $340,000 approved and funded on LN-2847 — milestone #4 verified",
    outcome: "executed",
    loan_ref: "LN-2847",
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: "a8",
    actor_role: "system",
    action_type: "proposal_rejected",
    decision_category: "governance",
    description: "Proposal GV-045 failed — 48.3% FOR (threshold 60% not met). Servicer replacement denied.",
    outcome: "rejected",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

const DEMO_ROLES: RoleAssignment[] = [
  { id: "r1", user_name: "James Whitfield",  email: "j.whitfield@kontraplatform.com", role: "lender_controller", voting_power: 0,    active: true },
  { id: "r2", user_name: "Maria Chen",       email: "m.chen@abcservicing.com",         role: "master_servicer",   voting_power: 0,    active: true },
  { id: "r3", user_name: "David Okafor",     email: "d.okafor@specialserv.com",        role: "special_servicer",  voting_power: 0,    active: true },
  { id: "r4", user_name: "Sarah Müller",     email: "s.muller@kontraplatform.com",     role: "asset_manager",     voting_power: 0,    active: true },
  { id: "r5", user_name: "Apex Capital LLC", email: "ops@apexcapital.com",             role: "investor",          voting_power: 24.5, active: true },
  { id: "r6", user_name: "Bridgewater Fund", email: "ops@bridgewaterfund.com",         role: "investor",          voting_power: 18.3, active: true },
  { id: "r7", user_name: "Harbor Equity",    email: "invest@harborequity.com",         role: "investor",          voting_power: 15.1, active: true },
  { id: "r8", user_name: "Summit RE Fund",   email: "info@summitrefund.com",           role: "investor",          voting_power: 12.8, active: true },
  { id: "r9", user_name: "Pacific Trust",    email: "ops@pacifictrust.io",             role: "investor",          voting_power: 9.6,  active: true },
  { id: "r10", user_name: "Aria Patel",      email: "a.patel@kontraplatform.com",      role: "admin",             voting_power: 0,    active: true },
];

// ── Helpers ────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  lender_controller: "bg-brand-100 text-brand-700 border border-brand-200",
  master_servicer:   "bg-blue-100 text-blue-700 border border-blue-200",
  special_servicer:  "bg-amber-100 text-amber-700 border border-amber-200",
  asset_manager:     "bg-emerald-100 text-emerald-700 border border-emerald-200",
  investor:          "bg-violet-100 text-violet-700 border border-violet-200",
  admin:             "bg-slate-100 text-slate-600 border border-slate-200",
  system:            "bg-slate-100 text-slate-500 border border-slate-200",
};
const ROLE_LABEL: Record<string, string> = {
  lender_controller: "Lender Controller",
  master_servicer:   "Master Servicer",
  special_servicer:  "Special Servicer",
  asset_manager:     "Asset Manager",
  investor:          "Investor",
  admin:             "Admin",
  system:            "System",
};

const STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700 border border-emerald-200",
  approved: "bg-blue-50 text-blue-700 border border-blue-200",
  rejected: "bg-brand-50 text-brand-700 border border-brand-200",
  expired:  "bg-slate-100 text-slate-500",
  executed: "bg-violet-50 text-violet-700 border border-violet-200",
  draft:    "bg-slate-100 text-slate-500",
};

const TYPE_LABEL: Record<string, string> = {
  loan_extension:        "Loan Extension",
  rate_modification:     "Rate Modification",
  collateral_disposition:"Collateral Disposition",
  distribution_policy:   "Distribution Policy",
  servicer_replacement:  "Servicer Replacement",
  workout_strategy:      "Workout Strategy",
  other:                 "Other",
};

const CAT_STYLE: Record<string, string> = {
  servicing:  "bg-slate-100 text-slate-600 border border-slate-200",
  governance: "bg-violet-100 text-violet-700 border border-violet-200",
};

const daysUntil = (iso: string) => {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (d > 0) return `${d}d remaining`;
  if (d === 0) return "Closes today";
  return `Closed ${Math.abs(d)}d ago`;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const shortHash = (h?: string) => h ? `${h.slice(0, 6)}…${h.slice(-4)}` : null;

type Tab = "active" | "history" | "audit" | "roles";

export default function InvestorGovernancePage() {
  const [tab, setTab] = useState<Tab>("active");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [audit, setAudit]         = useState<AuditEntry[]>([]);
  const [roles, setRoles]         = useState<RoleAssignment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [auditFilter, setAuditFilter] = useState<"all" | "servicing" | "governance">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [propRes, auditRes, rolesRes] = await Promise.allSettled([
      api.get<{ proposals: Proposal[] }>("/loan-governance/proposals"),
      api.get<{ entries: AuditEntry[] }>("/loan-governance/audit"),
      api.get<{ assignments: RoleAssignment[] }>("/loan-governance/roles"),
    ]);
    setProposals(propRes.status === "fulfilled" ? (propRes.value.data?.proposals ?? DEMO_PROPOSALS) : DEMO_PROPOSALS);
    setAudit(auditRes.status === "fulfilled" ? (auditRes.value.data?.entries ?? DEMO_AUDIT) : DEMO_AUDIT);
    setRoles(rolesRes.status === "fulfilled" ? (rolesRes.value.data?.assignments ?? DEMO_ROLES) : DEMO_ROLES);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeProposals = proposals.filter((p) => p.status === "active");
  const pastProposals   = proposals.filter((p) => p.status !== "active" && p.status !== "draft");
  const filteredAudit   = auditFilter === "all" ? audit : audit.filter((e) => e.decision_category === auditFilter);

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "active",  label: "Active Proposals",  count: activeProposals.length },
    { key: "history", label: "Past Results",       count: pastProposals.length },
    { key: "audit",   label: "Audit Trail",        count: audit.length },
    { key: "roles",   label: "Role Assignments",   count: roles.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Investor Governance</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Governance proposals, investor voting, and complete servicing audit trail
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeProposals.some((p) => p.quorum_met && p.votes_for_pct >= p.threshold_pct) && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              {activeProposals.filter((p) => p.votes_for_pct >= p.threshold_pct).length} Proposal(s) Passing
            </span>
          )}
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white flex items-center gap-2"
                : "rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-200 flex items-center gap-2"
            }
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${tab === t.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Active Proposals ── */}
      {tab === "active" && (
        <div className="space-y-4">
          {activeProposals.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
              No active proposals — all major economic decisions are current.
            </div>
          ) : activeProposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} showVoteButton />
          ))}
        </div>
      )}

      {/* ── Past Results ── */}
      {tab === "history" && (
        <div className="space-y-4">
          {pastProposals.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
              No completed proposals yet.
            </div>
          ) : pastProposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      )}

      {/* ── Audit Trail ── */}
      {tab === "audit" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Filter:</span>
            {(["all", "servicing", "governance"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAuditFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  auditFilter === f
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f === "all" ? "All Actions" : f === "servicing" ? "Servicing" : "Governance"}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {filteredAudit.map((entry) => (
                <div key={entry.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="mt-1 flex-shrink-0">
                    {entry.decision_category === "governance" ? (
                      <ScaleIcon className="h-5 w-5 text-violet-500" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${CAT_STYLE[entry.decision_category]}`}>
                        {entry.decision_category}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLOR[entry.actor_role] ?? "bg-slate-100 text-slate-500"}`}>
                        {ROLE_LABEL[entry.actor_role] ?? entry.actor_role}
                      </span>
                      {entry.loan_ref && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {entry.loan_ref}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800">{entry.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>{fmtTime(entry.created_at)}</span>
                      {entry.outcome && (
                        <span className={`font-semibold ${
                          entry.outcome === "executed" ? "text-emerald-600" :
                          entry.outcome === "approved" ? "text-blue-600" :
                          entry.outcome === "rejected" ? "text-brand-600" : "text-slate-500"
                        }`}>
                          {entry.outcome}
                        </span>
                      )}
                      {entry.blockchain_tx_hash && (
                        <span className="flex items-center gap-1 text-violet-600 font-mono">
                          <LinkIcon className="h-3 w-3" />
                          On-chain: {shortHash(entry.blockchain_tx_hash)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Servicing decisions are protected — investors see outcomes but cannot modify them.
            Governance decisions are recorded on-chain.
          </p>
        </div>
      )}

      {/* ── Role Assignments ── */}
      {tab === "roles" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-sm font-bold text-slate-900">Current Role Assignments</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Voting power applies to investors only. All other roles have 0% voting weight.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Name / Entity","Email","Role","Voting Power","Status"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {roles.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-900">{r.user_name}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{r.email}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLOR[r.role] ?? "bg-slate-100 text-slate-500"}`}>
                        {ROLE_LABEL[r.role] ?? r.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-slate-700">
                      {r.voting_power > 0 ? `${r.voting_power.toFixed(1)}%` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-400"}`}>
                        {r.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-400">
              Total investor voting power: {roles.filter((r) => r.role === "investor").reduce((s, r) => s + r.voting_power, 0).toFixed(1)}% ·
              Remaining unallocated: {(100 - roles.filter((r) => r.role === "investor").reduce((s, r) => s + r.voting_power, 0)).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalCard({ proposal: p, showVoteButton }: { proposal: Proposal; showVoteButton?: boolean }) {
  const isPassing = p.votes_for_pct >= p.threshold_pct;
  const deadline  = daysUntil(p.voting_deadline);
  const past      = new Date(p.voting_deadline) < new Date();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:border-slate-300 transition-colors">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{p.proposal_number}</span>
              <span className="rounded-full bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 text-xs font-medium">
                {TYPE_LABEL[p.proposal_type] ?? p.proposal_type}
              </span>
              {p.loan_ref && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{p.loan_ref}</span>
              )}
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS_STYLE[p.status] ?? "bg-slate-100 text-slate-500"}`}>
                {p.status}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{p.title}</h3>
            <p className="text-sm text-slate-500 mt-1">{p.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ClockIcon className="h-3.5 w-3.5" />
              {deadline}
            </div>
            <div className={`text-xs font-semibold ${ROLE_COLOR[p.proposed_by_role.toLowerCase().replace(/ /g, "_")] ?? "bg-slate-100 text-slate-500"} rounded-full px-2 py-0.5`}>
              {p.proposed_by_role}
            </div>
          </div>
        </div>
      </div>

      {/* Vote bars */}
      <div className="px-6 py-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-14 text-right text-xs font-bold text-emerald-700">FOR</span>
            <div className="flex-1 rounded-full bg-slate-100 h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${p.votes_for_pct}%` }}
              />
            </div>
            <span className="w-12 text-xs font-bold text-emerald-700 tabular-nums">{p.votes_for_pct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 text-right text-xs font-bold text-brand-700">AGAINST</span>
            <div className="flex-1 rounded-full bg-slate-100 h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${p.votes_against_pct}%` }}
              />
            </div>
            <span className="w-12 text-xs font-bold text-brand-700 tabular-nums">{p.votes_against_pct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 text-right text-xs font-bold text-slate-400">ABSTAIN</span>
            <div className="flex-1 rounded-full bg-slate-100 h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-300 transition-all"
                style={{ width: `${p.votes_abstain_pct}%` }}
              />
            </div>
            <span className="w-12 text-xs font-bold text-slate-400 tabular-nums">{p.votes_abstain_pct.toFixed(1)}%</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-bold ${p.quorum_met ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
              Quorum: {p.quorum_met ? "Met" : `Needed ${p.quorum_pct}%`}
            </span>
            <span className={`rounded-full px-2.5 py-1 font-bold ${isPassing ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"}`}>
              Threshold: {p.threshold_pct}%  {isPassing ? "✓ Passing" : "Not met"}
            </span>
            {p.blockchain_tx_hash && (
              <span className="flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-1 text-violet-700 font-mono text-xs">
                <LinkIcon className="h-3 w-3" />
                {shortHash(p.blockchain_tx_hash)}
              </span>
            )}
          </div>
          {showVoteButton && !past && (
            <button className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors">
              Cast Vote
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
