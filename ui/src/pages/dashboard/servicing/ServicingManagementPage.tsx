import { useState } from "react";
import { useServicingContext } from "./ServicingContext";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";

type MgmtStatus = "current" | "pending_change" | "expired" | "review";

type PropertyManager = {
  loan_ref: string;
  borrower: string;
  property: string;
  type: string;
  management_company: string;
  agreement_expires: string;
  agreement_start: string;
  management_fee_pct: number;
  status: MgmtStatus;
  issues: string[];
  contact: string;
};

const PROPERTIES: PropertyManager[] = [
  {
    loan_ref: "LN-2847",
    borrower: "Cedar Grove Partners",
    property: "The Meridian Apartments",
    type: "Multifamily",
    management_company: "First Choice Residential",
    agreement_expires: "2027-06-30",
    agreement_start: "2024-07-01",
    management_fee_pct: 5.5,
    status: "current",
    issues: [],
    contact: "Rebecca Walton · (404) 555-0182",
  },
  {
    loan_ref: "LN-3201",
    borrower: "Metro Development LLC",
    property: "Westgate Industrial Park",
    type: "Industrial",
    management_company: "Metro Asset Services",
    agreement_expires: "2026-12-31",
    agreement_start: "2023-01-01",
    management_fee_pct: 3.5,
    status: "review",
    issues: [
      "Agreement expires Dec 31, 2026 — renewal not yet initiated.",
      "Insurance certificate expired Apr 1, 2026 — updated certificate required.",
    ],
    contact: "Tony Reeves · (512) 555-0244",
  },
  {
    loan_ref: "LN-5593",
    borrower: "Westridge Capital",
    property: "Summit Office Complex",
    type: "Office",
    management_company: "Summit Property Partners",
    agreement_expires: "2028-03-31",
    agreement_start: "2025-04-01",
    management_fee_pct: 4.0,
    status: "current",
    issues: [],
    contact: "Diana Park · (212) 555-0371",
  },
  {
    loan_ref: "LN-0728",
    borrower: "Crestwood Logistics",
    property: "Crestwood Distribution Center",
    type: "Industrial",
    management_company: "Texas Industrial Management",
    agreement_expires: "2027-09-30",
    agreement_start: "2024-10-01",
    management_fee_pct: 3.0,
    status: "current",
    issues: [],
    contact: "James Ortega · (214) 555-0509",
  },
  {
    loan_ref: "LN-4108",
    borrower: "Oakfield Group",
    property: "Oakfield Retail Plaza",
    type: "Retail",
    management_company: "Greenleaf Retail Advisors",
    agreement_expires: "2025-12-31",
    agreement_start: "2022-01-01",
    management_fee_pct: 4.5,
    status: "pending_change",
    issues: [
      "Agreement expired Dec 31, 2025 — operating on hold-over.",
      "Borrower submitted new management company proposal (Oak Management Co.) on Apr 14, 2026.",
      "New PM agreement pending lender approval and updated insurance certificates.",
      "Termination clause analysis required before transition.",
    ],
    contact: "Mike Faber · (312) 555-0128",
  },
  {
    loan_ref: "LN-1120",
    borrower: "Sunrise Holdings",
    property: "Sunrise Business Park",
    type: "Mixed-Use",
    management_company: "Sunrise Asset Management",
    agreement_expires: "2027-03-31",
    agreement_start: "2024-04-01",
    management_fee_pct: 4.0,
    status: "current",
    issues: [],
    contact: "Nina Alvarez · (305) 555-0296",
  },
];

const statusConfig: Record<MgmtStatus, { label: string; bg: string; dot: string; icon: React.ReactNode }> = {
  current:        { label: "Current",         bg: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: <CheckCircleIcon className="h-4 w-4 text-emerald-600" /> },
  pending_change: { label: "Pending Change",  bg: "bg-amber-100 text-amber-700",    dot: "bg-amber-500",   icon: <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" /> },
  expired:        { label: "Expired",         bg: "bg-red-100 text-red-700",         dot: "bg-red-500",     icon: <XCircleIcon className="h-4 w-4 text-red-600" /> },
  review:         { label: "Review Required", bg: "bg-orange-100 text-orange-700",   dot: "bg-orange-500",  icon: <ExclamationTriangleIcon className="h-4 w-4 text-orange-600" /> },
};

const CHECKLIST_ITEMS = [
  "Executed new management agreement",
  "Updated insurance certificates",
  "Operating budget for current year",
  "Transition plan and timeline",
  "Key contact and vendor list",
  "Lender consent letter signed",
];

const AI_CLAUSE_FINDINGS = [
  "Termination clause requires 60-day written notice — confirm with existing PM.",
  "Performance fee triggers align with current loan covenants (NOI ≥ $280k).",
  "Indemnification language missing lender consent — must be added before execution.",
  "Management fee of 4.5% is within lender-approved range (≤5%).",
  "Non-compete radius of 5 miles — confirm no conflict with borrower's other properties.",
];

export default function ServicingManagementPage() {
  const { addAlert, addTask, logAudit, requestApproval } = useServicingContext();
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, string[]>>({});
  const [clausesReviewed, setClausesReviewed] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  const selectedProperty = PROPERTIES.find(p => p.loan_ref === selectedRef);

  const toggleItem = (loan_ref: string, item: string) => {
    setCheckedItems(prev => {
      const existing = prev[loan_ref] ?? [];
      return {
        ...prev,
        [loan_ref]: existing.includes(item)
          ? existing.filter(e => e !== item)
          : [...existing, item],
      };
    });
  };

  const handleClauseReview = (loan_ref: string) => {
    setClausesReviewed(prev => ({ ...prev, [loan_ref]: true }));
    addAlert({
      id: `alert-mgmt-clauses-${loan_ref}`,
      title: `AI clause review complete — ${loan_ref}`,
      detail: "Indemnification gap flagged. Lender consent language must be added before execution.",
      severity: "medium",
      category: "Management",
    });
    logAudit({
      id: `audit-mgmt-clause-${loan_ref}-${Date.now()}`,
      action: `AI clause review — ${loan_ref}`,
      detail: "5 clause findings generated. Indemnification gap requires resolution.",
      timestamp: new Date().toISOString(),
      status: "logged",
    });
  };

  const handleSubmit = (p: PropertyManager) => {
    setSubmitted(prev => ({ ...prev, [p.loan_ref]: true }));
    addTask({
      id: `task-mgmt-${p.loan_ref}`,
      title: `Approve management change — ${p.loan_ref}`,
      detail: `${p.property}: transition to new PM requires lender approval before notification.`,
      status: "in-review",
      category: "Management",
      requiresApproval: true,
    });
    requestApproval(
      `Approve property management change — ${p.loan_ref}`,
      `${p.property} (${p.borrower}): management transition package submitted. Pending lender approval before notices sent.`
    );
  };

  const needsAttention = PROPERTIES.filter(p => p.status !== "current");
  const currentCount = PROPERTIES.filter(p => p.status === "current").length;

  return (
    <div className="space-y-5">
      {/* Portfolio summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Properties",    value: PROPERTIES.length,         color: "text-slate-900" },
          { label: "Current",             value: currentCount,               color: "text-emerald-700" },
          { label: "Needs Attention",     value: needsAttention.length,      color: needsAttention.length > 0 ? "text-amber-700" : "text-emerald-700" },
          { label: "Pending Changes",     value: PROPERTIES.filter(p => p.status === "pending_change").length, color: "text-red-700" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Property roster */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Property Management Roster
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Loan / Property</th>
                <th className="px-4 py-3 text-left">Management Company</th>
                <th className="px-4 py-3 text-right">Fee</th>
                <th className="px-4 py-3 text-right">Expires</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {PROPERTIES.map(p => {
                const sc = statusConfig[p.status];
                return (
                  <tr
                    key={p.loan_ref}
                    className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${selectedRef === p.loan_ref ? "bg-slate-50" : ""}`}
                    onClick={() => setSelectedRef(selectedRef === p.loan_ref ? null : p.loan_ref)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BuildingOffice2Icon className="h-4 w-4 text-slate-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-900">{p.loan_ref}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[180px]">{p.property}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">{p.management_company}</p>
                      <p className="text-xs text-slate-400">{p.contact}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {p.management_fee_pct}%
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {p.agreement_expires}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {sc.icon}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${sc.bg}`}>
                          {sc.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.issues.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedRef(p.loan_ref); }}
                          className="text-xs font-semibold text-amber-700 hover:underline"
                        >
                          {p.issues.length} issue{p.issues.length > 1 ? "s" : ""}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Management change workflow — shown when a property is selected that has issues */}
      {selectedProperty && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {statusConfig[selectedProperty.status].icon}
                <h2 className="text-base font-bold text-slate-900">
                  {selectedProperty.loan_ref} — {selectedProperty.property}
                </h2>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {selectedProperty.management_company} · {selectedProperty.management_fee_pct}% fee · {selectedProperty.contact}
              </p>
            </div>
            <button
              onClick={() => setSelectedRef(null)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Close
            </button>
          </div>

          {/* Issues */}
          {selectedProperty.issues.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Outstanding Issues</p>
              {selectedProperty.issues.map((issue, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
                >
                  <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">{issue}</p>
                </div>
              ))}
            </div>
          )}

          {/* Document checklist + AI clause review */}
          {(selectedProperty.status === "pending_change" || selectedProperty.status === "review") && (
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                  Document Checklist
                </p>
                <div className="space-y-2">
                  {CHECKLIST_ITEMS.map(item => {
                    const checked = (checkedItems[selectedProperty.loan_ref] ?? []).includes(item);
                    return (
                      <label
                        key={item}
                        className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(selectedProperty.loan_ref, item)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900"
                        />
                        <span className={`text-sm ${checked ? "text-emerald-700 line-through" : "text-slate-700"}`}>
                          {item}
                        </span>
                        {checked && <CheckCircleIcon className="ml-auto h-4 w-4 text-emerald-500 shrink-0" />}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {(checkedItems[selectedProperty.loan_ref] ?? []).length} of {CHECKLIST_ITEMS.length} documents complete
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">AI Clause Review</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600 mb-4">
                    Run AI clause analysis to identify risks in the management agreement before routing for approval.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleClauseReview(selectedProperty.loan_ref)}
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 transition"
                  >
                    {clausesReviewed[selectedProperty.loan_ref] ? "Re-run Clause Review" : "Run Clause Review"}
                  </button>
                  {clausesReviewed[selectedProperty.loan_ref] && (
                    <div className="mt-4 space-y-2">
                      {AI_CLAUSE_FINDINGS.map((finding, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-2 rounded-lg px-3 py-2.5 border text-xs ${
                            finding.includes("missing") || finding.includes("required")
                              ? "border-red-200 bg-red-50 text-red-800"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          <span className="text-slate-400 shrink-0">{i + 1}.</span>
                          {finding}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {clausesReviewed[selectedProperty.loan_ref] && !submitted[selectedProperty.loan_ref] && (
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => handleSubmit(selectedProperty)}
                      disabled={(checkedItems[selectedProperty.loan_ref] ?? []).length < CHECKLIST_ITEMS.length}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-50 transition"
                    >
                      Submit Change for Lender Approval
                    </button>
                    {(checkedItems[selectedProperty.loan_ref] ?? []).length < CHECKLIST_ITEMS.length && (
                      <p className="text-xs text-amber-700">
                        Complete all checklist items before submitting.
                      </p>
                    )}
                  </div>
                )}
                {submitted[selectedProperty.loan_ref] && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                    <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700">
                      Change package submitted — pending lender approval
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current properties — just show details */}
          {selectedProperty.status === "current" && selectedProperty.issues.length === 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                <p className="text-sm text-emerald-800 font-semibold">
                  Management agreement current and compliant — no action required.
                </p>
              </div>
              <p className="mt-1 text-xs text-emerald-700">
                Agreement runs {selectedProperty.agreement_start} through {selectedProperty.agreement_expires}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
