import React, { useCallback, useMemo, useState } from "react";
import { api } from "../lib/api";

function normalizeApiBase(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  return withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
}

function parseLoans(raw: string) {
  if (!raw) return [];
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => ({ id: `loan-${idx + 1}`, name: line }));
}

function shortenAddress(address?: string | null): string {
  if (!address) return "—";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return "—";
  }
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatNumber(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return "—";
  }
  return amount.toLocaleString("en-US");
}

type Props = {
  apiBase?: string;
};

type PoolDetails = {
  id: string;
  name: string;
  symbol: string;
  tokenAddress?: string;
  metrics?: {
    targetSize?: number | null;
    capitalRaised?: number;
    remaining?: number | null;
    totalSupply?: number;
    holders?: number;
  };
  underlyingLoans?: {
    count: number;
    totalBalance: number | null;
  };
};

export default function TokenizationApiPanel({ apiBase }: Props) {
  const baseURL = useMemo(() => normalizeApiBase(apiBase), [apiBase]);
  const [poolForm, setPoolForm] = useState({ name: "", symbol: "", targetSize: "", loans: "", adminWallet: "" });
  const [poolError, setPoolError] = useState<string | null>(null);
  const [poolResult, setPoolResult] = useState<PoolDetails | null>(null);
  const [poolTx, setPoolTx] = useState<any>(null);
  const [poolLoading, setPoolLoading] = useState(false);

  const [whitelistForm, setWhitelistForm] = useState({ investorId: "", wallet: "" });
  const [whitelistResult, setWhitelistResult] = useState<any>(null);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);
  const [whitelistLoading, setWhitelistLoading] = useState(false);

  const [investmentForm, setInvestmentForm] = useState({ investorId: "", poolId: "", amount: "" });
  const [investmentResult, setInvestmentResult] = useState<any>(null);
  const [investmentError, setInvestmentError] = useState<string | null>(null);
  const [investmentLoading, setInvestmentLoading] = useState(false);

  const [poolDetails, setPoolDetails] = useState<PoolDetails | null>(null);
  const [lookupPoolId, setLookupPoolId] = useState<string>("");
  const [lookupError, setLookupError] = useState<string | null>(null);

  const withBase = useCallback(
    (options?: Record<string, any>) => (baseURL ? { ...(options || {}), baseURL } : options),
    [baseURL]
  );

  const handleCreatePool = async (event: React.FormEvent) => {
    event.preventDefault();
    setPoolLoading(true);
    setPoolError(null);
    try {
      const payload = {
        name: poolForm.name,
        symbol: poolForm.symbol || undefined,
        target_size: poolForm.targetSize ? Number(poolForm.targetSize) : undefined,
        loans: parseLoans(poolForm.loans),
        admin_wallet: poolForm.adminWallet || undefined,
      };
      const { data } = await api.post("/pools", payload, withBase());
      setPoolResult(data.pool);
      setPoolTx(data.transaction);
      if (data.pool?.id) {
        setInvestmentForm((prev) => ({ ...prev, poolId: data.pool.id }));
        setLookupPoolId(data.pool.id);
        await loadPoolDetails(data.pool.id);
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Unable to create pool";
      setPoolError(message);
    } finally {
      setPoolLoading(false);
    }
  };

  const handleWhitelist = async (event: React.FormEvent) => {
    event.preventDefault();
    setWhitelistLoading(true);
    setWhitelistError(null);
    try {
      const payload = { investor_id: whitelistForm.investorId, wallet: whitelistForm.wallet };
      const { data } = await api.post("/investors/whitelist", payload, withBase());
      setWhitelistResult(data);
      setInvestmentForm((prev) => ({ ...prev, investorId: whitelistForm.investorId }));
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Unable to whitelist investor";
      setWhitelistError(message);
    } finally {
      setWhitelistLoading(false);
    }
  };

  const handleInvestment = async (event: React.FormEvent) => {
    event.preventDefault();
    setInvestmentLoading(true);
    setInvestmentError(null);
    try {
      const payload = {
        investor_id: investmentForm.investorId,
        pool_id: investmentForm.poolId,
        amount: investmentForm.amount ? Number(investmentForm.amount) : undefined,
      };
      const { data } = await api.post("/investments", payload, withBase());
      setInvestmentResult(data);
      if (data?.pool?.id) {
        await loadPoolDetails(data.pool.id);
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Unable to record investment";
      setInvestmentError(message);
    } finally {
      setInvestmentLoading(false);
    }
  };

  const loadPoolDetails = useCallback(
    async (poolId?: string) => {
      if (!poolId) return;
      try {
        setLookupError(null);
        const { data } = await api.get(`/pools/${poolId}`, withBase());
        setPoolDetails(data.pool);
      } catch (err: any) {
        const message = err?.response?.data?.message || err?.message || "Unable to load pool";
        setLookupError(message);
      }
    },
    [withBase]
  );

  const onLookupSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await loadPoolDetails(lookupPoolId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">API-backed tokenization</h2>
          <p className="text-sm text-slate-600">
            Create pools, whitelist investors, and mint participation tokens directly against the new REST endpoints.
          </p>
        </div>
        {poolDetails?.tokenAddress && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {shortenAddress(poolDetails.tokenAddress)}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deploy pool token</p>
              <h3 className="text-lg font-semibold text-slate-900">PoolFactory + DB</h3>
            </div>
            <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-800">POST /api/pools</span>
          </div>
          <form className="space-y-3" onSubmit={handleCreatePool}>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Pool name"
              value={poolForm.name}
              onChange={(e) => setPoolForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                placeholder="Symbol (optional)"
                value={poolForm.symbol}
                onChange={(e) => setPoolForm((prev) => ({ ...prev, symbol: e.target.value }))}
              />
              <input
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                placeholder="Target size"
                type="number"
                value={poolForm.targetSize}
                onChange={(e) => setPoolForm((prev) => ({ ...prev, targetSize: e.target.value }))}
              />
            </div>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Admin wallet (optional)"
              value={poolForm.adminWallet}
              onChange={(e) => setPoolForm((prev) => ({ ...prev, adminWallet: e.target.value }))}
            />
            <textarea
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="One loan per line: Midtown Office\nLogistics Portfolio"
              rows={3}
              value={poolForm.loans}
              onChange={(e) => setPoolForm((prev) => ({ ...prev, loans: e.target.value }))}
            />
            <button
              type="submit"
              disabled={poolLoading}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {poolLoading ? "Deploying…" : "Deploy pool"}
            </button>
          </form>
          {poolError && <p className="text-sm text-rose-600">{poolError}</p>}
          {poolResult && (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">{poolResult.name}</p>
              <p className="text-slate-500">{poolResult.symbol} · {shortenAddress(poolResult.tokenAddress)}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-slate-500">Target</dt>
                  <dd className="font-semibold">{formatCurrency(poolResult.metrics?.targetSize ?? null)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Total supply</dt>
                  <dd className="font-semibold">{formatNumber(poolResult.metrics?.totalSupply ?? 0)}</dd>
                </div>
              </dl>
              {poolTx?.hash && (
                <p className="mt-2 break-words font-mono text-[11px] text-slate-500">Tx: {poolTx.hash}</p>
              )}
            </div>
          )}
        </article>

        <article className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Whitelist investor</p>
              <h3 className="text-lg font-semibold text-slate-900">KYC + Registry</h3>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
              POST /api/investors/whitelist
            </span>
          </div>
          <form className="space-y-3" onSubmit={handleWhitelist}>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Investor ID"
              value={whitelistForm.investorId}
              onChange={(e) => setWhitelistForm((prev) => ({ ...prev, investorId: e.target.value }))}
              required
            />
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Wallet address"
              value={whitelistForm.wallet}
              onChange={(e) => setWhitelistForm((prev) => ({ ...prev, wallet: e.target.value }))}
              required
            />
            <button
              type="submit"
              disabled={whitelistLoading}
              className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {whitelistLoading ? "Whitelisting…" : "Approve investor"}
            </button>
          </form>
          {whitelistError && <p className="text-sm text-rose-600">{whitelistError}</p>}
          {whitelistResult?.whitelist && (
            <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
              <p className="font-semibold">KYC approved</p>
              <p className="text-emerald-900">{shortenAddress(whitelistResult.whitelist.address)}</p>
              <p className="text-emerald-900">Status: {whitelistResult.whitelist.isWhitelisted ? "Whitelisted" : "Pending"}</p>
            </div>
          )}
        </article>

        <article className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Record investment</p>
              <h3 className="text-lg font-semibold text-slate-900">Mint pool tokens</h3>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">POST /api/investments</span>
          </div>
          <form className="space-y-3" onSubmit={handleInvestment}>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Investor ID"
              value={investmentForm.investorId}
              onChange={(e) => setInvestmentForm((prev) => ({ ...prev, investorId: e.target.value }))}
              required
            />
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Pool ID"
              value={investmentForm.poolId}
              onChange={(e) => setInvestmentForm((prev) => ({ ...prev, poolId: e.target.value }))}
              required
            />
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Amount"
              type="number"
              value={investmentForm.amount}
              onChange={(e) => setInvestmentForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />
            <button
              type="submit"
              disabled={investmentLoading}
              className="w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
            >
              {investmentLoading ? "Minting…" : "Mint to investor"}
            </button>
          </form>
          {investmentError && <p className="text-sm text-rose-600">{investmentError}</p>}
          {investmentResult?.investment && (
            <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Minted {formatNumber(investmentResult.investment.amount)}</p>
              <p>Wallet: {shortenAddress(investmentResult.investment.wallet)}</p>
              {investmentResult.transaction?.hash && (
                <p className="break-words font-mono text-[11px] text-amber-800">Tx: {investmentResult.transaction.hash}</p>
              )}
            </div>
          )}
        </article>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pool lookup</p>
            <p className="text-sm text-slate-600">
              Fetch pool performance, on-chain supply, and holder counts straight from the new GET endpoint.
            </p>
          </div>
          <form className="flex items-center gap-2" onSubmit={onLookupSubmit}>
            <input
              className="w-48 rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Pool ID"
              value={lookupPoolId}
              onChange={(e) => setLookupPoolId(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Load
            </button>
          </form>
        </div>
        {lookupError && <p className="mt-3 text-sm text-rose-600">{lookupError}</p>}
        {poolDetails ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Token</p>
              <p className="font-semibold text-slate-900">{poolDetails.symbol}</p>
              <p className="text-xs text-slate-500">{shortenAddress(poolDetails.tokenAddress)}</p>
            </div>
            <div className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Funding</p>
              <p className="font-semibold text-slate-900">
                {formatCurrency(poolDetails.metrics?.capitalRaised ?? null)} / {formatCurrency(poolDetails.metrics?.targetSize ?? null)}
              </p>
              <p className="text-xs text-slate-500">Remaining: {formatCurrency(poolDetails.metrics?.remaining ?? null)}</p>
            </div>
            <div className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">On-chain</p>
              <p className="font-semibold text-slate-900">Supply {formatNumber(poolDetails.metrics?.totalSupply ?? 0)}</p>
              <p className="text-xs text-slate-500">Holders: {formatNumber(poolDetails.metrics?.holders ?? 0)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Deploy or load a pool to see token metrics.</p>
        )}
      </div>
    </div>
  );
}
