import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
  CubeIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { api } from "../lib/api";

// api.get/post/delete all return { data: actualResponse }
// These helpers unwrap to the actual payload.
const get = async <T = unknown>(path: string): Promise<T> => {
  const r = await api.get<T>(path);
  return (r as unknown as { data: T }).data;
};
const post = async <T = unknown>(path: string, body?: unknown): Promise<T> => {
  const r = await api.post<T>(path, body);
  return (r as unknown as { data: T }).data;
};
const del = async <T = unknown>(path: string): Promise<T> => {
  const r = await api.delete<T>(path);
  return (r as unknown as { data: T }).data;
};

// ─── Types ────────────────────────────────────────────────────────────────────

type TokenStatus = "draft" | "tokenized" | "paused";

type Pool = {
  id: string;
  title?: string | null;
  name?: string | null;
  status: string;
  data?: {
    token_status?: TokenStatus;
    token_symbol?: string;
    token_supply?: number;
    token_contract_address?: string;
    token_network?: string;
    tokenized_at?: string;
    name?: string;
  };
  created_at?: string;
};

function poolName(p: Pool): string {
  return p.title ?? p.name ?? p.data?.name ?? p.id.slice(0, 8) + "…";
}

type Allocation = {
  id: string;
  investor_name: string;
  wallet_address: string;
  token_amount: number;
  ownership_pct: number;
  created_at: string;
};

type WhitelistEntry = {
  id: string;
  wallet_address: string;
  investor_name?: string;
  kyc_status: string;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US");
}

function pct(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function shortAddr(addr?: string) {
  if (!addr) return "—";
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: TokenStatus }) {
  if (status === "tokenized") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircleIcon className="h-3 w-3" /> Tokenized
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      Draft
    </span>
  );
}

function ErrorBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">
      <span>{msg}</span>
      <button onClick={onDismiss} className="ml-2 text-brand-400 hover:text-brand-600">
        <XCircleIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Tab: Tokenize ────────────────────────────────────────────────────────────

function TokenizeTab({ pool, onSuccess }: { pool: Pool; onSuccess: (updated: Pool) => void }) {
  const tokenData = pool.data ?? {};
  const isTokenized = tokenData.token_status === "tokenized";
  const [symbol, setSymbol] = useState(tokenData.token_symbol ?? "");
  const [supply, setSupply] = useState(String(tokenData.token_supply ?? 1_000_000));
  const [contract, setContract] = useState(tokenData.token_contract_address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTokenize() {
    setError(null);
    if (!symbol.trim()) { setError("Token symbol is required"); return; }
    if (!supply || Number(supply) <= 0) { setError("Supply must be a positive number"); return; }
    setBusy(true);
    try {
      const result = await post<{ token: { symbol: string; supply: number; network: string; contract_address: string | null } }>(`/markets/pools/${pool.id}/tokenize`, {
        symbol: symbol.trim().toUpperCase(),
        token_supply: Number(supply),
        contract_address: contract.trim() || null,
        network: "base",
      });
      onSuccess({ ...pool, data: { ...pool.data, ...result.token, token_status: "tokenized" as TokenStatus } });
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Tokenization failed");
    } finally {
      setBusy(false);
    }
  }

  if (isTokenized) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-emerald-700">
            <CheckCircleIcon className="h-5 w-5" />
            <span className="font-semibold">Pool is tokenized</span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Symbol</dt>
              <dd className="mt-1 font-semibold text-slate-900">{tokenData.token_symbol}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total supply</dt>
              <dd className="mt-1 font-semibold text-slate-900">{fmt(tokenData.token_supply)} tokens</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Network</dt>
              <dd className="mt-1 text-slate-700 capitalize">{tokenData.token_network ?? "Base"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Contract</dt>
              <dd className="mt-1 font-mono text-xs text-slate-700">
                {tokenData.token_contract_address ? shortAddr(tokenData.token_contract_address) : <span className="text-amber-600">Not deployed yet</span>}
              </dd>
            </div>
          </dl>
        </div>
        <p className="text-xs text-slate-500">
          Token supply is fixed. To update the contract address after deployment, re-tokenize with the same symbol.
        </p>
        <div className="flex justify-end">
          <button
            onClick={() => onSuccess(pool)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Next: whitelist wallets →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Mint one ERC-20 token on Base representing ownership shares of this pool.
        All financial logic (NAV, DSCR, distributions) stays fully off-chain.
        The blockchain is used only to track ownership via mint, burn, and transfer.
      </p>
      {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Token symbol</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="e.g. KPOOL1"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            maxLength={10}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Total supply (tokens)</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="1,000,000"
            type="number"
            value={supply}
            onChange={(e) => setSupply(e.target.value)}
            min={1}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Contract address on Base <span className="font-normal text-slate-400">(optional — add after deployment)</span>
        </label>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="0x..."
          value={contract}
          onChange={(e) => setContract(e.target.value)}
        />
      </div>
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-700 space-y-1">
        <p className="font-semibold">Smart contract</p>
        <p>Deploy a minimal ERC-20 on Base (Solidity ~50 lines). The contract only needs: mint(to, amount), burn(from, amount), transfer(from, to, amount). One contract per pool. Token supply is fixed at tokenization.</p>
      </div>
      <button
        onClick={handleTokenize}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CubeIcon className="h-4 w-4" />}
        {busy ? "Tokenizing…" : "Tokenize pool"}
      </button>
    </div>
  );
}

// ─── Tab: Allocations ─────────────────────────────────────────────────────────

function AllocationsTab({ pool }: { pool: Pool }) {
  const tokenData = pool.data ?? {};
  const isTokenized = tokenData.token_status === "tokenized";
  const supply = tokenData.token_supply ?? 0;

  const [items, setItems] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ investor_name: "", wallet_address: "", token_amount: "" });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!isTokenized) return;
    setLoading(true);
    try {
      const result = await get<{ items: Allocation[]; token_supply: number }>(`/markets/pools/${pool.id}/allocations`);
      setItems(result.items ?? []);
    } catch { /* table may not exist yet */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [pool.id, isTokenized]);

  const allocated = items.reduce((s, a) => s + a.token_amount, 0);
  const remaining = supply - allocated;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.investor_name.trim()) { setError("Investor name is required"); return; }
    if (!form.wallet_address.trim()) { setError("Wallet address is required"); return; }
    const amount = Number(form.token_amount);
    if (!amount || amount <= 0) { setError("Token amount must be positive"); return; }
    if (amount > remaining) { setError(`Only ${fmt(remaining)} tokens available`); return; }
    setAdding(true);
    try {
      const result = await post<Allocation>(`/markets/pools/${pool.id}/allocations`, {
        investor_name: form.investor_name.trim(),
        wallet_address: form.wallet_address.trim(),
        token_amount: amount,
      });
      setItems((prev) => [...prev, result]);
      setForm({ investor_name: "", wallet_address: "", token_amount: "" });
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to add allocation");
    } finally { setAdding(false); }
  }

  async function handleRemove(id: string) {
    try {
      await del(`/markets/pools/${pool.id}/allocations/${id}`);
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to remove allocation");
    }
  }

  if (!isTokenized) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Tokenize the pool first to assign investor allocations.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center shadow-sm min-w-[120px]">
          <p className="text-xs text-slate-500">Total supply</p>
          <p className="text-lg font-semibold text-slate-900">{fmt(supply)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center shadow-sm min-w-[120px]">
          <p className="text-xs text-slate-500">Allocated</p>
          <p className="text-lg font-semibold text-emerald-700">{fmt(allocated)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center shadow-sm min-w-[120px]">
          <p className="text-xs text-slate-500">Remaining</p>
          <p className={`text-lg font-semibold ${remaining === 0 ? "text-slate-400" : "text-slate-900"}`}>{fmt(remaining)}</p>
        </div>
      </div>

      {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Investor</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Wallet</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Tokens</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Ownership</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{a.investor_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{shortAddr(a.wallet_address)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-800">{fmt(a.token_amount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {pct(a.ownership_pct)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => handleRemove(a.id)} className="text-slate-400 hover:text-brand-600">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-slate-400">
                    No allocations yet. Add the first investor below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {remaining > 0 && (
        <form onSubmit={handleAdd} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Add allocation</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Investor name"
              value={form.investor_name}
              onChange={(e) => setForm((f) => ({ ...f, investor_name: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="0x wallet address"
              value={form.wallet_address}
              onChange={(e) => setForm((f) => ({ ...f, wallet_address: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder={`Tokens (max ${fmt(remaining)})`}
              type="number"
              min={1}
              max={remaining}
              value={form.token_amount}
              onChange={(e) => setForm((f) => ({ ...f, token_amount: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {adding ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
            {adding ? "Adding…" : "Add allocation"}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Tab: Whitelist ───────────────────────────────────────────────────────────

function WhitelistTab({ onDone }: { onDone?: () => void }) {
  const [items, setItems] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ wallet_address: "", investor_name: "" });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await get<{ items: WhitelistEntry[] }>("/markets/whitelist");
      setItems(result.items ?? []);
    } catch { /* table may not exist yet */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.wallet_address.trim()) { setError("Wallet address is required"); return; }
    setAdding(true);
    try {
      const result = await post<WhitelistEntry>("/markets/whitelist", {
        wallet_address: form.wallet_address.trim(),
        investor_name: form.investor_name.trim() || undefined,
        kyc_status: "approved",
      });
      setItems((prev) => [result, ...prev]);
      setForm({ wallet_address: "", investor_name: "" });
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to add wallet");
    } finally { setAdding(false); }
  }

  async function handleRemove(wallet: string) {
    try {
      await del(`/markets/whitelist/${encodeURIComponent(wallet)}`);
      setItems((prev) => prev.filter((w) => w.wallet_address !== wallet));
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to remove wallet");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Only whitelisted wallets can receive token allocations. This enforces simple compliance: KYC your investors, add their wallets here, then assign allocations.
      </p>
      {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Wallet address</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Investor name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">KYC status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-800">{w.wallet_address}</td>
                  <td className="px-4 py-2.5 text-slate-700">{w.investor_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      w.kyc_status === "approved" ? "bg-emerald-50 text-emerald-700" :
                      w.kyc_status === "rejected" ? "bg-brand-50 text-brand-700" :
                      "bg-amber-50 text-amber-700"
                    }`}>
                      {w.kyc_status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => handleRemove(w.wallet_address)} className="text-slate-400 hover:text-brand-600">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                    No wallets whitelisted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleAdd} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Add wallet</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="0x wallet address"
            value={form.wallet_address}
            onChange={(e) => setForm((f) => ({ ...f, wallet_address: e.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Investor name (optional)"
            value={form.investor_name}
            onChange={(e) => setForm((f) => ({ ...f, investor_name: e.target.value }))}
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {adding ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ShieldCheckIcon className="h-4 w-4" />}
          {adding ? "Adding…" : "Whitelist wallet"}
        </button>
      </form>

      {onDone && items.length > 0 && (
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onDone}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Proceed to allocations →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Pool list with inline create ─────────────────────────────────────────────

function PoolList({
  pools,
  selectedId,
  onSelect,
  loading,
  onCreated,
}: {
  pools: Pool[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  onCreated: (pool: Pool) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [slowWarning, setSlowWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Pool name is required"); return; }
    setError(null);
    setSaving(true);
    setSlowWarning(false);

    // Show a "warming up" hint if the server takes more than 6 seconds
    const slowTimer = setTimeout(() => setSlowWarning(true), 6000);

    // Hard timeout after 55 seconds with a clear error
    const controller = new AbortController();
    const hardTimeout = setTimeout(() => controller.abort(), 55000);

    try {
      const result = await post<Pool>("/markets/pools", {
        title: name.trim(),
        status: "active",
        data: {},
      });
      onCreated(result);
      setName("");
      setCreating(false);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("aborted") || msg.includes("signal")) {
        setError("Server took too long to respond. Please try again — it should be faster now.");
      } else {
        setError(msg || "Failed to create pool");
      }
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(hardTimeout);
      setSaving(false);
      setSlowWarning(false);
    }
  }

  return (
    <div className="w-full lg:w-64 shrink-0 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Loan pools</p>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <PlusIcon className="h-3 w-3" /> New pool
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-indigo-800">New pool</p>
          <input
            autoFocus
            className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="e.g. Multifamily Fund I"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <p className="text-xs text-brand-600">{error}</p>}
          {slowWarning && (
            <p className="text-xs text-amber-600">
              Server is warming up — this may take up to 30 seconds on first load…
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setError(null); setName(""); }}
              className="flex-1 rounded border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-slate-400 py-2">Loading…</p>}

      {!loading && pools.length === 0 && !creating && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
          <CubeIcon className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-500">No pools yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "New pool" to start</p>
        </div>
      )}

      <ul className="space-y-1.5">
        {pools.map((pool) => (
          <li key={pool.id}>
            <button
              onClick={() => onSelect(pool.id)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                selectedId === pool.id
                  ? "border-indigo-200 bg-indigo-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-900 text-sm truncate">{poolName(pool)}</span>
                <StatusBadge status={pool.data?.token_status} />
              </div>
              {pool.data?.token_symbol && (
                <p className="mt-0.5 text-xs text-slate-500 font-mono">{pool.data.token_symbol}</p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "Create pool" },
    { n: 2, label: "Tokenize" },
    { n: 3, label: "Whitelist wallets" },
    { n: 4, label: "Assign allocations" },
  ];
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            step === s.n
              ? "bg-indigo-600 text-white"
              : step > s.n
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-400"
          }`}>
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
              step > s.n ? "bg-emerald-500 text-white" : step === s.n ? "bg-white/30 text-white" : "bg-slate-300 text-slate-500"
            }`}>
              {step > s.n ? "✓" : s.n}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 flex-shrink-0 ${step > s.n ? "bg-emerald-300" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "tokenize" | "allocations" | "whitelist";

export default function OnchainDashboard() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [poolsLoading, setPoolsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("tokenize");

  const selectedPool = pools.find((p) => p.id === selectedId) ?? null;

  const loadPools = async () => {
    setPoolsLoading(true);
    try {
      const result = await get<{ items?: Pool[]; data?: Pool[] } | Pool[]>("/markets/pools");
      const list: Pool[] = Array.isArray(result)
        ? result
        : ((result as { items?: Pool[] }).items ?? (result as { data?: Pool[] }).data ?? []);
      setPools(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    } catch { /* ignore */ }
    finally { setPoolsLoading(false); }
  };

  useEffect(() => {
    // Pre-warm the backend (Render cold-starts take 30–60s on first request).
    // Fire a silent health ping as soon as this page loads so the server is
    // ready by the time the user clicks "Create pool".
    fetch("/api/markets/pools", { method: "GET" }).catch(() => {});
    loadPools();
  }, []);

  function handlePoolUpdated(updated: Pool) {
    setPools((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handlePoolCreated(pool: Pool) {
    setPools((prev) => [pool, ...prev]);
    setSelectedId(pool.id);
    setTab("tokenize");
  }

  // Determine current step for the indicator
  const step: 1 | 2 | 3 | 4 = !selectedPool
    ? 1
    : selectedPool.data?.token_status !== "tokenized"
    ? 2
    : tab === "whitelist"
    ? 3
    : 4;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; stepHint: string }[] = [
    { id: "tokenize", label: "Tokenize", icon: <CubeIcon className="h-4 w-4" />, stepHint: "Step 2" },
    { id: "whitelist", label: "Whitelist", icon: <ShieldCheckIcon className="h-4 w-4" />, stepHint: "Step 3" },
    { id: "allocations", label: "Allocations", icon: <UserGroupIcon className="h-4 w-4" />, stepHint: "Step 4" },
  ];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tokenization</p>
        <h1 className="text-2xl font-semibold text-slate-900">Tokenization</h1>
        <p className="text-sm text-slate-600">
          Structure loan pools, prepare token issuances, and assign investor allocations. Clean data in, investable digital assets out.
        </p>
      </header>

      <StepIndicator step={step} />

      <div className="flex flex-col gap-6 lg:flex-row">
        <PoolList
          pools={pools}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setTab("tokenize"); }}
          loading={poolsLoading}
          onCreated={handlePoolCreated}
        />

        <div className="flex-1 min-w-0">
          {!selectedPool ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
              <CubeIcon className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-base font-semibold text-slate-500">Select or create a pool to get started</p>
              <p className="text-sm text-slate-400 mt-1">Use the "New pool" button on the left, then follow the steps to tokenize and assign allocations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{poolName(selectedPool)}</h2>
                  <p className="text-xs text-slate-500">Pool · {selectedPool.id.slice(0, 8)}…</p>
                </div>
                <StatusBadge status={selectedPool.data?.token_status} />
              </div>

              <div className="flex gap-0 border-b border-slate-200">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition ${
                      tab === t.id
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t.icon}
                    {t.label}
                    <span className="ml-1 hidden text-[10px] font-normal text-slate-400 sm:inline">
                      {t.stepHint}
                    </span>
                  </button>
                ))}
              </div>

              <div>
                {tab === "tokenize" && (
                  <TokenizeTab pool={selectedPool} onSuccess={(updated) => { handlePoolUpdated(updated); setTab("whitelist"); }} />
                )}
                {tab === "whitelist" && <WhitelistTab onDone={() => setTab("allocations")} />}
                {tab === "allocations" && (
                  <AllocationsTab pool={selectedPool} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
