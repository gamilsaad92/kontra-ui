import React, { useEffect, useMemo, useState } from 'react';
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  BookOpenIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { api } from '../lib/api';

const STATUS_OPTIONS = [
  { value: 'required', label: 'Required' },
  { value: 'drafting', label: 'Drafting' },
  { value: 'in_review', label: 'In review' },
  { value: 'final', label: 'Final' },
];

const DEFAULT_CONFIG = {
  structure: {
    vehicle: 'SPV',
    offeringStyle: 'Private placement',
    exemptions: [
      {
        code: 'Reg D 506(c)',
        description: 'US-only tranche for accredited investors with verification and investor legends.',
      },
      {
        code: 'Reg S',
        description: 'Offshore tranche that excludes US persons and routes onboarding through non-US distributors.',
      },
    ],
    tokenRepresentation:
      'Digital tokens map to limited partner/LLC interests in the SPV; no rights beyond the operating agreement.',
  },
  documentation: [
    {
      key: 'ppm',
      name: 'Private Placement Memorandum',
      owner: 'Securities counsel',
      status: 'required',
      notes: 'Counsel drafts core disclosures, use of proceeds, and legends.',
    },
    {
      key: 'subscription',
      name: 'Subscription Agreement',
      owner: 'Securities counsel',
      status: 'required',
      notes: 'Captures purchaser reps, AML, and governing law.',
    },
    {
      key: 'token_terms',
      name: 'Token Terms',
      owner: 'Product + legal',
      status: 'required',
      notes: 'Defines wallet eligibility, mint/burn rules, legends, and on-chain metadata.',
    },
    {
      key: 'risk_factors',
      name: 'Risk Factors',
      owner: 'Risk + legal',
      status: 'required',
      notes: 'Includes illiquidity, SPV insolvency, and operational risks.',
    },
    {
      key: 'transfer_restrictions',
      name: 'Transfer Restrictions',
      owner: 'Legal + transfer agent',
      status: 'required',
      notes: 'Whitelisting, lockups, and legends for Reg D/Reg S tranches.',
    },
  ],
  transferRestrictions: {
    whitelistOnly: true,
    kycRequired: true,
    regDAccreditedOnly: true,
    regSOffshoreOnly: true,
    secondaryTransfersRequireCounsel: true,
    lockupMonths: 12,
  },
  riskFactors: [
    'Interests are illiquid during Reg D/Reg S distribution compliance periods.',
    'Tokens only track SPV interests; they do not provide direct rights in underlying assets.',
    'Regulatory change risk around digital asset custody, broker-dealer rules, and transfer agents.',
    'SPV insolvency or servicing failure could impair redemptions or distributions.',
  ],
};

function StatusBadge({ status }) {
  const styles = {
    required: 'bg-amber-50 text-amber-800 ring-amber-200',
    drafting: 'bg-sky-50 text-sky-800 ring-sky-200',
    in_review: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    final: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  };
  const label = STATUS_OPTIONS.find((opt) => opt.value === status)?.label || status;
  const style = styles[status] || 'bg-slate-50 text-slate-700 ring-slate-200';
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${style}`}>{label}</span>;
}

function RestrictionRow({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div>
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="text-slate-600">{description}</p>
      </div>
    </label>
  );
}

export default function LegalConfiguration() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/legal/config');
        if (!active) return;
        setConfig({ ...DEFAULT_CONFIG, ...(data?.config || {}) });
      } catch (err) {
        if (active) setError(err?.message || 'Failed to load legal configuration');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const lastUpdated = useMemo(() => {
    if (!config?.lastUpdated) return null;
    try {
      return new Date(config.lastUpdated).toLocaleString();
    } catch (err) {
      return null;
    }
  }, [config?.lastUpdated]);

  const updateDocStatus = (key, status) => {
    setConfig((prev) => ({
      ...prev,
      documentation: (prev.documentation || []).map((doc) =>
        doc.key === key ? { ...doc, status } : doc
      ),
    }));
  };

  const updateRestriction = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      transferRestrictions: { ...prev.transferRestrictions, [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        documentation: config.documentation,
        transferRestrictions: config.transferRestrictions,
        structure: config.structure,
      };
      const { data } = await api.post('/legal/config', payload);
      setConfig((prev) => ({ ...prev, ...(data?.config || {}) }));
      setSuccess('Legal controls updated and saved.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to save legal controls');
    } finally {
      setSaving(false);
    }
  };

  const structure = config?.structure || DEFAULT_CONFIG.structure;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Legal setup</p>
          <h1 className="text-2xl font-semibold text-slate-900">Private placement + SPV tokens</h1>
          <p className="text-sm text-slate-600">
            Hardcode the Reg D / Reg S structure so operations, transfers, and investor onboarding stay within counsel-approved guardrails.
          </p>
          {lastUpdated && <p className="text-xs text-slate-500">Last updated {lastUpdated}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ShieldCheckIcon className="h-4 w-4" />
            Whitelist enforced
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <DocumentCheckIcon className="h-4 w-4" />
            Private placement
          </span>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5" />
          <div>
            <p className="font-semibold">{error}</p>
            <p>Please confirm the API is reachable and you have admin privileges.</p>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircleIcon className="h-5 w-5" />
          <p>{success}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-slate-500" />
          Loading legal configuration…
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Structure</p>
                  <h2 className="text-lg font-semibold text-slate-900">{structure.offeringStyle} via {structure.vehicle}</h2>
                  <p className="text-sm text-slate-600">Tokens represent interests in the SPV and inherit its offering legends.</p>
                </div>
                <BookOpenIcon className="h-6 w-6 text-slate-400" />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exemptions</p>
                  <div className="flex flex-wrap gap-2">
                    {structure.exemptions?.length ? (
                      structure.exemptions.map((ex) => (
                        <span key={ex.code} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200">
                          {ex.code}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No exemptions configured</span>
                    )}
                  </div>
                  {structure.exemptions?.length > 0 && (
                    <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                      {structure.exemptions.map((ex) => (
                        <li key={`${ex.code}-desc`}>{ex.description}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Token representation</p>
                  <p className="text-slate-800">{structure.tokenRepresentation || 'Tokens mirror SPV equity interests with legends applied.'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transfer rules</p>
                  <h3 className="text-lg font-semibold text-slate-900">Investor guardrails</h3>
                  <p className="text-sm text-slate-600">Hardcoded constraints for Reg D / Reg S flows.</p>
                </div>
                <ShieldCheckIcon className="h-6 w-6 text-slate-400" />
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 ring-1 ring-emerald-200">
                  <CheckCircleIcon className="h-4 w-4" />
                  Whitelisted, KYC-approved wallets only
                </p>
                <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800 ring-1 ring-amber-200">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Secondary transfers carry a {config.transferRestrictions.lockupMonths}-month lockup notice
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                  <li>US investors must be accredited or QIB (Reg D 506(c)).</li>
                  <li>Non-US flows stay offshore under Reg S; capture jurisdiction in onboarding.</li>
                  <li>Tokens mirror SPV interests and inherit the same restrictions.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documentation</p>
                <h2 className="text-lg font-semibold text-slate-900">Counsel-owned artifacts</h2>
                <p className="text-sm text-slate-600">Track what needs outside counsel sign-off before tokens move.</p>
              </div>
              <DocumentCheckIcon className="h-6 w-6 text-slate-400" />
            </div>
            <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
              {(config.documentation || []).map((doc) => (
                <div key={doc.key} className="grid gap-3 bg-white px-4 py-3 sm:grid-cols-5 sm:items-center">
                  <div className="sm:col-span-2">
                    <p className="font-semibold text-slate-900">{doc.name}</p>
                    <p className="text-sm text-slate-600">{doc.notes}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Owner</p>
                    <p className="text-sm font-semibold text-slate-800">{doc.owner}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={doc.status} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                      value={doc.status}
                      onChange={(event) => updateDocStatus(doc.key, event.target.value)}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transfer restrictions</p>
                <h2 className="text-lg font-semibold text-slate-900">Hardcoded controls</h2>
                <p className="text-sm text-slate-600">Keep issuance, transfers, and liquidity aligned with private placement terms.</p>
              </div>
              <AdjustmentsHorizontalIcon className="h-6 w-6 text-slate-400" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <RestrictionRow
                label="Whitelist + KYC required"
                description="Only allow transfers to wallets that pass KYC and live on the approved investor registry."
                checked={config.transferRestrictions.whitelistOnly && config.transferRestrictions.kycRequired}
                onChange={(checked) => {
                  updateRestriction('whitelistOnly', checked);
                  updateRestriction('kycRequired', checked);
                }}
              />
              <RestrictionRow
                label="Reg D 506(c) (US accredited only)"
                description="Block retail US investors; require accreditation/QIB verification before allocating tokens."
                checked={config.transferRestrictions.regDAccreditedOnly}
                onChange={(checked) => updateRestriction('regDAccreditedOnly', checked)}
              />
              <RestrictionRow
                label="Reg S offshore only"
                description="Non-US tranches stay offshore; capture jurisdiction and legends for secondary controls."
                checked={config.transferRestrictions.regSOffshoreOnly}
                onChange={(checked) => updateRestriction('regSOffshoreOnly', checked)}
              />
              <RestrictionRow
                label="Counsel review for secondary transfers"
                description="Require manual review for lockups, legends, and transfer agent updates before settles."
                checked={config.transferRestrictions.secondaryTransfersRequireCounsel}
                onChange={(checked) => updateRestriction('secondaryTransfersRequireCounsel', checked)}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:max-w-sm sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-800">
                Lockup (months)
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  value={config.transferRestrictions.lockupMonths}
                  onChange={(event) => updateRestriction('lockupMonths', Number(event.target.value))}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">SPV tokens only</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">On-chain legends</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Subscription + PPM required</span>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk factors</p>
                <h2 className="text-lg font-semibold text-slate-900">Disclosures that land in the PPM</h2>
                <p className="text-sm text-slate-600">Remind teams what counsel needs called out before investors subscribe.</p>
              </div>
              <ExclamationTriangleIcon className="h-6 w-6 text-slate-400" />
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {(config.riskFactors || []).map((factor, idx) => (
                <li key={idx} className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                  <span className="mt-1 h-2 w-2 rounded-full bg-slate-400" aria-hidden />
                  <p>{factor}</p>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                'Save legal controls'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
