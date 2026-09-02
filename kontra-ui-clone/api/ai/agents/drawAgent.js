/**
 * Draw Agent — validates draw packages for multifamily/commercial CRE loans.
 * Checks invoice completeness, lien waiver receipt, percent-complete vs evidence,
 * retainage, and inspector certification. Follows Freddie Mac guide Chapter 14 style.
 *
 * @param {object} input
 * @param {object[]} input.invoices          - array of invoice objects { id, vendor, amount, description }
 * @param {object[]} input.lien_waivers      - array of lien waiver docs  { vendor, type: 'conditional'|'unconditional', amount }
 * @param {object[]} input.line_items        - SOV line items             { id, description, budget, claimed_pct, inspector_pct }
 * @param {object[]} input.attachments       - supporting docs/photos     { label, url, kind }
 * @param {number}   input.prior_draw_total  - total previously disbursed
 * @param {number}   input.requested_amount  - this draw request amount
 * @param {number}   input.contract_amount   - total contract / loan amount
 * @param {string}   [input.inspector_cert]  - inspector certification status
 * @param {object}   [input.context]         - misc loan context { loan_id, property_name, draw_number }
 * @returns {object} AiReviewOutput
 */
const runDrawAgent = (input = {}) => {
  const invoices = input.invoices || [];
  const lienWaivers = input.lien_waivers || [];
  const lineItems = input.line_items || [];
  const attachments = input.attachments || [];
  const priorTotal = Number(input.prior_draw_total) || 0;
  const requested = Number(input.requested_amount) || 0;
  const contractAmount = Number(input.contract_amount) || 0;
  const inspectorCert = input.inspector_cert || '';
  const context = input.context || {};

  const reasons = [];
  const evidence = [];
  const proposedUpdates = {};

  // ── 1. Invoice completeness ──────────────────────────────────────────────
  const invoiceTotal = invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  if (invoices.length === 0) {
    reasons.push({
      code: 'missing_invoices',
      message: 'No invoices submitted with draw request.',
      severity: 'high',
    });
  } else if (Math.abs(invoiceTotal - requested) > requested * 0.02) {
    reasons.push({
      code: 'invoice_amount_mismatch',
      message: `Invoice total ($${invoiceTotal.toLocaleString()}) does not match requested amount ($${requested.toLocaleString()}).`,
      severity: 'high',
    });
  }
  proposedUpdates.invoice_total = invoiceTotal;
  proposedUpdates.invoice_count = invoices.length;

  // ── 2. Lien waiver analysis ──────────────────────────────────────────────
  const waiverVendors = new Set(lienWaivers.map((w) => w.vendor?.toLowerCase()?.trim()).filter(Boolean));
  const invoiceVendors = new Set(invoices.map((i) => i.vendor?.toLowerCase()?.trim()).filter(Boolean));
  const missingWaivers = [...invoiceVendors].filter((v) => !waiverVendors.has(v));
  const hasUnconditional = lienWaivers.some((w) => w.type === 'unconditional');
  const hasConditional = lienWaivers.some((w) => w.type === 'conditional');

  if (missingWaivers.length > 0) {
    reasons.push({
      code: 'missing_lien_waivers',
      message: `Lien waivers missing for: ${missingWaivers.join(', ')}.`,
      severity: 'high',
    });
  }
  if (priorTotal > 0 && !hasUnconditional) {
    reasons.push({
      code: 'missing_unconditional_waiver',
      message: 'Unconditional lien waivers required for prior draw amounts not received.',
      severity: 'medium',
    });
  }
  proposedUpdates.lien_waiver_status = {
    vendors_with_waivers: [...waiverVendors],
    missing_waivers: missingWaivers,
    has_unconditional: hasUnconditional,
    has_conditional: hasConditional,
  };

  // ── 3. SOV percent-complete vs inspector certification ───────────────────
  const overClaimedItems = [];
  let totalBudget = 0;
  let totalClaimed = 0;

  lineItems.forEach((item) => {
    const budget = Number(item.budget) || 0;
    const claimedPct = Number(item.claimed_pct) || 0;
    const inspectorPct = Number(item.inspector_pct);
    totalBudget += budget;
    totalClaimed += budget * (claimedPct / 100);

    if (!Number.isNaN(inspectorPct) && claimedPct > inspectorPct + 5) {
      overClaimedItems.push({
        id: item.id || item.description,
        description: item.description,
        claimed_pct: claimedPct,
        inspector_pct: inspectorPct,
        variance: claimedPct - inspectorPct,
      });
    }
  });

  if (overClaimedItems.length > 0) {
    reasons.push({
      code: 'sov_overclaim',
      message: `${overClaimedItems.length} SOV line item(s) claimed above inspector-certified completion.`,
      severity: 'high',
    });
    proposedUpdates.overclaimed_items = overClaimedItems;
  }

  // ── 4. Retainage check ───────────────────────────────────────────────────
  const cumulativePct = contractAmount > 0 ? ((priorTotal + requested) / contractAmount) * 100 : 0;
  proposedUpdates.cumulative_pct = Math.round(cumulativePct * 10) / 10;

  if (cumulativePct > 50 && !hasUnconditional) {
    reasons.push({
      code: 'retainage_threshold',
      message: `Draw crosses 50% disbursement threshold (${cumulativePct.toFixed(1)}%); unconditional waivers required.`,
      severity: 'medium',
    });
  }

  // ── 5. Inspector certification ───────────────────────────────────────────
  if (!inspectorCert || inspectorCert === 'pending') {
    reasons.push({
      code: 'inspector_not_certified',
      message: 'Inspector has not certified work completion for this draw.',
      severity: 'high',
    });
  }

  // ── 6. Photo / site evidence ─────────────────────────────────────────────
  attachments.forEach((att, i) => {
    evidence.push({
      label: att.label || `Draw document ${i + 1}`,
      url: att.url || '',
      kind: att.kind === 'photo' ? 'image' : 'doc',
      excerpt: att.excerpt,
    });
  });

  if (attachments.filter((a) => a.kind === 'photo').length === 0) {
    reasons.push({
      code: 'missing_site_photos',
      message: 'No site photos included with draw package.',
      severity: 'medium',
    });
  }

  // ── 7. Determine status & confidence ─────────────────────────────────────
  const hasHigh = reasons.some((r) => r.severity === 'high');
  const hasMed = reasons.some((r) => r.severity === 'medium');

  const status = hasHigh ? 'fail' : hasMed ? 'needs_review' : 'pass';
  const confidence = status === 'pass' ? 0.88 : status === 'fail' ? 0.31 : 0.58;

  // ── 8. Recommended actions ───────────────────────────────────────────────
  const recommendedActions = [];

  if (status === 'pass') {
    recommendedActions.push({
      action_type: 'approve_draw_disbursement',
      label: 'Approve draw disbursement',
      payload: { draw_number: context.draw_number, amount: requested },
      requires_approval: true,
    });
    recommendedActions.push({
      action_type: 'generate_draw_comment',
      label: 'Generate Freddie Mac draw comment',
      payload: { draw_number: context.draw_number, amount: requested },
      requires_approval: true,
    });
  } else {
    if (missingWaivers.length > 0) {
      recommendedActions.push({
        action_type: 'request_lien_waivers',
        label: 'Request outstanding lien waivers',
        payload: { missing_vendors: missingWaivers },
        requires_approval: true,
      });
    }
    if (overClaimedItems.length > 0) {
      recommendedActions.push({
        action_type: 'request_sov_revision',
        label: 'Request SOV revision from borrower',
        payload: { items: overClaimedItems.map((i) => i.id) },
        requires_approval: true,
      });
    }
    if (!inspectorCert || inspectorCert === 'pending') {
      recommendedActions.push({
        action_type: 'order_inspection',
        label: 'Order inspector certification',
        payload: { reason: 'Inspector certification required before disbursement.' },
        requires_approval: true,
      });
    }
    recommendedActions.push({
      action_type: 'draft_draw_deficiency_letter',
      label: 'Draft draw deficiency notice',
      payload: { draw_number: context.draw_number, deficiencies: reasons.map((r) => r.message) },
      requires_approval: true,
    });
  }

  // ── 9. Title & summary ───────────────────────────────────────────────────
  const propertyName = context.property_name || 'Property';
  const drawNum = context.draw_number ? `Draw #${context.draw_number}` : 'Draw request';

  let title;
  if (status === 'pass') {
    title = `${drawNum} — ${propertyName}: approved for disbursement ($${requested.toLocaleString()})`;
  } else if (hasHigh) {
    const primary = reasons.find((r) => r.severity === 'high');
    title = `${drawNum} — ${propertyName}: ${primary.message}`;
  } else {
    title = `${drawNum} — ${propertyName}: exceptions require review before disbursement`;
  }

  const summary =
    status === 'pass'
      ? `Draw package is complete. All invoices, lien waivers, and inspector certifications are in order. Recommended for disbursement approval.`
      : `Draw package has ${reasons.length} exception(s). Disbursement should be withheld pending resolution. See recommended actions for next steps.`;

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

module.exports = { runDrawAgent };
