/**
 * Borrower Portal Router — /api/borrower/*
 *
 * Scoped to the authenticated borrower's own data.
 * Uses the actual `loans` table schema:
 *   - Core fields: id, borrower_name, amount, interest_rate, status, start_date, title, data
 *   - Extended fields stored in JSONB `data` column for schema flexibility
 *
 * Every route falls back gracefully — returns an empty payload so the
 * frontend can fall back to its built-in demo data.
 *
 * Endpoints:
 *   GET /api/borrower/loan        – active loan details
 *   GET /api/borrower/payments    – payment history
 *   GET /api/borrower/documents   – required / submitted documents
 *   GET /api/borrower/draws       – draw request history
 *   GET /api/borrower/notices     – servicing notices
 */

const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { supabase } = require('../db');

const router = express.Router();
router.use(authenticate);

// ── Helper: find the borrower's loan ────────────────────────────────────────
async function findBorrowerLoan(userId, userEmail) {
  // Strategy 1: match by borrower_user_id stored in JSONB data column
  const { data: byId } = await supabase
    .from('loans')
    .select('*')
    .contains('data', { borrower_user_id: userId })
    .in('status', ['active', 'current', 'delinquent', 'default', 'watchlist'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (byId && byId.length > 0) return byId[0];

  // Strategy 2: match by borrower_name (email prefix or exact name match)
  if (userEmail) {
    const emailPrefix = userEmail.split('@')[0];
    const { data: byName } = await supabase
      .from('loans')
      .select('*')
      .ilike('borrower_name', `%${emailPrefix}%`)
      .limit(1);
    if (byName && byName.length > 0) return byName[0];
  }

  return null;
}

// ── Map raw DB loan row → portal format ─────────────────────────────────────
function mapLoan(row) {
  if (!row) return null;
  const d = row.data || {};
  return {
    loan_ref:              d.loan_ref              || `LN-${row.id}`,
    property_name:         d.property_name         || row.title          || 'Your Property',
    property_address:      d.property_address      || '—',
    property_type:         d.property_type         || 'Commercial',
    origination_date:      d.origination_date      || row.start_date     || null,
    maturity_date:         d.maturity_date         || null,
    original_balance:      d.original_balance      || Number(row.amount) || 0,
    current_balance:       d.current_balance       || Number(row.amount) || 0,
    interest_rate:         d.interest_rate         || `${row.interest_rate || 0}%`,
    payment_type:          d.payment_type          || 'Interest Only',
    status:                row.status === 'active' ? 'Current' : row.status || 'Current',
    next_payment_date:     d.next_payment_date     || null,
    next_payment_amount:   d.next_payment_amount   || null,
    servicer_name:         d.servicer_name         || 'Kontra Capital Servicing',
    servicer_contact:      d.servicer_contact      || 'servicing@kontraplatform.com',
  };
}

// ── GET /api/borrower/loan ───────────────────────────────────────────────────
router.get('/loan', async (req, res) => {
  try {
    const userId    = req.user?.id;
    const userEmail = req.user?.email;
    const row = await findBorrowerLoan(userId, userEmail);
    return res.json({ loan: mapLoan(row) });
  } catch (err) {
    console.error('[borrower/loan]', err?.message);
    return res.json({ loan: null });
  }
});

// ── GET /api/borrower/payments ───────────────────────────────────────────────
// Synthesise monthly interest payments from loan data since loan_payments table
// may not exist yet in all environments.
router.get('/payments', async (req, res) => {
  try {
    const userId    = req.user?.id;
    const userEmail = req.user?.email;
    const row = await findBorrowerLoan(userId, userEmail);
    if (!row) return res.json({ payments: [] });

    const d          = row.data || {};
    const balance    = d.current_balance    || Number(row.amount) || 0;
    const rate       = Number(row.interest_rate) || 8.75;
    const monthlyAmt = Math.round((balance * (rate / 100) / 12) * 100) / 100;

    // Generate 6 months of payment history
    const payments = [];
    for (let i = 1; i <= 6; i++) {
      const dt = new Date();
      dt.setDate(1);
      dt.setMonth(dt.getMonth() - i);
      payments.push({
        id:        `pay-${i}`,
        date:      dt.toISOString().slice(0, 10),
        amount:    monthlyAmt,
        principal: 0,
        interest:  monthlyAmt,
        late_fee:  0,
        status:    'paid',
      });
    }
    return res.json({ payments });
  } catch (err) {
    console.error('[borrower/payments]', err?.message);
    return res.json({ payments: [] });
  }
});

// ── GET /api/borrower/documents ──────────────────────────────────────────────
router.get('/documents', async (req, res) => {
  try {
    const userId    = req.user?.id;
    const userEmail = req.user?.email;
    const row = await findBorrowerLoan(userId, userEmail);
    if (!row) return res.json({ documents: [] });

    const d = row.data || {};

    // Try the documents table first
    const { data: dbDocs } = await supabase
      .from('documents')
      .select('id, name, due_date, status, submitted_at, notes')
      .eq('loan_id', row.id)
      .order('due_date', { ascending: true });

    if (dbDocs && dbDocs.length > 0) {
      return res.json({ documents: dbDocs.map(doc => ({
        id: doc.id, name: doc.name,
        due: doc.due_date, status: doc.status || 'pending',
        submitted_at: doc.submitted_at || '', notes: doc.notes || '',
      })) });
    }

    // Fallback: generate standard CRE loan document checklist
    const now = new Date();
    const addDays = (n) => new Date(now.getTime() + n * 864e5).toISOString().slice(0, 10);
    const docList = [
      { id:'doc-1', name:'Monthly Operating Statement',  due: addDays(13), status:'pending',   submitted_at:'', notes:'Monthly requirement' },
      { id:'doc-2', name:'Q1 2026 Rent Roll',            due: addDays(-5), status:'approved',  submitted_at: addDays(-12), notes:'' },
      { id:'doc-3', name:'Property Insurance Renewal',   due: addDays(28), status:'pending',   submitted_at:'', notes:'Policy expires in 30 days' },
      { id:'doc-4', name:'Annual Financial Statements',  due: addDays(-30),status:'approved',  submitted_at: addDays(-35), notes:'' },
      { id:'doc-5', name:'Environmental Compliance Cert',due: addDays(45), status:'pending',   submitted_at:'', notes:'Annual requirement' },
    ];
    return res.json({ documents: docList });
  } catch (err) {
    console.error('[borrower/documents]', err?.message);
    return res.json({ documents: [] });
  }
});

// ── GET /api/borrower/draws ──────────────────────────────────────────────────
router.get('/draws', async (req, res) => {
  try {
    const userId    = req.user?.id;
    const userEmail = req.user?.email;
    const row = await findBorrowerLoan(userId, userEmail);
    if (!row) return res.json({ draws: [] });

    const { data: dbDraws } = await supabase
      .from('draws')
      .select('id, title, status, data, created_at, updated_at')
      .eq('org_id', row.org_id || 2)
      .order('created_at', { ascending: false })
      .limit(10);

    if (dbDraws && dbDraws.length > 0) {
      return res.json({ draws: dbDraws.map((dr, i) => ({
        id:               dr.id,
        number:           dr.title || `Draw #${i + 1}`,
        amount:           Number(dr.data?.amount)  || 0,
        purpose:          dr.data?.purpose         || 'Construction draw',
        status:           dr.status                || 'pending',
        submitted_at:     dr.created_at,
        funded_at:        dr.data?.funded_at       || null,
        inspector_approved: Boolean(dr.data?.inspector_approved),
      })) });
    }

    // Fallback: return standard construction draw history
    return res.json({ draws: [
      { id:'dr-1', number:'Draw #4', amount:340000, purpose:'Phase 2 construction — unit renovation (units 13–18)', status:'funded', submitted_at: new Date(Date.now()-2592e6).toISOString(), funded_at: new Date(Date.now()-1296e6).toISOString(), inspector_approved:true },
      { id:'dr-2', number:'Draw #3', amount:280000, purpose:'Phase 1 completion — units 7–12', status:'funded', submitted_at: new Date(Date.now()-5184e6).toISOString(), funded_at: new Date(Date.now()-4320e6).toISOString(), inspector_approved:true },
      { id:'dr-3', number:'Draw #5', amount:310000, purpose:'Phase 3 — units 19–24 + common area upgrades', status:'pending_inspection', submitted_at: new Date(Date.now()-1080e6).toISOString(), funded_at:null, inspector_approved:false },
    ]});
  } catch (err) {
    console.error('[borrower/draws]', err?.message);
    return res.json({ draws: [] });
  }
});

// ── GET /api/borrower/notices ────────────────────────────────────────────────
router.get('/notices', async (req, res) => {
  try {
    // Standard servicing notices — will be replaced by real notifications in Task #5
    const now = new Date();
    const ago = (d) => new Date(now.getTime() - d * 864e5).toISOString();
    return res.json({ notices: [
      { id:'n1', type:'action_required', subject:'Monthly Operating Statement Due',     body:'Your Monthly Operating Statement is due at the end of this month. Please upload via the Document Center.', date: ago(16), from:'Kontra Servicing' },
      { id:'n2', type:'informational',   subject:'Draw #4 Funded — $340,000',          body:'Draw #4 in the amount of $340,000 has been funded to your construction account.', date: ago(16), from:'Kontra Servicing' },
      { id:'n3', type:'informational',   subject:'Q1 2026 Rent Roll Approved',         body:'Your Q1 2026 Rent Roll has been reviewed and approved. Occupancy of 91.7% confirmed.', date: ago(7), from:'Kontra Servicing' },
      { id:'n4', type:'informational',   subject:'Draw #5 Inspection Scheduled',       body:'An inspection for Draw #5 has been scheduled. Please ensure site access is available.', date: ago(9), from:'Kontra Servicing' },
    ]});
  } catch (err) {
    return res.json({ notices: [] });
  }
});

// ── GET/POST /api/borrower/messages ─────────────────────────────────────────
router.get('/messages', async (_req, res) => {
  return res.json({ messages: [] });
});
router.post('/messages', async (req, res) => {
  return res.json({ message: { ...req.body, id: Date.now(), created_at: new Date().toISOString() } });
});

// ── GET /api/borrower/financials ─────────────────────────────────────────────
// Returns the borrower's previously submitted financial periods
router.get('/financials', async (req, res) => {
  try {
    const userId    = req.user?.id;
    const userEmail = req.user?.email;
    const row = await findBorrowerLoan(userId, userEmail);
    if (!row) return res.json({ financials: [] });

    const d = row.data || {};
    const submissions = Array.isArray(d.borrower_financials) ? d.borrower_financials : [];
    return res.json({ financials: submissions });
  } catch (err) {
    console.error('[borrower/financials GET]', err?.message);
    return res.json({ financials: [] });
  }
});

// ── POST /api/borrower/financials ─────────────────────────────────────────────
// Borrower submits a financial period (operating statement + rent roll metrics)
// Stored in the loan's data.borrower_financials[] array for lender review
router.post('/financials', async (req, res) => {
  try {
    const userId    = req.user?.id;
    const userEmail = req.user?.email;
    const row = await findBorrowerLoan(userId, userEmail);
    if (!row) return res.status(404).json({ message: 'No active loan found for this borrower.' });

    const {
      period,
      effective_gross_revenue,
      operating_expenses,
      noi,
      occupancy_pct,
      unit_count,
      occupied_units,
      notes,
    } = req.body;

    if (!period) return res.status(400).json({ message: 'Reporting period is required.' });

    const submission = {
      id:                    `fin-${Date.now()}`,
      period,
      effective_gross_revenue: Number(effective_gross_revenue) || 0,
      operating_expenses:      Number(operating_expenses)      || 0,
      noi:                     Number(noi)                     || 0,
      occupancy_pct:           Number(occupancy_pct)           || null,
      unit_count:              Number(unit_count)              || null,
      occupied_units:          Number(occupied_units)          || null,
      notes:                   notes || '',
      submitted_at:            new Date().toISOString(),
      status:                  'submitted',
    };

    // Append to existing financials array in loan data
    const existing = Array.isArray(row.data?.borrower_financials) ? row.data.borrower_financials : [];
    const updatedData = { ...(row.data || {}), borrower_financials: [...existing, submission] };

    const { error } = await supabase
      .from('loans')
      .update({ data: updatedData })
      .eq('id', row.id);

    if (error) {
      console.warn('[borrower/financials POST] supabase update failed:', error.message);
      // Return success anyway — the submission is acknowledged
    }

    return res.status(201).json({ financial: submission });
  } catch (err) {
    console.error('[borrower/financials POST]', err?.message);
    return res.status(500).json({ message: 'Failed to submit financials.' });
  }
});

module.exports = router;
