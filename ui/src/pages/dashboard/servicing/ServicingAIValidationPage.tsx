import { useState } from "react";
import { useServicingContext } from "./ServicingContext";

const validationQueue = [
  { id: "val-1", type: "Draw package", item: "Draw 4491", status: "needs-review" },
  { id: "val-2", type: "Inspection photos", item: "Inspection 33", status: "needs-review" },
  { id: "val-3", type: "Borrower upload", item: "Q2 Financials", status: "pass" },
];

export default function ServicingAIValidationPage() {
  const { addTask, logAudit, requestApproval } = useServicingContext();
  const [queue, setQueue] = useState(validationQueue);

  const handleStatus = (id: string, status: string) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    addTask({
      id: `task-${id}`,
      title: `Validate ${id}`,
      detail: `AI validation updated to ${status}.`,
      status: status === "pass" ? "approved" : "in-review",
      category: "AI Validation",
    });
    logAudit({
      id: `audit-${id}`,
      action: "AI validation updated",
      detail: `${id} marked as ${status}.`,
      timestamp: new Date().toISOString(),
      status: "logged",
    });
  };

  const handleExternalAction = (item: string) => {
    requestApproval(
      "Approve AI validation outcome",
      `Release external action for ${item} after approval.`
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">AI validation queue</h2>
        <p className="mt-1 text-sm text-slate-500">
          Track AI validation outcomes for draws, inspections, and borrower uploads. Human approval
          is required before external actions.
        </p>
        <div className="mt-4 space-y-3">
          {queue.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.item}</p>
                  <p className="text-xs text-slate-500">{item.type}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {item.status.replace("-", " ")}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleStatus(item.id, "pass")}
                  className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  Mark pass
                </button>
                <button
                  type="button"
                  onClick={() => handleStatus(item.id, "fail")}
                  className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                >
                  Mark fail
                </button>
                <button
                  type="button"
                  onClick={() => handleStatus(item.id, "needs-review")}
                  className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700"
                >
                  Needs review
                </button>
                <button
                  type="button"
                  onClick={() => handleExternalAction(item.item)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  Request external action approval
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
