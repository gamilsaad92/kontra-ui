const express = require('express');
  const { createClient } = require('@supabase/supabase-js');

  const router = express.Router();
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Stage definitions ────────────────────────────────────────────────────────
  const STAGES = [
    { id: 'origination', label: 'Origination',  color: '#6366f1', order: 1, description: 'Application received, underwriting in progress' },
    { id: 'approved',    label: 'Approved',      color: '#0ea5e9', order: 2, description: 'Credit approved, documents being finalized' },
    { id: 'closing',     label: 'Closing',       color: '#8b5cf6', order: 3, description: 'Loan documents signed, funding in process' },
    { id: 'active',      label: 'Active',        color: '#22c55e', order: 4, description: 'Loan funded and performing as agreed' },
    { id: 'watch_list',  label: 'Watch List',    color: '#f59e0b', order: 5, description: 'Elevated risk; monitoring required' },
    { id: 'default',     label: 'Default',       color: '#ef4444', order: 6, description: 'Borrower in default on obligations' },
    { id: 'workout',     label: 'Workout',       color: '#f97316', order: 7, description: 'Modification or restructuring underway' },
    { id: 'reo',         label: 'REO',           color: '#dc2626', order: 8, description: 'Real estate owned after foreclosure' },
    { id: 'paid_off',    label: 'Paid Off',      color: '#64748b', order: 9, description: 'Loan fully repaid or exited' },
  ];

  // Valid transitions map
  const VALID_TRANSITIONS = {
    origination: ['approved', 'paid_off'],
    approved:    ['closing', 'origination', 'paid_off'],
    closing:     ['active', 'approved'],
    active:      ['watch_list', 'paid_off'],
    watch_list:  ['active', 'default', 'workout'],
    default:     ['workout', 'reo', 'paid_off'],
    workout:     ['active', 'reo', 'paid_off'],
    reo:         ['paid_off'],
    paid_off:    [],
  };

  // Bootstrap events table
  async function bootstrap() {
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS loan_lifecycle_events (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          loan_id       UUID NOT NULL,
          from_stage    TEXT,
          to_stage      TEXT NOT NULL,
          reason        TEXT,
          triggered_by  TEXT DEFAULT 'manual',
          created_by    UUID,
          created_at    TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_lifecycle_loan ON loan_lifecycle_events(loan_id);
      `
    }).then(() => null).catch(() => null);
  }
  bootstrap();

  // ── GET /api/lifecycle/stages ────────────────────────────────────────────────
  router.get('/stages', (req, res) => {
    res.json(STAGES);
  });

  // ── GET /api/lifecycle/board ─────────────────────────────────────────────────
  // Returns all loans grouped by their current lifecycle stage
  router.get('/board', async (req, res) => {
    try {
      const { org_id } = req.query;

      let q = supabase
        .from('loans')
        .select('id, borrower_name, amount, interest_rate, term_months, start_date, status, risk_score, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      const { data: loans, error } = await q;
      if (error) throw error;

      // Map DB status → lifecycle stage
      const stageMap = (status) => {
        const s = (status || '').toLowerCase().replace(/\s+/g, '_');
        if (STAGES.find(st => st.id === s)) return s;
        // Map common legacy statuses
        if (s.includes('active') || s === 'current') return 'active';
        if (s.includes('default')) return 'default';
        if (s.includes('paid') || s.includes('payoff') || s.includes('closed')) return 'paid_off';
        if (s.includes('watch')) return 'watch_list';
        if (s.includes('workout') || s.includes('restructur')) return 'workout';
        if (s.includes('reo') || s.includes('foreclos')) return 'reo';
        if (s.includes('closing')) return 'closing';
        if (s.includes('approv')) return 'approved';
        return 'active'; // default most loans to active
      };

      // Group by stage
      const board = {};
      STAGES.forEach(s => { board[s.id] = []; });

      (loans ?? []).forEach(loan => {
        const stage = stageMap(loan.status);
        if (board[stage]) {
          board[stage].push({
            id: loan.id,
            borrower: loan.borrower_name,
            amount: loan.amount,
            rate: loan.interest_rate,
            term: loan.term_months,
            start_date: loan.start_date,
            risk_score: loan.risk_score,
            stage,
            created_at: loan.created_at,
          });
        }
      });

      res.json({ stages: STAGES, board });
    } catch (err) {
      console.error('[lifecycle] board error:', err);
      // Return fallback board with mock data
      const board = {};
      STAGES.forEach(s => { board[s.id] = []; });
      board.active = [
        { id: 'demo-1', borrower: 'Skyline Capital LLC', amount: 8500000, rate: 6.75, stage: 'active', risk_score: 72 },
        { id: 'demo-2', borrower: 'Harbor View Partners', amount: 14200000, rate: 7.25, stage: 'active', risk_score: 61 },
        { id: 'demo-3', borrower: 'Metro Realty Group', amount: 5900000, rate: 6.50, stage: 'active', risk_score: 84 },
      ];
      board.watch_list = [
        { id: 'demo-4', borrower: 'Apex Holdings LLC', amount: 3750000, rate: 8.00, stage: 'watch_list', risk_score: 41 },
      ];
      board.origination = [
        { id: 'demo-5', borrower: 'Crestview Investments', amount: 11000000, rate: 7.00, stage: 'origination', risk_score: 78 },
      ];
      board.closing = [
        { id: 'demo-6', borrower: 'Pinnacle RE Fund', amount: 6800000, rate: 6.90, stage: 'closing', risk_score: 69 },
      ];
      res.json({ stages: STAGES, board, fallback: true });
    }
  });

  // ── POST /api/lifecycle/:loanId/transition ───────────────────────────────────
  router.post('/:loanId/transition', async (req, res) => {
    try {
      const { loanId } = req.params;
      const { to_stage, reason, triggered_by = 'manual', created_by } = req.body;

      if (!to_stage) return res.status(400).json({ error: 'to_stage is required' });
      if (!STAGES.find(s => s.id === to_stage)) return res.status(400).json({ error: 'Invalid stage' });

      // Get current loan
      const { data: loan, error: loanErr } = await supabase
        .from('loans').select('id, status, borrower_name').eq('id', loanId).single();

      let from_stage = null;
      if (!loanErr && loan) {
        from_stage = loan.status?.toLowerCase().replace(/\s+/g, '_') ?? null;
        // Validate transition
        if (from_stage && VALID_TRANSITIONS[from_stage] && !VALID_TRANSITIONS[from_stage].includes(to_stage)) {
          return res.status(422).json({
            error: `Invalid transition: ${from_stage} → ${to_stage}`,
            valid_transitions: VALID_TRANSITIONS[from_stage] || []
          });
        }
        // Update loan status
        await supabase.from('loans').update({ status: to_stage }).eq('id', loanId);
      }

      // Record event
      const { data: event, error: evtErr } = await supabase.from('loan_lifecycle_events').insert({
        loan_id: loanId,
        from_stage,
        to_stage,
        reason: reason || null,
        triggered_by,
        created_by: created_by || null,
      }).select().single();

      if (evtErr) return res.status(500).json({ error: evtErr.message });
      res.status(201).json({ event, loan_id: loanId, from_stage, to_stage });
    } catch (err) {
      console.error('[lifecycle] transition error:', err);
      res.status(500).json({ error: 'Transition failed' });
    }
  });

  // ── GET /api/lifecycle/:loanId/history ──────────────────────────────────────
  router.get('/:loanId/history', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('loan_lifecycle_events')
        .select('*')
        .eq('loan_id', req.params.loanId)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data ?? []);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  });

  // ── GET /api/lifecycle/stats ─────────────────────────────────────────────────
  router.get('/stats', async (req, res) => {
    try {
      const { data: loans } = await supabase.from('loans').select('status, amount');
      const stats = {};
      STAGES.forEach(s => { stats[s.id] = { count: 0, total_amount: 0 }; });
      (loans ?? []).forEach(l => {
        const stage = l.status?.toLowerCase().replace(/\s+/g, '_') ?? 'active';
        const key = stats[stage] ? stage : 'active';
        stats[key].count++;
        stats[key].total_amount += Number(l.amount) || 0;
      });
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  module.exports = router;
  