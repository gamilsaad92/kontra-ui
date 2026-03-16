import React, { useEffect, useMemo, useState } from 'react';
import LoanList from './LoanList';
import { API_BASE } from '../lib/apiBase';
import {
  calculateAdjustedCoupon,
  computeFeeWaterfall,
  computeGreenRateImpact,
  defaultDscrLoans,
  defaultPerformanceLoans,
  defaultGreenLoans
} from '../lib/loanProducts';

export default function LoansDashboard() {
    const [dscrLoans, setDscrLoans] = useState(defaultDscrLoans);
  const [dscrLoading, setDscrLoading] = useState(true);
  const [jobStatus, setJobStatus] = useState({
    lastRun: defaultDscrLoans[0]?.lastRecalculated ?? null,
    nextRun: defaultDscrLoans[0]?.nextReset ?? null,
    status: 'Simulated'
  });
  const [feeStructures, setFeeStructures] = useState(defaultPerformanceLoans);
  const [feeLoading, setFeeLoading] = useState(true);
  const [greenNotes, setGreenNotes] = useState(defaultGreenLoans);
  const [greenLoading, setGreenLoading] = useState(true);
  const [greenFeed, setGreenFeed] = useState({
    provider: defaultGreenLoans[0]?.energyProvider ?? 'Energy Monitoring API',
    lastSync: defaultGreenLoans[0]?.lastIngested ?? null,
    status: 'Streaming'
  });

  useEffect(() => {
    let active = true;
    const fetchDscrLoans = async () => {
      setDscrLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/loans/dscr-metrics`);
        if (!res.ok) throw new Error('Unable to load DSCR metrics');
        const data = await res.json();
        if (!active) return;
        const incoming = Array.isArray(data.loans) && data.loans.length > 0 ? data.loans : defaultDscrLoans;
        setDscrLoans(incoming.map(loan => ({
          ...loan,
          lastRecalculated: loan.lastRecalculated ?? data.lastRun ?? loan.last_recalculated,
          nextReset: loan.nextReset ?? data.nextRun ?? loan.next_recalculation
        })));
        setJobStatus({
          lastRun: data.job?.lastRun ?? data.lastRun ?? incoming[0]?.lastRecalculated ?? defaultDscrLoans[0]?.lastRecalculated ?? null,
          nextRun: data.job?.nextRun ?? data.nextRun ?? incoming[0]?.nextReset ?? defaultDscrLoans[0]?.nextReset ?? null,
          status: data.job?.status ?? 'Active'
        });
      } catch (error) {
        console.warn('Falling back to default DSCR dataset', error);
        if (!active) return;
        setDscrLoans(defaultDscrLoans);
        setJobStatus({
          lastRun: defaultDscrLoans[0]?.lastRecalculated ?? null,
          nextRun: defaultDscrLoans[0]?.nextReset ?? null,
          status: 'Simulated'
        });
      } finally {
        if (active) setDscrLoading(false);
      }
    };

    fetchDscrLoans();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchPerformanceLoans = async () => {
      setFeeLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/loans/performance-fees`);
        if (!res.ok) throw new Error('Unable to load performance fee data');
        const data = await res.json();
        if (!active) return;
        const incoming = Array.isArray(data.loans) && data.loans.length > 0 ? data.loans : defaultPerformanceLoans;
        setFeeStructures(incoming);
      } catch (error) {
        console.warn('Falling back to default performance fee dataset', error);
        if (!active) return;
        setFeeStructures(defaultPerformanceLoans);
      } finally {
        if (active) setFeeLoading(false);
      }
    };

    fetchPerformanceLoans();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchGreenNotes = async () => {
      setGreenLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/loans/green-kpis`);
        if (!res.ok) throw new Error('Unable to load green loan KPIs');
        const data = await res.json();
        if (!active) return;
        const incoming = Array.isArray(data.loans) && data.loans.length > 0 ? data.loans : defaultGreenLoans;
        setGreenNotes(incoming);
        setGreenFeed(prev => ({
          provider: data.feed?.provider ?? incoming[0]?.energyProvider ?? prev.provider ?? 'Energy Monitoring API',
          lastSync: data.feed?.lastSync ?? incoming[0]?.lastIngested ?? prev.lastSync ?? null,
          status: data.feed?.status ?? prev.status ?? 'Streaming'
        }));
      } catch (error) {
        console.warn('Falling back to default green incentive dataset', error);
        if (!active) return;
        setGreenNotes(defaultGreenLoans);
        setGreenFeed({
          provider: defaultGreenLoans[0]?.energyProvider ?? 'Energy Monitoring API',
          lastSync: defaultGreenLoans[0]?.lastIngested ?? null,
          status: 'Simulated'
        });
      } finally {
        if (active) setGreenLoading(false);
      }
    };

    fetchGreenNotes();
    return () => {
      active = false;
    };
  }, []);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }),
    []
  );
  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }),
    []
  );

  const dscrRows = useMemo(
    () =>
      (dscrLoans || []).map(loan => {
        const { adjustedCoupon, deltaBps } = calculateAdjustedCoupon(loan);
        return {
          ...loan,
          adjustedCoupon,
          deltaBps
        };
      }),
    [dscrLoans]
  );

  const feeRows = useMemo(
    () =>
      (feeStructures || []).map(loan => ({
        ...loan,
        waterfall: computeFeeWaterfall(loan)
      })),
    [feeStructures]
  );

  const greenRows = useMemo(
    () =>
      (greenNotes || []).map(loan => ({
        ...loan,
        impact: computeGreenRateImpact(loan)
      })),
    [greenNotes]
  );

  const avgDscr = useMemo(() => {
    if (!dscrRows.length) return null;
    const sum = dscrRows.reduce((total, loan) => total + Number(loan.dscr ?? 0), 0);
    return (sum / dscrRows.length).toFixed(2);
  }, [dscrRows]);

  const netGreenAdjustment = useMemo(
    () =>
      greenRows.reduce(
        (sum, loan) => sum + Number(loan.impact?.totalAdjustmentBps ?? 0),
        0
      ),
    [greenRows]
  );

  const triggeredKpis = useMemo(
    () =>
      greenRows.reduce(
        (total, loan) => total + (loan.impact?.triggered?.length ?? 0),
        0
      ),
    [greenRows]
  );

  const formatDate = value =>
    value ? new Date(value).toLocaleString(undefined, { hour12: true }) : '—';
  const formatAdjustment = deltaBps =>
    `${deltaBps > 0 ? '+' : ''}${deltaBps ?? 0} bps`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Loans</h1>
        <p className="text-sm text-slate-600">
          Where primary credit agreements live, perfect for loan-linked products.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dynamic DSCR-Linked Loans
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {dscrRows.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Average DSCR {avgDscr ?? '—'} | Automated coupon resets
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Monthly DSCR Automation Job
          </p>
          <p className="mt-2 text-base font-semibold text-slate-900">
            {jobStatus.status}
          </p>
          <dl className="mt-3 space-y-1 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <dt>Last run</dt>
              <dd>{formatDate(jobStatus.lastRun)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Next scheduled</dt>
              <dd>{formatDate(jobStatus.nextRun)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-slate-500">
            Recalculates DSCR monthly and updates interest accrual automatically.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Green Incentive Net Rate Impact
          </p>
          <p className={`mt-2 text-3xl font-bold ${netGreenAdjustment <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {formatAdjustment(netGreenAdjustment)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {triggeredKpis} KPI trigger{triggeredKpis === 1 ? '' : 's'} active via {greenFeed.provider}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Dynamic DSCR-Linked Loans
          </h2>
          <p className="text-xs text-slate-600">
            Kontra recalculates DSCR monthly and applies automated coupon step-ups or step-downs.
          </p>
        </div>
        {dscrLoading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Loading DSCR automation metrics…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Borrower</th>
                  <th className="px-4 py-2">DSCR / Target</th>
                  <th className="px-4 py-2">Coupon Base</th>
                  <th className="px-4 py-2">Adjustment</th>
                  <th className="px-4 py-2">New Coupon</th>
                  <th className="px-4 py-2">Interest (MTD)</th>
                  <th className="px-4 py-2">Next Reset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {dscrRows.map(loan => (
                  <tr key={`${loan.id}-${loan.borrower}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{loan.borrower}</div>
                      <div className="text-xs text-slate-500">Loan #{loan.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{Number(loan.dscr ?? 0).toFixed(2)}</div>
                      <div className="text-xs text-slate-500">Target {Number(loan.targetDscr ?? 0).toFixed(2)}</div>
                    </td>
                    <td className="px-4 py-3">{loan.baseCoupon?.toFixed(2)}%</td>
                    <td className="px-4 py-3">
                      <span className={loan.deltaBps <= 0 ? 'text-emerald-600' : 'text-amber-600'}>
                        {formatAdjustment(loan.deltaBps)}
                      </span>
                      <div className="text-[11px] text-slate-500">Sensitivity {loan.rateSensitivity?.toFixed(2)}x</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{loan.adjustedCoupon.toFixed(2)}%</td>
                    <td className="px-4 py-3">{currencyFormatter.format(loan.interestAccruedMonth ?? 0)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(loan.nextReset)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
          Automation notes are stored on each loan record so downstream servicing and accounting modules receive synchronized rate changes.
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Performance-Based Fee Participation
          </h2>
          <p className="text-xs text-slate-600">
            Capture profit-share percentages and NOI targets, then let Kontra automate the waterfall calculations.
          </p>
        </div>
        {feeLoading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Loading fee participation models…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Borrower</th>
                  <th className="px-4 py-2">NOI Target</th>
                  <th className="px-4 py-2">Actual NOI</th>
                  <th className="px-4 py-2">Profit Share</th>
                  <th className="px-4 py-2">Excess NOI</th>
                  <th className="px-4 py-2">Sponsor Carry</th>
                  <th className="px-4 py-2">Lender Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {feeRows.map(loan => (
                  <tr key={`${loan.id}-${loan.borrower}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{loan.borrower}</div>
                      <div className="text-xs text-slate-500">Last waterfall {formatDate(loan.lastWaterfall)}</div>
                    </td>
                    <td className="px-4 py-3">{currencyFormatter.format(loan.noiTarget ?? 0)}</td>
                    <td className="px-4 py-3">{currencyFormatter.format(loan.actualNoi ?? 0)}</td>
                    <td className="px-4 py-3">{percentFormatter.format(loan.profitSharePct ?? 0)}</td>
                    <td className="px-4 py-3">{currencyFormatter.format(loan.waterfall.excessNoi)}</td>
                    <td className="px-4 py-3">{currencyFormatter.format(loan.waterfall.sponsorCarry)}</td>
                    <td className="px-4 py-3">{currencyFormatter.format(loan.waterfall.lenderDistribution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
          Waterfall outputs post directly to servicing and investor reporting once the performance period closes.
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Green Loan Incentive Notes</h2>
          <p className="text-xs text-slate-600">
            Sustainability KPIs are stored directly on each loan. When energy monitoring feeds hit targets, rate step-ups or step-downs are applied instantly.
          </p>
        </div>
        {greenLoading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Loading sustainability KPIs…</div>
        ) : (
          <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
            {greenRows.map(loan => (
              <div key={`${loan.id}-${loan.borrower}`} className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{loan.borrower}</p>
                    <p className="text-xs text-slate-500">Loan #{loan.id}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${loan.impact.totalAdjustmentBps <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatAdjustment(loan.impact.totalAdjustmentBps)}
                    </p>
                    <p className="text-[11px] text-slate-500">Net rate impact</p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <dt className="font-medium text-slate-500">Base Coupon</dt>
                    <dd>{loan.baseCoupon?.toFixed(2)}%</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Rate Band</dt>
                    <dd>
                      {loan.rateFloor?.toFixed(2)}% – {loan.rateCap?.toFixed(2)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Energy Feed</dt>
                    <dd>{loan.energyProvider ?? greenFeed.provider}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Last Sync</dt>
                    <dd>{formatDate(loan.lastIngested ?? greenFeed.lastSync)}</dd>
                  </div>
                </dl>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Sustainability KPIs
                  </p>
                  <ul className="mt-2 space-y-2">
                    {loan.kpis?.map(kpi => {
                      const achieved = loan.impact.triggered.some(active => active.name === kpi.name);
                      return (
                        <li key={kpi.name} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-900">{kpi.name}</span>
                            <span className={achieved ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
                              {achieved ? 'Trigger active' : 'Monitoring'}
                            </span>
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                            <span>Base {kpi.baseline}{kpi.unit}</span>
                            <span>Now {kpi.current}{kpi.unit}</span>
                            <span>Goal {kpi.target}{kpi.unit}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-600">
                            {formatAdjustment(kpi.rateDeltaBps)} when {kpi.direction === 'decrease' ? '≤' : '≥'} {kpi.target}
                            {kpi.unit}
                          </p>
                          <p className="text-[10px] text-slate-400">Source: {kpi.source}</p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
          Energy monitoring via {greenFeed.provider} last synchronized {formatDate(greenFeed.lastSync)}. Trigger history is logged for audit across underwriting and servicing teams.
        </div>
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Core Loan Records</h2>
          <p className="text-sm text-slate-600">
            Manage individual credit agreements, review amortization schedules, and action servicing workflows.
          </p>
        </div>
        <LoanList />
      </section>
    </div>
  );
}
