import { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  BanknotesIcon,
  BoltIcon,
  ChartBarIcon,
  ChartPieIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useChains } from "wagmi";
import {
  type OnchainOverview,
  type OnchainPosition,
  type OnchainTransaction,
  fetchOnchainOverview,
   fetchOnchainPerformance,
  recordOnchainTransaction,
   type OnchainPerformance,
} from "../services/blockchain";

function formatCurrency(value?: number | null, maximumFractionDigits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits });
}

function formatPercent(value?: number | null, maximumFractionDigits = 1) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(maximumFractionDigits)}%`;
}

function SummaryCard({ title, value, helper }: { title: string; value: string; helper?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

function PositionRow({ position }: { position: OnchainPosition }) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-900">{position.property}</div>
        <div className="text-xs text-slate-500">{position.borrower} • {position.loanId}</div>
      </td>
      <td className="px-4 py-3 text-slate-800">{formatCurrency(position.notional)}</td>
      <td className="px-4 py-3 text-slate-800">{formatPercent(position.ownership, 1)}</td>
      <td className="px-4 py-3 text-slate-800">{formatPercent(position.coupon, 2)}</td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[12px] font-semibold capitalize text-slate-700">
          {position.status}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-800">{position.nextPayout ?? "—"}</td>
    </tr>
  );
}

function TransactionRow({ transaction }: { transaction: OnchainTransaction }) {
  const shortHash = useMemo(() => `${transaction.txHash.slice(0, 10)}…${transaction.txHash.slice(-4)}`, [transaction.txHash]);
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-4 py-3 font-semibold text-slate-900">{transaction.action}</td>
      <td className="px-4 py-3 text-slate-800">{transaction.loanId || "—"}</td>
      <td className="px-4 py-3 text-slate-800">{formatCurrency(transaction.notional)}</td>
      <td className="px-4 py-3 text-slate-800">{transaction.status}</td>
      <td className="px-4 py-3 text-slate-800">{shortHash}</td>
      <td className="px-4 py-3 text-slate-800">{new Date(transaction.timestamp).toLocaleString()}</td>
    </tr>
  );
}

export default function OnchainDashboard() {
  const { address } = useAccount();
  const chainId = useChainId();
  const chains = useChains();
  const chain = useMemo(() => chains.find((item) => item.id === chainId), [chains, chainId]);
  const [overview, setOverview] = useState<OnchainOverview | null>(null);
  const [performance, setPerformance] = useState<OnchainPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async (wallet?: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewData, performanceData] = await Promise.all([
        fetchOnchainOverview(wallet ?? undefined),
        fetchOnchainPerformance(wallet ?? undefined),
      ]);
      setOverview(overviewData);
      setPerformance(performanceData);
    } catch (err) {
      setError("Unable to load on-chain data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview(address ?? undefined);
  }, [address]);

  const handleLogSync = async () => {
    if (!address) {
      setError("Connect a wallet to record activity");
      return;
    }
    try {
      await recordOnchainTransaction({
        wallet: address,
        chainId: chain?.id,
        action: 'walletSync',
        status: 'recorded',
        notional: 0,
        metadata: { reason: 'ui-sync' },
      });
      await loadOverview(address);
    } catch (err) {
      setError("Unable to record on-chain sync");
    }
  };

  const positions = overview?.positions ?? [];
  const transactions = overview?.transactions ?? [];
  const loanPerformance = performance?.loanPerformance ?? [];
  const aiValuations = performance?.aiValuations ?? [];
  
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blockchain layer</p>
          <h1 className="text-2xl font-semibold text-slate-900">Wallet ownership & cashflows</h1>
          <p className="text-sm text-slate-600">Track ERC-721 whole loans, ERC-20 participations, and pro-rata distributions.</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectButton accountStatus="address" showBalance={false} label="Connect wallet" />
          <button
            type="button"
            onClick={handleLogSync}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Record sync
          </button>
        </div>
      </header>

      {error && <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {isLoading && <div className="text-sm text-slate-500">Loading on-chain state…</div>}

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Connected wallet"
          value={address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected"}
          helper={chain ? `${chain.name} • Chain ${chain.id}` : "Select a network"}
        />
        <SummaryCard
          title="On-chain exposure"
          value={formatCurrency(overview?.totals.exposure ?? 0)}
          helper="Sum of ERC-721 and ERC-20 balances"
        />
        <SummaryCard
          title="Average yield"
          value={formatPercent(overview?.totals.averageYield ?? 0, 2)}
          helper="Weighted by current holdings"
        />
        <SummaryCard title="Next payout" value={overview?.totals.nextPayout ?? '—'} helper="CashFlowSplitter schedule" />
      </section>

            <section className="grid gap-4 lg:grid-cols-3">
        <SummaryCard
          title="Chain finality"
          value={`${performance?.chainHealth.finalitySeconds ?? "-"}s`}
          helper="Block finality from RPC health checks"
        />
        <SummaryCard
          title="Settlement lag"
          value={`${performance?.chainHealth.settlementLagSeconds ?? "-"}s`}
          helper="On-chain → Supabase index delay"
        />
        <SummaryCard
          title="Oracle coverage"
          value={formatPercent(performance?.chainHealth.oracleCoverage ?? 0.9, 0)}
          helper="Price feeds powering AI valuations"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Loan & participation balances</p>
            <p className="text-xs text-slate-500">ERC-721 whole loans and ERC-20 participations sourced via viem adapters.</p>
          </div>
          {overview?.contracts && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                <ShieldCheckIcon className="h-4 w-4" /> LoanToken {overview.contracts.loanToken.address.slice(0, 8)}…
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                <BanknotesIcon className="h-4 w-4" /> Participation {overview.contracts.participationToken.address.slice(0, 8)}…
              </span>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Loan</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Notional</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Ownership</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Coupon</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Next payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {positions.map((position) => (
                <PositionRow key={position.loanId} position={position} />
              ))}
              {positions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-slate-500">
                    Connect a wallet to load holdings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">On-chain loan performance</p>
            <p className="text-xs text-slate-500">DSCR, LTV, delinquency and paydown progress streamed from blockchain receipts.</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
            <ChartBarIcon className="h-4 w-4" /> Chain dashboards
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Loan</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Chain</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">DSCR</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">LTV</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Delinquency</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Realized / Projected</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Paydown</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Last payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loanPerformance.map((row) => (
                <tr key={row.loanId} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{row.property || row.loanId}</div>
                    <div className="text-xs text-slate-500">{row.borrower || '—'} • {row.status}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{row.chain}</td>
                  <td className="px-4 py-3 text-slate-800">{row.dscr.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-800">{formatPercent(row.ltv, 0)}</td>
                  <td className="px-4 py-3 text-slate-800">{formatPercent(row.delinquencyRate, 1)}</td>
                  <td className="px-4 py-3 text-slate-800">
                    {formatPercent(row.realizedYield, 2)} / {formatPercent(row.projectedYield, 2)}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{formatPercent(row.paydownProgress, 0)}</td>
                  <td className="px-4 py-3 text-slate-800">{row.lastPaymentTx}</td>
                </tr>
              ))}
              {loanPerformance.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-sm text-slate-500">
                    Connect a wallet to see live on-chain performance.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Recent blockchain activity</p>
              <p className="text-xs text-slate-500">Wallet events written to Supabase for off-chain sync.</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              <BoltIcon className="h-4 w-4" /> Live
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Action</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Loan</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Notional</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Tx hash</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-sm text-slate-500">
                      No blockchain activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Chain metadata</p>
              <p className="text-xs text-slate-500">Contracts, network, and splitter routing.</p>
            </div>
            <ChartPieIcon className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-3 p-4 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">Network</span>
              <span className="text-slate-600">{overview?.contracts.network.name} • Chain {overview?.contracts.network.chainId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">LoanToken</span>
              <span className="text-slate-600">{overview?.contracts.loanToken.address}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">ParticipationToken</span>
              <span className="text-slate-600">{overview?.contracts.participationToken.address}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">CashFlowSplitter</span>
              <span className="text-slate-600">{overview?.contracts.cashFlowSplitter.address}</span>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">Deployment note</p>
              <p>{overview?.contracts.deploymentNotes ?? 'Replace demo addresses with live deployments as soon as audits complete.'}</p>
            </div>
          </div>
        </div>
      </section>
      
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">AI valuation & token pricing</p>
              <p className="text-xs text-slate-500">Risk-adjusted pricing powered by DSCR, LTV, volatility and chain premiums.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
              NAV ${performance ? performance.tokenPricing.navPerToken.toFixed(2) : "-"} • Secondary ${performance ? performance.tokenPricing.secondaryPrice.toFixed(2) : "-"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Loan</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Fair value</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Risk prem.</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Confidence</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Drivers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aiValuations.map((valuation) => (
                  <tr key={valuation.loanId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">{valuation.loanId}</td>
                    <td className="px-4 py-3 text-slate-800">{formatCurrency(valuation.fairValue, 2)}</td>
                    <td className="px-4 py-3 text-slate-800">{valuation.riskPremiumBps} bps</td>
                    <td className="px-4 py-3 text-slate-800">{formatPercent(valuation.confidence, 0)}</td>
                    <td className="px-4 py-3 text-slate-600">{valuation.drivers.join(', ')}</td>
                  </tr>
                ))}
                {aiValuations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-sm text-slate-500">
                      Token pricing runs once on connect.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">RWA expansion backlog</p>
              <p className="text-xs text-slate-500">Upcoming asset classes with chain selection and launch timing.</p>
            </div>
            <ChartPieIcon className="h-5 w-5 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            {performance?.rwaPipeline.map((item) => (
              <div key={item.type} className="flex items-start justify-between px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.type}</p>
                  <p className="text-xs text-slate-500">{item.notes}</p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <div className="font-semibold text-slate-800">{item.chain}</div>
                  <div className="text-emerald-700">{item.status}</div>
                  <div className="text-slate-500">Launch {item.launchQuarter}</div>
                </div>
              </div>
            ))}
            {(performance?.rwaPipeline?.length ?? 0) === 0 && (
              <div className="px-4 py-4 text-sm text-slate-500">No RWA backlog defined yet.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
