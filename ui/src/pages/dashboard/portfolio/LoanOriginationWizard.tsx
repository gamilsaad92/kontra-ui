/**
 * Loan Origination Wizard — 5-stage structured workflow
 * Term Sheet → Underwriting → Commitment → Closing → Funded
 *
 * Creates/updates a loan entity through each stage,
 * persisting data to /api/portfolio/loans at each step.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/apiClient';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// ── Stage definitions ─────────────────────────────────────────────────────────
const STAGES = [
  { id: 'term_sheet',   label: 'Term Sheet',   sub: 'Loan parameters & property' },
  { id: 'underwriting', label: 'Underwriting', sub: 'Financial analysis' },
  { id: 'commitment',   label: 'Commitment',   sub: 'Terms & covenants' },
  { id: 'closing',      label: 'Closing',      sub: 'Execution & docs' },
  { id: 'funded',       label: 'Funded',       sub: 'Loan activation' },
];

const STAGE_STATUS: Record<string, string> = {
  term_sheet: 'draft',
  underwriting: 'pending',
  commitment: 'pending',
  closing: 'pending',
  funded: 'active',
};

// ── Field types ───────────────────────────────────────────────────────────────
type StageData = Record<string, string | number | boolean | undefined>;

interface LoanDraft {
  id?: string;
  title: string;
  status: string;
  origination_stage: string;
  data: StageData;
}

// ── API hooks ─────────────────────────────────────────────────────────────────
function useLoanDraft(id?: string) {
  return useQuery({
    queryKey: ['loan-draft', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch(`/api/portfolio/loans/${id}`);
      if (!res.ok) throw new Error('Failed to load loan');
      return res.json();
    },
  });
}

function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; status: string; data: StageData }) => {
      const res = await apiFetch('/api/portfolio/loans', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create loan');
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio-loans'] }),
  });
}

function useUpdateDraft(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title?: string; status?: string; data?: StageData }) => {
      const res = await apiFetch(`/api/portfolio/loans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update loan');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-loans'] });
      qc.invalidateQueries({ queryKey: ['loan-draft', id] });
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  min,
  max,
  step,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <input
      type={type}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className={inputCls}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Stage 1: Term Sheet ───────────────────────────────────────────────────────
function StageTermSheet({
  data,
  title,
  onField,
  onTitle,
}: {
  data: StageData;
  title: string;
  onField: (k: string, v: string) => void;
  onTitle: (v: string) => void;
}) {
  const str = (k: string) => String(data[k] ?? '');
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field label="Loan Name *" className="sm:col-span-2">
        <Input value={title} onChange={onTitle} placeholder="e.g. 123 Main St — Bridge Acquisition" required />
      </Field>
      <Field label="Borrower / Sponsor Entity *">
        <Input value={str('borrower_name')} onChange={(v) => onField('borrower_name', v)} placeholder="Legal entity name" required />
      </Field>
      <Field label="Loan Purpose">
        <Select
          value={str('loan_purpose') || 'acquisition'}
          onChange={(v) => onField('loan_purpose', v)}
          options={[
            { value: 'acquisition', label: 'Acquisition' },
            { value: 'refinance', label: 'Refinance' },
            { value: 'construction', label: 'Construction' },
            { value: 'bridge', label: 'Bridge' },
            { value: 'mezzanine', label: 'Mezzanine' },
            { value: 'other', label: 'Other' },
          ]}
        />
      </Field>
      <Field label="Property Type">
        <Select
          value={str('property_type') || 'multifamily'}
          onChange={(v) => onField('property_type', v)}
          options={[
            { value: 'multifamily', label: 'Multifamily' },
            { value: 'office', label: 'Office' },
            { value: 'retail', label: 'Retail' },
            { value: 'industrial', label: 'Industrial' },
            { value: 'hotel', label: 'Hotel' },
            { value: 'mixed_use', label: 'Mixed Use' },
            { value: 'land', label: 'Land' },
            { value: 'other', label: 'Other' },
          ]}
        />
      </Field>
      <Field label="Property Address" className="sm:col-span-2">
        <Input value={str('property_address')} onChange={(v) => onField('property_address', v)} placeholder="Street, City, State, ZIP" />
      </Field>
      <Field label="Loan Amount Requested ($)" hint="Enter the full requested loan amount">
        <Input type="number" min="0" step="1000" value={str('loan_amount_requested')} onChange={(v) => onField('loan_amount_requested', v)} placeholder="e.g. 5000000" />
      </Field>
      <Field label="Purchase Price / Property Value ($)">
        <Input type="number" min="0" step="1000" value={str('purchase_price')} onChange={(v) => onField('purchase_price', v)} placeholder="e.g. 7500000" />
      </Field>
      <Field label="Requested Close Date">
        <Input type="date" value={str('requested_close_date')} onChange={(v) => onField('requested_close_date', v)} />
      </Field>
      <Field label="Loan Term (months)">
        <Input type="number" min="1" max="360" value={str('loan_term_months')} onChange={(v) => onField('loan_term_months', v)} placeholder="e.g. 24" />
      </Field>
    </div>
  );
}

// ── Stage 2: Underwriting ─────────────────────────────────────────────────────
function StageUnderwriting({
  data,
  onField,
}: {
  data: StageData;
  onField: (k: string, v: string) => void;
}) {
  const str = (k: string) => String(data[k] ?? '');

  const appraised = parseFloat(str('appraised_value')) || 0;
  const loanReq = parseFloat(str('loan_amount_requested')) || 0;
  const noi = parseFloat(str('noi_annual')) || 0;
  const debtService = loanReq * (parseFloat(str('interest_rate_proposed')) / 100);
  const autoLtv = appraised > 0 ? ((loanReq / appraised) * 100).toFixed(1) : '';
  const autoDscr = debtService > 0 ? (noi / debtService).toFixed(2) : '';

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field label="As-Is Appraised Value ($)" hint="Current market value">
        <Input type="number" min="0" step="1000" value={str('appraised_value')} onChange={(v) => onField('appraised_value', v)} placeholder="e.g. 8000000" />
      </Field>
      <Field label="As-Stabilized Value ($)" hint="Projected value at full occupancy">
        <Input type="number" min="0" step="1000" value={str('as_stabilized_value')} onChange={(v) => onField('as_stabilized_value', v)} placeholder="e.g. 9500000" />
      </Field>
      <Field label="Annual NOI ($)" hint="Net Operating Income — gross revenue minus operating expenses">
        <Input type="number" min="0" step="100" value={str('noi_annual')} onChange={(v) => onField('noi_annual', v)} placeholder="e.g. 420000" />
      </Field>
      <Field label="Cap Rate (%)" hint="NOI ÷ property value">
        <Input type="number" min="0" max="30" step="0.01" value={str('cap_rate')} onChange={(v) => onField('cap_rate', v)} placeholder="e.g. 5.25" />
      </Field>
      <Field label="Proposed Interest Rate (%)" hint="Used for auto DSCR calculation below">
        <Input type="number" min="0" max="30" step="0.001" value={str('interest_rate_proposed')} onChange={(v) => onField('interest_rate_proposed', v)} placeholder="e.g. 7.5" />
      </Field>
      <Field label="Current Occupancy (%)">
        <Input type="number" min="0" max="100" step="0.1" value={str('occupancy_pct')} onChange={(v) => onField('occupancy_pct', v)} placeholder="e.g. 87.5" />
      </Field>
      <Field label="Gross Building SF">
        <Input type="number" min="0" value={str('gross_sf')} onChange={(v) => onField('gross_sf', v)} placeholder="e.g. 45000" />
      </Field>
      <Field label="Year Built">
        <Input type="number" min="1800" max="2030" value={str('year_built')} onChange={(v) => onField('year_built', v)} placeholder="e.g. 1998" />
      </Field>
      <Field label="Number of Units / Tenants">
        <Input type="number" min="0" value={str('unit_count')} onChange={(v) => onField('unit_count', v)} placeholder="e.g. 48" />
      </Field>
      <Field label="Amortization (months, 0 = IO)">
        <Input type="number" min="0" max="480" value={str('amortization_months')} onChange={(v) => onField('amortization_months', v)} placeholder="e.g. 360 or 0 for IO" />
      </Field>

      {/* Auto-calculated summary */}
      {(autoLtv || autoDscr) && (
        <div className="sm:col-span-2 rounded-xl border border-brand-100 bg-brand-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">Auto-Calculated Metrics</p>
          <div className="flex flex-wrap gap-6">
            {autoLtv && (
              <div>
                <p className="text-xs text-slate-500">LTV</p>
                <p className="text-lg font-bold text-slate-900">{autoLtv}%</p>
              </div>
            )}
            {autoDscr && (
              <div>
                <p className="text-xs text-slate-500">DSCR (annual IO)</p>
                <p className={`text-lg font-bold ${parseFloat(autoDscr) >= 1.25 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {autoDscr}x
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stage 3: Commitment ───────────────────────────────────────────────────────
function StageCommitment({
  data,
  onField,
}: {
  data: StageData;
  onField: (k: string, v: string) => void;
}) {
  const str = (k: string) => String(data[k] ?? '');
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field label="Committed Loan Amount ($)">
        <Input type="number" min="0" step="1000" value={str('loan_amount')} onChange={(v) => onField('loan_amount', v)} placeholder="e.g. 4750000" />
      </Field>
      <Field label="Interest Rate (%) *">
        <Input type="number" min="0" max="30" step="0.001" value={str('interest_rate')} onChange={(v) => onField('interest_rate', v)} placeholder="e.g. 7.25" required />
      </Field>
      <Field label="Origination Fee (%)">
        <Input type="number" min="0" max="10" step="0.01" value={str('origination_fee_pct')} onChange={(v) => onField('origination_fee_pct', v)} placeholder="e.g. 1.0" />
      </Field>
      <Field label="Recourse">
        <Select
          value={str('recourse') || 'non_recourse'}
          onChange={(v) => onField('recourse', v)}
          options={[
            { value: 'non_recourse', label: 'Non-Recourse' },
            { value: 'recourse', label: 'Full Recourse' },
            { value: 'partial', label: 'Partial Recourse' },
          ]}
        />
      </Field>
      <Field label="Commitment Expiration Date">
        <Input type="date" value={str('commitment_expiration')} onChange={(v) => onField('commitment_expiration', v)} />
      </Field>
      <Field label="Extension Options">
        <Input value={str('extension_options')} onChange={(v) => onField('extension_options', v)} placeholder="e.g. 2 x 6-month extensions" />
      </Field>

      {/* Covenants */}
      <div className="sm:col-span-2">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Loan Covenants</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="DSCR Floor" hint="Minimum debt service coverage ratio">
            <Input type="number" min="0" max="5" step="0.01" value={str('covenant_dscr_floor')} onChange={(v) => onField('covenant_dscr_floor', v)} placeholder="e.g. 1.25" />
          </Field>
          <Field label="LTV Cap (%)" hint="Maximum loan-to-value">
            <Input type="number" min="0" max="100" step="0.1" value={str('covenant_ltv_cap')} onChange={(v) => onField('covenant_ltv_cap', v)} placeholder="e.g. 70" />
          </Field>
          <Field label="Occupancy Floor (%)" hint="Minimum occupancy required">
            <Input type="number" min="0" max="100" step="0.1" value={str('covenant_occupancy_floor')} onChange={(v) => onField('covenant_occupancy_floor', v)} placeholder="e.g. 80" />
          </Field>
          <Field label="Reserve Requirement ($)" hint="Minimum reserve account balance">
            <Input type="number" min="0" step="1000" value={str('covenant_reserve_min')} onChange={(v) => onField('covenant_reserve_min', v)} placeholder="e.g. 150000" />
          </Field>
          <Field label="Covenant Reporting Frequency" className="sm:col-span-2">
            <Select
              value={str('covenant_frequency') || 'quarterly'}
              onChange={(v) => onField('covenant_frequency', v)}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'semi_annual', label: 'Semi-Annual' },
                { value: 'annual', label: 'Annual' },
              ]}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ── Stage 4: Closing ──────────────────────────────────────────────────────────
function StageClosing({
  data,
  onField,
}: {
  data: StageData;
  onField: (k: string, v: string) => void;
}) {
  const str = (k: string) => String(data[k] ?? '');
  const checklist = [
    'Appraisal received and approved',
    'Title commitment issued',
    'Environmental report (Phase I) cleared',
    'Insurance certificates on file',
    'Borrower entity documents verified',
    'Loan agreement executed',
    'Deed of trust / mortgage recorded',
    'Title insurance policy issued',
  ];

  const getChecked = (item: string) =>
    Boolean((data[`check_${item.replace(/\s+/g, '_').toLowerCase()}`] ?? false));

  const toggleCheck = (item: string) => {
    const key = `check_${item.replace(/\s+/g, '_').toLowerCase()}`;
    onField(key, getChecked(item) ? '' : 'true');
  };

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field label="Actual Closing Date">
        <Input type="date" value={str('closing_date')} onChange={(v) => onField('closing_date', v)} />
      </Field>
      <Field label="Origination Date">
        <Input type="date" value={str('origination_date')} onChange={(v) => onField('origination_date', v)} />
      </Field>
      <Field label="Title Company">
        <Input value={str('title_company')} onChange={(v) => onField('title_company', v)} placeholder="e.g. First American Title" />
      </Field>
      <Field label="Closing / Escrow Attorney">
        <Input value={str('closing_attorney')} onChange={(v) => onField('closing_attorney', v)} placeholder="Law firm name" />
      </Field>
      <Field label="Loan Reference Number">
        <Input value={str('loan_ref')} onChange={(v) => onField('loan_ref', v)} placeholder="e.g. LN-2847" />
      </Field>
      <Field label="Wire Instructions Reference">
        <Input value={str('wire_reference')} onChange={(v) => onField('wire_reference', v)} placeholder="Account/routing ref or memo" />
      </Field>

      {/* Closing Checklist */}
      <div className="sm:col-span-2">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Closing Checklist</p>
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item}>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={getChecked(item)}
                  onChange={() => toggleCheck(item)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-700">{item}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Stage 5: Funded ───────────────────────────────────────────────────────────
function StageFunded({
  data,
  onField,
}: {
  data: StageData;
  onField: (k: string, v: string) => void;
}) {
  const str = (k: string) => String(data[k] ?? '');
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field label="Funding Date *">
        <Input type="date" value={str('funding_date')} onChange={(v) => onField('funding_date', v)} required />
      </Field>
      <Field label="Initial Advance Amount ($)">
        <Input type="number" min="0" step="1000" value={str('initial_advance')} onChange={(v) => onField('initial_advance', v)} placeholder="e.g. 4750000" />
      </Field>
      <Field label="First Payment Date">
        <Input type="date" value={str('first_payment_date')} onChange={(v) => onField('first_payment_date', v)} />
      </Field>
      <Field label="Maturity Date *">
        <Input type="date" value={str('maturity_date')} onChange={(v) => onField('maturity_date', v)} required />
      </Field>
      <Field label="Servicer Name">
        <Input value={str('servicer_name')} onChange={(v) => onField('servicer_name', v)} placeholder="e.g. Kontra Capital Servicing" />
      </Field>
      <Field label="Servicer Contact Email">
        <Input type="email" value={str('servicer_contact')} onChange={(v) => onField('servicer_contact', v)} placeholder="servicing@kontraplatform.com" />
      </Field>
      <Field label="Special Conditions / Notes" className="sm:col-span-2">
        <textarea
          value={str('special_conditions')}
          onChange={(e) => onField('special_conditions', e.target.value)}
          rows={4}
          placeholder="Any special conditions, exceptions, or notes for the loan file…"
          className={inputCls}
        />
      </Field>

      <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            Completing this step will mark the loan as <strong>Active</strong> in the portfolio.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────
export default function LoanOriginationWizard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const existingId = searchParams.get('id') ?? undefined;

  const [loanId, setLoanId] = useState<string | undefined>(existingId);
  const [currentStage, setCurrentStage] = useState(0);
  const [title, setTitle] = useState('');
  const [stageData, setStageData] = useState<StageData>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  // Load existing draft
  const draftQuery = useLoanDraft(loanId);
  const createMutation = useCreateDraft();
  const updateMutation = useUpdateDraft(loanId ?? '');

  useEffect(() => {
    if (draftQuery.data) {
      const entity = draftQuery.data as { title?: string; data?: StageData; origination_stage?: string };
      setTitle(entity.title ?? '');
      setStageData((entity.data as StageData) ?? {});
      const stageIdx = STAGES.findIndex((s) => s.id === (entity.data as StageData)?.origination_stage);
      if (stageIdx >= 0) setCurrentStage(stageIdx);
    }
  }, [draftQuery.data]);

  const setField = (k: string, v: string) => setStageData((d) => ({ ...d, [k]: v }));

  const saveAndAdvance = async (targetStage: number) => {
    if (!title.trim()) {
      setError('Loan name is required on the Term Sheet.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const stageId = STAGES[currentStage].id;
      const payload = {
        title: title.trim(),
        status: STAGE_STATUS[stageId] ?? 'draft',
        data: { ...stageData, origination_stage: stageId },
      };

      if (!loanId) {
        const created = await createMutation.mutateAsync(payload);
        const newId = (created as { id: string }).id;
        setLoanId(newId);
        setSearchParams({ id: newId });
      } else {
        await updateMutation.mutateAsync(payload);
      }

      if (targetStage >= STAGES.length) {
        setCompleted(true);
      } else {
        setCurrentStage(targetStage);
      }
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => saveAndAdvance(currentStage + 1);
  const handleBack = () => setCurrentStage((s) => Math.max(0, s - 1));
  const handleFinish = () => saveAndAdvance(STAGES.length);
  const handleSaveDraft = async () => {
    await saveAndAdvance(currentStage);
    if (!error) navigate('/portfolio/loans');
  };

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Loan Funded & Active</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          {title} has been added to your portfolio as an active loan.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate('/portfolio/loans')}
            className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            View Portfolio
          </button>
          <button
            onClick={() => {
              setCompleted(false);
              setLoanId(undefined);
              setTitle('');
              setStageData({});
              setCurrentStage(0);
              setSearchParams({});
            }}
            className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Originate Another Loan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Loan Origination</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {title ? `Drafting: ${title}` : 'Complete each stage to activate the loan.'}
          </p>
        </div>
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Save & Exit
        </button>
      </div>

      {/* Stage Progress */}
      <nav className="relative flex items-center justify-between">
        {STAGES.map((stage, i) => {
          const done = i < currentStage;
          const active = i === currentStage;
          return (
            <div key={stage.id} className="flex flex-1 flex-col items-center">
              <button
                onClick={() => i < currentStage && setCurrentStage(i)}
                disabled={i > currentStage}
                className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
                  done
                    ? 'border-brand-700 bg-brand-700 text-white cursor-pointer'
                    : active
                    ? 'border-brand-700 bg-white text-brand-700'
                    : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                {done ? <CheckCircleIcon className="h-5 w-5" /> : i + 1}
              </button>
              <p className={`text-center text-xs font-medium ${active ? 'text-slate-900' : done ? 'text-brand-700' : 'text-slate-400'}`}>
                {stage.label}
              </p>
              <p className="hidden text-center text-xs text-slate-400 sm:block">{stage.sub}</p>
            </div>
          );
        })}
        {/* Connector line */}
        <div className="absolute left-0 right-0 top-4 -z-10 mx-8 h-0.5 bg-slate-200" />
      </nav>

      {/* Stage Content */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-slate-800">
          Stage {currentStage + 1}: {STAGES[currentStage].label}
        </h2>

        {currentStage === 0 && (
          <StageTermSheet data={stageData} title={title} onField={setField} onTitle={setTitle} />
        )}
        {currentStage === 1 && (
          <StageUnderwriting data={stageData} onField={setField} />
        )}
        {currentStage === 2 && (
          <StageCommitment data={stageData} onField={setField} />
        )}
        {currentStage === 3 && (
          <StageClosing data={stageData} onField={setField} />
        )}
        {currentStage === 4 && (
          <StageFunded data={stageData} onField={setField} />
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStage === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back
        </button>

        <div className="flex gap-2">
          {currentStage < STAGES.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & Continue'}
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Activating…' : 'Activate Loan'}
              <CheckCircleIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
