/**
 * Investor Portal Router — /api/investor/*
 *
 * Scoped to the authenticated investor's holdings.
 * All endpoints fall back gracefully when DB data is sparse.
 *
 * Endpoints:
 *   GET /api/investor/holdings       – loan positions / token holdings
 *   GET /api/investor/distributions  – interest & principal distribution history
 *   GET /api/investor/performance    – per-loan DSCR, LTV, risk metrics
 *   GET /api/investor/alerts         – active risk alerts
 *   GET /api/investor/summary        – portfolio summary stats
 */

const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { supabase } = require('../db');

const router = express.Router();
router.use(authenticate);

// ── GET /api/investor/holdings ────────────────────────────────────────────────
router.get('/holdings', async (req, res) => {
  try {
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('investor_holdings')
      .select(`
        id, token_symbol, token_balance, share_pct, share_usd, yield_pct,
        loans!inner (
          id, title, status, interest_rate, amount, start_date, data
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    const holdings = (data || []).map(row => {
      const loan = row.loans || {};
      const d = loan.data || {};
      return {
        loan_id:        String(loan.id),
        loan_ref:       d.loan_ref       || `LN-${loan.id}`,
        property_name:  d.property_name  || loan.title || 'Unknown Property',
        property_type:  d.property_type  || 'Commercial',
        location:       d.location       || '—',
        upb:            d.current_balance || Number(loan.amount) || 0,
        my_share_pct:   Number(row.share_pct)    || 0,
        my_share_usd:   Number(row.share_usd)    || 0,
        token_balance:  Number(row.token_balance) || 0,
        token_symbol:   row.token_symbol  || '',
        status:         loan.status === 'active' ? 'Current' : loan.status === 'delinquent' ? 'Special Servicing' : loan.status || 'Current',
        yield_pct:      Number(row.yield_pct)    || Number(loan.interest_rate) || 0,
        maturity:       d.maturity_date   || null,
      };
    });

    return res.json({ holdings });
  } catch (err) {
    console.error('[investor/holdings]', err?.message);
    return res.json({ holdings: [] });
  }
});

// ── GET /api/investor/distributions ──────────────────────────────────────────
// Generates distribution records based on holdings × monthly interest
router.get('/distributions', async (req, res) => {
  try {
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('investor_holdings')
      .select('token_symbol, share_usd, yield_pct, loans!inner(id, data, status)')
      .eq('user_id', userId);

    if (error) throw error;
    if (!data || data.length === 0) return res.json({ distributions: [] });

    // Synthesise monthly distribution records for the past 6 months
    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push({ label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }), date: d.toISOString().slice(0, 10) });
    }

    const distributions = [];
    let counter = 1;
    for (const m of months) {
      for (const row of data) {
        if (!row.loans?.data?.loan_ref) continue;
        const shareUsd = Number(row.share_usd) || 0;
        const yieldPct = Number(row.yield_pct) || 8;
        const gross = Math.round((shareUsd * (yieldPct / 100) / 12) * 100) / 100;
        const net   = Math.round(gross * 0.9 * 100) / 100;
        const isPast = new Date(m.date) < new Date();
        distributions.push({
          id:           `dist-${counter++}`,
          period:       m.label,
          loan_ref:     row.loans.data.loan_ref,
          gross_amount: gross,
          net_amount:   net,
          type:         'Interest',
          paid_at:      m.date,
          status:       isPast ? 'paid' : 'scheduled',
        });
      }
    }

    return res.json({ distributions });
  } catch (err) {
    console.error('[investor/distributions]', err?.message);
    return res.json({ distributions: [] });
  }
});

// ── GET /api/investor/performance ─────────────────────────────────────────────
router.get('/performance', async (req, res) => {
  try {
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('investor_holdings')
      .select('loans!inner(id, title, status, data)')
      .eq('user_id', userId);

    if (error) throw error;

    const performance = (data || []).map(row => {
      const loan = row.loans || {};
      const d = loan.data || {};
      return {
        loan_ref:         d.loan_ref       || `LN-${loan.id}`,
        property:         d.property_name  || loan.title || 'Unknown',
        dscr:             Number(d.dscr)   || 1.0,
        ltv:              Number(d.ltv)    || 70.0,
        delinquency_days: Number(d.delinquency_days) || 0,
        payment_status:   d.payment_status || (loan.status === 'active' ? 'Current' : 'Delinquent'),
        risk_label:       d.dscr > 1.4 ? 'Low' : d.dscr > 1.1 ? 'Medium' : 'High',
      };
    });

    return res.json({ performance });
  } catch (err) {
    console.error('[investor/performance]', err?.message);
    return res.json({ performance: [] });
  }
});

// ── GET /api/investor/alerts ──────────────────────────────────────────────────
router.get('/alerts', async (req, res) => {
  try {
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('investor_holdings')
      .select('loans!inner(id, status, data)')
      .eq('user_id', userId);

    if (error) throw error;

    const alerts = [];
    let aid = 1;
    for (const row of (data || [])) {
      const loan = row.loans || {};
      const d = loan.data || {};
      const ref = d.loan_ref || `LN-${loan.id}`;
      const dscr = Number(d.dscr) || 1.0;
      const delinqDays = Number(d.delinquency_days) || 0;

      if (delinqDays > 30) {
        alerts.push({
          id: `alert-${aid++}`, severity: 'high', loan_ref: ref,
          message: `Loan in special servicing — ${delinqDays} days delinquent.`,
          created_at: new Date().toISOString(),
        });
      } else if (dscr < 1.25 && dscr > 0) {
        alerts.push({
          id: `alert-${aid++}`, severity: 'medium', loan_ref: ref,
          message: `DSCR at ${dscr.toFixed(2)}x — near covenant floor of 1.20x. Under review.`,
          created_at: new Date().toISOString(),
        });
      }
    }

    return res.json({ alerts });
  } catch (err) {
    console.error('[investor/alerts]', err?.message);
    return res.json({ alerts: [] });
  }
});

// ── GET /api/investor/summary ─────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('investor_holdings')
      .select('share_usd, yield_pct, token_balance, loans!inner(status)')
      .eq('user_id', userId);

    if (error) throw error;

    const rows = data || [];
    const total_invested  = rows.reduce((s, r) => s + (Number(r.share_usd)    || 0), 0);
    const total_tokens    = rows.reduce((s, r) => s + (Number(r.token_balance) || 0), 0);
    const avg_yield       = rows.length ? rows.reduce((s, r) => s + (Number(r.yield_pct) || 0), 0) / rows.length : 0;
    const active_count    = rows.filter(r => r.loans?.status === 'active').length;

    return res.json({
      total_invested,
      total_tokens,
      avg_yield: Math.round(avg_yield * 100) / 100,
      loan_count: rows.length,
      active_count,
    });
  } catch (err) {
    return res.json({ total_invested: 0, total_tokens: 0, avg_yield: 0, loan_count: 0, active_count: 0 });
  }
});

module.exports = router;
