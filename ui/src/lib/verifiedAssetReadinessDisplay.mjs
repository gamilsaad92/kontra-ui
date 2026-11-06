const NON_NEGATIVE_INTEGER_KEYS = [
  'confirmed_count',
  'required_count',
  'unresolved_exception_count',
  'provenance_gap_count',
  'missing_approval_count',
];

const REASON_KEYS = [
  'incomplete_required_fields',
  'unresolved_conflicts',
  'missing_approvals',
  'provenance_gaps',
];

export function isVerifiedAssetReadinessResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!['eligible', 'ineligible'].includes(value.eligibility)) return false;
  if (typeof value.status !== 'string' || !value.status.trim()) return false;

  const summary = value.summary;
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return false;
  if (NON_NEGATIVE_INTEGER_KEYS.some(key =>
    !Number.isInteger(summary[key]) || summary[key] < 0,
  )) return false;
  if (typeof summary.provenance_intact !== 'boolean') return false;
  if (typeof summary.approvals_satisfied !== 'boolean') return false;

  const reasons = value.reasons;
  if (!reasons || typeof reasons !== 'object' || Array.isArray(reasons)) return false;
  if (!REASON_KEYS.every(key => Array.isArray(reasons[key]))) return false;

  const reasonCount = REASON_KEYS.reduce((total, key) => total + reasons[key].length, 0);
  if (reasonCount !== summary.unresolved_exception_count) return false;
  if (summary.confirmed_count > summary.required_count) return false;
  if (summary.provenance_gap_count !== reasons.provenance_gaps.length) return false;
  if (summary.missing_approval_count !== reasons.missing_approvals.length) return false;
  if (
    value.eligibility === 'eligible'
    && (
      summary.required_count === 0
      || summary.unresolved_exception_count > 0
      || !summary.provenance_intact
      || !summary.approvals_satisfied
    )
  ) return false;
  return true;
}

export function getVerifiedAssetReadinessDisplay({
  readiness,
  requestStatus = 'loading',
  requestError = '',
  digitalAssetEnabled = true,
} = {}) {
  const title = digitalAssetEnabled ? 'Digital Asset Readiness' : 'Verified Asset Record';
  const eligibilityName = digitalAssetEnabled ? 'Digital Asset snapshot' : 'Verified Asset snapshot';

  if (requestStatus === 'loading') {
    return {
      state: 'loading',
      title,
      eligibilityName,
      eligibilityLabel: 'Loading',
      counts: null,
      blockerLabels: [],
      message: 'Readiness details are loading. No eligibility decision is available yet.',
      clean: false,
    };
  }

  if (requestStatus !== 'ready' || !isVerifiedAssetReadinessResponse(readiness)) {
    return {
      state: 'unavailable',
      title,
      eligibilityName,
      eligibilityLabel: 'Unavailable',
      counts: null,
      blockerLabels: [],
      message: requestError || 'Readiness details are unavailable. No eligibility decision is available.',
      clean: false,
    };
  }

  const { summary, reasons } = readiness;
  const blockerLabels = [
    ...reasons.incomplete_required_fields.map(item => item?.label || item?.field_key),
    ...reasons.unresolved_conflicts.map(item => item?.label || item?.field_key),
    ...reasons.missing_approvals.map(item =>
      `${item?.label || item?.field_key} — approval required`,
    ),
    ...reasons.provenance_gaps.map(item =>
      `${item?.label || item?.field_key} — ${item?.source || item?.requirement || 'current provenance required'}`,
    ),
  ].filter(Boolean);
  const hasExceptions = summary.unresolved_exception_count > 0
    || summary.provenance_gap_count > 0
    || summary.missing_approval_count > 0
    || !summary.provenance_intact
    || !summary.approvals_satisfied
    || blockerLabels.length > 0;
  const clean = readiness.eligibility === 'eligible' && !hasExceptions;

  return {
    state: 'ready',
    title,
    eligibilityName,
    eligibilityLabel: readiness.eligibility === 'eligible' ? 'Eligible' : 'Ineligible',
    status: readiness.status,
    summary,
    blockerLabels,
    provenanceGaps: reasons.provenance_gaps,
    clean,
    message: clean
      ? 'No canonical blockers or unresolved exceptions are currently reported.'
      : readiness.eligibility === 'ineligible'
        ? 'This snapshot is ineligible. It may be recorded for history but cannot be used for external preparation.'
        : `${summary.unresolved_exception_count} readiness exception${summary.unresolved_exception_count === 1 ? '' : 's'} need review.`,
  };
}
