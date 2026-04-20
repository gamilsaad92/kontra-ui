import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/apiClient';
import { useLoanList } from '../../../features/portfolio/loans/api';
import type { CanonicalEntity } from '../../../features/crud/types';
import { StatusBadge } from './PortfolioOverviewPage';

// ── Field helpers ─────────────────────────────────────────────────────────────
function pick(data: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (data?.[k] !== undefined && data[k] !== null && data[k] !== '') return data[k];
  }
  return undefined;
}
const getNum = (d: Record<string, unknown>, ...k: string[]) => {
  const v = pick(d, ...k);
  return v !== undefined ? parseFloat(String(v)) : undefined;
};
const getStr = (d: Record<string, unknown>, ...k: string[]) => {
  const v = pick(d, ...k);
  return v !== undefined ? String(v) : undefined;
};
const getLoanAmount = (d: Record<string, unknown>) =>
  getNum(d, 'loan_amount', 'principal', 'amount', 'loan_balance', 'commitment');
const getLtv = (d: Record<string, unknown>) =>
  getNum(d, 'ltv', 'ltv_pct', 'loan_to_value', 'LTV');
const getPropertyType = (d: Record<string, unknown>) =>
  getStr(d, 'property_type', 'asset_type', 'collateral_type');
const getMaturityDate = (d: Record<string, unknown>) =>
  getStr(d, 'maturity_date', 'maturity', 'loan_maturity', 'due_date');
const getRate = (d: Record<string, unknown>) =>
  getNum(d, 'interest_rate', 'rate', 'coupon', 'note_rate');
const getBorrower = (d: Record<string, unknown>) =>
  getStr(d, 'borrower_name', 'borrower', 'sponsor', 'guarantor');
const getAddress = (d: Record<string, unknown>) =>
  getStr(d, 'property_address', 'address', 'property_name', 'collateral');

function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function formatDate(s: string | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PROP_TYPE_OPTIONS = [
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'office', label: 'Office' },
  { value: 'retail', label: 'Retail' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'mixed_use', label: 'Mixed Use' },
  { value: 'land', label: 'Land' },
  { value: 'other', label: 'Other' },
];

const LOAN_PURPOSE_OPTIONS = [
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'refinance', label: 'Refinance' },
  { value: 'construction', label: 'Construction' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'mezzanine', label: 'Mezzanine' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Performing' },
  { value: 'pending', label: 'Watch' },
  { value: 'rejected', label: 'Delinquent' },
  { value: 'inactive', label: 'Matured' },
  { value: 'draft', label: 'Draft' },
];

const STATUS_FILTER = [{ value: 'all', label: 'All' }, ...STATUS_OPTIONS];

// ── Form types ────────────────────────────────────────────────────────────────
interface LoanFormData {
  title: string;
  status: string;
  borrower: string;
  property_type: string;
  property_address: string;
  loan_amount: string;
  interest_rate: string;
  ltv: string;
  origination_date: string;
  maturity_date: string;
  loan_purpose: string;
  covenant_dscr_floor: string;
  covenant_ltv_cap: string;
  covenant_occupancy_floor: string;
  covenant_reserve_min: string;
  covenant_frequency: string;
}

const EMPTY_FORM: LoanFormData = {
  title: '',
  status: 'active',
  borrower: '',
  property_type: 'multifamily',
  property_address: '',
  loan_amount: '',
  interest_rate: '',
  ltv: '',
  origination_date: '',
  maturity_date: '',
  loan_purpose: 'acquisition',
  covenant_dscr_floor: '',
  covenant_ltv_cap: '',
  covenant_occupancy_floor: '',
  covenant_reserve_min: '',
  covenant_frequency: 'quarterly',
};

function loanToForm(entity: CanonicalEntity): LoanFormData {
  const d = entity.data as Record<string, unknown>;
  return {
    title: ((entity.title ?? entity.name ?? '') as string),
    status: entity.status ?? 'active',
    borrower: getBorrower(d) ?? '',
    property_type: getPropertyType(d) ?? 'multifamily',
    property_address: getAddress(d) ?? '',
    loan_amount: String(getLoanAmount(d) ?? ''),
    interest_rate: String(getRate(d) ?? ''),
    ltv: String(getLtv(d) ?? ''),
    origination_date: (getStr(d, 'origination_date', 'origination') ?? ''),
    maturity_date: getMaturityDate(d) ?? '',
    loan_purpose: (getStr(d, 'loan_purpose', 'purpose') ?? 'acquisition'),
    covenant_dscr_floor: String(getNum(d, 'covenant_dscr_floor') ?? ''),
    covenant_ltv_cap: String(getNum(d, 'covenant_ltv_cap') ?? ''),
    covenant_occupancy_floor: String(getNum(d, 'covenant_occupancy_floor') ?? ''),
    covenant_reserve_min: String(getNum(d, 'covenant_reserve_min') ?? ''),
    covenant_frequency: (getStr(d, 'covenant_frequency') ?? 'quarterly'),
  };
}

function formToPayload(f: LoanFormData) {
  return {
    title: f.title || 'Untitled Loan',
    status: f.status,
    data: {
      borrower_name: f.borrower || undefined,
      property_type: f.property_type || undefined,
      property_address: f.property_address || undefined,
      loan_amount: f.loan_amount ? parseFloat(f.loan_amount) : undefined,
      interest_rate: f.interest_rate ? parseFloat(f.interest_rate) : undefined,
      ltv: f.ltv ? parseFloat(f.ltv) : undefined,
      origination_date: f.origination_date || undefined,
      maturity_date: f.maturity_date || undefined,
      loan_purpose: f.loan_purpose || undefined,
      covenant_dscr_floor: f.covenant_dscr_floor ? parseFloat(f.covenant_dscr_floor) : undefined,
      covenant_ltv_cap: f.covenant_ltv_cap ? parseFloat(f.covenant_ltv_cap) : undefined,
      covenant_occupancy_floor: f.covenant_occupancy_floor ? parseFloat(f.covenant_occupancy_floor) : undefined,
      covenant_reserve_min: f.covenant_reserve_min ? parseFloat(f.covenant_reserve_min) : undefined,
      covenant_frequency: f.covenant_frequency || undefined,
    },
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────
function useCreateLoanFull() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (form: LoanFormData) => {
      const res = await apiFetch('/api/portfolio/loans', {
        method: 'POST',
        body: JSON.stringify(formToPayload(form)),
      });
      if (!res.ok) throw new Error('Failed to create loan');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio-loans'] }),
  });
}

function useUpdateLoanFull(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (form: LoanFormData) => {
      const res = await apiFetch(`/api/portfolio/loans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(formToPayload(form)),
      });
      if (!res.ok) throw new Error('Failed to update loan');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio-loans'] }),
  });
}

function useDeleteLoan(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/portfolio/loans/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete loan');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio-loans'] }),
  });
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PortfolioLoansPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useLoanList();
  const loans = (data?.items ?? []) as CanonicalEntity[];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'ltv' | 'maturity'>('date');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; loan?: CanonicalEntity } | null>(
    null,
  );

  const filtered = useMemo(() => {
    let result = loans;
    if (statusFilter !== 'all') result = result.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((l) => {
        const d = l.data as Record<string, unknown>;
        return (
          (l.title ?? l.name ?? '').toLowerCase().includes(q) ||
          (getBorrower(d) ?? '').toLowerCase().includes(q) ||
          (getAddress(d) ?? '').toLowerCase().includes(q)
        );
      });
    }
    return [...result].sort((a, b) => {
      const da = a.data as Record<string, unknown>;
      const db = b.data as Record<string, unknown>;
      if (sortBy === 'amount') return (getLoanAmount(db) ?? 0) - (getLoanAmount(da) ?? 0);
      if (sortBy === 'ltv') return (getLtv(db) ?? 0) - (getLtv(da) ?? 0);
      if (sortBy === 'maturity') {
        const ma = getMaturityDate(da) ? new Date(getMaturityDate(da)!).getTime() : Infinity;
        const mb = getMaturityDate(db) ? new Date(getMaturityDate(db)!).getTime() : Infinity;
        return ma - mb;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [loans, search, statusFilter, sortBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-6 text-center">
        <p className="text-sm text-red-600">Failed to load loans.</p>
        <button onClick={refetch} className="mt-2 text-xs text-red-500 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search loans…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:outline-none"
          >
            <option value="date">Sort: Newest</option>
            <option value="amount">Sort: Loan Amount</option>
            <option value="ltv">Sort: LTV</option>
            <option value="maturity">Sort: Maturity Date</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/portfolio/originate')}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800"
          >
            + Originate Loan
          </button>
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            Quick Add
          </button>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTER.map((opt) => {
          const count =
            opt.value === 'all'
              ? loans.length
              : loans.filter((l) => l.status === opt.value).length;
          return (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                statusFilter === opt.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Loan List */}
      {filtered.length === 0 ? (
        <EmptyLoans onCreate={() => setModal({ mode: 'create' })} hasLoans={loans.length > 0} />
      ) : (
        <div className="space-y-3">
          {filtered.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onEdit={() => setModal({ mode: 'edit', loan })}
            />
          ))}
        </div>
      )}

      {modal && (
        <LoanModal mode={modal.mode} loan={modal.loan} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ── Loan Card ─────────────────────────────────────────────────────────────────
function LoanCard({ loan, onEdit }: { loan: CanonicalEntity; onEdit: () => void }) {
  const d = loan.data as Record<string, unknown>;
  const amount = getLoanAmount(d);
  const ltv = getLtv(d);
  const rate = getRate(d);
  const maturity = getMaturityDate(d);
  const borrower = getBorrower(d);
  const address = getAddress(d);
  const propType = getPropertyType(d);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {loan.title ?? loan.name ?? 'Untitled Loan'}
            </h3>
            <StatusBadge status={loan.status} />
            {propType && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs capitalize text-slate-600">
                {propType.replace('_', ' ')}
              </span>
            )}
          </div>
          {borrower && <p className="mt-0.5 text-xs text-slate-500">Borrower: {borrower}</p>}
          {address && <p className="mt-0.5 truncate text-xs text-slate-400">{address}</p>}
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Edit
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        <Metric label="Loan Amount" value={amount !== undefined ? formatUSD(amount) : '—'} />
        <Metric label="LTV" value={ltv !== undefined ? `${ltv.toFixed(1)}%` : '—'} />
        <Metric label="Rate" value={rate !== undefined ? `${rate.toFixed(2)}%` : '—'} />
        <Metric label="Maturity" value={formatDate(maturity)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function EmptyLoans({ onCreate, hasLoans }: { onCreate: () => void; hasLoans: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
      <p className="text-sm font-medium text-slate-600">
        {hasLoans ? 'No loans match your filters' : 'No loans yet'}
      </p>
      {!hasLoans && (
        <>
          <p className="mt-1 text-xs text-slate-400">Add your first CRE loan to get started.</p>
          <button
            onClick={onCreate}
            className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800"
          >
            + New Loan
          </button>
        </>
      )}
    </div>
  );
}

// ── Loan Modal ────────────────────────────────────────────────────────────────
function LoanModal({
  mode,
  loan,
  onClose,
}: {
  mode: 'create' | 'edit';
  loan?: CanonicalEntity;
  onClose: () => void;
}) {
  const [form, setForm] = useState<LoanFormData>(
    mode === 'edit' && loan ? loanToForm(loan) : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateLoanFull();
  const updateMutation = useUpdateLoanFull(loan?.id ?? '');
  const deleteMutation = useDeleteLoan(loan?.id ?? '');

  const isPending = createMutation.isPending || updateMutation.isPending;

  const set =
    (field: keyof LoanFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'create') await createMutation.mutateAsync(form);
      else await updateMutation.mutateAsync(form);
      onClose();
    } catch {
      setError('Failed to save loan. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this loan? This cannot be undone.')) return;
    try {
      await deleteMutation.mutateAsync();
      onClose();
    } catch {
      setError('Failed to delete loan.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {mode === 'create' ? 'New Loan' : 'Edit Loan'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Loan Name *" className="sm:col-span-2">
              <input
                required
                value={form.title}
                onChange={set('title')}
                placeholder="e.g. 123 Main St Multifamily"
                className={inputCls}
              />
            </Field>

            <Field label="Borrower / Sponsor">
              <input
                value={form.borrower}
                onChange={set('borrower')}
                placeholder="Entity or individual name"
                className={inputCls}
              />
            </Field>

            <Field label="Status">
              <select value={form.status} onChange={set('status')} className={inputCls}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Property Type">
              <select value={form.property_type} onChange={set('property_type')} className={inputCls}>
                {PROP_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Loan Purpose">
              <select value={form.loan_purpose} onChange={set('loan_purpose')} className={inputCls}>
                {LOAN_PURPOSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Property Address" className="sm:col-span-2">
              <input
                value={form.property_address}
                onChange={set('property_address')}
                placeholder="Street, City, State"
                className={inputCls}
              />
            </Field>

            <Field label="Loan Amount ($)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.loan_amount}
                onChange={set('loan_amount')}
                placeholder="e.g. 5000000"
                className={inputCls}
              />
            </Field>

            <Field label="LTV (%)">
              <input
                type="number"
                min="0"
                max="200"
                step="0.01"
                value={form.ltv}
                onChange={set('ltv')}
                placeholder="e.g. 65.0"
                className={inputCls}
              />
            </Field>

            <Field label="Interest Rate (%)">
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.interest_rate}
                onChange={set('interest_rate')}
                placeholder="e.g. 6.5"
                className={inputCls}
              />
            </Field>

            <Field label="Origination Date">
              <input
                type="date"
                value={form.origination_date}
                onChange={set('origination_date')}
                className={inputCls}
              />
            </Field>

            <Field label="Maturity Date">
              <input
                type="date"
                value={form.maturity_date}
                onChange={set('maturity_date')}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Covenant Thresholds */}
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Covenant Thresholds</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="DSCR Floor">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.01"
                  value={form.covenant_dscr_floor}
                  onChange={set('covenant_dscr_floor')}
                  placeholder="e.g. 1.25"
                  className={inputCls}
                />
              </Field>
              <Field label="LTV Cap (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.covenant_ltv_cap}
                  onChange={set('covenant_ltv_cap')}
                  placeholder="e.g. 70"
                  className={inputCls}
                />
              </Field>
              <Field label="Occupancy Floor (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.covenant_occupancy_floor}
                  onChange={set('covenant_occupancy_floor')}
                  placeholder="e.g. 80"
                  className={inputCls}
                />
              </Field>
              <Field label="Reserve Minimum ($)">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.covenant_reserve_min}
                  onChange={set('covenant_reserve_min')}
                  placeholder="e.g. 150000"
                  className={inputCls}
                />
              </Field>
              <Field label="Reporting Frequency" className="sm:col-span-2">
                <select value={form.covenant_frequency} onChange={set('covenant_frequency')} className={inputCls}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semi_annual">Semi-Annual</option>
                  <option value="annual">Annual</option>
                </select>
              </Field>
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {mode === 'edit' ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Delete Loan
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : mode === 'create' ? 'Create Loan' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400';

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
