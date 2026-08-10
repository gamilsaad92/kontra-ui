/**
 * Settlement Readiness Panel — all four states
 * Traditional | Digital | Tokenized | Completed/Sealed
 */
import React, { useState } from "react";

// ── Shared sub-components (self-contained, no API calls) ──────────────────────

function ScoreRing({ pct, allMet }: { pct: number; allMet: boolean }) {
  const r = 40, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = allMet ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626";
  return (
    <div className="relative flex items-center justify-center" style={{ width: 104, height: 104 }}>
      <svg width={104} height={104} viewBox="0 0 104 104">
        <circle cx={52} cy={52} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
        <circle cx={52} cy={52} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 52 52)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
        <span className="text-[10px] text-gray-400 mt-0.5">ready</span>
      </div>
    </div>
  );
}

function ConditionRow({ cond }: { cond: any }) {
  const { label, type, status, met, role } = cond;
  let icon = "○", clr = "text-gray-400";
  if (met) { icon = "✓"; clr = "text-green-600"; }
  else if (status === "needs_review") { icon = "◐"; clr = "text-amber-500"; }
  else if (status === "pending") { icon = "…"; clr = "text-amber-500"; }
  const tagBg = type === "approval" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-600";
  const tagText = type === "approval" ? `Sign-off: ${role || "Required"}` : "Field";
  return (
    <div className={`flex items-start gap-3 py-2.5 px-3 rounded-xl ${met ? "bg-green-50/50" : "bg-white"} border ${met ? "border-green-100" : "border-gray-100"}`}>
      <span className={`text-base font-bold mt-0.5 flex-shrink-0 ${clr}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tagBg}`}>{tagText}</span>
        </div>
        {!met && (
          <p className="text-xs text-gray-400 mt-0.5">
            {type === "approval" ? "Awaiting approval sign-off" :
             status === "needs_review" ? "Uploaded but needs verification" :
             "Missing — add via Transaction Record"}
          </p>
        )}
      </div>
      <span className="text-xs text-gray-300 flex-shrink-0 mt-1">
        {met ? "Verified" : status === "needs_review" ? "Review" : type === "approval" ? "Pending" : "Missing"}
      </span>
    </div>
  );
}

const MODES = [
  { id: "traditional", label: "Traditional", icon: "🏦", chip: "Wire / Escrow / ACH" },
  { id: "digital",     label: "Digital",     icon: "💱", chip: "Rail-agnostic" },
  { id: "tokenized",   label: "Tokenized",   icon: "🪙", chip: "Token issuance" },
];

// ── Panel mock data for each state ────────────────────────────────────────────

const TRADITIONAL_CONDS = [
  { key: "settlement.provider",             label: "Settlement Provider",         type: "field",    status: "verified",     met: true },
  { key: "settlement.rail",                 label: "Settlement Rail",             type: "field",    status: "verified",     met: true },
  { key: "settlement.asset_currency",       label: "Settlement Asset / Currency", type: "field",    status: "verified",     met: true },
  { key: "settlement.destination_reference",label: "Destination Reference",       type: "field",    status: "needs_review", met: false },
  { key: "settlement.funding_confirmed",    label: "Funding Confirmed",           type: "field",    status: "missing",      met: false },
  { key: "settlement.settlement_date",      label: "Settlement Date",             type: "field",    status: "missing",      met: false },
  { key: "settlement.evidence_doc_ref",     label: "Settlement Evidence",         type: "field",    status: "missing",      met: false },
  { key: "settlement.coordinator_approval", label: "Coordinator Approval",        type: "approval", status: "pending",      met: false, role: "Deal Coordinator" },
  { key: "settlement.legal_approval",       label: "Legal Counsel Approval",      type: "approval", status: "pending",      met: false, role: "Legal Counsel" },
];

const DIGITAL_CONDS = [
  { key: "settlement.provider",             label: "Settlement Provider",         type: "field",    status: "verified",     met: true },
  { key: "settlement.rail",                 label: "Settlement Rail",             type: "field",    status: "verified",     met: true },
  { key: "settlement.asset_currency",       label: "Settlement Asset / Currency", type: "field",    status: "verified",     met: true },
  { key: "settlement.destination_reference",label: "Destination Reference",       type: "field",    status: "verified",     met: true },
  { key: "settlement.expected_amount",      label: "Expected Settlement Amount",  type: "field",    status: "needs_review", met: false },
  { key: "settlement.coordinator_approval", label: "Coordinator Approval",        type: "approval", status: "approved",     met: true,  role: "Deal Coordinator" },
  { key: "settlement.compliance_approval",  label: "Compliance Approval",         type: "approval", status: "pending",      met: false, role: "Compliance Officer" },
];

const TOKENIZED_CONDS = [
  { key: "settlement.provider",              label: "Settlement Provider",         type: "field",    status: "verified", met: true },
  { key: "settlement.rail",                  label: "Settlement Rail",             type: "field",    status: "verified", met: true },
  { key: "settlement.asset_currency",        label: "Settlement Asset / Currency", type: "field",    status: "verified", met: true },
  { key: "settlement.destination_reference", label: "Destination Reference",       type: "field",    status: "verified", met: true },
  { key: "settlement.token_type",            label: "Token Type",                  type: "field",    status: "verified", met: true },
  { key: "settlement.issuance_provider",     label: "Issuance Provider",           type: "field",    status: "verified", met: true },
  { key: "settlement.whitelist_confirmed",   label: "KYC / Whitelist Confirmed",   type: "field",    status: "verified", met: true },
  { key: "settlement.legal_opinion_present", label: "Legal Opinion Uploaded",      type: "field",    status: "verified", met: true },
  { key: "settlement.coordinator_approval",  label: "Coordinator Approval",        type: "approval", status: "approved", met: true,  role: "Deal Coordinator" },
  { key: "settlement.legal_approval",        label: "Legal Counsel Approval",      type: "approval", status: "approved", met: true,  role: "Legal Counsel" },
  { key: "settlement.compliance_approval",   label: "Compliance Approval",         type: "approval", status: "approved", met: true,  role: "Compliance Officer" },
];

function computeScore(conds: any[]) {
  let total = 0, earned = 0;
  for (const c of conds) { total++; if (c.met) earned += 1.0; else if (c.status === "needs_review") earned += 0.5; }
  return Math.round(earned / total * 100);
}

// ── Individual panel states ────────────────────────────────────────────────────

function PanelShell({ title, badge, borderColor = "border-gray-200", children }: any) {
  return (
    <div className={`bg-white rounded-2xl border ${borderColor} px-6 py-5 space-y-5`}>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {badge && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function ModeBar({ selected }: { selected: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Settlement Mode</p>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map(m => {
          const isSelected = m.id === selected;
          return (
            <div key={m.id} className={`rounded-xl border px-3 py-3 text-left ${isSelected ? "border-gray-800 bg-gray-900 text-white" : "border-gray-100 bg-gray-50 text-gray-400"}`}>
              <div className="text-lg mb-1">{m.icon}</div>
              <div className={`text-xs font-bold ${isSelected ? "text-white" : "text-gray-400"}`}>{m.label}</div>
              <div className={`text-[10px] mt-0.5 ${isSelected ? "text-gray-300" : "text-gray-300"}`}>{m.chip}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConditionsList({ conds }: { conds: any[] }) {
  const fields = conds.filter(c => c.type === "field");
  const approvals = conds.filter(c => c.type === "approval");
  const verified = conds.filter(c => c.met).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Required Conditions</p>
        <p className="text-xs text-gray-400">{verified} / {conds.length} verified</p>
      </div>
      {fields.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide px-1">Settlement Fields</p>
          {fields.map(c => <ConditionRow key={c.key} cond={c} />)}
        </div>
      )}
      {approvals.length > 0 && (
        <div className="space-y-1.5 mt-2">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide px-1">Required Approvals</p>
          {approvals.map(c => <ConditionRow key={c.key} cond={c} />)}
        </div>
      )}
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
      <p className="text-[10px] text-gray-400 leading-relaxed">
        <strong>Kontra is a coordination platform.</strong> This panel tracks and verifies readiness — it does not execute, settle, or transmit funds, assets, or tokens. Nothing here constitutes legal, financial, or regulatory advice.
      </p>
    </div>
  );
}

// ── State 1: Traditional (33% — several missing) ─────────────────────────────

function TraditionalPanel() {
  const pct = computeScore(TRADITIONAL_CONDS);
  const allMet = false;
  const unmet = TRADITIONAL_CONDS.filter(c => !c.met);
  return (
    <PanelShell title="Settlement Readiness" badge="Traditional">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 mt-0.5">Verify all conditions before completing. Score is informational — completion requires all fields verified and all approvals granted.</p>
        </div>
        <ScoreRing pct={pct} allMet={allMet} />
      </div>
      <ModeBar selected="traditional" />
      <p className="text-xs text-gray-500">Standard banking rails — wire transfer, ACH, escrow, or similar established settlement channels.</p>
      <ConditionsList conds={TRADITIONAL_CONDS} />
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <p className="text-xs text-amber-700 font-semibold mb-1.5">{unmet.length} conditions remaining before completion</p>
          <ul className="text-xs text-amber-600 space-y-0.5">
            {unmet.slice(0, 4).map(u => <li key={u.key} className="flex items-center gap-1.5"><span>○</span> {u.label}</li>)}
            {unmet.length > 4 && <li className="text-amber-400">+{unmet.length - 4} more</li>}
          </ul>
        </div>
        <button disabled className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-100 text-gray-400 text-sm font-bold cursor-not-allowed">
          ✅ Complete Transaction — Conditions Pending
        </button>
      </div>
      <Disclaimer />
    </PanelShell>
  );
}

// ── State 2: Digital (75% — most done, one pending approval) ─────────────────

function DigitalPanel() {
  const pct = computeScore(DIGITAL_CONDS);
  const allMet = false;
  const unmet = DIGITAL_CONDS.filter(c => !c.met);
  return (
    <PanelShell title="Settlement Readiness" badge="Digital">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 mt-0.5">Verify all conditions before completing. Score is informational — completion requires all fields verified and all approvals granted.</p>
        </div>
        <ScoreRing pct={pct} allMet={allMet} />
      </div>
      <ModeBar selected="digital" />
      <p className="text-xs text-gray-500">Provider-neutral digital settlement interface. Kontra records settlement references only — no chain connectivity in Phase 1.</p>
      <ConditionsList conds={DIGITAL_CONDS} />
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <p className="text-xs text-amber-700 font-semibold mb-1.5">{unmet.length} condition{unmet.length !== 1 ? "s" : ""} remaining before completion</p>
          <ul className="text-xs text-amber-600 space-y-0.5">
            {unmet.map(u => <li key={u.key} className="flex items-center gap-1.5"><span>○</span> {u.label}</li>)}
          </ul>
        </div>
        <button disabled className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-100 text-gray-400 text-sm font-bold cursor-not-allowed">
          ✅ Complete Transaction — Conditions Pending
        </button>
      </div>
      <Disclaimer />
    </PanelShell>
  );
}

// ── State 3: Tokenized (100% — all met, CTA active) ───────────────────────────

function TokenizedPanel() {
  const pct = computeScore(TOKENIZED_CONDS);
  const allMet = true;
  return (
    <PanelShell title="Settlement Readiness" badge="Tokenized">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 mt-0.5">Verify all conditions before completing. Score is informational — completion requires all fields verified and all approvals granted.</p>
        </div>
        <ScoreRing pct={pct} allMet={allMet} />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Settlement Mode</p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">🔒 Locked</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(m => {
            const isSel = m.id === "tokenized";
            return (
              <div key={m.id} className={`rounded-xl border px-3 py-3 text-left ${isSel ? "border-gray-800 bg-gray-900" : "border-gray-100 bg-gray-50 cursor-not-allowed"}`}>
                <div className="text-lg mb-1">{m.icon}</div>
                <div className={`text-xs font-bold ${isSel ? "text-white" : "text-gray-300"}`}>{m.label}</div>
                <div className={`text-[10px] mt-0.5 ${isSel ? "text-gray-300" : "text-gray-200"}`}>{m.chip}</div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">Settlement via token issuance. Requires token type, issuance provider, KYC whitelist confirmation, and legal opinion.</p>
      </div>
      <ConditionsList conds={TOKENIZED_CONDS} />
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm text-green-800 font-semibold">All conditions verified ✓</p>
          <p className="text-xs text-green-600 mt-0.5">All required settlement conditions are confirmed. You can now create the Transaction Seal to complete this workspace.</p>
        </div>
        <button className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-all">
          ✅ Complete Transaction — Create Seal
        </button>
        <p className="text-[10px] text-gray-400 text-center px-2">Creating the seal makes the transaction record immutable. Documents can still be added as post-completion records. This action cannot be undone.</p>
      </div>
      <Disclaimer />
    </PanelShell>
  );
}

// ── State 4: Completed / Sealed ────────────────────────────────────────────────

function SealedPanel() {
  const sealedAt = new Date("2026-08-10T05:43:00Z").toLocaleString();
  const verifiedConditions = TOKENIZED_CONDS.map(c => ({ key: c.key, label: c.label, type: c.type }));
  return (
    <div className="bg-white rounded-2xl border border-green-200 px-6 py-5 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-gray-900">Settlement — Transaction Sealed</h2>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Complete</span>
      </div>

      {/* Sealed view */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">✅</span>
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Transaction Sealed</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            This workspace reached settlement on {sealedAt}. The Transaction Seal is a permanent digital record of verified conditions — it is not a legal instrument.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Settlement Mode",     value: "Tokenized" },
          { label: "Conditions Verified", value: `${verifiedConditions.length} / ${verifiedConditions.length}` },
          { label: "Sealed At",           value: sealedAt },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Verified at sealing</p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {verifiedConditions.map(c => (
            <div key={c.key} className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-green-500">✓</span>
              <span>{c.label}</span>
              <span className="text-xs text-gray-400 ml-1">{c.type}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
        <p className="text-xs text-amber-700">
          <strong>Post-Completion Documents:</strong> New documents uploaded to this workspace after sealing are recorded in the Post-Completion Records section and do not affect the sealed Transaction Record.
        </p>
      </div>

      <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-xl border border-gray-200 hover:border-gray-300 transition-all">
        <span>📄</span> View Seal Record
      </button>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Settlement_Sealed() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-lg mx-auto">
        <p className="text-xs text-gray-400 mb-3 font-mono">State: Completed / Sealed — mock data, no API calls</p>
        <SealedPanel />
      </div>
    </div>
  );
}
