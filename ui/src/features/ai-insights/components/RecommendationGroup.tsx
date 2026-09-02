import type { Recommendation } from "../types";

export default function RecommendationGroup({
  title,
  items,
}: {
  title: string;
  items: Recommendation[];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              </div>
              <a
                href={item.actionHref}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                {item.actionLabel}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
