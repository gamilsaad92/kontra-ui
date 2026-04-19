import { useMemo } from 'react';
  import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
  import { useLoanList } from '../../../features/portfolio/loans/api';
  import { useAssetList } from '../../../features/portfolio/assets/api';
  import DataState from '../../../components/DataState';
  import type { CanonicalEntity } from '../../../features/crud/types';

  // ── Flexible field accessors ──────────────────────────────────────────────────
  function pick(data: Record<string, unknown>, ...keys: string[]): unknown {
    for (const k of keys) {
      if (data?.[k] !== undefined && data[k] !== null && data[k] !== '') return data[k];
    }
    return undefined;
  }
  const getNum = (data: Record<string, unknown>, ...keys: string[]) => {
    const v = pick(data, ...keys);
    return v !== undefined ? parseFloat(String(v)) : undefined;
  };
  const getStr = (data: Record<string, unknown>, ...keys: string[]) => {
    const v = pick(data, ...keys);
    return v !== undefined ? String(v) : undefined;
  };
  const getLoanAmount = (d: Record<string, unknown>) =>
    getNum(d, 'loan_amount', 'principal', 'amount', 'loan_balance', 'commitment');
  const getLtv = (d: Record<string, unknown>) =>
    getNum(d, 'ltv', 'ltv_pct', 'loan_to_value', 'LTV');
  const getPropertyType = (d: Record<string, unknown>) =>
    getStr(d, 'property_type', 'asset_type', 'collateral_type') ?? 'other';
  const getMaturityDate = (d: Record<string, unknown>) =>
    getStr(d, 'maturity_date', 'maturity', 'loan_maturity', 'due_date');

  function formatUSD(n: number): string {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  }

  const PROP_COLORS: Record<string, string> = {
    multifamily: '#800020',
    office: '#b45309',
    retail: '#0f766e',
    industrial: '#1d4ed8',
    hotel: '#7c3aed',
    mixed_use: '#db2777',
    land: '#92400e',
    other: '#64748b',
  };

  const PROP_LABELS: Record<string, string> = {
    multifamily: 'Multifamily',
    office: 'Office',
    retail: 'Retail',
    industrial: 'Industrial',
    hotel: 'Hotel',
    mixed_use: 'Mixed Use',
    land: 'Land',
    other: 'Other',
  };

  const QUARTER_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function toQuarterKey(d: Date): string {
    return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
  }

  function buildMaturityLadder(loans: CanonicalEntity[]) {
    const buckets: Record<string, number> = {};
    const now = new Date();
    for (const loan of loans) {
      const dateStr = getMaturityDate(loan.data as Record<string, unknown>);
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (isNaN(d.getTime()) || d < now) continue;
      const key = toQuarterKey(d);
      buckets[key] = (buckets[key] || 0) + 1;
    }
    return Object.entries(buckets)
      .map(([q, count]) => ({ q, count }))
      .sort((a, b) => {
        const [qa, ya] = a.q.split(' ');
        const [qb, yb] = b.q.split(' ');
        return parseInt(ya) !== parseInt(yb)
          ? parseInt(ya) - parseInt(yb)
          : qa.localeCompare(qb);
      })
      .slice(0, 8);
  }

  const STATUS_DISPLAY: Record<string, string> = {
    active: 'Performing',
    pending: 'Watch',
    rejected: 'Delinquent',
    inactive: 'Matured',
    draft: 'Draft',
  };

  export default function PortfolioOverviewPage() {
    const loansQuery = useLoanList();
    const assetsQuery = useAssetList();
    const loans = (loansQuery.data?.items ?? []) as CanonicalEntity[];
    const assets = (assetsQuery.data?.items ?? []) as CanonicalEntity[];

    const kpis = useMemo(() => {
      const amounts = loans.map(l => getLoanAmount(l.data as Record<string, unknown>)).filter((n): n is number => n !== undefined);
      const ltvs = loans.map(l => getLtv(l.data as Record<string, unknown>)).filter((n): n is number => n !== undefined);
      const aum = amounts.reduce((s, n) => s + n, 0);
      const avgLtv = ltvs.length ? ltvs.reduce((s, n) => s + n, 0) / ltvs.length : undefined;
      const now = new Date();
      const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const maturingSoon = loans.filter(l => {
        const ds = getMaturityDate(l.data as Record<string, unknown>);
        if (!ds) return false;
        const d = new Date(ds);
        return !isNaN(d.getTime()) && d >= now && d <= in90;
      }).length;
      const watchCount = loans.filter(l => l.status === 'pending').length;
      const delinqCount = loans.filter(l => l.status === 'rejected').length;
      return { aum, avgLtv, maturingSoon, watchCount, delinqCount, total: loans.length, assetTotal: assets.length };
    }, [loans, assets]);

    const propTypeData = useMemo(() => {
      const counts: Record<string, number> = {};
      for (const loan of loans) {
        const t = getPropertyType(loan.data as Record<string, unknown>);
        counts[t] = (counts[t] || 0) + 1;
      }
      return Object.entries(counts).map(([type, count]) => ({
        type,
        label: PROP_LABELS[type] ?? type,
        count,
        color: PROP_COLORS[type] ?? '#64748b',
      }));
    }, [loans]);

    const maturityLadder = useMemo(() => buildMaturityLadder(loans), [loans]);

    if (loansQuery.isLoading || assetsQuery.isLoading) {
      return <DataState loading={true} />;
    }
    if (loansQuery.isError) {
      return <DataState error="Failed to load portfolio data." onRetry={() => loansQuery.refetch()} />;
    }

    const hasData = loans.length > 0;

    return (
      <div className="space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Total AUM" value={kpis.aum > 0 ? formatUSD(kpis.aum) : '—'} sub={`${kpis.total} loan${kpis.total !== 1 ? 's' : ''}`} />
          <KpiCard label="Avg LTV" value={kpis.avgLtv !== undefined ? `${kpis.avgLtv.toFixed(1)}%` : '—'} sub="across portfolio" />
          <KpiCard label="Watch / Delinquent" value={`${kpis.watchCount + kpis.delinqCount}`} sub="require attention" accent={kpis.watchCount + kpis.delinqCount > 0} />
          <KpiCard label="Maturing ≤ 90d" value={`${kpis.maturingSoon}`} sub="loans" accent={kpis.maturingSoon > 0} />
        </div>

        {!hasData ? (
          <EmptyPortfolio />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Property Type Breakdown */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Portfolio by Property Type</h3>
              {propTypeData.length === 0 ? (
                <p className="text-sm text-slate-400">No property type data recorded on loans yet.</p>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={propTypeData}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        strokeWidth={2}
                      >
                        {propTypeData.map((entry) => (
                          <Cell key={entry.type} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} loan${v !== 1 ? 's' : ''}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex flex-wrap gap-2 sm:flex-col">
                    {propTypeData.map(entry => (
                      <li key={entry.type} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                        {entry.label} ({entry.count})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Maturity Ladder */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Maturity Ladder</h3>
              {maturityLadder.length === 0 ? (
                <p className="text-sm text-slate-400">No maturity dates recorded on loans yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={maturityLadder} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="q" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v} loan${v !== 1 ? 's' : ''}`, 'Maturing']} />
                    <Bar dataKey="count" fill="#800020" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* Status breakdown */}
        {hasData && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Loan Status Summary</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(STATUS_DISPLAY).map(([status, label]) => {
                const count = loans.filter(l => l.status === status).length;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2 text-sm">
                    <StatusBadge status={status} />
                    <span className="font-semibold text-slate-800">{count}</span>
                    <span className="text-slate-500">{label}</span>
                  </div>
                );
              })}
              {loans.filter(l => !STATUS_DISPLAY[l.status]).length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2 text-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
                  <span className="font-semibold text-slate-800">{loans.filter(l => !STATUS_DISPLAY[l.status]).length}</span>
                  <span className="text-slate-500">Uncategorized</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
    return (
      <div className={`rounded-xl border bg-white p-4 ${accent ? 'border-amber-200' : 'border-slate-200'}`}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${accent ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    );
  }

  function EmptyPortfolio() {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600">No loans in portfolio yet</p>
        <p className="mt-1 text-xs text-slate-400">Add loans in the Loans tab to see portfolio analytics here.</p>
      </div>
    );
  }

  export function StatusBadge({ status }: { status: string }) {
    const cfg: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700',
      pending: 'bg-amber-100 text-amber-700',
      rejected: 'bg-red-100 text-red-700',
      inactive: 'bg-slate-100 text-slate-600',
      draft: 'bg-blue-100 text-blue-700',
    };
    const label = STATUS_DISPLAY[status] ?? status;
    const cls = cfg[status] ?? 'bg-slate-100 text-slate-600';
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
        {label}
      </span>
    );
  }
  