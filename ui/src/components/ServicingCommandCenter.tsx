import { useEffect, useState } from "react";
import { api } from "../lib/apiClient";

type AttentionItem = {
  loan_id: number | string;
  loan_number?: string;
  borrower_name?: string;
  exceptions?: { code: string }[];
};

type ServicingInsights = {
  summary: string;
  needs_attention: AttentionItem[];
  overdue_items: { loan_id: number | string; borrower_name?: string; last_payment_date?: string }[];
  maturity_soon: { loan_id: number | string; borrower_name?: string; maturity_date?: string }[];
  escrow_shortfalls: { loan_id: number | string; borrower_name?: string; escrow_balance?: number }[];
  hazard_loss_delays: { id: number | string; draw_id?: number | string; created_at?: string }[];
  draw_bottlenecks: { draw_id: number | string; loan_id: number | string; submitted_at?: string }[];
};

type Props = {
  orgId?: string | number | null;
};

export default function ServicingCommandCenter({ orgId }: Props) {
  const [data, setData] = useState<ServicingInsights | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
         const { data: payload } = await api.get<ServicingInsights>("/servicing/insights", {
          params: { range: "30d" },
        });
        if (!active) return;
         setData(payload);
      } catch {
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [orgId]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Servicing Command Center</h2>
          <p className="text-xs text-slate-500">Portfolio alerts, AI summary, and work queue.</p>
        </div>
        {loading && <span className="text-xs text-slate-400">Refreshing…</span>}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Alerts</p>
          {data?.needs_attention?.length ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {data.needs_attention.map((item) => (
                <li key={item.loan_id} className="rounded-md bg-white p-2 shadow-sm">
                  <p className="font-medium text-slate-900">
                    Loan {item.loan_number || item.loan_id}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.borrower_name || "Borrower"} ·{" "}
                    {(item.exceptions || []).map((ex) => ex.code).join(", ") || "Review"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No alerts in the current window.</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">AI Portfolio Summary</p>
          <p className="mt-3 text-sm text-slate-700">
            {data?.summary || "Portfolio summary will appear once insights are available."}
          </p>
          <div className="mt-3 grid gap-2 text-xs text-slate-500">
            <div>Maturity soon: {data?.maturity_soon?.length ?? 0}</div>
            <div>Escrow shortfalls: {data?.escrow_shortfalls?.length ?? 0}</div>
            <div>Hazard loss delays: {data?.hazard_loss_delays?.length ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">Work queue</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Overdue items</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {(data?.overdue_items || []).slice(0, 5).map((item) => (
                <li key={item.loan_id}>
                  Loan {item.loan_id} · Last payment {item.last_payment_date || "N/A"}
                </li>
              ))}
              {(!data?.overdue_items || data.overdue_items.length === 0) && (
                <li>No overdue items.</li>
              )}
            </ul>
          </div>
          <div className="rounded-md bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Draw bottlenecks</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {(data?.draw_bottlenecks || []).slice(0, 5).map((item) => (
                <li key={item.draw_id}>
                  Draw {item.draw_id} · Loan {item.loan_id}
                </li>
              ))}
              {(!data?.draw_bottlenecks || data.draw_bottlenecks.length === 0) && (
                <li>No delayed draws.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
