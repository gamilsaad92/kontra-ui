/**
 * Governance Layer
 *
 * Kontra's governance model is designed for regulated CRE debt infrastructure:
 *
 *   — Lender retains full control rights by default (major decisions, covenants)
 *   — Servicer retains operational control (collections, delinquency, draws)
 *   — Investors have voting rights ONLY on predefined actions (token-weighted)
 *   — Governance events are triggered automatically by loan covenant breaches
 *
 * Investor voting is limited to:
 *   - Major loan modifications (forbearance, rate changes, term extensions)
 *   - Disposition / asset sale approval
 *   - Maturity extension votes
 *   - Reserve/escrow fund release above defined thresholds
 *
 * Quorum and approval thresholds are configurable per token issuance and
 * are mapped to the underlying loan covenants.
 */

import { useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ScaleIcon,
  LockClosedIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Proposal {
  id: string;
  title: string;
  description: string;
  token_symbol: string;
  loan_ref: string;
  property_name: string;
  proposer: string;
  proposer_role: "lender" | "servicer" | "investor";
  trigger: "manual" | "covenant_breach" | "maturity";
  trigger_detail?: string;
  status: "active" | "passed" | "failed" | "pending_execution";
  action_type: "loan_modification" | "disposition" | "maturity_extension" | "reserve_release" | "covenant_waiver";
  quorum_required: number;
  approval_threshold: number;
  voting_power_total: number;
  votes_for: number;
  votes_against: number;
  votes_abstained: number;
  deadline: string;
  created_at: string;
  votes: { investor: string; tokens: number; vote: "for" | "against" | "abstain"; cast_at: string }[];
}

interface ControlRight {
  right: string;
  holder: "lender" | "servicer" | "investor_vote";
  description: string;
}

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_CONTROL_RIGHTS: ControlRight[] = [
  { right: "Loan Modification (Major)",     holder: "investor_vote", description: "Requires 67% supermajority of token-weighted votes. Lender must co-sign." },
  { right: "Loan Modification (Minor)",     holder: "lender",        description: "Lender decides. Servicer notified. Investors receive notice." },
  { right: "Disposition / Asset Sale",      holder: "investor_vote", description: "Requires 75% supermajority. Lender retains veto right." },
  { right: "Maturity Extension",            holder: "investor_vote", description: "Requires 51% majority. Lender must approve final terms." },
  { right: "Reserve Fund Release (>$250K)", holder: "investor_vote", description: "Requires 51% majority. Servicer executes after approval." },
  { right: "Reserve Fund Release (<$250K)", holder: "servicer",      description: "Servicer decides per reserve agreement. Logged to audit trail." },
  { right: "Forbearance Agreement",         holder: "lender",        description: "Lender decides. Investor notice within 5 business days." },
  { right: "Covenant Waiver",               holder: "investor_vote", description: "Requires 67% majority if DSCR waiver. Lender co-sign required." },
  { right: "Insurance Claims",              holder: "servicer",      description: "Servicer manages per servicing agreement." },
  { right: "Inspection & Compliance",       holder: "servicer",      description: "Servicer manages. Annual investor reporting required." },
];

const DEMO_PROPOSALS: Proposal[] = [
  {
    id: "prop-001",
    title: "Loan Modification — DSCR Covenant Waiver (LN-4108)",
    description: "Borrower has requested a temporary waiver of the 1.25x DSCR covenant for Q2 2026 due to renovation-related vacancy. Property occupancy is expected to recover to 95%+ by Q3 2026. Servicer recommends approval with 60-day performance review trigger.",
    token_symbol: "KTRA-4108", loan_ref: "LN-4108", property_name: "Grand Central Offices",
    proposer: "Kontra Servicing",
    proposer_role: "servicer",
    trigger: "covenant_breach",
    trigger_detail: "DSCR dropped to 1.08x in Q1 2026 — below 1.25x covenant threshold",
    status: "active",
    action_type: "covenant_waiver",
    quorum_required: 67,
    approval_threshold: 67,
    voting_power_total: 100,
    votes_for: 52,
    votes_against: 0,
    votes_abstained: 0,
    deadline: "2026-05-05T23:59:00Z",
    created_at: "2026-04-22T09:00:00Z",
    votes: [
      { investor: "Blackstone Real Estate Partners XII LP", tokens: 15000, vote: "for",     cast_at: "2026-04-23T10:30:00Z" },
      { investor: "Meridian Capital Partners LLC",          tokens: 6000,  vote: "abstain", cast_at: "2026-04-23T14:00:00Z" },
    ],
  },
  {
    id: "prop-002",
    title: "Maturity Extension — LN-2847 (6 months)",
    description: "Borrower requests a 6-month extension to the original maturity date of June 1, 2026 to allow time for refinancing in the current rate environment. Extension fee of 0.50% UPB payable upfront. Interest rate increases by 25bps during extension period.",
    token_symbol: "KTRA-2847", loan_ref: "LN-2847", property_name: "The Meridian Apartments",
    proposer: "First National Realty",
    proposer_role: "lender",
    trigger: "maturity",
    trigger_detail: "Loan matures June 1, 2026",
    status: "passed",
    action_type: "maturity_extension",
    quorum_required: 51,
    approval_threshold: 51,
    voting_power_total: 100,
    votes_for: 91,
    votes_against: 0,
    votes_abstained: 9,
    deadline: "2026-04-15T23:59:00Z",
    created_at: "2026-04-01T09:00:00Z",
    votes: [
      { investor: "Blackstone Real Estate Partners XII LP", tokens: 12500, vote: "for",     cast_at: "2026-04-02T11:00:00Z" },
      { investor: "Meridian Capital Partners LLC",          tokens: 5000,  vote: "for",     cast_at: "2026-04-03T09:00:00Z" },
      { investor: "David Park (Individual)",                tokens: 2500,  vote: "abstain", cast_at: "2026-04-05T16:30:00Z" },
    ],
  },
];

const ACTION_LABELS: Record<string, string> = {
  loan_modification: "Loan Modification",
  disposition:       "Disposition",
  maturity_extension:"Maturity Extension",
  reserve_release:   "Reserve Fund Release",
  covenant_waiver:   "Covenant Waiver",
};

const HOLDER_BADGE: Record<string, { label: string; classes: string }> = {
  lender:        { label: "Lender Controlled",  classes: "bg-burgundy-50 text-burgundy-700 bg-rose-50 text-rose-800 border border-rose-200" },
  servicer:      { label: "Servicer Controlled", classes: "bg-amber-50 text-amber-700 border border-amber-200" },
  investor_vote: { label: "Investor Vote",       classes: "bg-violet-50 text-violet-700 border border-violet-200" },
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtPct = (n: number) => n.toFixed(1) + "%";

export default function OnchainGovernancePage() {
  const [activeTab, setActiveTab] = useState<"proposals" | "rights">("proposals");
  const [votingId, setVotingId] = useState<string | null>(null);
  const [voteChoice, setVoteChoice] = useState<"for" | "against" | "abstain">("for");

  const votingProposal = DEMO_PROPOSALS.find((p) => p.id === votingId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Governance</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Lender retains full control rights by default. Investors vote only on predefined actions (loan mods, disposition, maturity extensions) via token-weighted voting. Governance events are automatically triggered by covenant breaches.
        </p>
      </div>

      {/* Control rights summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Lender Controlled", count: DEMO_CONTROL_RIGHTS.filter(r => r.holder === "lender").length, classes: "bg-rose-50 text-rose-800 border border-rose-200" },
          { label: "Servicer Controlled", count: DEMO_CONTROL_RIGHTS.filter(r => r.holder === "servicer").length, classes: "bg-amber-50 text-amber-800 border border-amber-200" },
          { label: "Investor Vote Required", count: DEMO_CONTROL_RIGHTS.filter(r => r.holder === "investor_vote").length, classes: "bg-violet-50 text-violet-800 border border-violet-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.classes}`}>
            <p className="text-xs font-bold uppercase tracking-widest opacity-70">{s.label}</p>
            <p className="text-3xl font-black mt-1 tabular-nums">{s.count}</p>
            <p className="text-xs mt-0.5 opacity-70">rights</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(["proposals", "rights"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "proposals" ? "Active Proposals & Votes" : "Control Rights Matrix"}
          </button>
        ))}
      </div>

      {/* Proposals */}
      {activeTab === "proposals" && (
        <div className="space-y-4">
          {DEMO_PROPOSALS.map((p) => {
            const totalVoted = p.votes_for + p.votes_against + p.votes_abstained;
            const quorumReached = totalVoted >= p.quorum_required;
            const approvalReached = p.voting_power_total > 0 && (p.votes_for / p.voting_power_total) * 100 >= p.approval_threshold;
            const forPct  = p.voting_power_total > 0 ? (p.votes_for / p.voting_power_total) * 100 : 0;
            const againstPct = p.voting_power_total > 0 ? (p.votes_against / p.voting_power_total) * 100 : 0;

            return (
              <div key={p.id} className={`rounded-xl border bg-white overflow-hidden ${p.status === "active" ? "border-violet-200" : "border-slate-200"}`}>
                <div className="p-5 space-y-4">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black tracking-widest text-slate-400">{p.token_symbol}</span>
                        <span className="text-xs text-slate-400">{p.loan_ref} · {p.property_name}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          p.status === "active" ? "bg-violet-50 text-violet-700 border border-violet-200" :
                          p.status === "passed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          p.status === "failed" ? "bg-red-50 text-red-700 border border-red-200" :
                          "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {p.status === "active" ? "Active" : p.status === "passed" ? "Passed" : p.status === "pending_execution" ? "Pending Execution" : "Failed"}
                        </span>
                        <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-bold">
                          {ACTION_LABELS[p.action_type]}
                        </span>
                      </div>
                      <p className="text-base font-bold text-slate-900">{p.title}</p>
                      {p.trigger === "covenant_breach" && p.trigger_detail && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold">
                          <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                          Auto-triggered: {p.trigger_detail}
                        </div>
                      )}
                      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">{p.description}</p>
                    </div>
                  </div>

                  {/* Vote bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Voting Progress — {fmtPct(totalVoted)} voted</span>
                      <span>Quorum: {p.quorum_required}% · Approval: {p.approval_threshold}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: fmtPct(forPct) }} />
                      <div className="h-full bg-red-400 transition-all"   style={{ width: fmtPct(againstPct) }} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />For: {fmtPct(forPct)}</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />Against: {fmtPct(againstPct)}</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" />Abstain: {fmtPct(p.votes_abstained)}</span>
                      <span className="ml-auto">
                        {quorumReached
                          ? <span className="text-emerald-700 font-bold">✓ Quorum reached</span>
                          : <span className="text-amber-700 font-bold">Quorum pending ({fmtPct(p.quorum_required - totalVoted)} more needed)</span>
                        }
                      </span>
                    </div>
                  </div>

                  {/* Individual votes */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Investor", "Voting Power (tokens)", "Vote", "Cast"].map((h) => (
                            <th key={h} className="px-4 py-2 text-left text-xs font-bold uppercase tracking-widest text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {p.votes.map((v, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-sm text-slate-700">{v.investor}</td>
                            <td className="px-4 py-2.5 text-sm font-mono font-bold text-slate-700">{v.tokens.toLocaleString()}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                v.vote === "for"     ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                v.vote === "against" ? "bg-red-50 text-red-700 border border-red-200" :
                                                       "bg-slate-100 text-slate-600"
                              }`}>
                                {v.vote === "for" ? <CheckCircleIcon className="h-3 w-3" /> : v.vote === "against" ? <XCircleIcon className="h-3 w-3" /> : <ClockIcon className="h-3 w-3" />}
                                {v.vote.charAt(0).toUpperCase() + v.vote.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(v.cast_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {p.status === "active" && (
                      <button
                        onClick={() => setVotingId(p.id)}
                        className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 transition-colors"
                      >
                        <ScaleIcon className="h-4 w-4" />
                        Cast Vote
                      </button>
                    )}
                    {p.status === "passed" && (
                      <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors">
                        Execute Proposal
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {p.status === "active" ? `Voting closes ${fmtDate(p.deadline)}` : `Proposal created ${fmtDate(p.created_at)}`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Control Rights Matrix */}
      {activeTab === "rights" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {["Right / Decision", "Controlled By", "Description"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {DEMO_CONTROL_RIGHTS.map((r, i) => {
                const badge = HOLDER_BADGE[r.holder];
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{r.right}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.classes}`}>
                        {r.holder === "lender" ? <LockClosedIcon className="h-3 w-3" /> :
                         r.holder === "servicer" ? <UserGroupIcon className="h-3 w-3" /> :
                         <ScaleIcon className="h-3 w-3" />}
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-lg">{r.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vote modal */}
      {votingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-lg space-y-5">
            <div>
              <h3 className="text-lg font-black text-slate-900">Cast Your Vote</h3>
              <p className="text-sm text-violet-700 font-semibold mt-0.5">{votingProposal.title}</p>
              <p className="text-xs text-slate-500 mt-1">{votingProposal.token_symbol} · {votingProposal.loan_ref}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1">
              <p>Your voting power: <strong>8,000 KTRA-2847 tokens</strong></p>
              <p>Approval threshold: <strong>51% majority</strong></p>
              <p>Voting deadline: <strong>{fmtDate(votingProposal.deadline)}</strong></p>
            </div>
            <div className="space-y-2">
              {(["for", "against", "abstain"] as const).map((choice) => (
                <button
                  key={choice}
                  onClick={() => setVoteChoice(choice)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    voteChoice === choice
                      ? choice === "for"     ? "border-emerald-500 bg-emerald-50"
                      : choice === "against" ? "border-red-400 bg-red-50"
                      :                        "border-slate-400 bg-slate-100"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    voteChoice === choice
                      ? choice === "for" ? "border-emerald-600 bg-emerald-600" : choice === "against" ? "border-red-500 bg-red-500" : "border-slate-600 bg-slate-600"
                      : "border-slate-300"
                  }`}>
                    {voteChoice === choice && <span className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <span className={`text-sm font-bold capitalize ${
                    voteChoice === choice
                      ? choice === "for" ? "text-emerald-800" : choice === "against" ? "text-red-800" : "text-slate-800"
                      : "text-slate-600"
                  }`}>{choice}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setVotingId(null); alert(`Vote "${voteChoice}" cast successfully. Your vote is recorded on-chain and in the governance audit trail.`); }}
                className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-800 transition-colors"
              >
                Confirm Vote
              </button>
              <button onClick={() => setVotingId(null)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
