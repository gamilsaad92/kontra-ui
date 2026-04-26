/**
 * Cap Table / Transfer Agent Module
 *
 * Kontra acts as the off-chain Transfer Agent, maintaining the authoritative
 * ownership record for all tokenized loan positions. Every transfer is:
 *   1. Compliance-checked (KYC, Reg D lockup, whitelist)
 *   2. Recorded on-chain as a token event
 *   3. Reconciled against the off-chain servicing record
 *
 * Transfer restrictions enforced:
 *   - Reg D 12-month lock from issuance
 *   - Reg S 40-day distribution compliance + 12-month restricted period
 *   - Whitelist-only: receiving wallet must be in the verified investor registry
 *   - 2,000-holder limit (Reg D / Section 12(g) threshold)
 */

import { useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Holding {
  investor_name: string;
  entity_type: string;
  wallet: string;
  token_symbol: string;
  loan_ref: string;
  shares: number;
  total_supply: number;
  acquisition_date: string;
  lockup_expires: string | null;
  restriction_type: "reg_d_506c" | "reg_d_506b" | "reg_s" | "institutional";
  lockup_active: boolean;
  freely_transferable: boolean;
}

interface PendingTransfer {
  id: string;
  token_symbol: string;
  loan_ref: string;
  from_investor: string;
  to_investor: string;
  amount: number;
  requested_at: string;
  compliance_status: "approved" | "pending" | "blocked";
  block_reason?: string;
}

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_HOLDINGS: Holding[] = [
  { investor_name: "Blackstone Real Estate Partners XII LP", entity_type: "Fund",       wallet: "0x3A4B...C8D1", token_symbol: "KTRA-2847", loan_ref: "LN-2847", shares: 12500, total_supply: 42000, acquisition_date: "2026-01-15", lockup_expires: null,         restriction_type: "institutional", lockup_active: false, freely_transferable: true  },
  { investor_name: "Meridian Capital Partners LLC",          entity_type: "Entity",      wallet: "0x7F2A...B3E9", token_symbol: "KTRA-2847", loan_ref: "LN-2847", shares: 5000,  total_supply: 42000, acquisition_date: "2026-02-01", lockup_expires: "2027-02-01", restriction_type: "reg_d_506c",  lockup_active: true,  freely_transferable: false },
  { investor_name: "David Park (Individual)",                entity_type: "Individual",  wallet: "0x9C1D...F4A2", token_symbol: "KTRA-2847", loan_ref: "LN-2847", shares: 2500,  total_supply: 42000, acquisition_date: "2025-11-10", lockup_expires: "2026-11-10", restriction_type: "reg_d_506b",  lockup_active: true,  freely_transferable: false },
  { investor_name: "Blackstone Real Estate Partners XII LP", entity_type: "Fund",       wallet: "0x3A4B...C8D1", token_symbol: "KTRA-3201", loan_ref: "LN-3201", shares: 8000,  total_supply: 28000, acquisition_date: "2026-01-15", lockup_expires: null,         restriction_type: "institutional", lockup_active: false, freely_transferable: true  },
  { investor_name: "Meridian Capital Partners LLC",          entity_type: "Entity",      wallet: "0x7F2A...B3E9", token_symbol: "KTRA-5593", loan_ref: "LN-5593", shares: 3000,  total_supply: 20000, acquisition_date: "2026-02-01", lockup_expires: "2027-02-01", restriction_type: "reg_d_506c",  lockup_active: true,  freely_transferable: false },
  { investor_name: "Harrington Global Fund (Cayman Islands)",entity_type: "Offshore Fund",wallet: "0x5E8C...A1F7", token_symbol: "KTRA-0728", loan_ref: "LN-0728", shares: 10000, total_supply: 32000, acquisition_date: "2026-01-22", lockup_expires: "2027-01-22", restriction_type: "reg_s",       lockup_active: true,  freely_transferable: false },
];

const DEMO_PENDING_TRANSFERS: PendingTransfer[] = [
  {
    id: "tx-001",
    token_symbol: "KTRA-2847", loan_ref: "LN-2847",
    from_investor: "Blackstone Real Estate Partners XII LP",
    to_investor: "Pacific Ventures Capital LP",
    amount: 3000,
    requested_at: "2026-04-20T09:15:00Z",
    compliance_status: "approved",
  },
  {
    id: "tx-002",
    token_symbol: "KTRA-2847", loan_ref: "LN-2847",
    from_investor: "Meridian Capital Partners LLC",
    to_investor: "Sunrise Investment Group LLC",
    amount: 1500,
    requested_at: "2026-04-22T14:30:00Z",
    compliance_status: "blocked",
    block_reason: "Reg D 12-month lockup has not expired. Lockup expires 2027-02-01. Transfer blocked by transfer hook.",
  },
  {
    id: "tx-003",
    token_symbol: "KTRA-0728", loan_ref: "LN-0728",
    from_investor: "Harrington Global Fund (Cayman Islands)",
    to_investor: "Continental Asset Management (Singapore)",
    amount: 2000,
    requested_at: "2026-04-23T11:00:00Z",
    compliance_status: "pending",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const RESTRICTION_LABEL: Record<string, string> = {
  institutional: "Institutional (QIB)",
  reg_d_506c:    "Reg D 506(c)",
  reg_d_506b:    "Reg D 506(b)",
  reg_s:         "Reg S (Offshore)",
};

const TRANSFER_STATUS: Record<string, { label: string; classes: string; icon: typeof CheckCircleIcon }> = {
  approved: { label: "Approved",      classes: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircleIcon },
  pending:  { label: "Under Review",  classes: "bg-amber-50 text-amber-700 border border-amber-200",     icon: ClockIcon },
  blocked:  { label: "Blocked",       classes: "bg-red-50 text-red-700 border border-red-200",           icon: XCircleIcon },
};

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const pct = (s: number, t: number) => ((s / t) * 100).toFixed(1) + "%";

// ── Token-level summaries ──────────────────────────────────────────────────────
const TOKEN_SUMMARIES = [
  { symbol: "KTRA-2847", loan_ref: "LN-2847", property: "The Meridian Apartments", supply: 42000, holders: 3, locked: 7500, transferable: 12500, upb: 4_112_500 },
  { symbol: "KTRA-3201", loan_ref: "LN-3201", property: "Rosewood Medical Plaza",   supply: 28000, holders: 1, locked: 0,    transferable: 8000,  upb: 6_875_000 },
  { symbol: "KTRA-5593", loan_ref: "LN-5593", property: "Harbour Square Retail",    supply: 20000, holders: 1, locked: 3000, transferable: 0,     upb: 3_400_000 },
  { symbol: "KTRA-0728", loan_ref: "LN-0728", property: "Pacific Vista Industrial", supply: 32000, holders: 1, locked: 10000,transferable: 0,     upb: 5_250_000 },
];

export default function OnchainCapTablePage() {
  const [activeToken, setActiveToken] = useState("KTRA-2847");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const tokenSummary = TOKEN_SUMMARIES.find((t) => t.symbol === activeToken)!;
  const tokenHoldings = DEMO_HOLDINGS.filter((h) => h.token_symbol === activeToken);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Cap Table & Transfer Agent</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Authoritative ownership record for all tokenized loan positions. Transfer restrictions are enforced at the smart contract level — Reg D lockups and whitelist checks block non-compliant trades.
        </p>
      </div>

      {/* Token selector */}
      <div className="flex gap-2 flex-wrap">
        {TOKEN_SUMMARIES.map((t) => (
          <button
            key={t.symbol}
            onClick={() => setActiveToken(t.symbol)}
            className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${
              activeToken === t.symbol
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            <p className="text-xs font-black tracking-widest">{t.symbol}</p>
            <p className={`text-xs mt-0.5 ${activeToken === t.symbol ? "text-slate-300" : "text-slate-500"}`}>{t.loan_ref}</p>
          </button>
        ))}
      </div>

      {/* Token summary */}
      {tokenSummary && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">{tokenSummary.symbol}</p>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">{tokenSummary.property}</h3>
              <p className="text-xs text-slate-500">{tokenSummary.loan_ref} · UPB ${(tokenSummary.upb).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1">
                {tokenSummary.holders} holder{tokenSummary.holders !== 1 ? "s" : ""}
              </span>
              <span className="rounded-full bg-slate-100 text-slate-600 px-3 py-1">
                {tokenSummary.supply.toLocaleString()} total supply
              </span>
              <span className={`rounded-full px-3 py-1 ${tokenSummary.locked > 0 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                {tokenSummary.locked.toLocaleString()} locked
              </span>
            </div>
          </div>
          {/* Lock bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Transfer Status Distribution</span>
              <span>{pct(tokenSummary.locked, tokenSummary.supply)} restricted · {pct(tokenSummary.transferable, tokenSummary.supply)} freely transferable</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
              <div className="h-full bg-amber-400" style={{ width: pct(tokenSummary.locked, tokenSummary.supply) }} />
              <div className="h-full bg-emerald-500" style={{ width: pct(tokenSummary.transferable, tokenSummary.supply) }} />
            </div>
            <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Restricted (Reg D / Reg S lockup)</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Freely Transferable (Whitelist-gated)</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-200" />Unallocated</span>
            </div>
          </div>
        </div>
      )}

      {/* Holdings table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-2">Current Holders — {activeToken}</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {["Investor", "Type", "Wallet", "Shares", "Ownership %", "Acquired", "Lockup Expires", "Exemption", "Transferable"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tokenHoldings.map((h, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">{h.investor_name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{h.entity_type}</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">{h.wallet}</span></td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-800 tabular-nums">{h.shares.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-700 tabular-nums">{pct(h.shares, h.total_supply)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{fmtDate(h.acquisition_date)}</td>
                  <td className="px-4 py-3">
                    {h.lockup_active ? (
                      <div className="flex items-center gap-1.5">
                        <LockClosedIcon className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs font-bold text-amber-700">{fmtDate(h.lockup_expires)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600 whitespace-nowrap">{RESTRICTION_LABEL[h.restriction_type]}</td>
                  <td className="px-4 py-3">
                    {h.freely_transferable
                      ? <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                      : <LockClosedIcon className="h-5 w-5 text-amber-400" />
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Transfers */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <ArrowsRightLeftIcon className="h-4 w-4" />
          Pending Transfer Requests
        </h3>
        <div className="space-y-3">
          {DEMO_PENDING_TRANSFERS.map((tx) => {
            const badge = TRANSFER_STATUS[tx.compliance_status];
            const TxIcon = badge.icon;
            return (
              <div key={tx.id} className={`rounded-xl border p-4 ${tx.compliance_status === "blocked" ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black tracking-widest text-slate-400">{tx.token_symbol}</span>
                      <span className="text-xs text-slate-400">{tx.loan_ref}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.classes}`}>
                        <TxIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold">{tx.amount.toLocaleString()} tokens</span> from{" "}
                      <span className="font-semibold">{tx.from_investor}</span> →{" "}
                      <span className="font-semibold">{tx.to_investor}</span>
                    </p>
                    {tx.block_reason && (
                      <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 mt-1">
                        <ExclamationTriangleIcon className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700">{tx.block_reason}</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-400">Requested {new Date(tx.requested_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tx.compliance_status === "pending" && (
                      <>
                        <button
                          onClick={() => setApprovingId(tx.id)}
                          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors"
                        >
                          Approve
                        </button>
                        <button className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 transition-colors">Block</button>
                      </>
                    )}
                    {tx.compliance_status === "approved" && (
                      <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition-colors">Execute Transfer</button>
                    )}
                    <button className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">View</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Regulatory note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-xs font-bold text-slate-600 mb-1">Transfer Agent Compliance</p>
        <p className="text-xs text-slate-500">
          Kontra acts as the off-chain Transfer Agent per SEC Rule 17Ad-7. Every secondary transfer is validated against: (1) Reg D 12-month restriction period, (2) Reg S 40-day distribution compliance and 12-month U.S. market restriction, (3) Whitelist registry — receiving wallet must be a verified eligible investor. The 2,000-holder cap (Section 12(g) trigger) is enforced automatically. All transfers are recorded as immutable events on both the off-chain servicing ledger and the token contract.
        </p>
      </div>

      {approvingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-md space-y-4">
            <h3 className="text-lg font-black text-slate-900">Approve Transfer</h3>
            <p className="text-sm text-slate-600">Compliance checks passed. Confirm to execute the token transfer and update the cap table.</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1">
              <p>✓ Receiving wallet is in verified whitelist</p>
              <p>✓ Receiving investor KYC/AML status: Verified</p>
              <p>✓ No Reg D lockup on transferring party</p>
              <p>✓ Holder count remains within Section 12(g) limit</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setApprovingId(null); alert("Transfer approved and executed. Cap table updated. On-chain event recorded."); }}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 transition-colors"
              >
                Confirm & Execute
              </button>
              <button onClick={() => setApprovingId(null)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
