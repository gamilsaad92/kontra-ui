import React from 'react';
import { getDistributionSnapshot, updateNetAssetValue } from '../services/servicing';

function formatCurrency(value = 0, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
}

function resolveDefaultPeriod() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}-01`;
}

export default function DistributionPlanner() {
  const [poolId, setPoolId] = React.useState('POOL-DIST-1');
  const [period, setPeriod] = React.useState(resolveDefaultPeriod());
  const [navAmount, setNavAmount] = React.useState('');
  const [snapshot, setSnapshot] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const statusBadge = React.useMemo(() => {
    if (!snapshot?.distribution?.status) return null;
    const status = snapshot.distribution.status;
    const isReady = status === 'calculated';
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
          isReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}
      >
        {isReady ? 'Ready for reporting' : 'Waiting on token supply'}
      </span>
    );
  }, [snapshot?.distribution?.status]);

  async function loadSnapshot() {
    if (!poolId || !period) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await getDistributionSnapshot(poolId, period);
      setSnapshot(data);
    } catch (err) {
      console.error('Failed to load distribution', err);
      setMessage('Unable to load distribution for this period.');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, period]);

  async function handleNavSubmit(event) {
    event.preventDefault();
    if (!poolId || !navAmount) {
      setMessage('Pool ID and NAV are required.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const data = await updateNetAssetValue(poolId, parseFloat(navAmount), period);
      setSnapshot(data);
      setMessage('NAV updated and distribution recalculated.');
    } catch (err) {
      console.error('Failed to update NAV', err);
      setMessage('Unable to update NAV. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const distribution = snapshot?.distribution;
  const remittance = snapshot?.remittance_summary;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Distribution hooks</p>
          <h3 className="text-2xl font-semibold text-slate-900">Remittance period NAV + token splits</h3>
          <p className="mt-1 text-sm text-slate-500">
            Log the current NAV for your pool and Kontra will derive the per-token distribution amount
            for the remittance period. Payments are still wired off-chain; this keeps investor reporting
            in sync with your ledger.
          </p>
        </div>
        {statusBadge}
      </div>

      <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={handleNavSubmit}>
        <div className="md:col-span-2">
          <label className="text-sm text-slate-600">Pool ID</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 p-2"
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
            placeholder="POOL-123"
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">Remittance period</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 p-2"
            type="month"
            value={period?.slice(0, 7) || ''}
            onChange={(e) => setPeriod(`${e.target.value}-01`)}
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">Pool NAV (USD)</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="w-full rounded-lg border border-slate-200 p-2"
              type="number"
              min="0"
              step="1000"
              value={navAmount}
              onChange={(e) => setNavAmount(e.target.value)}
              placeholder="1,200,000"
            />
            <button
              type="submit"
              className="whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              disabled={loading}
            >
              {loading ? 'Updating…' : 'Update NAV'}
            </button>
          </div>
        </div>
      </form>

      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">NAV + supply</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>NAV</span>
              <span className="font-semibold">{formatCurrency(distribution?.nav ?? 0, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tokens outstanding</span>
              <span className="font-semibold">{distribution?.tokens_outstanding ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>NAV last updated</span>
              <span className="font-semibold">{formatDate(distribution?.nav_updated_at)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Remittance math</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Net to investors</span>
              <span className="font-semibold">{formatCurrency(remittance?.net_to_investors ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Per-token distribution</span>
              <span className="font-semibold">
                {formatCurrency(distribution?.per_token_distribution ?? 0, 6)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Period</span>
              <span className="font-semibold">{distribution?.period || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
