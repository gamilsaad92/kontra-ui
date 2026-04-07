import { useServicingContext } from './ServicingContext';

const severityDot = (s: string) => {
  if (s === 'high') return 'bg-brand-500';
  if (s === 'medium') return 'bg-amber-400';
  return 'bg-slate-400';
};

const statusBadge = (s: string) => {
  if (s === 'open') return 'bg-brand-100 text-brand-700';
  if (s === 'in-review') return 'bg-amber-100 text-amber-700';
  if (s === 'approved') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
};

export default function ServicingOverviewPage() {
  const { alerts, tasks, auditTrail } = useServicingContext();

  const highAlerts = alerts.filter((a) => a.severity === 'high');
  const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in-review');
  const approvalTasks = tasks.filter((t) => t.requiresApproval && t.status === 'in-review');

  const kpis = [
    {
      label: 'Active Alerts',
      value: alerts.length,
      sub: `${highAlerts.length} high priority`,
      accent: highAlerts.length > 0 ? 'text-brand-600' : 'text-slate-900',
    },
    {
      label: 'Open Tasks',
      value: openTasks.length,
      sub: `${approvalTasks.length} awaiting approval`,
      accent: approvalTasks.length > 0 ? 'text-amber-600' : 'text-slate-900',
    },
    {
      label: 'Audit Entries',
      value: auditTrail.length,
      sub: 'All actions logged',
      accent: 'text-slate-900',
    },
    {
      label: 'Pending Approvals',
      value: approvalTasks.length,
      sub: 'Require human sign-off',
      accent: approvalTasks.length > 0 ? 'text-brand-600' : 'text-slate-900',
    },
  ];

  const categoryMap: Record<string, number> = {};
  alerts.forEach((a) => {
    categoryMap[a.category] = (categoryMap[a.category] || 0) + 1;
  });

  const modules = [
    { label: 'Payments', path: '/servicing/payments', desc: 'Payment receipts, short-pays, remitter mismatches, and posting exceptions.' },
    { label: 'Inspections', path: '/servicing/inspections', desc: 'Freddie Mac-style reviews — photo checklist, life-safety flags, repair tracking.' },
    { label: 'Draws', path: '/servicing/draws', desc: 'Draw package validation: invoices, lien waivers, SOV, inspector certification.' },
    { label: 'Escrows', path: '/servicing/escrow', desc: 'Balance projections, shortage detection, cure notice generation.' },
    { label: 'Borrower Financials', path: '/servicing/borrower-financials', desc: 'DSCR, NOI variance, occupancy trends, watchlist recommendations.' },
    { label: 'Management', path: '/servicing/management', desc: 'Management change compliance, document checklist, clause review.' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Servicing portfolio overview</h2>
        <p className="mt-1 text-sm text-slate-500">
          Live exceptions, tasks, and audit activity across your serviced loan portfolio.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-3xl font-bold ${kpi.accent}`}>{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Exception queue</h3>
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Task queue</h3>
            <div className="mt-4 space-y-2">
              {tasks.slice(0, 6).map((task) => (
                <div key={task.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{task.title}</p>
                    <span
                      className={`flex-none rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(task.status)}`}
                    >
                      {task.status.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{task.detail}</p>
                  {task.requiresApproval && (
                    <p className="mt-1 text-xs font-medium text-amber-600">Requires approval</p>
                  )}
                </div>
              ))}
              {tasks.length === 0 && <p className="text-sm text-slate-500">No open tasks.</p>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Audit trail</h3>
            <div className="mt-4 space-y-2">
              {auditTrail.slice(0, 5).map((entry) => (
                <div key={entry.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-slate-900">{entry.action}</p>
                  <p className="text-xs text-slate-500">{entry.detail}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(entry.timestamp).toLocaleString()} ·{' '}
                    <span
                      className={
                        entry.status === 'approved'
                          ? 'text-emerald-600'
                          : entry.status === 'pending-approval'
                            ? 'text-amber-600'
                            : 'text-slate-500'
                      }
                    >
                      {entry.status.replace('-', ' ')}
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

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Servicing modules</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <a
              key={mod.label}
              href={mod.path}
              className="block rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
            >
              <p className="text-sm font-semibold text-slate-900">{mod.label}</p>
              <p className="mt-1 text-xs text-slate-500">{mod.desc}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
