import { useState } from "react";
import { Link } from "react-router-dom";
import { useServicingContext } from "./ServicingContext";
import type { ServicedLoan } from "./ServicingContext";

const severityDot = (s: string) => {
  if (s === "high") return "bg-red-500";
  if (s === "medium") return "bg-amber-400";
  return "bg-slate-400";
};

const statusBadge = (s: string) => {
  if (s === "open") return "bg-red-100 text-red-700";
  if (s === "in-review") return "bg-amber-100 text-amber-700";
  if (s === "approved") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
};

const paymentBadge = (s: ServicedLoan["paymentStatus"]) => {
  if (s === "current") return "bg-emerald-100 text-emerald-700";
  if (s === "due") return "bg-amber-100 text-amber-700";
  if (s === "late") return "bg-red-100 text-red-700";
  if (s === "watch") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-600";
};

const dscrColor = (d: number) => {
  if (d >= 1.35) return "text-emerald-600";
  if (d >= 1.20) return "text-amber-600";
  return "text-red-600";
};

export default function ServicingOverviewPage() {
  const { alerts, tasks, auditTrail, loans } = useServicingContext();
  const [loanSort, setLoanSort] = useState<"balance" | "dscr" | "paymentStatus">("paymentStatus");

  const highAlerts = alerts.filter((a) => a.severity === "high");
  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "in-review");
  const approvalTasks = tasks.filter((t) => t.requiresApproval && t.status === "in-review");

  const totalUPB = loans.reduce((s, l) => s + l.balance, 0);
  const lateLoans = loans.filter((l) => l.paymentStatus === "late" || l.paymentStatus === "watch");
  const avgDSCR = loans.length ? (loans.reduce((s, l) => s + l.dscr, 0) / loans.length).toFixed(2) : "—";

  const kpis = [
    { label: "Total UPB", value: `$${(totalUPB / 1_000_000).toFixed(1)}M`, sub: `${loans.length} active loans`, accent: "text-slate-900" },
    { label: "Active Alerts", value: alerts.length, sub: `${highAlerts.length} high priority`, accent: highAlerts.length > 0 ? "text-red-600" : "text-slate-900" },
    { label: "Open Tasks", value: openTasks.length, sub: `${approvalTasks.length} awaiting approval`, accent: approvalTasks.length > 0 ? "text-amber-600" : "text-slate-900" },
    { label: "Avg Portfolio DSCR", value: avgDSCR + "x", sub: `${lateLoans.length} loans on watchlist`, accent: Number(avgDSCR) < 1.2 ? "text-red-600" : "text-slate-900" },
  ];

  const sortedLoans = [...loans].sort((a, b) => {
    if (loanSort === "balance") return b.balance - a.balance;
    if (loanSort === "dscr") return a.dscr - b.dscr;
    const order = { late: 0, watch: 1, due: 2, current: 3 };
    return (order[a.paymentStatus] ?? 4) - (order[b.paymentStatus] ?? 4);
  });

  const modules = [
    { label: "Payments", path: "/servicer/payments", desc: "Receipts, short-pays, remitter mismatches, posting exceptions.", icon: "💳" },
    { label: "Inspections", path: "/servicer/inspections", desc: "Freddie Mac-style reviews — photo checklist, life-safety, repair tracking.", icon: "🔍" },
    { label: "Draws", path: "/servicer/draws", desc: "Draw package validation: invoices, lien waivers, SOV, inspector cert.", icon: "📋" },
    { label: "Escrows", path: "/servicer/escrow", desc: "Balance projections, shortage detection, cure notice generation.", icon: "🏦" },
    { label: "Borrower Financials", path: "/servicer/borrower-financials", desc: "DSCR, NOI variance, occupancy trends, watchlist recommendations.", icon: "📊" },
    { label: "Delinquency", path: "/servicer/delinquency", desc: "Late charge tracking, cure workflow, default escalation.", icon: "⚠️" },
    { label: "AI Ops", path: "/servicer/ai-ops", desc: "AI-powered document validation, risk scoring, auto-flagging.", icon: "🤖" },
    { label: "Waterfall", path: "/servicer/waterfall", desc: "Payment distribution across tranches and participation interests.", icon: "🌊" },
  ];

  const categoryMap: Record<string, number> = {};
  alerts.forEach((a) => { categoryMap[a.category] = (categoryMap[a.category] || 0) + 1; });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Servicing Portfolio Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Live exceptions, tasks, and audit activity across your {loans.length} serviced loans.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-semibold text-amber-700">Live Servicing</span>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-3xl font-bold ${kpi.accent}`}>{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Loan Portfolio Table */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Serviced Loan Portfolio</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort by:</span>
            {(["paymentStatus", "balance", "dscr"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setLoanSort(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  loanSort === s
                    ? "bg-amber-100 text-amber-700"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {s === "paymentStatus" ? "Status" : s === "balance" ? "Balance" : "DSCR"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 text-left">Loan / Property</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">DSCR</th>
                <th className="px-4 py-3 text-right">LTV</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Maturity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-900">{loan.property}</p>
                    <p className="text-xs text-slate-500">{loan.borrower} · {loan.id}</p>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{loan.type}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                    ${(loan.balance / 1_000_000).toFixed(1)}M
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600">{loan.rate}%</td>
                  <td className={`px-4 py-3.5 text-right font-bold ${dscrColor(loan.dscr)}`}>
                    {loan.dscr.toFixed(2)}x
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600">{loan.ltv}%</td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paymentBadge(loan.paymentStatus)}`}>
                      {loan.paymentStatus.charAt(0).toUpperCase() + loan.paymentStatus.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">{loan.maturity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Exception queue + Task queue */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Exception Queue</h3>
          {alerts.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">No active exceptions. Portfolio is clean.</p>
          )}
          <div className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${severityDot(alert.severity)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{alert.title}</p>
                    <span className="flex-none rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {alert.category}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{alert.detail}</p>
                </div>
              </div>
            ))}
          </div>
          {Object.keys(categoryMap).length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase text-slate-400">Exceptions by module</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(categoryMap).map(([cat, count]) => (
                  <span
                    key={cat}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {cat} · {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Task Queue</h3>
            <div className="mt-4 space-y-2">
              {tasks.slice(0, 6).map((task) => (
                <div key={task.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{task.title}</p>
                    <span
                      className={`flex-none rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(task.status)}`}
                    >
                      {task.status.replace("-", " ")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{task.detail}</p>
                  {task.requiresApproval && (
                    <p className="mt-1 text-xs font-semibold text-amber-600">⚡ Requires approval</p>
                  )}
                </div>
              ))}
              {tasks.length === 0 && <p className="text-sm text-slate-500">No open tasks.</p>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Audit Trail</h3>
            <div className="mt-4 space-y-2">
              {auditTrail.slice(0, 5).map((entry) => (
                <div key={entry.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-slate-900">{entry.action}</p>
                  <p className="text-xs text-slate-500">{entry.detail}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(entry.timestamp).toLocaleString()} ·{" "}
                    <span
                      className={
                        entry.status === "approved"
                          ? "text-emerald-600"
                          : entry.status === "pending-approval"
                            ? "text-amber-600"
                            : "text-slate-500"
                      }
                    >
                      {entry.status.replace("-", " ")}
                    </span>
                  </p>
                </div>
              ))}
              {auditTrail.length === 0 && (
                <p className="text-sm text-slate-500">No audit entries yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Servicing Modules */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Servicing Modules</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((mod) => (
            <Link
              key={mod.label}
              to={mod.path}
              className="block rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:border-amber-200 hover:bg-amber-50/30"
            >
              <div className="mb-1.5 text-xl">{mod.icon}</div>
              <p className="text-sm font-semibold text-slate-900">{mod.label}</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{mod.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
