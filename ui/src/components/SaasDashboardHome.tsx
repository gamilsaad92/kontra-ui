import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import TokenizationApiPanel from "./TokenizationApiPanel";

type RiskBucket = {
  label: string;
  value: number;
};

type RiskEntitySummary = {
  total: number;
  buckets: RiskBucket[];
  top: Array<{
    id: string | number;
    name?: string;
    asset?: string;
    risk: number;
    value?: number | null;
    amount?: number | null;
  }>;
};

type RiskNotification = {
  id: string | number;
  message: string;
  link?: string | null;
  created_at?: string | null;
};

type RiskAlert = {
  id: string | number;
  label: string;
  risk: number;
  type: "asset" | "loan" | "troubled_asset" | string;
};

type RiskSummary = {
  combinedBuckets: RiskBucket[];
  assets: RiskEntitySummary;
  loans: RiskEntitySummary;
  troubled: RiskEntitySummary;
  topAlerts: RiskAlert[];
  lastRunAt: string | null;
  notifications: RiskNotification[];
};

type QuickAction = {
  label: string;
  description: string;
  href: string;
  tone: "emerald" | "sky" | "amber" | "violet";
};

type TokenProduct = {
  name: string;
  status: "Live" | "In Pilot" | "In Discovery";
  underlying: string;
  denomination: string;
  rights: string[];
  summary: string;
};

type BlockchainStack = {
  family: string;
  devNetwork: string;
  mainnetTargets: string[];
  rationale: string;
};

type PoolTokenStandard = {
  standard: string;
  usage: string;
  status: string;
  notes: string;
  factory?: string;
  whitelistRegistry?: string;
};

type LoanTokenStandard = {
  standard: string;
  usage: string;
  status: string;
  notes?: string;
};

type TokenizationServiceMeta = {
  rpcUrl: string;
  network: {
    name?: string;
    chainId?: number;
  };
  adminAddress: string | null;
  contracts: {
    poolFactory: string;
    whitelistRegistry: string;
  };
};

type TokenizationStack = {
  blockchain: BlockchainStack;
  poolToken: PoolTokenStandard;
  loanTokens: LoanTokenStandard[];
  service: TokenizationServiceMeta;
    whitelistRegistry: {
    address: string;
    entries: number;
    investorTypes: Record<string, number>;
  };
  poolFactory: {
    address: string;
    poolsDeployed: number;
  };
  pools: Array<{
    poolId: string;
    name: string;
    symbol: string;
    contractAddress: string;
    whitelistRegistry: string;
    admin?: string | null;
    active: boolean;
    totalSupply: number;
    holders: Array<{ address: string; balance: number }>;
  }>;
  integration: {
    frontend: string;
    backend: string;
  };
};

type Props = {
  apiBase?: string;
};

const quickActions: QuickAction[] = [
  {
    label: "Submit Loan Sale",
    description: "Move whole loans with automated settlement tracking.",
    href: "/trades?type=loan_sale",
    tone: "emerald"
  },
  {
    label: "Launch Participation",
    description: "Coordinate participations with shared schedules.",
    href: "/trades?type=participation",
    tone: "sky"
  },
  {
    label: "Book Repo",
    description: "Capture short-term liquidity across repo lines.",
    href: "/trades?type=repo",
    tone: "amber"
  },
  {
    label: "Assign Syndication",
    description: "Update allocations across your syndication book.",
    href: "/trades?type=syndication_assignment",
    tone: "violet"
  }
];

const tokenProducts: TokenProduct[] = [
  {
    name: "Kontra Pool Token",
    status: "Live",
    underlying: "Pool of CRE loans",
    denomination: "1 token = 1 USD of NAV at issuance (NAV tracked in Kontra)",
    rights: [
      "Pro-rata share of interest and principal collections after fees",
      "Recoveries",
      "Share of losses"
    ],
    summary:
      "Kontra's first on-chain instrument captures pooled CRE loan performance with transparent NAV tracking and pro-rata economics."
  }
];

function normalizeApiBase(base?: string): string | undefined {
  if (!base) return undefined;
  const trimmed = base.trim();
  if (!trimmed) return undefined;
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  return withoutTrailing.endsWith("/api") ? withoutTrailing : `${withoutTrailing}/api`;
}

function bucketTotal(buckets?: RiskBucket[]): number {
  return (buckets ?? []).reduce((sum, bucket) => sum + (bucket?.value ?? 0), 0);
}

function toPercent(value: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null) return "—";
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function shortenAddress(address?: string | null): string {
  if (!address) return "—";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatRpcEndpoint(url?: string | null): string {
  if (!url) return "—";
  if (url.length <= 48) return url;
  return `${url.slice(0, 32)}…${url.slice(-10)}`;
}

function formatTimestamp(timestamp?: string | null): string {
  if (!timestamp) return "Unknown";
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString();
  } catch (err) {
    return "Unknown";
  }
}

function riskTone(type: RiskAlert["type"], score: number): string {
  if (score >= 0.7) return "bg-rose-100 text-rose-700 border-rose-200";
  if (score >= 0.4) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

const toneStyles: Record<QuickAction["tone"], string> = {
  emerald: "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:border-emerald-200",
  sky: "bg-sky-50 text-sky-700 border border-sky-100 hover:border-sky-200",
  amber: "bg-amber-50 text-amber-700 border border-amber-100 hover:border-amber-200",
  violet: "bg-violet-50 text-violet-700 border border-violet-100 hover:border-violet-200"
};

type MarketplaceHighlight = {
  id: string | number;
  title: string;
  sector: string | null;
  geography: string | null;
  parAmount: number | null;
  occupancyRate: number | null;
  dscr: number | null;
  dscrBuffer: number | null;
  noiMargin: number | null;
};

type MarketplaceSummary = {
  totals: {
    activeListings: number;
    avgOccupancyRate: number | null;
    avgDscr: number | null;
    avgDscrBuffer: number | null;
    avgNoiMargin: number | null;
    totalParAmount: number | null;
  };
  highlights: MarketplaceHighlight[];
  borrowerKpiLeaders: Array<{ name: string; count: number }>;
  updatedAt: string | null;
};

function formatPercentValue(value?: number | null, decimals = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(decimals)}%`;
}

function formatRatio(value?: number | null, decimals = 2): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(decimals);
}

function formatSignedPercent(value?: number | null, decimals = 1): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  const formatted = (value * 100).toFixed(decimals);
  return `${value > 0 ? "+" : value < 0 ? "" : ""}${formatted}%`;
}

export default function SaasDashboardHome({ apiBase }: Props) {
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [riskLoading, setRiskLoading] = useState(true);
  const [marketplaceSummary, setMarketplaceSummary] = useState<MarketplaceSummary | null>(null);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [tokenizationStack, setTokenizationStack] = useState<TokenizationStack | null>(null);
  const [tokenizationError, setTokenizationError] = useState<string | null>(null);
  const [tokenizationLoading, setTokenizationLoading] = useState(true);
  
  useEffect(() => {
    let cancelled = false;
    function loadRisk() {
      setRiskLoading(true);
      setRiskError(null);
      const baseURL = normalizeApiBase(apiBase);
      api
        .get<RiskSummary>("/investors/risk", baseURL ? { baseURL } : undefined)
        .then((response) => {
          if (!cancelled) {
            setRiskSummary(response.data);
          }
        })
        .catch((err: any) => {
          if (cancelled) {
            return;
          }
          const status = err?.response?.status;
          if (status === 404) {
            setRiskError("Trading module is disabled for this environment.");
          } else {
            setRiskError("Unable to load investor risk summary.");
          }
          setRiskSummary(null);
        })
        .finally(() => {
          if (!cancelled) {
            setRiskLoading(false);
          }
        });
    }
    loadRisk();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    function loadMarketplace() {
      setMarketplaceLoading(true);
      setMarketplaceError(null);
      const baseURL = normalizeApiBase(apiBase);
      api
        .get<MarketplaceSummary>("/dashboard/marketplace", baseURL ? { baseURL } : undefined)
        .then((response) => {
          if (!cancelled) {
            setMarketplaceSummary(response.data);
          }
        })
        .catch((err: any) => {
          if (cancelled) {
            return;
          }
          const status = err?.response?.status;
          if (status === 404) {
            setMarketplaceError("Trading module is disabled for this environment.");
          } else {
            setMarketplaceError("Unable to load marketplace metrics.");
          }
          setMarketplaceSummary(null);
        })
        .finally(() => {
          if (!cancelled) {
            setMarketplaceLoading(false);
          }
        });
    }
    loadMarketplace();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

   useEffect(() => {
    let cancelled = false;

    function loadTokenizationStack() {
      setTokenizationLoading(true);
      setTokenizationError(null);
      const baseURL = normalizeApiBase(apiBase);
      api
        .get<TokenizationStack>('/tokenization/stack', baseURL ? { baseURL } : undefined)
        .then((response) => {
          if (!cancelled) {
            setTokenizationStack(response.data);
          }
        })
        .catch(() => {
          if (cancelled) return;
          setTokenizationError('Unable to load blockchain and token standard.');
          setTokenizationStack(null);
        })
        .finally(() => {
          if (!cancelled) {
            setTokenizationLoading(false);
          }
        });
    }

    loadTokenizationStack();

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const combinedTotal = useMemo(() => bucketTotal(riskSummary?.combinedBuckets), [riskSummary]);

  const sections = useMemo(
    () => [
      { key: "assets", label: "Assets", summary: riskSummary?.assets },
      { key: "loans", label: "Loans", summary: riskSummary?.loans },
      { key: "troubled", label: "Troubled", summary: riskSummary?.troubled }
    ],
    [riskSummary]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">SaaS Portfolio Overview</h1>
        <p className="text-sm text-slate-500">
          Monitor investor risk, trading workflows, and notifications from the unified SaaS control center.
        </p>
        {riskSummary?.lastRunAt && (
          <p className="text-xs text-slate-400">
            Risk scores refreshed {formatTimestamp(riskSummary.lastRunAt)}
          </p>
        )}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Blockchain & Token Standard</h2>
            <p className="text-sm text-slate-500">
              Baseline chain selection for pooled tokens today and loan-specific tokens later.
            </p>
          </div>
          {tokenizationStack?.blockchain?.devNetwork && (
            <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {tokenizationStack.blockchain.devNetwork}
            </span>
          )}
        </div>

        {tokenizationLoading && (
          <p className="mt-3 text-sm text-slate-500">Loading chain and token defaults…</p>
        )}

        {tokenizationError && !tokenizationLoading && (
          <p className="mt-3 text-sm text-rose-600">{tokenizationError}</p>
        )}

        {!tokenizationLoading && !tokenizationError && tokenizationStack && (
          <>
           <div className="mt-4 grid gap-4 lg:grid-cols-4">
              <article className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blockchain</p>
                    <h3 className="text-lg font-semibold text-slate-900">{tokenizationStack.blockchain.family}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">EVM</span>
                </div>
                   <dl className="space-y-2 text-sm text-slate-700">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Development</dt>
                    <dd className="font-semibold">{tokenizationStack.blockchain.devNetwork}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Mainnet targets</dt>
                    <dd className="font-semibold">{tokenizationStack.blockchain.mainnetTargets.join(', ')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Rationale</dt>
                    <dd>{tokenizationStack.blockchain.rationale}</dd>
                  </div>
                </dl>
              </article>

              <article className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pool Token</p>
                    <h3 className="text-lg font-semibold text-slate-900">{tokenizationStack.poolToken.standard}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {tokenizationStack.poolToken.status}
                  </span>
                </div>
                    <p className="text-sm text-slate-700">{tokenizationStack.poolToken.usage}</p>
                <p className="text-xs text-slate-500">{tokenizationStack.poolToken.notes}</p>
                <dl className="space-y-1 text-xs text-slate-500">
                  {tokenizationStack.poolToken.factory && (
                    <div className="flex items-center justify-between">
                      <dt>Factory</dt>
                      <dd className="font-semibold text-slate-800">{shortenAddress(tokenizationStack.poolToken.factory)}</dd>
                    </div>
                  )}
                  {tokenizationStack.poolToken.whitelistRegistry && (
                    <div className="flex items-center justify-between">
                      <dt>Whitelist</dt>
                      <dd className="font-semibold text-slate-800">
                        {shortenAddress(tokenizationStack.poolToken.whitelistRegistry)}
                      </dd>
                    </div>
                  )}
                </dl>
              </article>

              <article className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">  
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Loan Tokens (later)</p>
                  <h3 className="text-lg font-semibold text-slate-900">ERC-721 & ERC-1155</h3>
                </div>
                <ul className="space-y-3 text-sm text-slate-700">
                  {tokenizationStack.loanTokens.map((token) => (
                    <li key={token.standard} className="rounded-lg bg-white/70 p-3 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold uppercase tracking-wide">{token.standard}</span>
                        <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">{token.status}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{token.usage}</p>
                      {token.notes && <p className="text-xs text-slate-500">{token.notes}</p>}
                    </li>
                  ))}
                </ul>
              </article>
                          <article className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tokenization Service</p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {tokenizationStack.service.network?.name || 'Custom network'}
                    </h3>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">RPC</span>
                </div>
                <dl className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Chain ID</dt>
                    <dd className="font-semibold">{tokenizationStack.service.network?.chainId ?? '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Admin Wallet</dt>
                    <dd className="font-semibold">{shortenAddress(tokenizationStack.service.adminAddress)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Pool Factory</dt>
                    <dd className="font-semibold">{shortenAddress(tokenizationStack.service.contracts.poolFactory)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Whitelist Registry</dt>
                    <dd className="font-semibold">{shortenAddress(tokenizationStack.service.contracts.whitelistRegistry)}</dd>
                  </div>
                </dl>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">RPC Endpoint</p>
                  <p className="break-words font-mono text-xs text-slate-700">{formatRpcEndpoint(tokenizationStack.service.rpcUrl)}</p>
                </div>
              </article>
            </div>

               <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <article className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Whitelist Registry</p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {shortenAddress(tokenizationStack.whitelistRegistry.address)}
                    </h3>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                    {tokenizationStack.whitelistRegistry.entries} entries
                  </span>
                </div>
                 <p className="text-sm text-slate-700">
                  Enforces KYC/AML before mint or transfer. Investor types and provider refs are persisted per address.
                </p>
                <dl className="space-y-2 text-sm text-slate-700">
                  {Object.entries(tokenizationStack.whitelistRegistry.investorTypes || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-xs">
                      <dt className="font-semibold uppercase tracking-wide text-slate-500">{type}</dt>
                      <dd className="font-semibold text-slate-800">{count}</dd>
                    </div>
                  ))}
                </dl>
              </article>
                 
              <article className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pool Factory</p>
                    <h3 className="text-lg font-semibold text-slate-900">{shortenAddress(tokenizationStack.poolFactory.address)}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {tokenizationStack.poolFactory.poolsDeployed} pools
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  Deploys ERC-20 pool tokens with embedded whitelist enforcement and admin-controlled lifecycle.
                </p>
                <div className="space-y-2">
                  {tokenizationStack.pools.length === 0 && (
                    <p className="text-sm text-slate-500">No pools have been deployed yet.</p>
                  )}
                  {tokenizationStack.pools.slice(0, 3).map((pool) => (
                    <div key={pool.poolId} className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold uppercase tracking-wide">{pool.symbol}</span>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          {pool.active ? 'Active' : 'Closed'}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900">{pool.name}</p>
                      <p className="text-xs text-slate-500">{shortenAddress(pool.contractAddress)}</p>
                      <p className="text-xs text-slate-600">
                        Supply: {pool.totalSupply} · Holders: {pool.holders?.length ?? 0}
                      </p>
                    </div>
                    ))}
                </div>
              </article>
            </div>
          </>
        )}
      </section>

         <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <TokenizationApiPanel apiBase={apiBase} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Token Products</h2>
            <p className="text-sm text-slate-500">
              Live instruments available to investors, mapped to underlying collateral and economic rights.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            First product live
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {tokenProducts.map((product) => (
            <article
              key={product.name}
              className="flex flex-col gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">First live product</p>
                  <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                  <p className="text-sm text-slate-600">{product.summary}</p>
                </div>
                <span className="inline-flex items-center self-start rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {product.status}
                </span>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Underlying</dt>
                  <dd className="text-sm font-semibold text-slate-900">{product.underlying}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Denomination</dt>
                  <dd className="text-sm font-semibold text-slate-900">{product.denomination}</dd>
                </div>
              </dl>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Investor rights</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {product.rights.map((right) => (
                    <li key={right} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                      <span>{right}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      {riskLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Loading risk telemetry…</p>
        </div>
      )}

      {!riskLoading && riskError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {riskError}
        </div>
      )}

      {!riskLoading && !riskError && riskSummary && (
        <>
          <section className="grid gap-6 lg:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Risk Buckets</h2>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{combinedTotal}</p>
              <p className="text-sm text-slate-500">Total monitored exposures</p>
              <dl className="mt-4 space-y-2">
                {(riskSummary.combinedBuckets ?? []).map((bucket) => (
                  <div key={bucket.label} className="flex items-center justify-between text-sm">
                    <dt className="text-slate-600">{bucket.label}</dt>
                    <dd className="font-medium text-slate-900">
                      {bucket.value} <span className="ml-2 text-xs text-slate-500">{toPercent(bucket.value, combinedTotal)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Top Alerts</h2>
              {riskSummary.topAlerts.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No elevated risk signals detected.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {riskSummary.topAlerts.map((alert) => (
                    <li key={alert.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{alert.label}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{alert.type.replace(/_/g, " ")}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${riskTone(alert.type, alert.risk)}`}>
                        Risk {Math.round(alert.risk * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            {sections.map(({ key, label, summary }) => (
              <article key={key} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{summary?.total ?? 0}</p>
                <p className="text-xs text-slate-500">Active records scored</p>
                <dl className="mt-3 space-y-1">
                  {(summary?.buckets ?? []).map((bucket) => (
                    <div key={bucket.label} className="flex items-center justify-between text-xs">
                      <dt className="text-slate-500">{bucket.label}</dt>
                      <dd className="font-medium text-slate-700">{bucket.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 space-y-2">
                  {(summary?.top ?? []).map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-sm font-medium text-slate-800">{item.name || item.asset}</p>
                      <p className="text-xs text-slate-500">Risk {Math.round(item.risk * 100)}%</p>
                      {(item.value !== undefined && item.value !== null) || (item.amount !== undefined && item.amount !== null) ? (
                        <p className="text-xs font-medium text-slate-600">{formatCurrency((item.value ?? item.amount) ?? undefined)}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}

            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3 xl:col-span-1">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent Notifications</h3>
              {riskSummary.notifications.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No investor notifications yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {riskSummary.notifications.map((notification) => (
                    <li key={notification.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-sm text-slate-700">{notification.message}</p>
                      {notification.created_at && (
                        <p className="text-xs text-slate-400">{formatTimestamp(notification.created_at)}</p>
                      )}
                      {notification.link && (
                        <a
                          href={notification.link}
                          className="mt-1 inline-flex text-xs font-medium text-sky-600 hover:text-sky-700"
                        >
                          View details
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        </>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Marketplace Pulse</h2>
            <p className="text-sm text-slate-500">Live insight into exchange listing health and traction.</p>
          </div>
          {marketplaceSummary?.updatedAt && (
            <p className="text-xs text-slate-400">
              Updated {formatTimestamp(marketplaceSummary.updatedAt)}
            </p>
          )}
        </div>

        {marketplaceLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading marketplace metrics…</p>
          </div>
        ) : marketplaceError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            {marketplaceError}
          </div>
        ) : marketplaceSummary ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Listing Overview</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Active listings</dt>
                  <dd className="font-semibold text-slate-900">
                    {marketplaceSummary.totals.activeListings}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Avg. occupancy</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatPercentValue(marketplaceSummary.totals.avgOccupancyRate ?? null, 1)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Avg. DSCR</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatRatio(marketplaceSummary.totals.avgDscr ?? null, 2)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Avg. DSCR buffer</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatRatio(marketplaceSummary.totals.avgDscrBuffer ?? null, 2)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Avg. NOI margin</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatSignedPercent(marketplaceSummary.totals.avgNoiMargin ?? null, 1)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Total par marketed</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatCurrency(marketplaceSummary.totals.totalParAmount ?? undefined)}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lead Listings</h3>
              {marketplaceSummary.highlights.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No listings have been published yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {marketplaceSummary.highlights.slice(0, 3).map((listing) => (
                    <li key={listing.id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">{listing.title}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        {listing.sector && <span>{listing.sector}</span>}
                        {listing.geography && <span>{listing.geography}</span>}
                        {listing.parAmount !== null && (
                          <span>{formatCurrency(listing.parAmount)}</span>
                        )}
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div>
                          <dt className="text-slate-500">Occupancy</dt>
                          <dd className="font-medium text-slate-900">
                            {formatPercentValue(listing.occupancyRate ?? null, 1)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">DSCR</dt>
                          <dd className="font-medium text-slate-900">{formatRatio(listing.dscr ?? null, 2)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Buffer</dt>
                          <dd className="font-medium text-slate-900">
                            {formatRatio(listing.dscrBuffer ?? null, 2)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">NOI margin</dt>
                          <dd className="font-medium text-slate-900">
                            {formatSignedPercent(listing.noiMargin ?? null, 1)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Borrower KPI Signals</h3>
              {marketplaceSummary.borrowerKpiLeaders.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">KPI feeds have not been ingested yet.</p>
              ) : (
                <ul className="mt-4 space-y-2 text-sm">
                  {marketplaceSummary.borrowerKpiLeaders.map((item) => (
                    <li key={item.name} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <span className="font-medium text-slate-800">{item.name}</span>
                      <span className="text-xs text-slate-500">{item.count} listings</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Trading Shortcuts</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              className={`flex h full flex-col justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ${toneStyles[action.tone]}`}
            >
              <div>
                <p className="text-base font-semibold">{action.label}</p>
                <p className="mt-1 text-sm font-normal text-slate-600">{action.description}</p>
              </div>
              <span className="mt-3 text-xs font-semibold uppercase text-slate-500">Open workspace →</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
