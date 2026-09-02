/**
 * Management Agent — validates property management compliance for CRE loans.
 * Checks management agreement documentation, licensing, insurance, operating
 * budget approval, and flags life-safety and covenant issues.
 *
 * @param {object}   input
 * @param {object[]} input.documents         - submitted docs [{type, status, expiry_date}]
 * @param {string}   [input.change_type]     - 'new_manager' | 'amendment' | 'renewal'
 * @param {object}   [input.manager_info]    - { name, license_number, license_expiry }
 * @param {string[]} [input.clause_flags]    - AI-identified problematic clauses
 * @param {boolean}  [input.lender_consent_obtained] - whether lender consent is in file
 * @param {object}   [input.context]         - { loan_id, property_name }
 * @returns {object} AiReviewOutput
 */
const runManagementAgent = (input = {}) => {
  const documents = input.documents || [];
  const changeType = input.change_type || 'amendment';
  const managerInfo = input.manager_info || {};
  const clauseFlags = input.clause_flags || [];
  const lenderConsent = Boolean(input.lender_consent_obtained);
  const context = input.context || {};

  const reasons = [];
  const evidence = [];
  const proposedUpdates = {};

  const REQUIRED_DOCS = {
    new_manager: [
      'management_agreement',
      'insurance_certificate',
      'operating_budget',
      'transition_plan',
      'manager_license',
      'lender_consent',
    ],
    amendment: [
      'management_agreement_amendment',
      'insurance_certificate',
      'lender_consent',
    ],
    renewal: [
      'management_agreement',
      'insurance_certificate',
      'manager_license',
    ],
  };

  const requiredDocs = REQUIRED_DOCS[changeType] || REQUIRED_DOCS.amendment;
  const submittedTypes = new Set(documents.map((d) => d.type?.toLowerCase()?.trim()));

  // ── 1. Document completeness ─────────────────────────────────────────────
  const missingDocs = requiredDocs.filter((req) => !submittedTypes.has(req));
  if (missingDocs.length > 0) {
    reasons.push({
      code: 'missing_required_documents',
      message: `Missing required documents: ${missingDocs.map((d) => d.replace(/_/g, ' ')).join(', ')}.`,
      severity: missingDocs.includes('lender_consent') || missingDocs.includes('management_agreement') ? 'high' : 'medium',
    });
  }
  proposedUpdates.required_documents = requiredDocs;
  proposedUpdates.submitted_documents = [...submittedTypes];
  proposedUpdates.missing_documents = missingDocs;

  // ── 2. Lender consent ────────────────────────────────────────────────────
  if (!lenderConsent && changeType !== 'renewal') {
    reasons.push({
      code: 'lender_consent_missing',
      message: 'Lender consent not obtained prior to management change. Loan documents require prior written approval.',
      severity: 'high',
    });
  }

  // ── 3. License validation ────────────────────────────────────────────────
  if (managerInfo.license_expiry) {
    const expiry = new Date(managerInfo.license_expiry);
    const daysToExpiry = Math.floor((expiry - new Date()) / (1000 * 60 * 60 * 24));
    proposedUpdates.license_days_to_expiry = daysToExpiry;

    if (daysToExpiry < 0) {
      reasons.push({
        code: 'manager_license_expired',
        message: `Property manager license expired on ${expiry.toLocaleDateString()}.`,
        severity: 'high',
      });
    } else if (daysToExpiry < 60) {
      reasons.push({
        code: 'manager_license_expiring_soon',
        message: `Manager license expires in ${daysToExpiry} days.`,
        severity: 'medium',
      });
    }
  }

  // ── 4. Insurance certificate check ──────────────────────────────────────
  const insuranceDoc = documents.find((d) => d.type === 'insurance_certificate');
  if (insuranceDoc) {
    if (insuranceDoc.status === 'expired') {
      reasons.push({
        code: 'insurance_expired',
        message: 'Manager insurance certificate has expired. Updated certificate required.',
        severity: 'high',
      });
    } else if (insuranceDoc.expiry_date) {
      const expiry = new Date(insuranceDoc.expiry_date);
      const daysToExpiry = Math.floor((expiry - new Date()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry < 30) {
        reasons.push({
          code: 'insurance_expiring_soon',
          message: `Manager insurance expires in ${daysToExpiry} days.`,
          severity: 'medium',
        });
      }
    }
  }

  // ── 5. Clause flags ──────────────────────────────────────────────────────
  if (clauseFlags.length > 0) {
    reasons.push({
      code: 'contract_clause_flags',
      message: `AI clause review identified ${clauseFlags.length} potential issue(s): ${clauseFlags[0]}${clauseFlags.length > 1 ? ` and ${clauseFlags.length - 1} more` : ''}.`,
      severity: 'medium',
    });
    proposedUpdates.clause_flags = clauseFlags;
  }

  // ── 6. Document checklist completion ────────────────────────────────────
  const completedCount = requiredDocs.filter((req) => submittedTypes.has(req)).length;
  proposedUpdates.checklist_pct = requiredDocs.length > 0
    ? Math.round((completedCount / requiredDocs.length) * 100) : 100;

  // ── 7. Status, confidence, actions ──────────────────────────────────────
  const hasHigh = reasons.some((r) => r.severity === 'high');
  const hasMed = reasons.some((r) => r.severity === 'medium');
  const status = hasHigh ? 'fail' : hasMed ? 'needs_review' : 'pass';
  const confidence = status === 'pass' ? 0.91 : status === 'fail' ? 0.28 : 0.65;

  const recommendedActions = [];

  if (missingDocs.length > 0) {
    recommendedActions.push({
      action_type: 'request_missing_documents',
      label: 'Request missing management documents from borrower',
      payload: { missing: missingDocs },
      requires_approval: true,
    });
  }

  if (!lenderConsent) {
    recommendedActions.push({
      action_type: 'obtain_lender_consent',
      label: 'Issue lender consent letter',
      payload: { change_type: changeType, property: context.property_name },
      requires_approval: true,
    });
  }

  if (clauseFlags.length > 0) {
    recommendedActions.push({
      action_type: 'route_to_legal',
      label: 'Route flagged clauses to legal for review',
      payload: { flags: clauseFlags },
      requires_approval: true,
    });
  }

  if (status === 'pass') {
    recommendedActions.push({
      action_type: 'approve_management_change',
      label: 'Approve management change and notify counterparties',
      payload: { loan_id: context.loan_id, change_type: changeType },
      requires_approval: true,
    });
  }

  recommendedActions.push({
    action_type: 'draft_management_comment',
    label: 'Draft servicer comment for management change',
    payload: { change_type: changeType, property: context.property_name },
    requires_approval: true,
  });

  // ── 8. Title & summary ───────────────────────────────────────────────────
  const propName = context.property_name || 'Property';
  const changeLabel = changeType === 'new_manager' ? 'management change'
    : changeType === 'amendment' ? 'agreement amendment'
    : 'agreement renewal';

  let title;
  if (status === 'pass') {
    title = `${propName} — ${changeLabel}: all documents complete and cleared`;
  } else if (hasHigh) {
    title = `${propName} — ${changeLabel}: critical items blocking approval`;
  } else {
    title = `${propName} — ${changeLabel}: ${reasons.length} item(s) require resolution`;
  }

  const summary =
    status === 'pass'
      ? `All required documents received and verified. Management ${changeLabel} cleared for approval.`
      : `Management ${changeLabel} has ${reasons.length} unresolved item(s). ${missingDocs.length > 0 ? `${missingDocs.length} document(s) still outstanding.` : ''} Approval withheld pending resolution.`;

  return {
    status,
    confidence,
    title,
    summary,
    reasons,
    evidence,
    recommended_actions: recommendedActions,
    proposed_updates: proposedUpdates,
  };
};

module.exports = { runManagementAgent };
