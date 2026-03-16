import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BoltIcon, LinkIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import WebhooksManager from "../components/WebhooksManager";
import { resolveApiBase } from "../lib/api";
import { addQueuedItem, registerFlushOnOnline } from "../lib/offlineQueue";

const CATALOG = {
  quickbooks: {
    title: "QuickBooks",
    description: "Sync invoices, settlements, and accounting journal entries.",
  },
  yardi: {
    title: "Yardi",
    description: "Pull property ledgers and rent rolls for multifamily assets.",
  },
  procore: {
    title: "Procore",
    description: "Import draws, inspections, and construction change orders.",
  },
  toast: {
    title: "Toast",
    description: "Stream restaurant orders to hospitality revenue analytics.",
  },
  square: {
    title: "Square",
    description: "Reconcile point-of-sale batches with treasury balances.",
  },
  xero: {
    title: "Xero",
    description: "Mirror ledger updates into your treasury workspace.",
  },
};

function IntegrationCard({ name, connected, onConnect }) {
  const meta = CATALOG[name] ?? { title: name, description: "Connect to start syncing." };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">{meta.title}</p>
          <p className="text-slate-300 text-sm mt-1">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/50 px-3 py-1 text-xs font-semibold text-emerald-300">
              <ShieldCheckIcon className="h-4 w-4" /> Connected
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onConnect(name)}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-amber-500"
            >
              <LinkIcon className="h-4 w-4" /> Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Integrations() {
  const apiBase = resolveApiBase();
  const [connections, setConnections] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queuedMessage, setQueuedMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
        const res = await fetch(`${apiBase}/api/integrations`);
      if (!res.ok) throw new Error("Failed to load integrations");
      const data = await res.json();
      setConnections(data.integrations || {});
    } catch (err) {
      console.error(err);
      setError("Unable to load integrations right now.");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    load();
  }, [apiBase, load]);

  useEffect(() => {
    const stop = registerFlushOnOnline("integration-connect", async ({ name }) => {
     await fetch(`${apiBase}/api/integrations/${name}/connect`, { method: "POST" });
      await load();
      setQueuedMessage("Queued integration connects have been applied.");
    });
    return stop;
  }, [apiBase, load]);

  const handleConnect = useCallback(async (name) => {
    if (!navigator.onLine) {
      addQueuedItem("integration-connect", { name });
      setQueuedMessage("Saved offline and will connect once you are back online.");
      return;
    }
   await fetch(`${apiBase}/api/integrations/${name}/connect`, { method: "POST" });
    await load();
  }, [apiBase, load]);

  const cards = useMemo(
    () =>
      Object.keys(CATALOG).map((key) => (
        <IntegrationCard key={key} name={key} connected={Boolean(connections[key])} onConnect={handleConnect} />
      )),
    [connections, handleConnect]
  );

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Integrations</p>
          <h1 className="text-2xl font-semibold text-white">Marketplace</h1>
          <p className="text-sm text-slate-400">
            Connect third-party systems and register webhooks for automation.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200">
          <BoltIcon className="h-4 w-4" /> Live sync ready
        </span>
      </header>

      {queuedMessage && <div className="rounded-lg bg-emerald-900/40 px-4 py-3 text-emerald-200">{queuedMessage}</div>}
      {error && <div className="rounded-lg bg-red-900/50 px-4 py-3 text-red-100">{error}</div>}

      <section className="space-y-3">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Available connections</span>
          {loading && <span className="text-amber-300">Refreshing…</span>}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards}</div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Webhooks</p>
            <h2 className="text-xl font-semibold text-white">Automation endpoints</h2>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
          <WebhooksManager />
        </div>
      </section>
    </div>
  );
}
