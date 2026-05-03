import { useState } from 'react';

const ASSETS = [
  {
    id: 'AST-2847',
    name: 'Meridian Apartments',
    address: '1420 Meridian Ave, Miami Beach, FL 33139',
    type: 'Multifamily',
    status: 'performing',
    units: 312,
    occupancy: 94.2,
    value: '$148,500,000',
    loanBalance: '$98,200,000',
    ltv: 66.1,
    noi: '$8,420,000',
    capRate: 5.67,
    dscr: 1.48,
    appraiser: 'CBRE Valuation Advisory',
    lastAppraisal: 'Feb 15, 2026',
    token: 'KTRA-2847',
    tokenStatus: 'tokenized',
    vintage: 2018,
    sf: '284,600 SF',
    market: 'Miami-Dade',
    loanId: 'LN-2847',
  },
  {
    id: 'AST-3201',
    name: 'Metro Industrial Portfolio',
    address: '8800 NW 36th St, Doral, FL 33178',
    type: 'Industrial',
    status: 'watch',
    units: 4,
    occupancy: 81.5,
    value: '$62,300,000',
    loanBalance: '$44,900,000',
    ltv: 72.1,
    noi: '$3,180,000',
    capRate: 5.10,
    dscr: 1.19,
    appraiser: 'JLL Valuation & Advisory',
    lastAppraisal: 'Jan 28, 2026',
    token: 'KTRA-3201',
    tokenStatus: 'pending',
    vintage: 2015,
    sf: '618,400 SF',
    market: 'Miami-Dade',
    loanId: 'LN-3201',
  },
  {
    id: 'AST-4012',
    name: 'Harbor Logistics Center',
    address: '22 Harborfront Way, Seattle, WA 98108',
    type: 'Industrial',
    status: 'performing',
    units: 1,
    occupancy: 100,
    value: '$38,750,000',
    loanBalance: '$23,100,000',
    ltv: 59.6,
    noi: '$2,340,000',
    capRate: 6.04,
    dscr: 1.71,
    appraiser: 'Cushman & Wakefield',
    lastAppraisal: 'Mar 3, 2026',
    token: null,
    tokenStatus: 'none',
    vintage: 2020,
    sf: '192,000 SF',
    market: 'Seattle Metro',
    loanId: 'LN-4012',
  },
  {
    id: 'AST-1899',
    name: 'Lakewood Office Tower',
    address: '350 N Orleans St, Chicago, IL 60654',
    type: 'Office',
    status: 'troubled',
    units: 1,
    occupancy: 67.3,
    value: '$89,200,000',
    loanBalance: '$74,600,000',
    ltv: 83.6,
    noi: '$3,960,000',
    capRate: 4.44,
    dscr: 0.91,
    appraiser: 'Avison Young Valuation',
    lastAppraisal: 'Dec 12, 2025',
    token: null,
    tokenStatus: 'none',
    vintage: 2007,
    sf: '480,000 SF',
    market: 'Chicago CBD',
    loanId: 'LN-1899',
  },
  {
    id: 'AST-5544',
    name: 'Bayview Mixed-Use',
    address: '975 Third St, San Francisco, CA 94107',
    type: 'Mixed-Use',
    status: 'performing',
    units: 148,
    occupancy: 97.8,
    value: '$212,000,000',
    loanBalance: '$127,200,000',
    ltv: 60.0,
    noi: '$12,100,000',
    capRate: 5.71,
    dscr: 1.62,
    appraiser: 'HFF | JLL',
    lastAppraisal: 'Mar 22, 2026',
    token: 'KTRA-5544',
    tokenStatus: 'tokenized',
    vintage: 2022,
    sf: '310,200 SF',
    market: 'San Francisco',
    loanId: 'LN-5544',
  },
  {
    id: 'AST-6671',
    name: 'Sunbelt Retail Centers',
    address: '1100 E Camelback Rd, Phoenix, AZ 85014',
    type: 'Retail',
    status: 'watch',
    units: 3,
    occupancy: 88.2,
    value: '$54,100,000',
    loanBalance: '$38,700,000',
    ltv: 71.5,
    noi: '$2,890,000',
    capRate: 5.34,
    dscr: 1.22,
    appraiser: 'CBRE Valuation Advisory',
    lastAppraisal: 'Feb 2, 2026',
    token: null,
    tokenStatus: 'none',
    vintage: 2013,
    sf: '224,800 SF',
    market: 'Phoenix Metro',
    loanId: 'LN-6671',
  },
];

const TYPE_ICONS: Record<string, string> = {
  Multifamily: '🏢',
  Industrial: '🏭',
  Office: '🏛️',
  'Mixed-Use': '🏙️',
  Retail: '🏪',
  Hotel: '🏨',
};

function statusBadge(status: string) {
  if (status === 'performing') return 'bg-emerald-100 text-emerald-700';
  if (status === 'watch') return 'bg-amber-100 text-amber-700';
  if (status === 'troubled') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}

function tokenBadge(status: string) {
  if (status === 'tokenized') return { cls: 'bg-violet-100 text-violet-700', label: 'Tokenized' };
  if (status === 'pending') return { cls: 'bg-amber-100 text-amber-700', label: 'Token Pending' };
  return { cls: 'bg-slate-100 text-slate-500', label: 'Not tokenized' };
}

function LtvBar({ ltv }: { ltv: number }) {
  const color = ltv >= 80 ? '#e11d48' : ltv >= 70 ? '#f59e0b' : '#10b981';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div style={{ width: `${Math.min(ltv, 100)}%`, background: color }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-xs font-mono text-slate-600 w-10 text-right">{ltv.toFixed(1)}%</span>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <p className="text-base font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PortfolioAssetsPage() {
  const [selectedId, setSelectedId] = useState<string>(ASSETS[0].id);
  const [filter, setFilter] = useState<string>('all');

  const types = ['all', ...Array.from(new Set(ASSETS.map(a => a.type)))];
  const filtered = filter === 'all' ? ASSETS : ASSETS.filter(a => a.type === filter);
  const asset = ASSETS.find(a => a.id === selectedId) || ASSETS[0];

  const totalValue = ASSETS.reduce((sum, a) => sum + parseFloat(a.value.replace(/[$,]/g, '')), 0);
  const totalBalance = ASSETS.reduce((sum, a) => sum + parseFloat(a.loanBalance.replace(/[$,]/g, '')), 0);
  const avgDscr = (ASSETS.reduce((sum, a) => sum + a.dscr, 0) / ASSETS.length);
  const tokenized = ASSETS.filter(a => a.tokenStatus === 'tokenized').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Assets</h2>
          <p className="text-xs text-slate-500 mt-0.5">{ASSETS.length} collateral properties across the portfolio</p>
        </div>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition">
          + Register Asset
        </button>
      </div>

      {/* Portfolio summary strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Portfolio Value</p>
          <p className="mt-1 text-xl font-bold text-slate-900">${(totalValue / 1e9).toFixed(2)}B</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Loan Balance</p>
          <p className="mt-1 text-xl font-bold text-slate-900">${(totalBalance / 1e6).toFixed(0)}M</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Avg DSCR</p>
          <p className={`mt-1 text-xl font-bold ${avgDscr >= 1.25 ? 'text-emerald-600' : avgDscr >= 1.0 ? 'text-amber-600' : 'text-rose-600'}`}>
            {avgDscr.toFixed(2)}x
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tokenized</p>
          <p className="mt-1 text-xl font-bold text-violet-600">{tokenized}/{ASSETS.length} assets</p>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === t
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t === 'all' ? 'All types' : t}
          </button>
        ))}
      </div>

      {/* List + Detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr]">
        {/* Asset list */}
        <div className="space-y-2">
          {filtered.map(a => {
            const isActive = a.id === selectedId;
            const tok = tokenBadge(a.tokenStatus);
            return (
              <div
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`rounded-xl border p-4 cursor-pointer transition ${
                  isActive
                    ? 'border-slate-900 bg-white shadow-sm ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-none">{TYPE_ICONS[a.type] || '🏢'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 truncate">{a.name}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{a.address}</p>
                      </div>
                      <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge(a.status)}`}>
                        {a.status}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-slate-400 mb-1">LTV</p>
                        <LtvBar ltv={a.ltv} />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Value</p>
                        <p className="text-sm font-bold text-slate-900">{a.value}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-400">{a.id} · {a.type}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tok.cls}`}>{tok.label}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Asset detail */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-slate-900 px-5 py-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{TYPE_ICONS[asset.type] || '🏢'}</span>
                <div>
                  <p className="font-semibold text-white">{asset.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{asset.address}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadge(asset.status)}`}>
                {asset.status}
              </span>
              {asset.tokenStatus !== 'none' && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tokenBadge(asset.tokenStatus).cls}`}>
                  {tokenBadge(asset.tokenStatus).label}
                </span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Appraised Value" value={asset.value} />
              <Metric label="Loan Balance" value={asset.loanBalance} sub={`${asset.ltv.toFixed(1)}% LTV`} />
              <Metric label="NOI" value={asset.noi} sub={`${asset.capRate.toFixed(2)}% cap rate`} />
              <Metric
                label="DSCR"
                value={`${asset.dscr.toFixed(2)}x`}
                sub={asset.dscr >= 1.25 ? '✓ Covenant satisfied' : asset.dscr >= 1.0 ? '⚠ Below threshold' : '✗ Covenant breach'}
              />
              <Metric label="Occupancy" value={`${asset.occupancy}%`} />
              <Metric label="Year Built" value={String(asset.vintage)} sub={asset.sf} />
            </div>

            {/* LTV bar detail */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Loan-to-Value</p>
                <span className={`text-xs font-bold ${asset.ltv >= 80 ? 'text-rose-600' : asset.ltv >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {asset.ltv.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{
                    width: `${Math.min(asset.ltv, 100)}%`,
                    background: asset.ltv >= 80 ? '#e11d48' : asset.ltv >= 70 ? '#f59e0b' : '#10b981',
                  }}
                  className="h-full rounded-full"
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-400">0%</span>
                <span className="text-xs text-slate-400">65% trigger</span>
                <span className="text-xs text-slate-400">75% max</span>
              </div>
            </div>

            {/* Property info */}
            <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Asset ID</p>
                <p className="text-sm text-slate-800 mt-0.5 font-mono">{asset.id}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Linked Loan</p>
                <p className="text-sm text-slate-800 mt-0.5 font-mono">{asset.loanId}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Market</p>
                <p className="text-sm text-slate-800 mt-0.5">{asset.market}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Size</p>
                <p className="text-sm text-slate-800 mt-0.5">{asset.sf}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Appraiser</p>
                <p className="text-sm text-slate-800 mt-0.5">{asset.appraiser}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Last Appraisal</p>
                <p className="text-sm text-slate-800 mt-0.5">{asset.lastAppraisal}</p>
              </div>
            </div>

            {/* Token section */}
            {asset.tokenStatus !== 'none' && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Token Record</p>
                <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-violet-900 font-mono">{asset.token}</p>
                    <p className="text-xs text-violet-600 mt-0.5">
                      {asset.tokenStatus === 'tokenized' ? 'ERC-1400 · Active on-chain · Reg D 506(c)' : 'Tokenization in progress — awaiting KYC completion'}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tokenBadge(asset.tokenStatus).cls}`}>
                    {tokenBadge(asset.tokenStatus).label}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-slate-100 pt-4 flex gap-2">
              <button className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
                View Appraisal
              </button>
              <button className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
                Covenant Tracker
              </button>
              {asset.tokenStatus === 'none' && (
                <button className="flex-1 rounded-lg bg-violet-600 py-2 text-xs font-medium text-white hover:bg-violet-700 transition">
                  Initiate Tokenization
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
