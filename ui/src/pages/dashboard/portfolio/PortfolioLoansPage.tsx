/**
 * Portfolio — Loans
 *
 * Lender-grade loan management view. Tries the live API first;
 * if the portfolio is empty it overlays rich demo data so the
 * dashboard is always useful for a pitch or demo.
 *
 * Each loan card shows the metrics a CRE lender cares about:
 *   UPB · DSCR · LTV · Rate · Occupancy · Maturity countdown
 *   Covenant status (pass / watch / breach)
 *   Tokenization link (KTRA-xxxx badge)
 */

import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import { useLoanList } from '../../../features/portfolio/loans/api';
import type { CanonicalEntity } from '../../../features/crud/types';

// ── Demo fallback data ─────────────────────────────────────────────────────────
// Matches the 6 established portfolio loans in the Kontra demo dataset.
const DEMO_LOANS = [
  {
    id: 'demo-ln-2847',
    loanId: 'LN-2847',
    title: 'The Meridian Apartments',
    status: 'active',
    borrower: 'Meridian Residential LLC',
    propertyType: 'multifamily',
    address: '1847 Colorado Blvd, Denver, CO 80205',
    upb: 5_112_500,
    originalAmount: 5_500_000,
    rate: 6.75,
    ltv: 65.2,
    dscr: 1.42,
    occupancy: 94,
    originationDate: '2024-06-15',
    maturityDate: '2026-06-15',
    loanPurpose: 'refinance',
    tokenSymbol: 'KTRA-2847',
    tokenized: true,
    covenants: [
      { name: 'DSCR Floor',        threshold: '≥ 1.25x', actual: '1.42x', status: 'pass' },
      { name: 'LTV Cap',           threshold: '≤ 75%',   actual: '65.2%', status: 'pass' },
      { name: 'Occupancy Floor',   threshold: '≥ 85%',   actual: '94%',   status: 'pass' },
      { name: 'Debt Yield Floor',  threshold: '≥ 8.5%',  actual: '9.2%',  status: 'pass' },
    ],
  },
  {
    id: 'demo-ln-3201',
    loanId: 'LN-3201',
    title: 'Rosewood Medical Plaza',
    status: 'active',
    borrower: 'Rosewood Health Properties Inc.',
    propertyType: 'office',
    address: '3201 N Central Ave, Phoenix, AZ 85012',
    upb: 8_450_000,
    originalAmount: 9_000_000,
    rate: 7.25,
    ltv: 57.9,
    dscr: 1.85,
    occupancy: 97,
    originationDate: '2023-12-01',
    maturityDate: '2027-12-01',
    loanPurpose: 'acquisition',
    tokenSymbol: 'KTRA-3201',
    tokenized: true,
    covenants: [
      { name: 'DSCR Floor',        threshold: '≥ 1.35x', actual: '1.85x', status: 'pass' },
      { name: 'LTV Cap',           threshold: '≤ 70%',   actual: '57.9%', status: 'pass' },
      { name: 'Occupancy Floor',   threshold: '≥ 90%',   actual: '97%',   status: 'pass' },
      { name: 'Debt Yield Floor',  threshold: '≥ 9.0%',  actual: '11.2%', status: 'pass' },
    ],
  },
  {
    id: 'demo-ln-5593',
    loanId: 'LN-5593',
    title: 'Harbour Square Retail',
    status: 'pending',
    borrower: 'Harbour Square Partners LLC',
    propertyType: 'retail',
    address: '5593 Harbour Ave SW, Seattle, WA 98126',
    upb: 4_187_500,
    originalAmount: 4_500_000,
    rate: 6.50,
    ltv: 71.8,
    dscr: 1.08,
    occupancy: 79,
    originationDate: '2023-03-15',
    maturityDate: '2027-03-15',
    loanPurpose: 'refinance',
    tokenSymbol: 'KTRA-5593',
    tokenized: true,
    covenants: [
      { name: 'DSCR Floor',        threshold: '≥ 1.20x', actual: '1.08x', status: 'watch' },
      { name: 'LTV Cap',           threshold: '≤ 70%',   actual: '71.8%', status: 'breach' },
      { name: 'Occupancy Floor',   threshold: '≥ 85%',   actual: '79%',   status: 'breach' },
      { name: 'Debt Yield Floor',  threshold: '≥ 8.0%',  actual: '7.4%',  status: 'watch' },
    ],
  },
  {
    id: 'demo-ln-0728',
    loanId: 'LN-0728',
    title: 'Pacific Vista Industrial',
    status: 'active',
    borrower: 'PV Logistics Holdings LLC',
    propertyType: 'industrial',
    address: '728 E Pacific Coast Hwy, El Segundo, CA 90245',
    upb: 6_487_500,
    originalAmount: 7_000_000,
    rate: 7.00,
    ltv: 55.0,
    dscr: 2.10,
    occupancy: 100,
    originationDate: '2023-08-22',
    maturityDate: '2028-08-22',
    loanPurpose: 'acquisition',
    tokenSymbol: 'KTRA-0728',
    tokenized: true,
    covenants: [
      { name: 'DSCR Floor',        threshold: '≥ 1.30x', actual: '2.10x', status: 'pass' },
      { name: 'LTV Cap',           threshold: '≤ 65%',   actual: '55.0%', status: 'pass' },
      { name: 'Occupancy Floor',   threshold: '≥ 85%',   actual: '100%',  status: 'pass' },
      { name: 'Debt Yield Floor',  threshold: '≥ 9.5%',  actual: '13.8%', status: 'pass' },
    ],
  },
  {
    id: 'demo-ln-4108',
    loanId: 'LN-4108',
    title: 'Grand Central Offices',
    status: 'pending',
    borrower: 'GCO Property Partners LP',
    propertyType: 'office',
    address: '4108 W Adams St, Chicago, IL 60612',
    upb: 3_762_500,
    originalAmount: 4_000_000,
    rate: 6.25,
    ltv: 74.2,
    dscr: 1.08,
    occupancy: 81,
    originationDate: '2024-01-10',
    maturityDate: '2028-01-10',
    loanPurpose: 'bridge',
    tokenSymbol: 'KTRA-4108',
    tokenized: true,
    covenants: [
      { name: 'DSCR Floor',        threshold: '≥ 1.25x', actual: '1.08x', status: 'breach' },
      { name: 'LTV Cap',           threshold: '≤ 75%',   actual: '74.2%', status: 'watch' },
      { name: 'Occupancy Floor',   threshold: '≥ 85%',   actual: '81%',   status: 'watch' },
      { name: 'Debt Yield Floor',  threshold: '≥ 8.0%',  actual: '7.1%',  status: 'breach' },
    ],
  },
  {
    id: 'demo-ln-1120',
    loanId: 'LN-1120',
    title: 'Lakeside Mixed-Use',
    status: 'active',
    borrower: 'Lakeside Development Group',
    propertyType: 'mixed_use',
    address: '1120 S Congress Ave, Austin, TX 78704',
    upb: 7_156_250,
    originalAmount: 7_500_000,
    rate: 7.50,
    ltv: 61.8,
    dscr: 1.55,
    occupancy: 88,
    originationDate: '2024-09-01',
    maturityDate: '2029-09-01',
    loanPurpose: 'acquisition',
    tokenSymbol: null,
    tokenized: false,
    covenants: [
      { name: 'DSCR Floor',        threshold: '≥ 1.25x', actual: '1.55x', status: 'pass' },
      { name: 'LTV Cap',           threshold: '≤ 70%',   actual: '61.8%', status: 'pass' },
      { name: 'Occupancy Floor',   threshold: '≥ 85%',   actual: '88%',   status: 'pass' },
      { name: 'Debt Yield Floor',  threshold: '≥ 9.0%',  actual: '10.4%', status: 'pass' },
    ],
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────
type CovenantStatus = 'pass' | 'watch' | 'breach';

interface DemoLoan {
  id: string;
  loanId: string;
  title: string;
  status: string;
  borrower: string;
  propertyType: string;
  address: string;
  upb: number;
  originalAmount: number;
  rate: number;
  ltv: number;
  dscr: number;
  occupancy: number;
  originationDate: string;
  maturityDate: string;
  loanPurpose: string;
  tokenSymbol: string | null;
  tokenized: boolean;
  covenants: { name: string; threshold: string; actual: string; status: CovenantStatus }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

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

const PROP_COLORS: Record<string, string> = {
  multifamily: 'bg-rose-50 text-rose-800 border border-rose-200',
  office:      'bg-blue-50 text-blue-800 border border-blue-200',
  retail:      'bg-teal-50 text-teal-800 border border-teal-200',
  industrial:  'bg-indigo-50 text-indigo-800 border border-indigo-200',
  hotel:       'bg-violet-50 text-violet-800 border border-violet-200',
  mixed_use:   'bg-pink-50 text-pink-800 border border-pink-200',
  other:       'bg-slate-100 text-slate-700',
};

const STATUS_CFG: Record<string, { label: string; classes: string }> = {
  active:   { label: 'Performing',  classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  pending:  { label: 'Watch List',  classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
  rejected: { label: 'Delinquent', classes: 'bg-red-50 text-red-700 border border-red-200' },
  inactive: { label: 'Matured',    classes: 'bg-slate-100 text-slate-600' },
  draft:    { label: 'Draft',      classes: 'bg-blue-50 text-blue-700 border border-blue-200' },
};

const COVENANT_CFG: Record<CovenantStatus, { label: string; classes: string; icon: typeof CheckCircleIcon }> = {
  pass:   { label: 'Pass',   classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: CheckCircleIcon },
  watch:  { label: 'Watch',  classes: 'bg-amber-50 text-amber-700 border border-amber-200',       icon: ExclamationTriangleIcon },
  breach: { label: 'Breach', classes: 'bg-red-50 text-red-700 border border-red-200',             icon: ExclamationTriangleIcon },
};

function dscrColor(v: number) {
  if (v >= 1.3)  return 'text-emerald-700 font-black';
  if (v >= 1.1)  return 'text-amber-700 font-black';
  return 'text-red-700 font-black';
}
function ltvColor(v: number) {
  if (v <= 60) return 'text-emerald-700 font-bold';
  if (v <= 70) return 'text-amber-700 font-bold';
  return 'text-red-700 font-bold';
}

// ── API → DemoLoan adapter ─────────────────────────────────────────────────────
function apiEntityToDemoLoan(e: CanonicalEntity): DemoLoan {
  const d = (e.data ?? {}) as Record<string, unknown>;
  const g = (keys: string[]) => {
    for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== '') return d[k];
    return undefined;
  };
  const num = (keys: string[]) => { const v = g(keys); return v !== undefined ? parseFloat(String(v)) : 0; };
  const str = (keys: string[]) => { const v = g(keys); return v !== undefined ? String(v) : ''; };
  const upb = num(['loan_amount', 'principal', 'amount', 'loan_balance', 'commitment']);
  const dscr = num(['dscr', 'debt_service_coverage', 'debt_service_coverage_ratio']);
  const ltv = num(['ltv', 'ltv_pct', 'loan_to_value', 'LTV']);
  const occ = num(['occupancy', 'occupancy_rate', 'occupancy_pct']);
  return {
    id: e.id,
    loanId: str(['loan_id', 'reference_id', 'id']).slice(0, 10) || e.id.slice(0, 8),
    title: e.title ?? e.name ?? 'Untitled Loan',
    status: e.status ?? 'active',
    borrower: str(['borrower_name', 'borrower', 'sponsor']),
    propertyType: str(['property_type', 'asset_type']) || 'other',
    address: str(['property_address', 'address', 'property_name']),
    upb,
    originalAmount: num(['original_amount', 'commitment']) || upb,
    rate: num(['interest_rate', 'rate', 'coupon', 'note_rate']),
    ltv,
    dscr,
    occupancy: occ,
    originationDate: str(['origination_date', 'origination']) || new Date().toISOString(),
    maturityDate: str(['maturity_date', 'maturity', 'due_date']),
    loanPurpose: str(['loan_purpose', 'purpose']) || 'other',
    tokenSymbol: str(['token_symbol']) || null,
    tokenized: !!g(['token_symbol', 'token_contract_address']),
    covenants: [],
  };
}

// ── Status Filter bar ──────────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { value: 'all',      label: 'All' },
  { value: 'active',   label: 'Performing' },
  { value: 'pending',  label: 'Watch List' },
  { value: 'rejected', label: 'Delinquent' },
  { value: 'inactive', label: 'Matured' },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PortfolioLoansPage() {
  const { data, isLoading } = useLoanList();
  const apiLoans = (data?.items ?? []) as CanonicalEntity[];

  // Use API data if available, otherwise fall back to rich demo data
  const loans: DemoLoan[] = useMemo(() => {
    if (apiLoans.length > 0) return apiLoans.map(apiEntityToDemoLoan);
    return DEMO_LOANS;
  }, [apiLoans]);

  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [sortBy, setSortBy]       = useState<'maturity' | 'dscr' | 'upb' | 'ltv'>('maturity');
  const [expandedId, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let out = loans;
    if (filter !== 'all') out = out.filter((l) => l.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.loanId.toLowerCase().includes(q) ||
          l.borrower.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q),
      );
    }
    return [...out].sort((a, b) => {
      if (sortBy === 'dscr')    return a.dscr - b.dscr;
      if (sortBy === 'upb')     return b.upb - a.upb;
      if (sortBy === 'ltv')     return b.ltv - a.ltv;
      if (sortBy === 'maturity') {
        const da = a.maturityDate ? new Date(a.maturityDate).getTime() : Infinity;
        const db = b.maturityDate ? new Date(b.maturityDate).getTime() : Infinity;
        return da - db;
      }
      return 0;
    });
  }, [loans, search, filter, sortBy]);

  // Portfolio summary stats
  const stats = useMemo(() => {
    const totalUPB  = loans.reduce((s, l) => s + l.upb, 0);
    const avgDSCR   = loans.length ? loans.reduce((s, l) => s + l.dscr, 0) / loans.length : 0;
    const avgLTV    = loans.length ? loans.reduce((s, l) => s + l.ltv, 0) / loans.length : 0;
    const atRisk    = loans.filter((l) => l.status === 'pending' || l.status === 'rejected').length;
    const breached  = loans.filter((l) => l.covenants.some((c) => c.status === 'breach')).length;
    const tokenized = loans.filter((l) => l.tokenized).length;
    const maturingDays90 = loans.filter((l) => {
      const d = daysUntil(l.maturityDate);
      return d >= 0 && d <= 90;
    }).length;
    return { totalUPB, avgDSCR, avgLTV, atRisk, breached, tokenized, maturingDays90 };
  }, [loans]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Portfolio summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Total UPB',        value: fmt(stats.totalUPB),                       accent: false },
          { label: 'Avg DSCR',         value: `${stats.avgDSCR.toFixed(2)}x`,             accent: stats.avgDSCR < 1.25 },
          { label: 'Avg LTV',          value: `${stats.avgLTV.toFixed(1)}%`,              accent: stats.avgLTV > 70 },
          { label: 'Watch / Delinq',   value: String(stats.atRisk),                       accent: stats.atRisk > 0 },
          { label: 'Covenant Breaches',value: String(stats.breached),                     accent: stats.breached > 0 },
          { label: 'Tokenized',        value: `${stats.tokenized} / ${loans.length}`,     accent: false },
          { label: 'Maturing ≤ 90d',   value: String(stats.maturingDays90),               accent: stats.maturingDays90 > 0 },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border bg-white p-3 ${s.accent ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className={`mt-0.5 text-xl font-black tabular-nums ${s.accent ? 'text-amber-700' : 'text-slate-900'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search loan, borrower, address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60 rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none"
          >
            <option value="maturity">Sort: Maturity (soonest)</option>
            <option value="dscr">Sort: DSCR (riskiest first)</option>
            <option value="upb">Sort: UPB (largest first)</option>
            <option value="ltv">Sort: LTV (highest first)</option>
          </select>
        </div>
        <button
          onClick={() => navigate('/portfolio/originate')}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors"
        >
          + Originate Loan
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const count = opt.value === 'all' ? loans.length : loans.filter((l) => l.status === opt.value).length;
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                filter === opt.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Loan cards */}
      <div className="space-y-3">
        {filtered.map((loan) => (
          <LoanCard
            key={loan.id}
            loan={loan}
            expanded={expandedId === loan.id}
            onToggle={() => setExpanded(expandedId === loan.id ? null : loan.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
            <p className="text-sm font-medium text-slate-600">No loans match your filters</p>
            <button onClick={() => { setSearch(''); setFilter('all'); }} className="mt-2 text-xs text-slate-400 underline">Clear filters</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Loan Card ─────────────────────────────────────────────────────────────────
function LoanCard({
  loan,
  expanded,
  onToggle,
}: {
  loan: DemoLoan;
  expanded: boolean;
  onToggle: () => void;
}) {
  const days = daysUntil(loan.maturityDate);
  const maturityUrgent = days >= 0 && days <= 90;
  const maturityImminent = days >= 0 && days <= 30;
  const matured = days < 0;

  const statusCfg = STATUS_CFG[loan.status] ?? STATUS_CFG.active;
  const propColor = PROP_COLORS[loan.propertyType] ?? PROP_COLORS.other;

  const worstCovenant: CovenantStatus = loan.covenants.some((c) => c.status === 'breach')
    ? 'breach'
    : loan.covenants.some((c) => c.status === 'watch')
    ? 'watch'
    : 'pass';

  const cvCfg = COVENANT_CFG[worstCovenant];
  const CvIcon = cvCfg.icon;

  return (
    <div
      className={`rounded-xl border bg-white transition-all ${
        worstCovenant === 'breach'
          ? 'border-red-200'
          : worstCovenant === 'watch'
          ? 'border-amber-200'
          : 'border-slate-200'
      }`}
    >
      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* Left: ID + title */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="shrink-0">
              <span className="inline-block rounded-lg bg-slate-900 px-2 py-1 text-xs font-black tracking-widest text-white">
                {loan.loanId}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{loan.title}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusCfg.classes}`}>
                  {statusCfg.label}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${propColor}`}>
                  {PROP_LABELS[loan.propertyType] ?? loan.propertyType}
                </span>
                {loan.tokenized && loan.tokenSymbol && (
                  <Link
                    to="/onchain/tokens"
                    className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-xs font-black text-violet-700 hover:bg-violet-100 transition-colors"
                  >
                    <CubeIcon className="h-3 w-3" />
                    {loan.tokenSymbol}
                  </Link>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{loan.borrower}</p>
              <p className="text-xs text-slate-400">{loan.address}</p>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/servicer/overview"
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              Servicing
            </Link>
            {loan.tokenized && (
              <Link
                to="/onchain/cap-table"
                className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors"
              >
                <CubeIcon className="h-3.5 w-3.5" />
                Cap Table
              </Link>
            )}
            <button onClick={onToggle} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 transition-colors">
              {expanded ? (
                <ChevronUpIcon className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-slate-500" />
              )}
            </button>
          </div>
        </div>

        {/* Metrics row */}
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
          <MetricCell label="UPB" value={fmt(loan.upb)} />
          <MetricCell
            label="DSCR"
            value={loan.dscr > 0 ? `${loan.dscr.toFixed(2)}x` : '—'}
            valueClass={loan.dscr > 0 ? dscrColor(loan.dscr) : ''}
          />
          <MetricCell
            label="LTV"
            value={loan.ltv > 0 ? `${loan.ltv.toFixed(1)}%` : '—'}
            valueClass={loan.ltv > 0 ? ltvColor(loan.ltv) : ''}
          />
          <MetricCell label="Rate" value={loan.rate > 0 ? `${loan.rate.toFixed(2)}%` : '—'} />
          <MetricCell
            label="Occupancy"
            value={loan.occupancy > 0 ? `${loan.occupancy}%` : '—'}
            valueClass={loan.occupancy > 0 ? (loan.occupancy >= 85 ? 'text-emerald-700 font-bold' : loan.occupancy >= 75 ? 'text-amber-700 font-bold' : 'text-red-700 font-bold') : ''}
          />
          <MetricCell
            label="Maturity"
            value={loan.maturityDate ? fmtDate(loan.maturityDate) : '—'}
            sub={
              matured
                ? 'Matured'
                : maturityImminent
                ? `${days}d — CRITICAL`
                : maturityUrgent
                ? `${days}d left`
                : days < 365
                ? `${days}d left`
                : undefined
            }
            subClass={maturityImminent ? 'text-red-600 font-bold' : maturityUrgent ? 'text-amber-600 font-bold' : 'text-slate-400'}
          />
        </div>

        {/* Covenant quick status */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cvCfg.classes}`}>
              <CvIcon className="h-3.5 w-3.5" />
              Covenants: {worstCovenant === 'pass' ? 'All Passing' : worstCovenant === 'watch' ? 'Watch — Near Threshold' : 'Breach — Action Required'}
            </span>
            {loan.covenants.filter((c) => c.status === 'breach').length > 0 && (
              <span className="text-xs text-red-600 font-bold">
                {loan.covenants.filter((c) => c.status === 'breach').length} breach{loan.covenants.filter((c) => c.status === 'breach').length > 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">
            Originated {fmtDate(loan.originationDate)} · {PROP_LABELS[loan.loanPurpose] ?? loan.loanPurpose}
          </span>
        </div>
      </div>

      {/* Expanded covenant detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 space-y-4">
          {/* Covenants table */}
          {loan.covenants.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Covenant Compliance</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-white">
                    <tr>
                      {['Covenant', 'Required', 'Actual', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-bold uppercase tracking-widest text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loan.covenants.map((cv, i) => {
                      const cfg = COVENANT_CFG[cv.status];
                      const Icon = cfg.icon;
                      return (
                        <tr key={i} className={cv.status !== 'pass' ? 'bg-red-50/30' : ''}>
                          <td className="px-4 py-2.5 text-sm font-semibold text-slate-800">{cv.name}</td>
                          <td className="px-4 py-2.5 text-sm text-slate-600 font-mono">{cv.threshold}</td>
                          <td className={`px-4 py-2.5 text-sm font-bold font-mono ${
                            cv.status === 'breach' ? 'text-red-700' : cv.status === 'watch' ? 'text-amber-700' : 'text-emerald-700'
                          }`}>{cv.actual}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.classes}`}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Key loan details */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-widest">Original Amount</p>
              <p className="text-slate-800 font-bold mt-0.5">{fmt(loan.originalAmount)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-widest">Current UPB</p>
              <p className="text-slate-800 font-bold mt-0.5">{fmt(loan.upb)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-widest">Origination</p>
              <p className="text-slate-800 font-bold mt-0.5">{fmtDate(loan.originationDate)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-widest">Loan Purpose</p>
              <p className="text-slate-800 font-bold mt-0.5 capitalize">{loan.loanPurpose}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <Link
              to="/servicer/overview"
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              Open in Servicing
            </Link>
            {loan.tokenized && (
              <>
                <Link to="/onchain/cap-table" className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors">
                  <CubeIcon className="h-3.5 w-3.5" />
                  Cap Table — {loan.tokenSymbol}
                </Link>
                <Link to="/onchain/distributions" className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors">
                  Distributions
                </Link>
              </>
            )}
            {!loan.tokenized && (
              <Link to="/onchain/tokens" className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                <CubeIcon className="h-3.5 w-3.5" />
                Issue Token
              </Link>
            )}
            {worstCovenant !== 'pass' && (
              <Link to="/governance/loan-control" className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors">
                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                Open Governance
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({
  label,
  value,
  valueClass = 'text-slate-800 font-bold',
  sub,
  subClass = 'text-slate-400',
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
  subClass?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-sm mt-0.5 tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-0.5 ${subClass}`}>{sub}</p>}
    </div>
  );
}
