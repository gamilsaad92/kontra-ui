/**
 * Borrower Communication Agent — drafts deficiency notices, ROR letters,
 * follow-up emails, and status updates based on structured findings from
 * other agents (financial, inspection, draw).
 *
 * Guardrails: drafts only. No message is sent without Kontra human approval.
 *
 * @param {object} input
 * @param {string} input.comm_type   - 'deficiency_notice'|'ror_letter'|'follow_up'|'status_update'|'cure_notice'
 * @param {string} input.borrower_name
 * @param {string} input.property_name
 * @param {string} input.loan_id
 * @param {object[]} [input.findings]    - findings from other agents [{code, severity, message}]
 * @param {string[]} [input.missing_items] - list of missing documents/items
 * @param {string} [input.cure_deadline]
 * @param {string} [input.servicer_name]
 * @param {object} [input.context]
 * @returns {object} AiReviewOutput with draft comms in proposed_updates
 */
const runBorrowerCommAgent = (input = {}) => {
  const {
    comm_type = 'follow_up',
    borrower_name = 'Borrower',
    property_name = 'Subject Property',
    loan_id = '',
    findings = [],
    missing_items = [],
    cure_deadline = null,
    servicer_name = 'Kontra Loan Servicer',
    context = {},
  } = input;

  const reasons = [];
  const evidence = [];
  const proposedUpdates = {};

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const deadline = cure_deadline
    ? new Date(cure_deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'within 10 business days';

  const highFindings = findings.filter((f) => f.severity === 'high');
  const medFindings = findings.filter((f) => f.severity === 'medium');

  if (missing_items.length === 0 && findings.length === 0) {
    reasons.push({
      code: 'no_deficiencies',
      message: 'No deficiencies or missing items provided — no communication needed.',
      severity: 'low',
    });
  }

  let subject = '';
  let body = '';
  let comm_category = comm_type;

  // ── Draft content by type ─────────────────────────────────────────────────
  if (comm_type === 'deficiency_notice') {
    subject = `Loan Servicing Deficiency Notice — ${property_name} (Loan ${loan_id})`;
    body = `${today}\n\nDear ${borrower_name},\n\n` +
      `Re: ${property_name} — Loan ${loan_id}\n\n` +
      `We are writing to notify you of the following deficiencies identified in connection with the above-referenced loan. ` +
      `Please provide the requested documentation and/or corrective information no later than ${deadline}.\n\n`;

    if (missing_items.length > 0) {
      body += `MISSING ITEMS REQUIRED:\n`;
      missing_items.forEach((item, i) => { body += `  ${i + 1}. ${item}\n`; });
      body += '\n';
    }

    if (findings.length > 0) {
      body += `EXCEPTIONS REQUIRING RESPONSE:\n`;
      findings.forEach((f, i) => { body += `  ${i + 1}. [${f.severity?.toUpperCase()}] ${f.message}\n`; });
      body += '\n';
    }

    body += `Failure to cure the above deficiencies by the stated deadline may result in additional servicing action. ` +
      `Please contact your servicing contact with any questions.\n\n` +
      `Sincerely,\n${servicer_name}`;

  } else if (comm_type === 'ror_letter') {
    subject = `Request for Records — ${property_name} (Loan ${loan_id})`;
    body = `${today}\n\nDear ${borrower_name},\n\n` +
      `Re: Request for Records — ${property_name} — Loan ${loan_id}\n\n` +
      `Pursuant to the terms of your loan agreement, we are requesting the following documents for the current reporting period. ` +
      `Please submit the items listed below by ${deadline}.\n\n` +
      `DOCUMENTS REQUESTED:\n`;

    const docs = missing_items.length > 0 ? missing_items : [
      'Current year-to-date operating statement',
      'Current rent roll with unit-level detail',
      'Prior year annual financial statements (audited or CPA-certified)',
    ];
    docs.forEach((doc, i) => { body += `  ${i + 1}. ${doc}\n`; });

    body += `\nDocuments may be submitted electronically to your assigned servicer contact. ` +
      `Please reference the above loan number in all correspondence.\n\n` +
      `Sincerely,\n${servicer_name}`;

  } else if (comm_type === 'cure_notice') {
    subject = `Cure Notice — Covenant Exception — ${property_name} (Loan ${loan_id})`;
    body = `${today}\n\nDear ${borrower_name},\n\n` +
      `Re: Cure Notice — ${property_name} — Loan ${loan_id}\n\n` +
      `Our records reflect the following loan covenant exception(s) as of the most recent reporting date. ` +
      `This notice is provided pursuant to your loan agreement and requires a cure plan to be submitted by ${deadline}.\n\n` +
      `COVENANT EXCEPTION(S):\n`;

    (findings.length > 0 ? findings : highFindings).forEach((f, i) => {
      body += `  ${i + 1}. ${f.message}\n`;
    });

    body += `\nPlease provide a written cure plan detailing the actions you intend to take to bring the loan into compliance. ` +
      `Your plan should include specific timelines and milestones.\n\n` +
      `This notice does not constitute a waiver of any rights or remedies available under the loan documents.\n\n` +
      `Sincerely,\n${servicer_name}`;

  } else if (comm_type === 'status_update') {
    subject = `Loan Status Update — ${property_name} (Loan ${loan_id})`;
    body = `${today}\n\nDear ${borrower_name},\n\n` +
      `Re: Loan Status Update — ${property_name} — Loan ${loan_id}\n\n` +
      `We are writing to provide you with a summary of the current servicing status for your loan.\n\n`;

    if (findings.length === 0 && missing_items.length === 0) {
      body += `Your loan is current with no outstanding exceptions or deficiencies at this time. Thank you for your continued compliance.\n\n`;
    } else {
      body += `The following items remain open as of this date:\n`;
      [...findings.map((f) => f.message), ...missing_items].forEach((item, i) => {
        body += `  ${i + 1}. ${item}\n`;
      });
      body += `\nPlease address the above items at your earliest convenience.\n\n`;
    }

    body += `Please do not hesitate to contact us with any questions.\n\nSincerely,\n${servicer_name}`;

  } else {
    // follow_up (default)
    subject = `Follow-Up — Outstanding Items — ${property_name} (Loan ${loan_id})`;
    body = `${today}\n\nDear ${borrower_name},\n\n` +
      `Re: Follow-Up — ${property_name} — Loan ${loan_id}\n\n` +
      `We are following up on our previous correspondence regarding outstanding servicing requirements. ` +
      `As of today's date, the following items remain unresolved:\n\n`;

    [...findings.map((f) => f.message), ...missing_items].forEach((item, i) => {
      body += `  ${i + 1}. ${item}\n`;
    });

    body += `\nWe request that you address these items by ${deadline}. ` +
      `If you have already submitted the required documents, please disregard this notice and confirm receipt with your servicer.\n\n` +
      `Sincerely,\n${servicer_name}`;
  }

  proposedUpdates.draft_subject = subject;
  proposedUpdates.draft_body = body;
  proposedUpdates.comm_type = comm_category;
  proposedUpdates.borrower_name = borrower_name;
  proposedUpdates.property_name = property_name;
  proposedUpdates.requires_approval = true;
  proposedUpdates.missing_items = missing_items;
  proposedUpdates.findings_count = findings.length;

  // ── Status & confidence ───────────────────────────────────────────────────
  const hasHighFindings = highFindings.length > 0;
  const confidence = missing_items.length === 0 && findings.length === 0 ? 0.50
    : hasHighFindings ? 0.78
    : 0.85;

  const status = missing_items.length === 0 && findings.length === 0
    ? 'needs_review'
    : 'needs_review'; // all comms require human approval

  const title = `${property_name} — ${comm_type.replace(/_/g, ' ')} draft ready for review`;
  const summary = `Draft ${comm_type.replace(/_/g, ' ')} prepared for ${borrower_name}. ` +
    `${missing_items.length} missing item(s), ${findings.length} finding(s) referenced. ` +
    `Requires servicer review before sending.`;

  const recommendedActions = [
    {
      action_type: 'review_draft_communication',
      label: `Review and approve ${comm_type.replace(/_/g, ' ')} before sending`,
      payload: { draft_subject: subject, comm_type, loan_id },
      requires_approval: true,
    },
  ];

  if (hasHighFindings) {
    recommendedActions.push({
      action_type: 'escalate_to_special_servicing',
      label: 'Escalate to special servicing team for high-severity findings',
      payload: { loan_id, findings: highFindings },
      requires_approval: true,
    });
  }

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

module.exports = { runBorrowerCommAgent };
