/**
 * Borrower Portal Router
 *
 * All endpoints scoped to the authenticated borrower's own data.
 * Every route falls back gracefully — if DB tables don't exist yet
 * or the user has no records, it returns an empty payload so the
 * frontend can fall back to its built-in demo data.
 *
 * Endpoints:
 *   GET /api/borrower/loan        – active loan details
 *   GET /api/borrower/payments    – payment history
 *   GET /api/borrower/documents   – required / submitted documents
 *   GET /api/borrower/draws       – draw request history
 *   GET /api/borrower/notices     – servicing notices
 *   GET /api/borrower/messages    – message thread with servicer
 *   POST /api/borrower/messages   – send a message
 */

const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { supabase } = require('../db');

const router = express.Router();
router.use(authenticate);

// ── GET /api/borrower/loan ───────────────────────────────────────────────────
router.get('/loan', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { data, error } = await supabase
      .from('loans')
      .select(`id, loan_ref, property_name, property_address, property_type,
               origination_date, maturity_date, original_balance, current_balance,
               interest_rate, payment_type, status, next_payment_date,
               next_payment_amount, servicer_name, servicer_contact`)
      .eq('borrower_user_id', userId)
      .in('status', ['Current', 'Active', 'In Construction', 'Special Servicing', 'Default'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return res.json({ loan: data });
  } catch (err) {
    return res.json({ loan: null });
  }
});

// ── GET /api/borrower/payments ───────────────────────────────────────────────
router.get('/payments', async (req, res) => {
  try {
    const userId = req.user?.id;

    // First get the borrower's loan id
    const { data: loanRow } = await supabase
      .from('loans')
      .select('id')
      .eq('borrower_user_id', userId)
      .limit(1)
      .single();

    if (!loanRow?.id) return res.json({ payments: [] });

    const { data, error } = await supabase
      .from('loan_payments')
      .select('id, payment_date, total_amount, principal_amount, interest_amount, late_fee, status')
      .eq('loan_id', loanRow.id)
      .order('payment_date', { ascending: false })
      .limit(24);

    if (error) throw error;

    const payments = (data || []).map(row => ({
      id:        row.id,
      date:      row.payment_date,
      amount:    Number(row.total_amount)    || 0,
      principal: Number(row.principal_amount) || 0,
      interest:  Number(row.interest_amount) || 0,
      late_fee:  Number(row.late_fee)        || 0,
      status:    row.status                  || 'paid',
    }));

    return res.json({ payments });
  } catch (err) {
    return res.json({ payments: [] });
  }
});

// ── GET /api/borrower/documents ──────────────────────────────────────────────
router.get('/documents', async (req, res) => {
  try {
    const userId = req.user?.id;

    const { data: loanRow } = await supabase
      .from('loans')
      .select('id')
      .eq('borrower_user_id', userId)
      .limit(1)
      .single();

    if (!loanRow?.id) return res.json({ documents: [] });

    const { data, error } = await supabase
      .from('loan_documents')
      .select('id, name, due_date, status, submitted_at, notes')
      .eq('loan_id', loanRow.id)
      .order('due_date', { ascending: true });

    if (error) throw error;

    const documents = (data || []).map(row => ({
      id:           row.id,
      name:         row.name,
      due:          row.due_date,
      status:       row.status       || 'pending',
      submitted_at: row.submitted_at || '',
      notes:        row.notes        || '',
    }));

    return res.json({ documents });
  } catch (err) {
    return res.json({ documents: [] });
  }
});

// ── GET /api/borrower/draws ──────────────────────────────────────────────────
router.get('/draws', async (req, res) => {
  try {
    const userId = req.user?.id;

    const { data: loanRow } = await supabase
      .from('loans')
      .select('id, loan_ref')
      .eq('borrower_user_id', userId)
      .limit(1)
      .single();

    if (!loanRow?.id) return res.json({ draws: [] });

    const { data, error } = await supabase
      .from('draw_requests')
      .select('id, draw_number, amount, purpose, status, submitted_at, funded_at, inspector_approved')
      .eq('loan_id', loanRow.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    const draws = (data || []).map((row, i) => ({
      id:                 row.id,
      number:             row.draw_number   || `Draw #${i + 1}`,
      amount:             Number(row.amount) || 0,
      purpose:            row.purpose        || '',
      status:             row.status         || 'pending_inspection',
      submitted_at:       row.submitted_at   || '',
      funded_at:          row.funded_at      || '',
      inspector_approved: row.inspector_approved || false,
    }));

    return res.json({ draws });
  } catch (err) {
    return res.json({ draws: [] });
  }
});

// ── GET /api/borrower/notices ────────────────────────────────────────────────
router.get('/notices', async (req, res) => {
  try {
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('notifications')
      .select('id, notice_type, subject, body, created_at, sender_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const notices = (data || []).map(row => ({
      id:    row.id,
      type:  row.notice_type  || 'informational',
      subject: row.subject    || '',
      body:  row.body         || '',
      date:  row.created_at,
      from:  row.sender_name  || 'Kontra Servicing',
    }));

    return res.json({ notices });
  } catch (err) {
    return res.json({ notices: [] });
  }
});

// ── GET /api/borrower/messages ───────────────────────────────────────────────
router.get('/messages', async (req, res) => {
  try {
    const userId = req.user?.id;

    const { data: loanRow } = await supabase
      .from('loans')
      .select('id')
      .eq('borrower_user_id', userId)
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('loan_messages')
      .select('id, sender_type, author_name, message_text, created_at')
      .eq('loan_id', loanRow?.id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    const messages = (data || []).map(row => ({
      id:     row.id,
      from:   row.sender_type  || 'lender',
      author: row.author_name  || 'Kontra Servicing',
      text:   row.message_text || '',
      ts:     row.created_at,
    }));

    return res.json({ messages });
  } catch (err) {
    return res.json({ messages: [] });
  }
});

// ── POST /api/borrower/messages ──────────────────────────────────────────────
router.post('/messages', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { text } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ message: 'Message text required' });

    const { data: loanRow } = await supabase
      .from('loans')
      .select('id')
      .eq('borrower_user_id', userId)
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('loan_messages')
      .insert({
        loan_id:      loanRow?.id,
        sender_type:  'borrower',
        author_name:  req.user?.email || 'Borrower',
        message_text: text.trim(),
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({
      id:     data.id,
      from:   'borrower',
      author: 'You',
      text:   data.message_text,
      ts:     data.created_at,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to send message' });
  }
});

module.exports = router;
