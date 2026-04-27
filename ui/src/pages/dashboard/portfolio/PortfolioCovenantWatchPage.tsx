/**
 * Portfolio — Covenant Watch
 *
 * Aggregated view of all loan covenants across the portfolio.
 * Lender sees at a glance which loans have breaches, which are
 * approaching thresholds, and which are clean.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

type CovenantStatus = 'pass' | 'watch' | 'breach';

interface CovenantRow {
  loanId: string;
  loanTitle: string;
  propertyType: string;
  status: string;
  covenant: string;
  threshold: string;
  actual: string;
  covenantStatus: CovenantStatus;
  lastChecked: string;
}

const COVENANTS: CovenantRow[] = [
  // LN-4108 — Breach (action required)
  { loanId: 'LN-4108', loanTitle: 'Grand Central Offices',    propertyType: 'Office',      status: 'pending', covenant: 'DSCR Floor',       threshold: '≥ 1.25x', actual: '1.08x', covenantStatus: 'breach', lastChecked: '2026-04-20' },
  { loanId: 'LN-4108', loanTitle: 'Grand Central Offices',    propertyType: 'Office',      status: 'pending', covenant: 'Debt Yield Floor',  threshold: '≥ 8.0%',  actual: '7.1%',  covenantStatus: 'breach', lastChecked: '2026-04-20' },
  { loanId: 'LN-4108', loanTitle: 'Grand Central Offices',    propertyType: 'Office',      status: 'pending', covenant: 'LTV Cap',           threshold: '≤ 75%',   actual: '74.2%', covenantStatus: 'watch',  lastChecked: '2026-04-20' },
  { loanId: 'LN-4108', loanTitle: 'Grand Central Offices',    propertyType: 'Office',      status: 'pending', covenant: 'Occupancy Floor',   threshold: '≥ 85%',   actual: '81%',   covenantStatus: 'watch',  lastChecked: '2026-04-20' },
  // LN-5593 — Breach
  { loanId: 'LN-5593', loanTitle: 'Harbour Square Retail',    propertyType: 'Retail',      status: 'pending', covenant: 'LTV Cap',           threshold: '≤ 70%',   actual: '71.8%', covenantStatus: 'breach', lastChecked: '2026-04-20' },
  { loanId: 'LN-5593', loanTitle: 'Harbour Square Retail',    propertyType: 'Retail',      status: 'pending', covenant: 'Occupancy Floor',   threshold: '≥ 85%',   actual: '79%',   covenantStatus: 'breach', lastChecked: '2026-04-20' },
  { loanId: 'LN-5593', loanTitle: 'Harbour Square Retail',    propertyType: 'Retail',      status: 'pending', covenant: 'DSCR Floor',        threshold: '≥ 1.20x', actual: '1.08x', covenantStatus: 'watch',  lastChecked: '2026-04-20' },
  { loanId: 'LN-5593', loanTitle: 'Harbour Square Retail',    propertyType: 'Retail',      status: 'pending', covenant: 'Debt Yield Floor',  threshold: '≥ 8.0%',  actual: '7.4%',  covenantStatus: 'watch',  lastChecked: '2026-04-20' },
  // LN-2847 — All pass
  { loanId: 'LN-2847', loanTitle: 'The Meridian Apartments',  propertyType: 'Multifamily', status: 'active',  covenant: 'DSCR Floor',        threshold: '≥ 1.25x', actual: '1.42x', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-2847', loanTitle: 'The Meridian Apartments',  propertyType: 'Multifamily', status: 'active',  covenant: 'LTV Cap',           threshold: '≤ 75%',   actual: '65.2%', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-2847', loanTitle: 'The Meridian Apartments',  propertyType: 'Multifamily', status: 'active',  covenant: 'Occupancy Floor',   threshold: '≥ 85%',   actual: '94%',   covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-2847', loanTitle: 'The Meridian Apartments',  propertyType: 'Multifamily', status: 'active',  covenant: 'Debt Yield Floor',  threshold: '≥ 8.5%',  actual: '9.2%',  covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  // LN-3201 — All pass
  { loanId: 'LN-3201', loanTitle: 'Rosewood Medical Plaza',   propertyType: 'Office',      status: 'active',  covenant: 'DSCR Floor',        threshold: '≥ 1.35x', actual: '1.85x', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-3201', loanTitle: 'Rosewood Medical Plaza',   propertyType: 'Office',      status: 'active',  covenant: 'LTV Cap',           threshold: '≤ 70%',   actual: '57.9%', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-3201', loanTitle: 'Rosewood Medical Plaza',   propertyType: 'Office',      status: 'active',  covenant: 'Occupancy Floor',   threshold: '≥ 90%',   actual: '97%',   covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-3201', loanTitle: 'Rosewood Medical Plaza',   propertyType: 'Office',      status: 'active',  covenant: 'Debt Yield Floor',  threshold: '≥ 9.0%',  actual: '11.2%', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  // LN-0728 — All pass
  { loanId: 'LN-0728', loanTitle: 'Pacific Vista Industrial', propertyType: 'Industrial',  status: 'active',  covenant: 'DSCR Floor',        threshold: '≥ 1.30x', actual: '2.10x', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-0728', loanTitle: 'Pacific Vista Industrial', propertyType: 'Industrial',  status: 'active',  covenant: 'LTV Cap',           threshold: '≤ 65%',   actual: '55.0%', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-0728', loanTitle: 'Pacific Vista Industrial', propertyType: 'Industrial',  status: 'active',  covenant: 'Occupancy Floor',   threshold: '≥ 85%',   actual: '100%',  covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-0728', loanTitle: 'Pacific Vista Industrial', propertyType: 'Industrial',  status: 'active',  covenant: 'Debt Yield Floor',  threshold: '≥ 9.5%',  actual: '13.8%', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  // LN-1120 — All pass
  { loanId: 'LN-1120', loanTitle: 'Lakeside Mixed-Use',       propertyType: 'Mixed Use',   status: 'active',  covenant: 'DSCR Floor',        threshold: '≥ 1.25x', actual: '1.55x', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-1120', loanTitle: 'Lakeside Mixed-Use',       propertyType: 'Mixed Use',   status: 'active',  covenant: 'LTV Cap',           threshold: '≤ 70%',   actual: '61.8%', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-1120', loanTitle: 'Lakeside Mixed-Use',       propertyType: 'Mixed Use',   status: 'active',  covenant: 'Occupancy Floor',   threshold: '≥ 85%',   actual: '88%',   covenantStatus: 'pass',   lastChecked: '2026-04-20' },
  { loanId: 'LN-1120', loanTitle: 'Lakeside Mixed-Use',       propertyType: 'Mixed Use',   status: 'active',  covenant: 'Debt Yield Floor',  threshold: '≥ 9.0%',  actual: '10.4%', covenantStatus: 'pass',   lastChecked: '2026-04-20' },
];

const STATUS_CFG: Record<CovenantStatus, { label: string; classes: string; icon: typeof CheckCircleIcon }> = {
  pass:   { label: 'Pass',   classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: CheckCircleIcon },
  watch:  { label: 'Watch',  classes: 'bg-amber-50 text-amber-700 border border-amber-200',       icon: ExclamationTriangleIcon },
  breach: { label: 'Breach', classes: 'bg-red-50 text-red-700 border border-red-200',             icon: XCircleIcon },
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function PortfolioCovenantWatchPage() {
  const [filter, setFilter] = useState<CovenantStatus | 'all'>('all');
  const [loanFilter, setLoanFilter] = useState<string>('all');

  const loanIds = [...new Set(COVENANTS.map((c) => c.loanId))];

  const filtered = COVENANTS.filter((c) => {
    const matchStatus = filter === 'all' || c.covenantStatus === filter;
    const matchLoan   = loanFilter === 'all' || c.loanId === loanFilter;
    return matchStatus && matchLoan;
  });

  const breachCount = COVENANTS.filter((c) => c.covenantStatus === 'breach').length;
  const watchCount  = COVENANTS.filter((c) => c.covenantStatus === 'watch').length;
  const passCount   = COVENANTS.filter((c) => c.covenantStatus === 'pass').length;
  const loansWithBreaches = [...new Set(COVENANTS.filter((c) => c.covenantStatus === 'breach').map((c) => c.loanId))].length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Covenant Watch</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time covenant compliance across all portfolio loans. Breaches trigger governance actions and servicer notifications.
          </p>
        </div>
        <Link
          to="/governance/loan-control"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          Open Governance
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500">Breaches</p>
          <p className="text-3xl font-black text-red-700 mt-1 tabular-nums">{breachCount}</p>
          <p className="text-xs text-red-500 mt-0.5">{loansWithBreaches} loan{loansWithBreaches !== 1 ? 's' : ''} affected</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-500">Watch</p>
          <p className="text-3xl font-black text-amber-700 mt-1 tabular-nums">{watchCount}</p>
          <p className="text-xs text-amber-500 mt-0.5">near threshold</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">Passing</p>
          <p className="text-3xl font-black text-emerald-700 mt-1 tabular-nums">{passCount}</p>
          <p className="text-xs text-emerald-500 mt-0.5">compliant</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Covenants</p>
          <p className="text-3xl font-black text-slate-900 mt-1 tabular-nums">{COVENANTS.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">across {loanIds.length} loans</p>
        </div>
      </div>

      {/* Breach alert */}
      {breachCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <XCircleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">
              {breachCount} covenant breach{breachCount !== 1 ? 'es' : ''} detected across {loansWithBreaches} loan{loansWithBreaches !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              LN-4108 (Grand Central Offices) and LN-5593 (Harbour Square Retail) require immediate attention.
              Servicer has been notified. Governance action may be required per loan documents.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'breach', 'watch', 'pass'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                filter === f
                  ? f === 'breach' ? 'bg-red-700 text-white' : f === 'watch' ? 'bg-amber-600 text-white' : f === 'pass' ? 'bg-emerald-700 text-white' : 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'All Statuses' : f === 'breach' ? `Breaches (${breachCount})` : f === 'watch' ? `Watch (${watchCount})` : `Passing (${passCount})`}
            </button>
          ))}
        </div>
        <select
          value={loanFilter}
          onChange={(e) => setLoanFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none"
        >
          <option value="all">All Loans</option>
          {loanIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>

      {/* Covenants table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              {['Loan', 'Property Type', 'Covenant', 'Required', 'Actual (Q1 2026)', 'Status', 'Last Checked', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.map((row, i) => {
              const cfg = STATUS_CFG[row.covenantStatus];
              const Icon = cfg.icon;
              return (
                <tr
                  key={i}
                  className={`hover:bg-slate-50 transition-colors ${row.covenantStatus === 'breach' ? 'bg-red-50/30' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs font-black text-slate-400 tracking-widest">{row.loanId}</p>
                      <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">{row.loanTitle}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{row.propertyType}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">{row.covenant}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600">{row.threshold}</td>
                  <td className={`px-4 py-3 text-sm font-black font-mono ${
                    row.covenantStatus === 'breach' ? 'text-red-700' :
                    row.covenantStatus === 'watch' ? 'text-amber-700' : 'text-emerald-700'
                  }`}>{row.actual}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${cfg.classes}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(row.lastChecked)}</td>
                  <td className="px-4 py-3">
                    {row.covenantStatus !== 'pass' ? (
                      <Link
                        to="/governance/loan-control"
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors whitespace-nowrap"
                      >
                        <ExclamationTriangleIcon className="h-3 w-3" />
                        Take Action
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-xs font-bold text-slate-600 mb-1">Covenant Testing Cadence</p>
        <p className="text-xs text-slate-500">
          DSCR and Occupancy covenants are tested quarterly from certified rent rolls and operating statements.
          LTV covenants are tested annually via third-party appraisal. Debt Yield is tested quarterly.
          Breaches trigger a cure period per loan documents (typically 30–60 days) before a default notice may be issued.
          All covenant tests and results are logged to the compliance audit trail.
        </p>
      </div>
    </div>
  );
}
