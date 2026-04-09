import { ShieldCheckIcon, ScaleIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const ROLES = [
  {
    key: "lender_controller",
    label: "Lender Controller",
    color: "bg-brand-600 text-white",
    dot: "bg-brand-600",
    description: "Ultimate authority over all servicing and governance. Sets policy.",
    canService: true,
    canVote: true,
    canPropose: true,
    canEnforce: true,
  },
  {
    key: "master_servicer",
    label: "Master Servicer",
    color: "bg-blue-600 text-white",
    dot: "bg-blue-500",
    description: "Day-to-day servicing: payments, draws, escrows, routine notices.",
    canService: true,
    canVote: false,
    canPropose: true,
    canEnforce: false,
  },
  {
    key: "special_servicer",
    label: "Special Servicer",
    color: "bg-amber-600 text-white",
    dot: "bg-amber-500",
    description: "Activated on default. Manages workout, REO, enforcement.",
    canService: true,
    canVote: false,
    canPropose: true,
    canEnforce: true,
  },
  {
    key: "asset_manager",
    label: "Asset Manager",
    color: "bg-emerald-600 text-white",
    dot: "bg-emerald-500",
    description: "Asset strategy, portfolio reporting, investor relations.",
    canService: false,
    canVote: false,
    canPropose: true,
    canEnforce: false,
  },
  {
    key: "investor",
    label: "Investor",
    color: "bg-violet-600 text-white",
    dot: "bg-violet-500",
    description: "Voting rights on major economic decisions only. No servicing access.",
    canService: false,
    canVote: true,
    canPropose: false,
    canEnforce: false,
  },
  {
    key: "admin",
    label: "Admin",
    color: "bg-slate-600 text-white",
    dot: "bg-slate-500",
    description: "Platform administration. Cannot override servicing decisions.",
    canService: false,
    canVote: false,
    canPropose: false,
    canEnforce: false,
  },
];

const LENDER_CONTROLLED = [
  {
    action: "Payment Processing",
    description: "Collect, apply, and record borrower payments",
    layer: "Kontra Backend",
    trigger: "Scheduled / Manual",
  },
  {
    action: "Escrow Management",
    description: "Tax, insurance, and reserve escrow disbursements",
    layer: "Kontra Backend",
    trigger: "Threshold / Schedule",
  },
  {
    action: "Draw Requests",
    description: "Approve and fund construction or renovation draws",
    layer: "Kontra Backend",
    trigger: "Servicer Approval",
  },
  {
    action: "Forbearance & Modifications",
    description: "Grant temporary payment relief or restructure terms",
    layer: "Kontra Backend",
    trigger: "Servicer Decision",
  },
  {
    action: "Enforcement / Foreclosure",
    description: "Initiate legal enforcement on defaulted loans",
    layer: "Kontra Backend",
    trigger: "Special Servicer",
  },
  {
    action: "Notice Issuance",
    description: "Default notices, cure letters, demand letters",
    layer: "Kontra Backend",
    trigger: "Automated / Manual",
  },
  {
    action: "Servicer Transfers",
    description: "Transfer primary servicing between servicers",
    layer: "Kontra Backend",
    trigger: "Lender Controller",
  },
  {
    action: "Compliance Reporting",
    description: "Regulatory filings, DSCR monitoring, covenant tracking",
    layer: "Kontra Backend",
    trigger: "Automated",
  },
];

const INVESTOR_VOTABLE = [
  {
    action: "Loan Extension > 12 Months",
    description: "Major maturity extensions beyond 12 months require investor ratification",
    threshold: "66.7%",
    quorum: "50%",
    onChain: true,
  },
  {
    action: "Rate Modification > 10%",
    description: "Significant interest rate changes that materially affect investor returns",
    threshold: "60%",
    quorum: "40%",
    onChain: true,
  },
  {
    action: "Collateral Disposition",
    description: "Sale, release, or substitution of collateral securing the loan",
    threshold: "75%",
    quorum: "50%",
    onChain: true,
  },
  {
    action: "Distribution Policy Changes",
    description: "Changes to waterfall, priority, or distribution frequency",
    threshold: "66.7%",
    quorum: "50%",
    onChain: true,
  },
  {
    action: "Primary Servicer Replacement",
    description: "Replacing the master servicer (not emergency special servicer transfer)",
    threshold: "60%",
    quorum: "40%",
    onChain: true,
  },
  {
    action: "Workout Strategy Approval",
    description: "Major distressed loan workout plans above materiality threshold",
    threshold: "55%",
    quorum: "35%",
    onChain: true,
  },
];

const MATRIX_COLS = [
  { key: "canService", label: "Servicing Actions" },
  { key: "canEnforce", label: "Enforcement" },
  { key: "canPropose", label: "Propose Governance" },
  { key: "canVote", label: "Vote on Proposals" },
];

export default function LoanControlPage() {
  return (
    <div className="space-y-8">

      {/* ── Page Header ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Loan Control Architecture</h2>
            <p className="mt-1 text-sm text-slate-500 max-w-2xl">
              Investors may influence major economic outcomes through governance proposals and binding votes.
              They must never directly control loan servicing, enforcement, or compliance decisions —
              those remain exclusively with the Kontra execution layer.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white whitespace-nowrap self-start">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Execution Layer: Kontra Backend
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
            <LockClosedIcon className="h-3.5 w-3.5" />
            Servicing decisions: checked against legal docs + servicing rules before execution
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
            <ScaleIcon className="h-3.5 w-3.5" />
            Governance outcomes: recorded on blockchain; enforced by Kontra backend
          </div>
        </div>
      </div>

      {/* ── Main Split: Protected vs Votable ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* LEFT: Lender Controlled */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-900 px-6 py-4">
            <LockClosedIcon className="h-5 w-5 text-white" />
            <div>
              <p className="text-sm font-black text-white uppercase tracking-widest">
                Lender Controlled
              </p>
              <p className="text-xs text-slate-400">Protected — investors cannot touch these</p>
            </div>
            <span className="ml-auto rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white">
              PROTECTED
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {LENDER_CONTROLLED.map((item) => (
              <div key={item.action} className="flex items-start gap-3 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100">
                  <LockClosedIcon className="h-2.5 w-2.5 text-brand-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {item.layer}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      Trigger: {item.trigger}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="h-3.5 w-3.5 text-amber-500" />
              Every action logged to audit trail with actor, role, timestamp, and decision category
            </p>
          </div>
        </div>

        {/* RIGHT: Investor Votable */}
        <div className="rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-violet-100 bg-violet-600 px-6 py-4">
            <ScaleIcon className="h-5 w-5 text-white" />
            <div>
              <p className="text-sm font-black text-white uppercase tracking-widest">
                Investor Votable
              </p>
              <p className="text-xs text-violet-200">Major economic outcomes — require governance proposal</p>
            </div>
            <span className="ml-auto rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white">
              GOVERNANCE
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {INVESTOR_VOTABLE.map((item) => (
              <div key={item.action} className="flex items-start gap-3 px-6 py-4 hover:bg-violet-50/40 transition-colors">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100">
                  <ScaleIcon className="h-2.5 w-2.5 text-violet-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                      Threshold: {item.threshold}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      Quorum: {item.quorum}
                    </span>
                    {item.onChain && (
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        On-chain recorded
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-violet-100 bg-violet-50 px-6 py-3">
            <p className="text-xs text-violet-600 flex items-center gap-1.5">
              <ScaleIcon className="h-3.5 w-3.5" />
              Outcomes written to blockchain; Kontra backend executes only after legal doc verification
            </p>
          </div>
        </div>
      </div>

      {/* ── Role Permissions Matrix ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">Role Permissions Matrix</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Six distinct roles with clearly separated servicing, governance, and enforcement capabilities
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400 w-48">Role</th>
                {MATRIX_COLS.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                    {col.label}
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-400">Responsibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ROLES.map((role) => (
                <tr key={role.key} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${role.dot}`} />
                      <span className="font-semibold text-slate-900 text-sm">{role.label}</span>
                    </div>
                  </td>
                  {MATRIX_COLS.map((col) => (
                    <td key={col.key} className="px-4 py-4 text-center">
                      {role[col.key as keyof typeof role] ? (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
                      ) : (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-xs text-slate-500 max-w-xs">{role.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Smart Contract Boundary ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">Smart Contract Boundary</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            The token contract never controls servicing. It is a record-keeping and voting layer only.
          </p>
        </div>
        <div className="grid gap-0 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="px-6 py-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <span className="text-sm font-black text-emerald-700">⛓</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">What lives on-chain</p>
                <p className="text-xs text-slate-500">Blockchain as record layer</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {[
                "Token ownership and transfer history",
                "Voting records — who voted, how, when",
                "Proposal outcomes (approved / rejected)",
                "Distribution events and amounts",
                "Governance quorum certifications",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 text-emerald-500 font-bold text-xs">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="px-6 py-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-brand-100 flex items-center justify-center">
                <LockClosedIcon className="h-4 w-4 text-brand-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">What stays off-chain</p>
                <p className="text-xs text-slate-500">Kontra backend as execution layer</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {[
                "Payment processing and application",
                "Escrow calculations and disbursements",
                "Draw approvals and funding",
                "Enforcement and foreclosure decisions",
                "Legal document verification before any action",
                "Servicing rule compliance checks",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <LockClosedIcon className="mt-1 h-3 w-3 text-brand-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
          <p className="text-xs text-slate-500">
            <strong className="text-slate-700">Developer rule:</strong>{" "}
            Investors can influence major economic outcomes through on-chain votes, but must never directly
            call servicing functions. The Kontra backend is the sole execution layer — it reads the
            on-chain governance outcome and then decides whether to act, checking legal docs and
            servicing agreements first.
          </p>
        </div>
      </div>

    </div>
  );
}
