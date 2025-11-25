import React, { useMemo, useState } from "react";
import { api } from "../lib/api";

function normalizeApiBase(base?: string): string | undefined {
  if (!base) return undefined;
  const trimmed = base.trim();
  if (!trimmed) return undefined;
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  return withoutTrailing.endsWith("/api") ? withoutTrailing : `${withoutTrailing}/api`;
}

const STATUS_OPTIONS = ["new", "current", "delinquent", "watchlist"];
const STANDARDS = ["ERC-721", "ERC-20"] as const;

export default function AssetDigitizationPanel({ apiBase }: { apiBase?: string }) {
  const [loanForm, setLoanForm] = useState({
    property_address: "",
    borrower: "",
    balance: "",
    rate: "",
    maturity: "",
    status: "new",
    lien_position: "First lien",
    collateral_value: "",
    token_symbol: "LOAN-001",
    total_supply: "1000000",
    price_per_token: "1.00",
    chain: "base-sepolia",
    owner_wallet: "",
    standard: "ERC-20" as (typeof STANDARDS)[number]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const isFractional = loanForm.standard === "ERC-20";
  const totalSupplyPreview = useMemo(() => {
    if (!isFractional) return 1;
    const parsed = Number(loanForm.total_supply);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [isFractional, loanForm.total_supply]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      loan: {
        property_address: loanForm.property_address,
        balance: loanForm.balance,
        rate: loanForm.rate,
        maturity: loanForm.maturity || null,
        status: loanForm.status,
        borrower: loanForm.borrower,
        lien_position: loanForm.lien_position,
        collateral_value: loanForm.collateral_value
      },
      token: {
        token_symbol: loanForm.token_symbol || "LOAN",
        total_supply: isFractional ? loanForm.total_supply || "0" : 1,
        price_per_token: loanForm.price_per_token,
        chain: loanForm.chain,
        owner_wallet: loanForm.owner_wallet,
        standard: loanForm.standard
      },
      transaction: {
        buyer: loanForm.owner_wallet,
        amount: isFractional ? loanForm.total_supply || "0" : 1
      }
    };

    try {
      const baseURL = normalizeApiBase(apiBase);
      const { data } = await api.post("/tokenize-loan", payload, baseURL ? { baseURL } : undefined);
      setResult(data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Unable to tokenize loan";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Asset Digitization API</h2>
          <p className="text-sm text-slate-600">
            Mint ERC-721 whole-loan tokens or ERC-20 fractional interests and capture immutable metadata in Supabase Storage.
          </p>
        </div>
        {result?.metadataUri && (
          <a
            href={result.metadataUri}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
          >
            Metadata JSON
          </a>
        )}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property address</label>
              <input
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="123 Main St, Austin, TX"
                value={loanForm.property_address}
                onChange={(e) => setLoanForm((prev) => ({ ...prev, property_address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Borrower</label>
              <input
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="ACME Holdings"
                value={loanForm.borrower}
                onChange={(e) => setLoanForm((prev) => ({ ...prev, borrower: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">UPB</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="number"
                min="0"
                placeholder="2500000"
                value={loanForm.balance}
                onChange={(e) => setLoanForm((prev) => ({ ...prev, balance: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rate (%)</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="number"
                step="0.01"
                min="0"
                placeholder="8.75"
                value={loanForm.rate}
                onChange={(e) => setLoanForm((prev) => ({ ...prev, rate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Maturity</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="date"
                value={loanForm.maturity}
                onChange={(e) => setLoanForm((prev) => ({ ...prev, maturity: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={loanForm.status}
                onChange={(e) => setLoanForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lien position</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={loanForm.lien_position}
                onChange={(e) => setLoanForm((prev) => ({ ...prev, lien_position: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collateral value</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="number"
                min="0"
                placeholder="5000000"
                value={loanForm.collateral_value}
                onChange={(e) => setLoanForm((prev) => ({ ...prev, collateral_value: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Token setup</p>
                <h3 className="text-base font-semibold text-slate-900">Select a standard and mint supply</h3>
              </div>
              <div className="flex gap-2 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-700">
                {STANDARDS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`rounded-full px-3 py-1 ${
                      loanForm.standard === option ? "bg-white shadow" : "bg-transparent"
                    }`}
                    onClick={() =>
                      setLoanForm((prev) => ({
                        ...prev,
                        standard: option,
                        total_supply: option === "ERC-20" ? prev.total_supply || "1000000" : "1"
                      }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Symbol</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={loanForm.token_symbol}
                  onChange={(e) => setLoanForm((prev) => ({ ...prev, token_symbol: e.target.value }))}
                />
              </div>
              {isFractional && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total supply</label>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    type="number"
                    min="1"
                    value={loanForm.total_supply}
                    onChange={(e) => setLoanForm((prev) => ({ ...prev, total_supply: e.target.value }))}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price per token</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  type="number"
                  step="0.01"
                  min="0"
                  value={loanForm.price_per_token}
                  onChange={(e) => setLoanForm((prev) => ({ ...prev, price_per_token: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chain</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={loanForm.chain}
                  onChange={(e) => setLoanForm((prev) => ({ ...prev, chain: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner wallet</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="0x..."
                  value={loanForm.owner_wallet}
                  onChange={(e) => setLoanForm((prev) => ({ ...prev, owner_wallet: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mint amount</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  type="number"
                  min="1"
                  value={isFractional ? loanForm.total_supply : 1}
                  readOnly={!isFractional}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Minting metadata…" : "Tokenize loan"}
          </button>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </form>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
              <h3 className="text-lg font-semibold text-slate-900">{loanForm.standard}</h3>
            </div>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">{loanForm.chain}</span>
          </div>

          <dl className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <dt>Address</dt>
              <dd className="text-right font-semibold">{loanForm.property_address || "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Borrower</dt>
              <dd className="text-right font-semibold">{loanForm.borrower || "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Supply</dt>
              <dd className="text-right font-semibold">{totalSupplyPreview.toLocaleString()}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Price</dt>
              <dd className="text-right font-semibold">${loanForm.price_per_token || "0"}</dd>
            </div>
          </dl>

          {result && (
            <div className="space-y-2 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Minted metadata</p>
              <p className="text-xs text-emerald-700">Loan ID: {result.loan?.id} · Token ID: {result.token?.id}</p>
              {result.metadataUri && (
                <p className="break-words text-xs text-emerald-700">{result.metadataUri}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
