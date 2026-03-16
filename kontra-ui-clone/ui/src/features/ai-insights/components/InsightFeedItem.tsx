import type { InsightItem, InsightSeverity } from "../types";

const severityStyles: Record<InsightSeverity, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-rose-200 bg-rose-50 text-rose-700",
  critical: "border-red-300 bg-red-50 text-red-700",
};

export default function InsightFeedItem({ item }: { item: InsightItem }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severityStyles[item.severity]}`}
            >
              {item.severity.toUpperCase()}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {item.category}
            </span>
            <span className="text-xs text-slate-500">{item.windowDays}-day window</span>
          </div>
          <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
          <p className="text-sm text-slate-500">
            Confidence {(item.confidence * 100).toFixed(0)}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.actions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr,1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Drivers</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {item.drivers.map((driver) => (
              <li key={driver} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-slate-400" />
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">View evidence</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.evidenceLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-xs font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-900"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
