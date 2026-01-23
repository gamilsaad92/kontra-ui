import { useState } from "react";
import { useServicingContext } from "./ServicingContext";

const checklist = [
  "Management agreement draft",
  "Insurance certificates",
  "Operating budget approval",
  "Transition plan",
  "Key contact list",
];

const clauseFindings = [
  "Termination clause requires 60-day notice; confirm with legal.",
  "Performance fee triggers align with current loan covenants.",
  "Indemnification language missing lender consent.",
];

export default function ServicingManagementPage() {
  const { addAlert, addTask, logAudit, requestApproval } = useServicingContext();
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [clausesReviewed, setClausesReviewed] = useState(false);

  const toggleItem = (item: string) => {
    setCheckedItems((prev) =>
      prev.includes(item) ? prev.filter((entry) => entry !== item) : [...prev, item]
    );
  };

  const handleClauseReview = () => {
    setClausesReviewed(true);
    addAlert({
      id: "alert-management-clauses",
      title: "AI clause review requires approval",
      detail: "Flagged indemnification gaps in new management contract.",
      severity: "medium",
      category: "Management",
    });
    logAudit({
      id: `audit-management-${Date.now()}`,
      action: "AI clause review completed",
      detail: "Clause review output stored for human approval.",
      timestamp: new Date().toISOString(),
      status: "logged",
    });
  };

  const handleSubmitChange = () => {
    addTask({
      id: "task-management-change",
      title: "Finalize management transition",
      detail: "Awaiting approval before sending change notice.",
      status: "in-review",
      category: "Management",
      requiresApproval: true,
    });
    requestApproval(
      "Approve property management change",
      "Submit change package and notify counterparties after approval."
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Property management change workflow</h2>
        <p className="mt-1 text-sm text-slate-500">
          Track document readiness, run AI clause review, and obtain human approvals before any
          external notifications.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr,1fr]">
          <div>
            <h3 className="text-sm font-semibold uppercase text-slate-500">Document checklist</h3>
            <div className="mt-3 space-y-2">
              {checklist.map((item) => (
                <label key={item} className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checkedItems.includes(item)}
                    onChange={() => toggleItem(item)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  {item}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {checkedItems.length} of {checklist.length} documents complete.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold uppercase text-slate-500">AI clause review</h3>
            <p className="mt-2 text-sm text-slate-600">
              Run AI-assisted clause review to highlight risks before routing for approval.
            </p>
            <button
              type="button"
              onClick={handleClauseReview}
              className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Run clause review
            </button>
            {clausesReviewed && (
              <ul className="mt-4 list-disc space-y-1 pl-4 text-sm text-slate-600">
                {clauseFindings.map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSubmitChange}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Submit change for approval
          </button>
          <p className="text-xs text-slate-500">
            External notices will only send after human approval and audit logging.
          </p>
        </div>
      </section>
    </div>
  );
}
