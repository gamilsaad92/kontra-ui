/**
 * Portfolio — Loans  (Phase 2: Centralized Loan Record)
 *
 * Every loan now carries a full servicing record:
 *   Reserves · Insurance · Taxes · Rent Roll · Inspection
 *
 * These five fields are the source of truth for the Token Gate.
 * The expanded card shows them, with a live "X / 12 Token Gate"
 * badge that deep-links to /onchain/gate?loan=LN-XXXX.
 */

import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  BanknotesIcon,
  ShieldCheckIcon as InsuranceIcon,
  DocumentCheckIcon,
  HomeModernIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { useLoanList } from '../../../features/portfolio/loans/api';
import type { CanonicalEntity } from '../../../features/crud/types';

// ── Types ──────────────────────────────────────────────────────────────────────
type CovenantStatus = 'pass' | 'watch' | 'breach';

interface Reserves    { balance: number; minimum: number; lastFunded: string; status: 'funded' | 'below' | 'critical' }
interface Insurance   { carrier: string; policyNumber: string; expiry: string; coverage: number; status: 'active' | 'expiring' | 'lapsed' }
interface Taxes       { paidThrough: string; nextDue: string; county: string; status: 'current' | 'delinquent' }
interface RentRoll    { certifiedDate: string; occupancy: number; units: number; certifiedBy: string }
interface Inspection  { lastDate: string; nextDue: string; inspector: string; critical: number; moderate: number; minor: number }

interface DemoLoan {
  id: string; loanId: string; title: string; status: string;
  borrower: string; propertyType: string; address: string;
  upb: number; originalAmount: number; rate: number; ltv: number;
  dscr: number; occupancy: number; originationDate: string;
  maturityDate: string; loanPurpose: string;
  tokenSymbol: string | null; tokenized: boolean;
  gateScore: number; // out of 12
  covenants: { name: string; threshold: string; actual: string; status: CovenantStatus }[];
  reserves: Reserves;
  insurance: Insurance;
  taxes: Taxes;
  rentRoll: RentRoll;
  inspection: Inspection;
}

// ── Full centralized loan records ──────────────────────────────────────────────
const DEMO_LOANS: DemoLoan[] = [
  {
    id: 'demo-ln-2847', loanId: 'LN-2847', title: 'The Meridian Apartments',
    status: 'active', borrower: 'Meridian Residential LLC',
    propertyType: 'multifamily', address: '1847 Colorado Blvd, Denver, CO 80205',
    upb: 5_112_500, originalAmount: 5_500_000, rate: 6.75, ltv: 65.2,
    dscr: 1.42, occupancy: 94, originationDate: '2024-06-15', maturityDate: '2026-06-15',
    loanPurpose: 'refinance', tokenSymbol: 'KTRA-2847', tokenized: true, gateScore: 11,
    covenants: [
      { name: 'DSCR Floor',       threshold: '≥ 1.25x', actual: '1.42x', status: 'pass' },
      { name: 'LTV Cap',          threshold: '≤ 75%',   actual: '65.2%', status: 'pass' },
      { name: 'Occupancy Floor',  threshold: '≥ 85%',   actual: '94%',   status: 'pass' },
      { name: 'Debt Yield Floor', threshold: '≥ 8.5%',  actual: '9.2%',  status: 'pass' },
    ],
    reserves:   { balance: 128_125, minimum: 100_000, lastFunded: '2026-04-01', status: 'funded' },
    insurance:  { carrier: 'The Hartford', policyNumber: 'HP-2847-2024', expiry: '2026-07-15', coverage: 8_000_000, status: 'expiring' },
    taxes:      { paidThrough: '2026-03-31', nextDue: '2026-06-01', county: 'Denver County, CO', status: 'current' },
    rentRoll:   { certifiedDate: '2026-03-15', occupancy: 94, units: 48, certifiedBy: 'Marcus & Millichap' },
    inspection: { lastDate: '2026-02-03', nextDue: '2026-08-03', inspector: 'National Property Inspections', critical: 0, moderate: 0, minor: 2 },
  },
  {
    id: 'demo-ln-3201', loanId: 'LN-3201', title: 'Rosewood Medical Plaza',
    status: 'active', borrower: 'Rosewood Health Properties Inc.',
    propertyType: 'office', address: '3201 N Central Ave, Phoenix, AZ 85012',
    upb: 8_450_000, originalAmount: 9_000_000, rate: 7.25, ltv: 57.9,
    dscr: 1.85, occupancy: 97, originationDate: '2023-12-01', maturityDate: '2027-12-01',
    loanPurpose: 'acquisition', tokenSymbol: 'KTRA-3201', tokenized: true, gateScore: 12,
    covenants: [
      { name: 'DSCR Floor',       threshold: '≥ 1.35x', actual: '1.85x', status: 'pass' },
      { name: 'LTV Cap',          threshold: '≤ 70%',   actual: '57.9%', status: 'pass' },
      { name: 'Occupancy Floor',  threshold: '≥ 90%',   actual: '97%',   status: 'pass' },
      { name: 'Debt Yield Floor', threshold: '≥ 9.0%',  actual: '11.2%', status: 'pass' },
    ],
    reserves:   { balance: 422_500, minimum: 300_000, lastFunded: '2026-04-01', status: 'funded' },
    insurance:  { carrier: 'AIG Commercial', policyNumber: 'AIG-3201-2023', expiry: '2026-11-30', coverage: 20_000_000, status: 'active' },
    taxes:      { paidThrough: '2026-03-31', nextDue: '2026-06-01', county: 'Maricopa County, AZ', status: 'current' },
    rentRoll:   { certifiedDate: '2026-02-28', occupancy: 97, units: 8, certifiedBy: 'JLL' },
    inspection: { lastDate: '2025-12-10', nextDue: '2026-06-10', inspector: 'Cushman & Wakefield', critical: 0, moderate: 1, minor: 3 },
  },
  {
    id: 'demo-ln-5593', loanId: 'LN-5593', title: 'Harbour Square Retail',
    status: 'pending', borrower: 'Harbour Square Partners LLC',
    propertyType: 'retail', address: '5593 Harbour Ave SW, Seattle, WA 98126',
    upb: 4_187_500, originalAmount: 4_500_000, rate: 6.50, ltv: 71.8,
    dscr: 1.08, occupancy: 79, originationDate: '2023-03-15', maturityDate: '2027-03-15',
    loanPurpose: 'refinance', tokenSymbol: 'KTRA-5593', tokenized: true, gateScore: 9,
    covenants: [
      { name: 'DSCR Floor',       threshold: '≥ 1.20x', actual: '1.08x', status: 'watch' },
      { name: 'LTV Cap',          threshold: '≤ 70%',   actual: '71.8%', status: 'breach' },
      { name: 'Occupancy Floor',  threshold: '≥ 85%',   actual: '79%',   status: 'breach' },
      { name: 'Debt Yield Floor', threshold: '≥ 8.0%',  actual: '7.4%',  status: 'watch' },
    ],
    reserves:   { balance: 78_500, minimum: 90_000, lastFunded: '2026-01-15', status: 'below' },
    insurance:  { carrier: 'Liberty Mutual', policyNumber: 'LM-5593-2023', expiry: '2026-08-01', coverage: 12_000_000, status: 'active' },
    taxes:      { paidThrough: '2026-03-31', nextDue: '2026-06-01', county: 'King County, WA', status: 'current' },
    rentRoll:   { certifiedDate: '2026-03-01', occupancy: 79, units: 18, certifiedBy: 'Kidder Mathews' },
    inspection: { lastDate: '2026-02-20', nextDue: '2026-08-20', inspector: 'Colliers', critical: 0, moderate: 2, minor: 4 },
  },
  {
    id: 'demo-ln-0728', loanId: 'LN-0728', title: 'Pacific Vista Industrial',
    status: 'active', borrower: 'PV Logistics Holdings LLC',
    propertyType: 'industrial', address: '728 E Pacific Coast Hwy, El Segundo, CA 90245',
    upb: 6_487_500, originalAmount: 7_000_000, rate: 7.00, ltv: 55.0,
    dscr: 2.10, occupancy: 100, originationDate: '2023-08-22', maturityDate: '2028-08-22',
    loanPurpose: 'acquisition', tokenSymbol: 'KTRA-0728', tokenized: true, gateScore: 12,
    covenants: [
      { name: 'DSCR Floor',       threshold: '≥ 1.30x', actual: '2.10x', status: 'pass' },
      { name: 'LTV Cap',          threshold: '≤ 65%',   actual: '55.0%', status: 'pass' },
      { name: 'Occupancy Floor',  threshold: '≥ 85%',   actual: '100%',  status: 'pass' },
      { name: 'Debt Yield Floor', threshold: '≥ 9.5%',  actual: '13.8%', status: 'pass' },
    ],
    reserves:   { balance: 324_375, minimum: 200_000, lastFunded: '2026-04-01', status: 'funded' },
    insurance:  { carrier: 'Pacific Shield Commercial', policyNumber: 'PS-0728-2023', expiry: '2027-03-15', coverage: 15_000_000, status: 'active' },
    taxes:      { paidThrough: '2026-03-31', nextDue: '2026-06-01', county: 'Los Angeles County, CA', status: 'current' },
    rentRoll:   { certifiedDate: '2026-03-05', occupancy: 100, units: 12, certifiedBy: 'CBRE' },
    inspection: { lastDate: '2026-01-15', nextDue: '2026-07-15', inspector: 'Colliers', critical: 0, moderate: 0, minor: 1 },
  },
  {
    id: 'demo-ln-4108', loanId: 'LN-4108', title: 'Grand Central Offices',
    status: 'pending', borrower: 'GCO Property Partners LP',
    propertyType: 'office', address: '4108 W Adams St, Chicago, IL 60612',
    upb: 3_762_500, originalAmount: 4_000_000, rate: 6.25, ltv: 74.2,
    dscr: 1.08, occupancy: 81, originationDate: '2024-01-10', maturityDate: '2028-01-10',
    loanPurpose: 'bridge', tokenSymbol: 'KTRA-4108', tokenized: true, gateScore: 10,
    covenants: [
      { name: 'DSCR Floor',       threshold: '≥ 1.25x', actual: '1.08x', status: 'breach' },
      { name: 'LTV Cap',          threshold: '≤ 75%',   actual: '74.2%', status: 'watch' },
      { name: 'Occupancy Floor',  threshold: '≥ 85%',   actual: '81%',   status: 'watch' },
      { name: 'Debt Yield Floor', threshold: '≥ 8.0%',  actual: '7.1%',  status: 'breach' },
    ],
    reserves:   { balance: 94_063, minimum: 90_000, lastFunded: '2026-03-15', status: 'funded' },
    insurance:  { carrier: 'Travelers Commercial', policyNumber: 'TC-4108-2024', expiry: '2026-10-10', coverage: 10_000_000, status: 'active' },
    taxes:      { paidThrough: '2026-03-31', nextDue: '2026-06-01', county: 'Cook County, IL', status: 'current' },
    rentRoll:   { certifiedDate: '2026-02-10', occupancy: 81, units: 22, certifiedBy: 'CBRE' },
    inspection: { lastDate: '2026-03-08', nextDue: '2026-09-08', inspector: 'InspectCRE', critical: 0, moderate: 0, minor: 0 },
  },
  {
    id: 'demo-ln-1120', loanId: 'LN-1120', title: 'Lakeside Mixed-Use',
    status: 'active', borrower: 'Lakeside Development Group',
    propertyType: 'mixed_use', address: '1120 S Congress Ave, Austin, TX 78704',
    upb: 7_156_250, originalAmount: 7_500_000, rate: 7.50, ltv: 61.8,
    dscr: 1.55, occupancy: 88, originationDate: '2024-09-01', maturityDate: '2029-09-01',
    loanPurpose: 'acquisition', tokenSymbol: null, tokenized: false, gateScore: 10,
    covenants: [
      { name: 'DSCR Floor',       threshold: '≥ 1.25x', actual: '1.55x', status: 'pass' },
      { name: 'LTV Cap',          threshold: '≤ 70%',   actual: '61.8%', status: 'pass' },
      { name: 'Occupancy Floor',  threshold: '≥ 85%',   actual: '88%',   status: 'pass' },
      { name: 'Debt Yield Floor', threshold: '≥ 9.0%',  actual: '10.4%', status: 'pass' },
    ],
    reserves:   { balance: 214_688, minimum: 180_000, lastFunded: '2026-04-01', status: 'funded' },
    insurance:  { carrier: 'Zurich Commercial', policyNumber: 'ZC-1120-2024', expiry: '2026-09-01', coverage: 18_000_000, status: 'active' },
    taxes:      { paidThrough: '2026-03-31', nextDue: '2026-06-01', county: 'Travis County, TX', status: 'current' },
    rentRoll:   { certifiedDate: '2026-03-20', occupancy: 88, units: 34, certifiedBy: 'Newmark' },
    inspection: { lastDate: '2026-01-28', nextDue: '2026-07-28', inspector: 'Commercial Property Advisors', critical: 0, moderate: 0, minor: 1 },
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

const PROP_LABELS: Record<string, string> = {
  multifamily: 'Multifamily', office: 'Office', retail: 'Retail',
  industrial: 'Industrial', hotel: 'Hotel', mixed_use: 'Mixed Use', other: 'Other',
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
const COVENANT_CFG: Record<CovenantStatus, { label: string; classes: string }> = {
  pass:   { label: 'Pass',   classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  watch:  { label: 'Watch',  classes: 'bg-amber-100 text-amber-700 border border-amber-200' },
  breach: { label: 'Breach', classes: 'bg-red-100 text-red-700 border border-red-200' },
};

function dscrColor(v: number) {
  if (v >= 1.3) return 'text-emerald-700 font-black';
  if (v >= 1.1) return 'text-amber-700 font-black';
  return 'text-red-700 font-black';
}
function ltvColor(v: number) {
  if (v <= 60) return 'text-emerald-700 font-bold';
  if (v <= 70) return 'text-amber-700 font-bold';
  return 'text-red-700 font-bold';
}
function gateScoreColor(s: number) {
  if (s === 12) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s >= 10)  return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

// ── API → DemoLoan adapter ────────────────────────────────────────────────────
function apiEntityToDemoLoan(e: CanonicalEntity): DemoLoan {
  const d = (e.data ?? {}) as Record<string, unknown>;
  const g = (keys: string[]) => { for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== '') return d[k]; return undefined; };
  const num = (keys: string[]) => { const v = g(keys); return v !== undefined ? parseFloat(String(v)) : 0; };
  const str = (keys: string[]) => { const v = g(keys); return v !== undefined ? String(v) : ''; };
  const upb = num(['loan_amount', 'principal', 'amount', 'loan_balance', 'commitment']);
  const dscr = num(['dscr', 'debt_service_coverage', 'debt_service_coverage_ratio']);
  const ltv = num(['ltv', 'ltv_pct', 'loan_to_value', 'LTV']);
  const occ = num(['occupancy', 'occupancy_rate', 'occupancy_pct']);
  const reserveBalance = num(['reserve_balance', 'reserves']);
  const reserveMin = num(['reserve_minimum', 'reserve_min']);
  return {
    id: e.id, loanId: str(['loan_id', 'reference_id']).slice(0, 10) || e.id.slice(0, 8),
    title: e.title ?? e.name ?? 'Untitled Loan', status: e.status ?? 'active',
    borrower: str(['borrower_name', 'borrower', 'sponsor']),
    propertyType: str(['property_type', 'asset_type']) || 'other',
    address: str(['property_address', 'address', 'property_name']),
    upb, originalAmount: num(['original_amount', 'commitment']) || upb,
    rate: num(['interest_rate', 'rate', 'coupon', 'note_rate']),
    ltv, dscr, occupancy: occ,
    originationDate: str(['origination_date', 'origination']) || new Date().toISOString(),
    maturityDate: str(['maturity_date', 'maturity', 'due_date']),
    loanPurpose: str(['loan_purpose', 'purpose']) || 'other',
    tokenSymbol: str(['token_symbol']) || null, tokenized: !!g(['token_symbol']), gateScore: 0,
    covenants: [],
    reserves:   { balance: reserveBalance, minimum: reserveMin, lastFunded: '', status: reserveBalance >= reserveMin ? 'funded' : 'below' },
    insurance:  { carrier: str(['insurance_carrier']), policyNumber: str(['insurance_policy']), expiry: str(['insurance_expiry']), coverage: num(['insurance_coverage']), status: 'active' },
    taxes:      { paidThrough: str(['tax_paid_through']), nextDue: str(['tax_next_due']), county: str(['tax_county']), status: 'current' },
    rentRoll:   { certifiedDate: str(['rent_roll_date']), occupancy: occ, units: num(['unit_count']), certifiedBy: str(['rent_roll_certifier']) },
    inspection: { lastDate: str(['last_inspection']), nextDue: str(['next_inspection']), inspector: str(['inspector']), critical: 0, moderate: 0, minor: 0 },
  };
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' }, { value: 'active', label: 'Performing' },
  { value: 'pending', label: 'Watch List' }, { value: 'rejected', label: 'Delinquent' },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PortfolioLoansPage() {
  const { data, isLoading } = useLoanList();
  const apiLoans = (data?.items ?? []) as CanonicalEntity[];
  const loans = useMemo<DemoLoan[]>(() => {
    if (apiLoans.length > 0) return apiLoans.map(apiEntityToDemoLoan);
    return DEMO_LOANS;
  }, [apiLoans]);

  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [sortBy, setSortBy]       = useState<'maturity' | 'dscr' | 'upb' | 'gate'>('maturity');
  const [expandedId, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'covenants' | 'servicing'>>({});
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let out = loans;
    if (filter !== 'all') out = out.filter((l) => l.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((l) =>
        l.title.toLowerCase().includes(q) || l.loanId.toLowerCase().includes(q) ||
        l.borrower.toLowerCase().includes(q) || l.address.toLowerCase().includes(q),
      );
    }
    return [...out].sort((a, b) => {
      if (sortBy === 'dscr')     return a.dscr - b.dscr;
      if (sortBy === 'upb')      return b.upb - a.upb;
      if (sortBy === 'gate')     return a.gateScore - b.gateScore;
      const da = a.maturityDate ? new Date(a.maturityDate).getTime() : Infinity;
      const db = b.maturityDate ? new Date(b.maturityDate).getTime() : Infinity;
      return da - db;
    });
  }, [loans, search, filter, sortBy]);

  const stats = useMemo(() => ({
    totalUPB:     loans.reduce((s, l) => s + l.upb, 0),
    avgDSCR:      loans.length ? loans.reduce((s, l) => s + l.dscr, 0) / loans.length : 0,
    avgLTV:       loans.length ? loans.reduce((s, l) => s + l.ltv, 0) / loans.length : 0,
    atRisk:       loans.filter((l) => l.status === 'pending' || l.status === 'rejected').length,
    gateReady:    loans.filter((l) => l.gateScore === 12).length,
    gateSuspended:loans.filter((l) => l.tokenized && l.gateScore < 12).length,
    maturingSoon: loans.filter((l) => { const d = daysUntil(l.maturityDate); return d >= 0 && d <= 90; }).length,
  }), [loans]);

  if (isLoading) return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" /></div>;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Total UPB',         value: fmt(stats.totalUPB),                        accent: false },
          { label: 'Avg DSCR',          value: `${stats.avgDSCR.toFixed(2)}x`,              accent: stats.avgDSCR < 1.25 },
          { label: 'Avg LTV',           value: `${stats.avgLTV.toFixed(1)}%`,               accent: stats.avgLTV > 70 },
          { label: 'Watch / Delinq',    value: String(stats.atRisk),                        accent: stats.atRisk > 0 },
          { label: 'Gate Ready (12/12)',value: `${stats.gateReady} / ${loans.length}`,     accent: false },
          { label: 'Token Suspended',   value: String(stats.gateSuspended),                 accent: stats.gateSuspended > 0 },
          { label: 'Maturing ≤ 90d',    value: String(stats.maturingSoon),                  accent: stats.maturingSoon > 0 },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border bg-white p-3 ${s.accent ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
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
            <input type="text" placeholder="Search loan, borrower, address…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60 rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none">
            <option value="maturity">Sort: Maturity (soonest)</option>
            <option value="dscr">Sort: DSCR (riskiest first)</option>
            <option value="upb">Sort: UPB (largest first)</option>
            <option value="gate">Sort: Gate score (lowest first)</option>
          </select>
        </div>
        <button onClick={() => navigate('/portfolio/originate')}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors">
          + Originate Loan
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const count = opt.value === 'all' ? loans.length : loans.filter((l) => l.status === opt.value).length;
          return (
            <button key={opt.value} onClick={() => setFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${filter === opt.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Loan cards */}
      <div className="space-y-3">
        {filtered.map((loan) => (
          <LoanCard key={loan.id} loan={loan}
            expanded={expandedId === loan.id}
            activeTab={activeTab[loan.id] ?? 'covenants'}
            onToggle={() => setExpanded(expandedId === loan.id ? null : loan.id)}
            onTabChange={(t) => setActiveTab((prev) => ({ ...prev, [loan.id]: t }))}
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
function LoanCard({ loan, expanded, activeTab, onToggle, onTabChange }: {
  loan: DemoLoan; expanded: boolean;
  activeTab: 'covenants' | 'servicing';
  onToggle: () => void;
  onTabChange: (t: 'covenants' | 'servicing') => void;
}) {
  const days = daysUntil(loan.maturityDate);
  const maturityUrgent   = days >= 0 && days <= 90;
  const maturityImminent = days >= 0 && days <= 30;
  const matured = days < 0;

  const statusCfg = STATUS_CFG[loan.status] ?? STATUS_CFG.active;
  const propColor = PROP_COLORS[loan.propertyType] ?? PROP_COLORS.other;

  const worstCovenant: CovenantStatus = loan.covenants.some((c) => c.status === 'breach') ? 'breach'
    : loan.covenants.some((c) => c.status === 'watch') ? 'watch' : 'pass';

  const gateColor = gateScoreColor(loan.gateScore);
  const GateIcon = loan.gateScore === 12 ? ShieldCheckIcon : loan.gateScore >= 10 ? ShieldCheckIcon : ShieldExclamationIcon;

  return (
    <div className={`rounded-xl border bg-white transition-all ${worstCovenant === 'breach' ? 'border-red-200' : worstCovenant === 'watch' ? 'border-amber-200' : 'border-slate-200'}`}>
      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="inline-block rounded-lg bg-slate-900 px-2 py-1 text-xs font-black tracking-widest text-white shrink-0">{loan.loanId}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{loan.title}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusCfg.classes}`}>{statusCfg.label}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${propColor}`}>{PROP_LABELS[loan.propertyType] ?? loan.propertyType}</span>
                {loan.tokenized && loan.tokenSymbol && (
                  <Link to={`/onchain/gate?loan=${loan.loanId}`}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-xs font-black text-violet-700 hover:bg-violet-100 transition-colors">
                    <CubeIcon className="h-3 w-3" />{loan.tokenSymbol}
                  </Link>
                )}
                {/* Token Gate score badge */}
                <Link to={`/onchain/gate?loan=${loan.loanId}`}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-black hover:opacity-80 transition-opacity ${gateColor}`}>
                  <GateIcon className="h-3 w-3" />
                  Gate {loan.gateScore}/12
                </Link>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{loan.borrower}</p>
              <p className="text-xs text-slate-400">{loan.address}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/servicer/overview" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />Servicing
            </Link>
            {loan.tokenized && (
              <Link to="/onchain/cap-table" className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors">
                <CubeIcon className="h-3.5 w-3.5" />Cap Table
              </Link>
            )}
            <button onClick={onToggle} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 transition-colors">
              {expanded ? <ChevronUpIcon className="h-4 w-4 text-slate-500" /> : <ChevronDownIcon className="h-4 w-4 text-slate-500" />}
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
          <MetricCell label="UPB" value={fmt(loan.upb)} />
          <MetricCell label="DSCR" value={loan.dscr > 0 ? `${loan.dscr.toFixed(2)}x` : '—'} valueClass={loan.dscr > 0 ? dscrColor(loan.dscr) : ''} />
          <MetricCell label="LTV" value={loan.ltv > 0 ? `${loan.ltv.toFixed(1)}%` : '—'} valueClass={loan.ltv > 0 ? ltvColor(loan.ltv) : ''} />
          <MetricCell label="Rate" value={loan.rate > 0 ? `${loan.rate.toFixed(2)}%` : '—'} />
          <MetricCell label="Occupancy" value={loan.occupancy > 0 ? `${loan.occupancy}%` : '—'}
            valueClass={loan.occupancy > 0 ? (loan.occupancy >= 85 ? 'text-emerald-700 font-bold' : loan.occupancy >= 75 ? 'text-amber-700 font-bold' : 'text-red-700 font-bold') : ''} />
          <MetricCell label="Maturity" value={loan.maturityDate ? fmtDate(loan.maturityDate) : '—'}
            sub={matured ? 'Matured' : maturityImminent ? `${days}d — CRITICAL` : maturityUrgent ? `${days}d left` : days < 365 ? `${days}d left` : undefined}
            subClass={maturityImminent ? 'text-red-600 font-bold' : maturityUrgent ? 'text-amber-600 font-bold' : 'text-slate-400'} />
        </div>

        {/* Covenant quick-status */}
        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            worstCovenant === 'breach' ? 'bg-red-50 text-red-700 border border-red-200' :
            worstCovenant === 'watch'  ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {worstCovenant === 'pass' ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <ExclamationTriangleIcon className="h-3.5 w-3.5" />}
            Covenants: {worstCovenant === 'pass' ? 'All Passing' : worstCovenant === 'watch' ? 'Watch — Near Threshold' : 'Breach — Action Required'}
          </span>
          <span className="text-xs text-slate-400">Originated {fmtDate(loan.originationDate)} · {loan.loanPurpose}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          {/* Tab bar */}
          <div className="flex gap-1 px-4 pt-3">
            {(['covenants', 'servicing'] as const).map((t) => (
              <button key={t} onClick={() => onTabChange(t)}
                className={`rounded-t-lg px-4 py-1.5 text-xs font-bold capitalize transition-colors ${activeTab === t ? 'bg-white border border-b-white border-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                {t === 'servicing' ? 'Servicing Record' : 'Covenants'}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-b-xl mx-4 mb-4 p-4 space-y-4">
            {activeTab === 'covenants' ? (
              <>
                {/* Covenant table */}
                {loan.covenants.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50">
                        <tr>{['Covenant', 'Required', 'Actual', 'Status'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-bold uppercase tracking-widest text-slate-500">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {loan.covenants.map((cv, i) => {
                          const cfg = COVENANT_CFG[cv.status];
                          return (
                            <tr key={i} className={cv.status !== 'pass' ? 'bg-red-50/30' : ''}>
                              <td className="px-4 py-2.5 text-sm font-semibold text-slate-800">{cv.name}</td>
                              <td className="px-4 py-2.5 text-sm text-slate-600 font-mono">{cv.threshold}</td>
                              <td className={`px-4 py-2.5 text-sm font-bold font-mono ${cv.status === 'breach' ? 'text-red-700' : cv.status === 'watch' ? 'text-amber-700' : 'text-emerald-700'}`}>{cv.actual}</td>
                              <td className="px-4 py-2.5">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.classes}`}>{cfg.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <ServicingRecord loan={loan} />
            )}

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <Link to="/servicer/overview" className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 transition-colors">
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />Open in Servicing
              </Link>
              <Link to={`/onchain/gate?loan=${loan.loanId}`} className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors">
                <ShieldCheckIcon className="h-3.5 w-3.5" />Token Gate — {loan.gateScore}/12
              </Link>
              {loan.tokenized && (
                <>
                  <Link to="/onchain/cap-table" className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors">
                    <CubeIcon className="h-3.5 w-3.5" />Cap Table — {loan.tokenSymbol}
                  </Link>
                  <Link to="/onchain/distributions" className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors">Distributions</Link>
                </>
              )}
              {!loan.tokenized && (
                <Link to={`/onchain/gate?loan=${loan.loanId}`} className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors">
                  <CubeIcon className="h-3.5 w-3.5" />Check Eligibility
                </Link>
              )}
              {worstCovenant !== 'pass' && (
                <Link to="/governance/loan-control" className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />Open Governance
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Servicing Record Panel ─────────────────────────────────────────────────────
function ServicingRecord({ loan }: { loan: DemoLoan }) {
  const { reserves, insurance, taxes, rentRoll, inspection } = loan;

  const reservePct = reserves.minimum > 0 ? (reserves.balance / reserves.minimum) * 100 : 100;
  const insExpiry = daysUntil(insurance.expiry);

  return (
    <div className="space-y-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Centralized Servicing Record</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Reserves */}
        <ServicingPanel
          icon={BanknotesIcon}
          title="Reserves"
          status={reserves.status === 'funded' ? 'pass' : reserves.status === 'below' ? 'watch' : 'fail'}
          statusLabel={reserves.status === 'funded' ? 'Funded' : reserves.status === 'below' ? 'Below Minimum' : 'Critical'}
        >
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Balance</span>
              <span className="font-bold text-slate-800">{fmt(reserves.balance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Required min</span>
              <span className="font-bold text-slate-800">{fmt(reserves.minimum)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
              <div className={`h-1.5 rounded-full ${reservePct >= 100 ? 'bg-emerald-500' : reservePct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(reservePct, 100)}%` }} />
            </div>
            <p className="text-slate-400">Last funded: {reserves.lastFunded ? fmtDate(reserves.lastFunded) : '—'}</p>
          </div>
        </ServicingPanel>

        {/* Insurance */}
        <ServicingPanel
          icon={InsuranceIcon}
          title="Insurance"
          status={insurance.status === 'active' ? 'pass' : insurance.status === 'expiring' ? 'watch' : 'fail'}
          statusLabel={insurance.status === 'active' ? 'Active' : insurance.status === 'expiring' ? `Expiring in ${insExpiry}d` : 'Lapsed'}
        >
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Carrier</span>
              <span className="font-bold text-slate-800 text-right">{insurance.carrier}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Coverage</span>
              <span className="font-bold text-slate-800">{fmt(insurance.coverage)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Policy #</span>
              <span className="font-mono text-slate-600">{insurance.policyNumber}</span>
            </div>
            <p className="text-slate-400">Expires: {insurance.expiry ? fmtDate(insurance.expiry) : '—'}</p>
          </div>
        </ServicingPanel>

        {/* Taxes */}
        <ServicingPanel
          icon={DocumentCheckIcon}
          title="Property Taxes"
          status={taxes.status === 'current' ? 'pass' : 'fail'}
          statusLabel={taxes.status === 'current' ? 'Current' : 'Delinquent'}
        >
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Paid through</span>
              <span className="font-bold text-slate-800">{taxes.paidThrough ? fmtDate(taxes.paidThrough) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Next due</span>
              <span className="font-bold text-slate-800">{taxes.nextDue ? fmtDate(taxes.nextDue) : '—'}</span>
            </div>
            <p className="text-slate-400">{taxes.county}</p>
          </div>
        </ServicingPanel>

        {/* Rent Roll */}
        <ServicingPanel
          icon={HomeModernIcon}
          title="Rent Roll"
          status={(() => {
            const d = daysUntil(rentRoll.certifiedDate);
            return d > -90 ? 'pass' : 'watch'; // certified within 90 days
          })()}
          statusLabel={(() => {
            const d = Math.abs(daysUntil(rentRoll.certifiedDate));
            return d <= 90 ? 'Current' : `${d}d old — stale`;
          })()}
        >
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Certified</span>
              <span className="font-bold text-slate-800">{rentRoll.certifiedDate ? fmtDate(rentRoll.certifiedDate) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Occupancy</span>
              <span className={`font-bold ${rentRoll.occupancy >= 85 ? 'text-emerald-700' : 'text-amber-700'}`}>{rentRoll.occupancy}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Units / suites</span>
              <span className="font-bold text-slate-800">{rentRoll.units}</span>
            </div>
            <p className="text-slate-400">By: {rentRoll.certifiedBy}</p>
          </div>
        </ServicingPanel>

        {/* Inspection */}
        <ServicingPanel
          icon={WrenchScrewdriverIcon}
          title="Inspection"
          status={inspection.critical > 0 ? 'fail' : inspection.moderate > 0 ? 'watch' : 'pass'}
          statusLabel={inspection.critical > 0 ? `${inspection.critical} Critical` : inspection.moderate > 0 ? `${inspection.moderate} Moderate` : 'Clear'}
        >
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Last inspection</span>
              <span className="font-bold text-slate-800">{inspection.lastDate ? fmtDate(inspection.lastDate) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Next due</span>
              <span className="font-bold text-slate-800">{inspection.nextDue ? fmtDate(inspection.nextDue) : '—'}</span>
            </div>
            <div className="flex gap-3">
              <span className={`font-bold ${inspection.critical > 0 ? 'text-red-700' : 'text-slate-400'}`}>{inspection.critical} critical</span>
              <span className={`font-bold ${inspection.moderate > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{inspection.moderate} moderate</span>
              <span className="text-slate-400">{inspection.minor} minor</span>
            </div>
            <p className="text-slate-400">By: {inspection.inspector}</p>
          </div>
        </ServicingPanel>

        {/* Loan details */}
        <ServicingPanel icon={DocumentCheckIcon} title="Loan Details" status="pass" statusLabel="On file">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Original amount</span>
              <span className="font-bold text-slate-800">{fmt(loan.originalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current UPB</span>
              <span className="font-bold text-slate-800">{fmt(loan.upb)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Origination</span>
              <span className="font-bold text-slate-800">{fmtDate(loan.originationDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Purpose</span>
              <span className="font-bold text-slate-800 capitalize">{loan.loanPurpose}</span>
            </div>
          </div>
        </ServicingPanel>
      </div>
    </div>
  );
}

function ServicingPanel({
  icon: Icon, title, status, statusLabel, children,
}: {
  icon: React.ElementType; title: string; status: 'pass' | 'watch' | 'fail'; statusLabel: string; children: React.ReactNode;
}) {
  const border = status === 'pass' ? 'border-emerald-200' : status === 'watch' ? 'border-amber-200' : 'border-red-200';
  const badge  = status === 'pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : status === 'watch' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200';
  const StatusIcon = status === 'pass' ? CheckCircleIcon : status === 'watch' ? ExclamationTriangleIcon : XCircleIcon;
  return (
    <div className={`rounded-xl border p-3 ${border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-slate-500" />
          <p className="text-xs font-black text-slate-700">{title}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge}`}>
          <StatusIcon className="h-3 w-3" />{statusLabel}
        </span>
      </div>
      {children}
    </div>
  );
}

function MetricCell({ label, value, valueClass = 'text-slate-800 font-bold', sub, subClass = 'text-slate-400' }: {
  label: string; value: string; valueClass?: string; sub?: string; subClass?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-sm mt-0.5 tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-0.5 ${subClass}`}>{sub}</p>}
    </div>
  );
}
