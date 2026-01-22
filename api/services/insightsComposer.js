const { supabase } = require('../db');

const DEFAULT_DOC_TYPES = [
  'appraisal',
  'insurance',
  'tax',
  'rent_roll',
  'financials',
  'draw_budget',
  'inspection_report'
];

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pickLatest(rows, field = 'created_at') {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows
    .slice()
    .sort((a, b) => new Date(b[field] || 0) - new Date(a[field] || 0))[0];
}

async function safeQuery(builder) {
  try {
    return await builder;
  } catch (error) {
    return { data: null, error };
  }
}

async function getLoanCore(loanId, organizationId) {
  let query = supabase
    .from('loans')
    .select(
      'id, loan_number, borrower_name, status, amount, curr_balance, maturity_date, start_date, asset_id, property_id, organization_id'
    )
    .eq('id', loanId)
    .maybeSingle();

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await safeQuery(query);
  if (error) return null;
  return data || null;
}

async function getLatestMetrics(loanId, loanCore) {
  const metrics = {
    dscr: null,
    target_dscr: null,
    noi_target: null,
    actual_noi: null,
    occupancy_rate: null,
    escrow_balance: null,
    tax_amount: null,
    insurance_amount: null,
    next_tax_due: null,
    next_insurance_due: null,
    maturity_date: loanCore?.maturity_date || null,
    status: loanCore?.status || null
  };

  const dscrResult = await safeQuery(
    supabase
      .from('loan_dscr_metrics')
      .select(
        'loan_id, dscr, current_dscr, dscr_ratio, target_dscr, last_recalculated, next_reset, interest_accrued_month'
      )
      .eq('loan_id', loanId)
      .maybeSingle()
  );

  if (!dscrResult.error && dscrResult.data) {
    metrics.dscr =
      toNumber(dscrResult.data.dscr) ??
      toNumber(dscrResult.data.current_dscr) ??
      toNumber(dscrResult.data.dscr_ratio);
    metrics.target_dscr = toNumber(dscrResult.data.target_dscr);
    metrics.last_recalculated = dscrResult.data.last_recalculated || null;
    metrics.next_reset = dscrResult.data.next_reset || null;
    metrics.interest_accrued_month = toNumber(dscrResult.data.interest_accrued_month);
  }

  const performanceResult = await safeQuery(
    supabase
      .from('loan_performance_fees')
      .select('loan_id, noi_target, actual_noi, reserve_balance, last_waterfall')
      .eq('loan_id', loanId)
      .maybeSingle()
  );

  if (!performanceResult.error && performanceResult.data) {
    metrics.noi_target = toNumber(performanceResult.data.noi_target);
    metrics.actual_noi = toNumber(performanceResult.data.actual_noi);
    metrics.reserve_balance = toNumber(performanceResult.data.reserve_balance);
    metrics.last_waterfall = performanceResult.data.last_waterfall || null;
  }

  if (loanCore?.asset_id) {
    const assetResult = await safeQuery(
      supabase
        .from('assets')
        .select('id, occupancy')
        .eq('id', loanCore.asset_id)
        .maybeSingle()
    );
    if (!assetResult.error && assetResult.data) {
      const occupancy = toNumber(assetResult.data.occupancy);
      if (occupancy !== null && occupancy <= 1 && occupancy >= 0) {
        metrics.occupancy_rate = Number((occupancy * 100).toFixed(2));
      } else if (occupancy !== null) {
        metrics.occupancy_rate = occupancy;
      }
    }
  }

  const escrowResult = await safeQuery(
    supabase
      .from('escrows')
      .select(
        'loan_id, escrow_balance, tax_amount, insurance_amount, next_tax_due, next_insurance_due'
      )
      .eq('loan_id', loanId)
      .maybeSingle()
  );

  if (!escrowResult.error && escrowResult.data) {
    metrics.escrow_balance = toNumber(escrowResult.data.escrow_balance);
    metrics.tax_amount = toNumber(escrowResult.data.tax_amount);
    metrics.insurance_amount = toNumber(escrowResult.data.insurance_amount);
    metrics.next_tax_due = escrowResult.data.next_tax_due || null;
    metrics.next_insurance_due = escrowResult.data.next_insurance_due || null;
  }

  return metrics;
}

async function getRecentPayments(loanId, organizationId, days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  let query = supabase
    .from('payments')
    .select('id, loan_id, amount, date, remaining_balance, created_at')
    .eq('loan_id', loanId)
    .gte('date', since.toISOString());

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await safeQuery(query.order('date', { ascending: false }));
  if (error || !Array.isArray(data)) return [];
  return data;
}

async function getOpenDraws(loanId) {
  const openStatuses = ['submitted', 'pending', 'review', 'approved'];
  const { data, error } = await safeQuery(
    supabase
      .from('draw_requests')
      .select('id, project, status, amount, submitted_at, approved_at')
      .eq('loan_id', loanId)
      .in('status', openStatuses)
      .order('submitted_at', { ascending: true })
  );

  if (error || !Array.isArray(data)) return [];
  return data;
}

async function getRecentInspections(loanId, loanCore) {
  const query = supabase
    .from('inspections')
    .select('id, inspection_date, notes, status, draw_id, project_id')
    .order('inspection_date', { ascending: false })
    .limit(10);

  let result = await safeQuery(query.eq('loan_id', loanId));
  if (result.error && loanCore?.property_id) {
    result = await safeQuery(query.eq('project_id', loanCore.property_id));
  }

  if (result.error || !Array.isArray(result.data)) return [];
  return result.data;
}

async function getDocumentChecklist(loanId) {
  const { data, error } = await safeQuery(
    supabase
      .from('loan_docs')
      .select('id, doc_type, storage_url, uploaded_at')
      .eq('loan_id', loanId)
      .order('uploaded_at', { ascending: false })
  );

  const docs = Array.isArray(data) ? data : [];
  const presentTypes = new Set(docs.map((doc) => String(doc.doc_type).toLowerCase()));
  const present = docs.map((doc) => ({
    id: doc.id,
    type: doc.doc_type,
    url: doc.storage_url,
    uploaded_at: doc.uploaded_at
  }));

  const missing = DEFAULT_DOC_TYPES.filter((docType) => !presentTypes.has(docType));
  return { present, missing };
}

async function getRecentNotesOrComments() {
  return [];
}

function buildTimeline({ payments, draws, inspections, documents }) {
  const events = [];

  payments.forEach((payment) => {
    events.push({
      type: 'payment',
      date: payment.date || payment.created_at,
      description: `Payment of ${payment.amount}`
    });
  });

  draws.forEach((draw) => {
    events.push({
      type: 'draw',
      date: draw.submitted_at || draw.approved_at,
      description: `Draw ${draw.status} for ${draw.amount}`
    });
  });

  inspections.forEach((inspection) => {
    events.push({
      type: 'inspection',
      date: inspection.inspection_date,
      description: `Inspection ${inspection.status || 'scheduled'}`
    });
  });

  documents.present.forEach((doc) => {
    events.push({
      type: 'document',
      date: doc.uploaded_at,
      description: `Document uploaded: ${doc.type}`
    });
  });

  return events
    .filter((event) => event.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 12);
}

async function getLoanServicingSnapshot(loanId, organizationId) {
  const loan = await getLoanCore(loanId, organizationId);
  const metrics = await getLatestMetrics(loanId, loan);
  const payments = await getRecentPayments(loanId, organizationId);
  const draws = await getOpenDraws(loanId);
  const inspections = await getRecentInspections(loanId, loan);
  const documents = await getDocumentChecklist(loanId);
  const notes = await getRecentNotesOrComments(loanId);

  const timeline = buildTimeline({ payments, draws, inspections, documents });

  return {
    loan,
    metrics,
    draws,
    inspections,
    payments,
    documents,
    notes,
    timeline
  };
}

module.exports = {
  getLoanCore,
  getLatestMetrics,
  getRecentPayments,
  getOpenDraws,
  getRecentInspections,
  getDocumentChecklist,
  getRecentNotesOrComments,
  getLoanServicingSnapshot
};
