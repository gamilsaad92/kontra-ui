import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";

type Offering = {
  id: string;
  status: string;
  offering_type: string;
  price_type: string;
  price_value: number | null;
  min_ticket: number | null;
  max_ticket: number | null;
  disclosure_pack_url?: string | null;
};

export default function DistributionMarketplace() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const loadOfferings = async () => {
    try {
      const response = await api.get("/market/offerings");
      setOfferings(response.data.offerings || []);
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to load offerings");
    }
  };

  useEffect(() => {
    loadOfferings();
  }, []);

  const handleList = async (offeringId: string) => {
    setStatus(null);
    try {
      await api.post(`/market/offerings/${offeringId}/list`);
      setStatus("Offering listed to whitelist.");
      loadOfferings();
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to list offering");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Marketplace (Permissioned)</h2>
        <p className="mt-2 text-sm text-slate-600">
          Only whitelisted, KYC-approved investors can view listed offerings. No public search or
          order book.
        </p>
      </div>

      {status ? (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          {status}
        </div>
      ) : null}

      <div className="grid gap-4">
        {offerings.map((offering) => (
          <div key={offering.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Offering #{offering.id}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {offering.offering_type} · {offering.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleList(offering.id)}
                className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-600"
              >
                List to whitelist
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-slate-400">Pricing</p>
                <p>
                  {offering.price_type} · {offering.price_value ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Tickets</p>
                <p>
                  {offering.min_ticket ?? "—"} - {offering.max_ticket ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Disclosure</p>
                <p>{offering.disclosure_pack_url ? "Ready" : "Missing"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
