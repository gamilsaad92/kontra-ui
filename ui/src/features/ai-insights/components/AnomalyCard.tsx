import type { Anomaly } from "../types";

export default function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{anomaly.title}</p>
          <p className="mt-1 text-sm text-slate-600">{anomaly.summary}</p>
          <p className="mt-2 text-xs text-slate-500">{anomaly.comparison}</p>
        </div>
        <a
          href={anomaly.reportLink}
          className="text-xs font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-900"
        >
          View report
        </a>
      </div>
    </div>
  );
}
