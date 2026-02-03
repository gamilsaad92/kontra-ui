import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowPathIcon, BanknotesIcon, BuildingLibraryIcon, SparklesIcon } from "@heroicons/react/24/outline";
import {
  createPoolToken,
  fetchLoanInventory,
  fetchPoolAdmin,
  type CashflowEntry,
  type InvestorHolding,
  type LoanInventoryItem,
  type PoolAdminOverview,
} from "../services/pools";

function formatCurrency(value?: number | null, maximumFractionDigits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits });
}

function formatPercent(value?: number | null, maximumFractionDigits = 1) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(maximumFractionDigits)}%`;
}

function formatNumber(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US");
}

function summarizeGeography(loans: LoanInventoryItem[]) {
  return loans.reduce<Record<string, number>>((acc, loan) => {
    const key = loan.state || "Other";
    acc[key] = (acc[key] ?? 0) + loan.upb;
    return acc;
  }, {});
}

function WeightedMetrics({ loans }: { loans: LoanInventoryItem[] }) {
  const metrics = useMemo(() => {
    const totalUpb = loans.reduce((sum, loan) => sum + loan.upb, 0);
    if (totalUpb === 0) {
      return { coupon: 0, dscr: 0, term: 0 };
    }
    const coupon = loans.reduce((sum, loan) => sum + loan.rate * loan.upb, 0) / totalUpb;
    const dscr = loans.reduce((sum, loan) => sum + loan.dscr * loan.upb, 0) / totalUpb;
    const term = loans.reduce((sum, loan) => sum + loan.remainingTermMonths * loan.upb, 0) / totalUpb;
    return { coupon, dscr, term };
  }, [loans]);

  const geography = useMemo(() => summarizeGeography(loans), [loans]);

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <MetricCard label="Weighted coupon" value={formatPercent(metrics.coupon, 2)} />
      <MetricCard label="WA DSCR" value={formatPercent(metrics.dscr, 2)} />
      <MetricCard label="WA remaining term" value={`${metrics.term.toFixed(0)} mos`} />
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Geography</div>
        <div className="mt-3 space-y-2">
          {Object.keys(geography).length === 0 && <p className="text-sm text-slate-500">Add loans to see the mix.</p>}
          {Object.entries(geography)
            .sort(([, a], [, b]) => b - a)
            .map(([state, upb]) => (
              <div key={state} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">{state}</span>
                <span className="text-slate-500">{formatCurrency(upb)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-2 ${valueClassName ?? "text-xl font-semibold text-slate-900"}`}>{value}</p>
    </div>
  );
}

function InventoryTable({
  loans,
  selected,
  onToggle,
}: {
  loans: LoanInventoryItem[];
  selected: Set<string>;
  onToggle: (loanId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Loan Inventory</p>
          <p className="text-xs text-slate-500">Pipeline, watchlist, and serviced loans.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {selected.size} selected
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Loan</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">UPB</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Rate</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">DSCR</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Term</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loans.map((loan) => {
              const isSelected = selected.has(loan.id);
              return (
                <tr key={loan.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{loan.property}</div>
                    <div className="text-xs text-slate-500">
                      {loan.city}, {loan.state} • {loan.borrower}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(loan.upb)}</td>
                  <td className="px-4 py-3 text-slate-800">{formatPercent(loan.rate, 2)}</td>
                  <td className="px-4 py-3 text-slate-800">{loan.dscr.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[12px] font-semibold capitalize text-slate-700">
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{loan.remainingTermMonths} mos</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onToggle(loan.id)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        isSelected
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border border-slate-200 text-slate-700 hover:border-emerald-200 hover:text-emerald-700"
                      }`}
                    >
                      {isSelected ? "Added" : "Add to Pool"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvestorTable({ investors }: { investors: InvestorHolding[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Investors</p>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">Whitelist live</span>
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Name</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Wallet</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Balance</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Ownership</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {investors.map((investor) => (
            <tr key={investor.wallet} className="hover:bg-slate-50/80">
              <td className="px-4 py-3 font-semibold text-slate-900">{investor.name}</td>
              <td className="px-4 py-3 text-slate-700">{investor.wallet}</td>
              <td className="px-4 py-3 text-slate-800">{formatCurrency(investor.balance)}</td>
              <td className="px-4 py-3 text-slate-800">{formatPercent(investor.ownership, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CashflowTable({ entries }: { entries: CashflowEntry[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Cashflows & distributions</p>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">On-chain</span>
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Period</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Gross</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Fees</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Distributed</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Paid</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr key={entry.period} className="hover:bg-slate-50/80">
              <td className="px-4 py-3 font-semibold text-slate-900">{entry.period}</td>
              <td className="px-4 py-3 text-slate-800">{formatCurrency(entry.gross)}</td>
              <td className="px-4 py-3 text-slate-800">{formatCurrency(entry.fees)}</td>
              <td className="px-4 py-3 text-slate-800">{formatCurrency(entry.distributed)}</td>
              <td className="px-4 py-3 text-slate-800">{entry.distributionDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PoolingWorkspace() {
  const [loans, setLoans] = useState<LoanInventoryItem[]>([]);
  const [selectedLoanIds, setSelectedLoanIds] = useState<Set<string>>(new Set());
  const [poolParams, setPoolParams] = useState({
    name: "Bridge Series 2024-1",
    symbol: "KBRG24",
    targetSize: 50000000,
    advanceRate: 0.78,
    minDscr: 1.15,
    adminWallet: "",
  });
  const [tokenizing, setTokenizing] = useState(false);
  const [tokenAddress, setTokenAddress] = useState<string | undefined>();
  const [activePoolId, setActivePoolId] = useState<string | undefined>();
  const [dataError, setDataError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [poolAdmin, setPoolAdmin] = useState<PoolAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);
  
    const validationErrors = useMemo(() => {
    return {
      targetSize:
        poolParams.targetSize > 0 && !Number.isNaN(poolParams.targetSize)
          ? ""
          : "Target raise must be greater than zero.",
      advanceRate:
        poolParams.advanceRate >= 0 && poolParams.advanceRate <= 1 && !Number.isNaN(poolParams.advanceRate)
          ? ""
          : "Advance rate must be between 0 and 1.",
      minDscr:
        poolParams.minDscr > 0 && !Number.isNaN(poolParams.minDscr)
          ? ""
          : "Minimum DSCR must be greater than zero.",
      adminWallet: poolParams.adminWallet.trim() !== "" ? "" : "Admin wallet is required.",
    };
  }, [poolParams]);

  const hasValidationErrors = useMemo(
    () => Object.values(validationErrors).some((message) => message.length > 0),
    [validationErrors]
  );

  const loadData = useCallback(
    async (poolId?: string) => {
      if (!isMounted.current) return;
      setLoading(true);
      setDataError(null);

      try {
        const [inventoryResult, adminResult] = await Promise.all([
          fetchLoanInventory(),
          fetchPoolAdmin(poolId ?? activePoolId),
        ]);

        if (!isMounted.current) return;

        setLoans(inventoryResult.loans);
        setPoolAdmin(adminResult.poolAdmin);
        setActivePoolId(adminResult.poolAdmin.id);

        if (inventoryResult.usedFallback || adminResult.usedFallback) {
          const fallbackSources = [
            inventoryResult.usedFallback ? "loan inventory" : null,
            adminResult.usedFallback ? "pool overview" : null,
          ].filter(Boolean);
          const details = [inventoryResult.errorMessage, adminResult.errorMessage]
            .filter(Boolean)
            .join("; ");
          const detailText = details ? ` (${details})` : "";
          setDataError(`Unable to load live ${fallbackSources.join(" and ")}. Showing fallback data${detailText}.`);
        }
      } catch (err) {
          if (!isMounted.current) return;
        const message = err instanceof Error ? err.message : "Unable to load live data.";
        setDataError(`${message} Showing fallback data.`);
      } finally {
         if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [activePoolId]
  );

  useEffect(() => {
    isMounted.current = true;
    loadData();
    return () => {
     isMounted.current = false;
    };
  }, [loadData]);

  const selectedLoans = useMemo(
    () => loans.filter((loan) => selectedLoanIds.has(loan.id)),
    [loans, selectedLoanIds]
  );

  const totalSelected = selectedLoans.reduce((sum, loan) => sum + loan.upb, 0);

  const isTokenizeDisabled = tokenizing || hasValidationErrors || selectedLoans.length === 0;

  const toggleLoan = (loanId: string) => {
    setSelectedLoanIds((prev) => {
      const next = new Set(prev);
      if (next.has(loanId)) {
        next.delete(loanId);
      } else {
        next.add(loanId);
      }
      return next;
    });
  };

  const handleTokenize = async () => {
     if (hasValidationErrors) {
      return;
    }
    if (selectedLoans.length === 0) {
      setError("Select at least one loan before tokenizing.");
      return;
    }
    setTokenizing(true);
    setError(null);
    try {
      const response = await createPoolToken({
        name: poolParams.name,
        symbol: poolParams.symbol,
        target_size: poolParams.targetSize,
        admin_wallet: poolParams.adminWallet || undefined,
        loans: selectedLoans.map((loan) => ({ id: loan.id, upb: loan.upb, rate: loan.rate, dscr: loan.dscr })),
        parameters: { advance_rate: poolParams.advanceRate, min_dscr: poolParams.minDscr },
      });
      setTokenAddress(response.tokenAddress);
      const nextPoolId = response.poolId ?? activePoolId;
      setActivePoolId(nextPoolId);
      const adminResult = await fetchPoolAdmin(nextPoolId);
      setPoolAdmin(adminResult.poolAdmin);
      if (adminResult.poolAdmin.id) {
        setActivePoolId(adminResult.poolAdmin.id);
      }
      if (adminResult.usedFallback) {
        setDataError("Unable to refresh live pool data. Showing fallback admin details.");
      } else {
        setDataError(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to tokenize pool";
      setError(message);
    } finally {
      setTokenizing(false);
    }
  };

  const builderHeading = tokenAddress
    ? `Token deployed at ${tokenAddress}`
    : "Configure pool terms and deploy";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lender / Servicer</p>
          <h1 className="text-2xl font-semibold text-slate-900">Loan pooling and tokenization</h1>
          <p className="text-sm text-slate-600">Select loans, build a pool, deploy a token, and monitor cashflows in one view.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <SparklesIcon className="h-4 w-4" />
            PoolFactory ready
          </span>
          {tokenAddress && (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              {tokenAddress}
            </span>
          )}
        </div>
      </header>

       {dataError && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold">Live data unavailable</p>
            <p className="text-amber-700">{dataError}</p>
          </div>
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-md bg-white px-3 py-2 text-xs font-semibold text-amber-800 shadow-sm ring-1 ring-amber-200 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Retrying…" : "Retry live data"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-slate-500" />
          Loading lender data…
        </div>
      ) : (
        <div className="space-y-6">
          <InventoryTable loans={loans} selected={selectedLoanIds} onToggle={toggleLoan} />

           <section className="space-y-6">
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pool Builder</p>
                    <h2 className="text-lg font-semibold text-slate-900">{builderHeading}</h2>
                    <p className="text-sm text-slate-600">Start a new pool, calculate weighted stats, and push to the PoolToken contract.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {selectedLoans.length} loans · {formatCurrency(totalSelected)} UPB
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Pool name</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={poolParams.name}
                      onChange={(e) => setPoolParams((prev) => ({ ...prev, name: e.target.value }))}
                    />
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Symbol</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={poolParams.symbol}
                      onChange={(e) => setPoolParams((prev) => ({ ...prev, symbol: e.target.value }))}
                    />
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Admin wallet</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="0x…"
                      value={poolParams.adminWallet}
                      onChange={(e) => setPoolParams((prev) => ({ ...prev, adminWallet: e.target.value }))}
                    />
                      {validationErrors.adminWallet && (
                      <p className="text-xs text-rose-600">{validationErrors.adminWallet}</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Target raise</label>
                    <input
                      type="number"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={poolParams.targetSize}
                                            onChange={(e) => {
                        const value = e.target.value === "" ? Number.NaN : Number(e.target.value);
                        setPoolParams((prev) => ({ ...prev, targetSize: value }));
                      }}
                    />
                                {validationErrors.targetSize && (
                      <p className="text-xs text-rose-600">{validationErrors.targetSize}</p>
                    )}
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Advance rate</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={poolParams.advanceRate}
                                 onChange={(e) => {
                        const value = e.target.value === "" ? Number.NaN : Number(e.target.value);
                        setPoolParams((prev) => ({ ...prev, advanceRate: value }));
                      }}
                    />
                                        {validationErrors.advanceRate && (
                      <p className="text-xs text-rose-600">{validationErrors.advanceRate}</p>
                    )}
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Minimum DSCR</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={poolParams.minDscr}
                              onChange={(e) => {
                        const value = e.target.value === "" ? Number.NaN : Number(e.target.value);
                        setPoolParams((prev) => ({ ...prev, minDscr: value }));
                      }}
                    />
                                       {validationErrors.minDscr && (
                      <p className="text-xs text-rose-600">{validationErrors.minDscr}</p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
                )}

                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <BanknotesIcon className="h-4 w-4" />
                    Loans pushed to /api/pools
                  </div>
                  <button
                    type="button"
                     disabled={isTokenizeDisabled}
                    onClick={handleTokenize}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
                  >
                    {tokenizing ? "Deploying PoolToken…" : "Tokenize Pool"}
                  </button>
                </div>
              </div>

                 <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pool Admin Dashboard</p>
                    <h3 className="text-lg font-semibold text-slate-900">{poolAdmin?.name ?? "Pool"}</h3>
                    <p className="text-sm text-slate-600">NAV, token contract, and on-chain supply.</p>
                  </div>
                  <BuildingLibraryIcon className="h-6 w-6 text-slate-400" />
                </div>
                   
                    {poolAdmin && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <MetricCard label="NAV" value={formatCurrency(poolAdmin.nav)} />
                      <MetricCard label="Outstanding" value={formatCurrency(poolAdmin.outstanding)} />
                      <MetricCard label="Total supply" value={formatNumber(poolAdmin.totalSupply)} />
                      <MetricCard
                        label="Token address"
                        value={poolAdmin.tokenAddress ?? "Pending"}
                        valueClassName="text-base font-semibold text-slate-900 break-all leading-5"
                    />
                  </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="h-4 w-4 text-amber-500" />
                        WA coupon {formatPercent(poolAdmin.metrics.waCoupon, 2)} · WA DSCR {formatPercent(poolAdmin.metrics.waDscr, 2)} · WA term
                        {` ${poolAdmin.metrics.waTerm.toFixed(0)} mos`}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-white px-2 py-1 font-semibold">Leverage {formatPercent(poolAdmin.metrics.leverage, 1)}</span>
                        <span className="rounded-full bg-white px-2 py-1 font-semibold">Coverage {formatPercent(poolAdmin.metrics.coverage, 1)}</span>
                        <span className="rounded-full bg-white px-2 py-1 font-semibold">{Object.keys(poolAdmin.geography).length} states</span>
                      </div>
                    </div>
                    
                    <InvestorTable investors={poolAdmin.investors} />
                    <CashflowTable entries={poolAdmin.cashflows} />
                  </div>
               )}
              </div>
                  <WeightedMetrics loans={selectedLoans} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
