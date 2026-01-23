import { useMemo } from "react";
import { useServicingContext } from "./ServicingContext";

const severityStyles: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function ServicingOverviewPage() {
  const { alerts, tasks, auditTrail } = useServicingContext();

  const approvals = useMemo(() => tasks.filter((task) => task.requiresApproval), [tasks]);
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "approved"), [tasks]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Active alerts</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{alerts.length}</p>
          <p className="text-sm text-slate-500">Borrower, escrow, management, and AI validation.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Open tasks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{openTasks.length}</p>
          <p className="text-sm text-slate-500">Awaiting action across servicing workflows.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Pending approvals</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{approvals.length}</p>
          <p className="text-sm text-slate-500">Human sign-off required before external actions.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Alerts requiring attention
            </h2>
            <span className="text-xs text-slate-400">Servicing Overview</span>
          </div>
          <div className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border px-3 py-2 text-sm ${severityStyles[alert.severity]}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{alert.title}</p>
                  <span className="text-xs uppercase">{alert.category}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{alert.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Approval queue</h2>
          <div className="mt-4 space-y-3">
            {approvals.map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                <p className="text-xs text-slate-500">{task.detail}</p>
                <p className="mt-2 text-xs font-medium text-amber-700">Awaiting human approval</p>
              </div>
            ))}
            {approvals.length === 0 && (
              <p className="text-sm text-slate-500">No approvals pending right now.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Task queue</h2>
          <div className="mt-4 space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                  <span className="text-xs uppercase text-slate-400">{task.category}</span>
                </div>
                <p className="text-xs text-slate-500">{task.detail}</p>
                <p className="mt-2 text-xs font-medium text-slate-600">
                  Status: {task.status.replace("-", " ")}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Audit trail</h2>
          <div className="mt-4 space-y-3">
            {auditTrail.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{entry.action}</p>
                <p className="text-xs text-slate-500">{entry.detail}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(entry.timestamp).toLocaleString()} · {entry.status.replace("-", " ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
