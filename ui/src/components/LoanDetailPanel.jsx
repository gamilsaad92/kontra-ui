import React, { useEffect, useMemo, useState } from 'react';
import AmortizationTable from './AmortizationTable';
import PaymentHistory from './PaymentHistory';
import EscrowInfo from './EscrowInfo';
import LoanPayoffCalculator from './LoanPayoffCalculator';
import LoanDeferralForm from './LoanDeferralForm';
import { API_BASE } from '../lib/apiBase';
import { DetailDrawer } from './ui';
import {
  calculateAdjustedCoupon,
  computeFeeWaterfall,
  computeGreenRateImpact,
  dscrFallbackForContext,
  greenFallbackForContext,
  performanceFallbackForContext
} from '../lib/loanProducts';

export default function LoanDetailPanel({ loanId, onClose }) {
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dscrMetrics, setDscrMetrics] = useState(null);
  const [feeTerms, setFeeTerms] = useState(null);
  const [greenProfile, setGreenProfile] = useState(null);
  const [productLoading, setProductLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/loans/${loanId}/details`);
        const data = await res.json();
        if (res.ok) setLoan(data);
      } catch {
        setLoan(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId]);

    useEffect(() => {
    if (!loanId || !loan) return;
    let active = true;
    const context = {
      id: loan.loan?.external_id ?? loan.loan?.loan_number ?? loan.loan?.loan_code ?? loan.loan?.id,
      borrower: loan.loan?.borrower_name
    };

    const fallbackDscr = dscrFallbackForContext(context);
    const fallbackPerformance = performanceFallbackForContext(context);
    const fallbackGreen = greenFallbackForContext(context);

    const fetchProductData = async () => {
      setProductLoading(true);
      try {
        const [dscrRes, feeRes, greenRes] = await Promise.allSettled([
          fetch(`${API_BASE}/api/loans/${loanId}/dscr-metrics`).then(res =>
            res.ok ? res.json() : Promise.reject(new Error('Failed to load DSCR metrics'))
          ),
          fetch(`${API_BASE}/api/loans/${loanId}/performance-fee`).then(res =>
            res.ok ? res.json() : Promise.reject(new Error('Failed to load performance fees'))
          ),
          fetch(`${API_BASE}/api/loans/${loanId}/green-kpis`).then(res =>
            res.ok ? res.json() : Promise.reject(new Error('Failed to load sustainability KPIs'))
          )
        ]);

        if (!active) return;

        const dscrData = dscrRes.status === 'fulfilled' ? dscrRes.value : null;
        const feeData = feeRes.status === 'fulfilled' ? feeRes.value : null;
        const greenData = greenRes.status === 'fulfilled' ? greenRes.value : null;

        setDscrMetrics({ ...fallbackDscr, ...(dscrData ?? {}) });
        setFeeTerms({ ...fallbackPerformance, ...(feeData ?? {}) });
        setGreenProfile({ ...fallbackGreen, ...(greenData ?? {}) });
      } catch (error) {
        console.warn('Falling back to loan automation defaults', error);
        if (!active) return;
        setDscrMetrics(fallbackDscr);
        setFeeTerms(fallbackPerformance);
        setGreenProfile(fallbackGreen);
      } finally {
        if (active) setProductLoading(false);
      }
    };

    fetchProductData();
    return () => {
      active = false;
    };
  }, [loanId, loan]);

  const formattedDscr = useMemo(
    () => (dscrMetrics ? calculateAdjustedCoupon(dscrMetrics) : null),
    [dscrMetrics]
  );
  const feeWaterfall = useMemo(
    () => (feeTerms ? computeFeeWaterfall(feeTerms) : null),
    [feeTerms]
  );
  const greenImpact = useMemo(
    () => (greenProfile ? computeGreenRateImpact(greenProfile) : null),
    [greenProfile]
  );

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

  const formatDate = value =>
    value ? new Date(value).toLocaleString(undefined, { hour12: true }) : '—';
  const formatAdjustment = deltaBps =>
    `${deltaBps > 0 ? '+' : ''}${deltaBps ?? 0} bps`;

  return (
      <DetailDrawer open={!!loanId} onClose={onClose}>
      {loading && <p>Loading…</p>}
      {!loading && !loan && <p>Not found.</p>}
      {!loading && loan && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Loan #{loan.loan.id}</h3>
          <p>Borrower: {loan.loan.borrower_name}</p>
          <p>Status: {loan.loan.status}</p>
                    {productLoading && (
            <p className="text-sm text-slate-500">Updating automation data…</p>
          )}
          {dscrMetrics && formattedDscr && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="text-lg font-medium text-slate-900">Dynamic DSCR Automation</h4>
              <p className="text-sm text-slate-600">
                Coupons refresh monthly based on Kontra&apos;s real-time DSCR calculations.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current DSCR</p>
                  <p className="text-base font-semibold text-slate-900">{Number(dscrMetrics.dscr ?? 0).toFixed(2)}</p>
                  <p className="text-[11px] text-slate-500">Target {Number(dscrMetrics.targetDscr ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coupon</p>
                  <p className="text-base font-semibold text-slate-900">{formattedDscr.adjustedCoupon.toFixed(2)}%</p>
                  <p className={`text-[11px] ${formattedDscr.deltaBps <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatAdjustment(formattedDscr.deltaBps)} vs base {Number(dscrMetrics.baseCoupon ?? 0).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reset Schedule</p>
                  <p className="text-sm text-slate-900">Next {formatDate(dscrMetrics.nextReset)}</p>
                  <p className="text-[11px] text-slate-500">Last recalculated {formatDate(dscrMetrics.lastRecalculated)}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sensitivity</p>
                  <p className="text-sm text-slate-900">{Number(dscrMetrics.rateSensitivity ?? 0).toFixed(2)}x per 1.00 DSCR</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Interest Accrued (MTD)</p>
                  <p className="text-sm text-slate-900">{currencyFormatter.format(dscrMetrics.interestAccruedMonth ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automation Notes</p>
                  <p className="text-sm text-slate-700">{dscrMetrics.automationNotes ?? 'Automation job running on standard cadence.'}</p>
                </div>
              </div>
            </div>
          )}

          {feeTerms && feeWaterfall && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="text-lg font-medium text-slate-900">Performance-Based Fee Participation</h4>
              <p className="text-sm text-slate-600">
                Profit share percentages and NOI hurdles are stored directly on this loan and waterfall calculations are automated each period.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">NOI Target</p>
                  <p className="text-sm text-slate-900">{currencyFormatter.format(feeTerms.noiTarget ?? 0)}</p>
                  <p className="text-[11px] text-slate-500">Profit share {percentFormatter.format(feeTerms.profitSharePct ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual NOI</p>
                  <p className="text-sm text-slate-900">{currencyFormatter.format(feeTerms.actualNoi ?? 0)}</p>
                  <p className="text-[11px] text-slate-500">Pref payment {currencyFormatter.format(feeWaterfall.prefPayment)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Waterfall</p>
                  <p className="text-sm text-slate-900">{formatDate(feeTerms.lastWaterfall)}</p>
                  <p className="text-[11px] text-slate-500">Reserve balance {currencyFormatter.format(feeTerms.reserveBalance ?? 0)}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Base NOI</p>
                  <p className="text-sm text-slate-900">{currencyFormatter.format(feeWaterfall.baseNoi)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Excess NOI</p>
                  <p className="text-sm text-slate-900">{currencyFormatter.format(feeWaterfall.excessNoi)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sponsor Carry</p>
                  <p className="text-sm text-slate-900">{currencyFormatter.format(feeWaterfall.sponsorCarry)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lender Distribution</p>
                  <p className="text-sm text-slate-900">{currencyFormatter.format(feeWaterfall.lenderDistribution)}</p>
                  <p className="text-[11px] text-slate-500">Pref shortfall {currencyFormatter.format(feeWaterfall.prefShortfall)}</p>
                </div>
              </div>
            </div>
          )}

          {greenProfile && greenImpact && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="text-lg font-medium text-slate-900">Green Loan Incentive Notes</h4>
              <p className="text-sm text-slate-600">
                Sustainability KPIs flow from energy monitoring providers. When goals are met, rate incentives are applied automatically.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net Rate Impact</p>
                  <p className={`text-sm font-semibold ${greenImpact.totalAdjustmentBps <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatAdjustment(greenImpact.totalAdjustmentBps)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rate Band</p>
                  <p className="text-sm text-slate-900">
                    {greenProfile.rateFloor?.toFixed(2)}% – {greenProfile.rateCap?.toFixed(2)}%
                  </p>
                  <p className="text-[11px] text-slate-500">Base coupon {greenProfile.baseCoupon?.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Data Sync</p>
                  <p className="text-sm text-slate-900">{formatDate(greenProfile.lastIngested)}</p>
                  <p className="text-[11px] text-slate-500">Provider {greenProfile.energyProvider ?? 'Energy Monitoring API'}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {greenProfile.kpis?.map(kpi => {
                  const achieved = greenImpact.triggered.some(active => active.name === kpi.name);
                  return (
                    <div key={kpi.name} className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{kpi.name}</span>
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <AmortizationTable loanId={loanId} />
          <PaymentHistory loanId={loanId} />
          <EscrowInfo loanId={loanId} startDate={loan.loan.start_date} />
          <LoanPayoffCalculator loanId={loanId} />
          <LoanDeferralForm loanId={loanId} />
          {loan.collateral && loan.collateral.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h4 className="text-lg font-medium mb-2">Collateral Docs</h4>
              <ul className="list-disc list-inside space-y-1">
                {loan.collateral.map(doc => (
                  <li key={doc.id}>
                    <a href={doc.document_url} className="text-blue-600 underline" target="_blank" rel="noreferrer">
                      {doc.document_url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </DetailDrawer>
  );
}
