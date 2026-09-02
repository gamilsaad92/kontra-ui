const express = require('express');
const authenticate = require('../middlewares/authenticate');
const requireOrg = require('../middlewares/requireOrg');
const { orgContext } = require('../middleware/orgContext');
const { supabase } = require('../db');
const { getLoanServicingSnapshot } = require('../services/insightsComposer');
const { evaluateServicingExceptions } = require('../services/servicingRules');
const { generateLoanInsights, buildWatchlistDraft, buildEmailDraft } = require('../services/ai/loanInsightsAI');

const router = express.Router();

router.use(authenticate);

function parseRangeDays(range) {
  if (!range) return 30;
  const match = String(range).trim().match(/(\d+)/);
  if (!match) return 30;
  const value = parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : 30;
}

async function storeDraft({ loanId, type, subject, body, userId }) {
  try {
    const { data, error } = await supabase
      .from('drafts')
      .insert([
        {
          loan_id: loanId,
          type,
          subject: subject || null,
          body: body || null,
          created_by: userId || null,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      return null;
    }
    return data;
  } catch (error) {
    return null;
  }
}

router.get('/loans/:loanId/insights', orgContext, async (req, res) => {
  const { loanId } = req.params;
 const snapshot = await getLoanServicingSnapshot(loanId, req.orgId);
  if (!snapshot?.loan) {
    return res.status(404).json({ message: 'Loan not found' });
  }

  const exceptions = evaluateServicingExceptions(snapshot);
  const insights = await generateLoanInsights(snapshot, exceptions, { useOpenAI: true });

  res.json({
    summary: insights.summary,
    key_metrics: snapshot.metrics,
    exceptions,
    recommended_actions: insights.recommended_actions,
    confidence: insights.confidence
  });
});

router.get('/servicing/insights', orgContext, async (req, res) => {
  const rangeDays = parseRangeDays(req.query.range);
  const orgId = req.orgId;

  const { data: loans, error } = await supabase
    .from('loans')
    .select('id, loan_number, borrower_name, status, maturity_date, asset_id, organization_id')
    .eq('organization_id', orgId)
    .limit(50);

  if (error) {
    return res.status(500).json({ message: 'Failed to load servicing insights' });
  }

  const snapshots = await Promise.all(
    (loans || []).map(async (loan) => {
      const snapshot = await getLoanServicingSnapshot(loan.id, orgId);
      const exceptions = evaluateServicingExceptions(snapshot);
      return { loan, snapshot, exceptions };
    })
  );

  const needsAttention = snapshots
    .filter((entry) => entry.exceptions.length > 0)
    .sort((a, b) => b.exceptions.length - a.exceptions.length)
    .slice(0, 10)
    .map((entry) => ({
      loan_id: entry.loan.id,
      loan_number: entry.loan.loan_number,
      borrower_name: entry.loan.borrower_name,
      exceptions: entry.exceptions
    }));

  const overdueItems = snapshots
    .filter((entry) => entry.exceptions.some((ex) => ex.code === 'PAYMENT_LATE'))
    .map((entry) => ({
      loan_id: entry.loan.id,
      borrower_name: entry.loan.borrower_name,
      last_payment_date: entry.snapshot.payments?.[0]?.date || null
    }));

  const maturitySoon = snapshots
    .filter((entry) => entry.exceptions.some((ex) => ex.code === 'MATURITY_SOON'))
    .map((entry) => ({
      loan_id: entry.loan.id,
      borrower_name: entry.loan.borrower_name,
      maturity_date: entry.loan.maturity_date
    }));

  const escrowShortfalls = snapshots
    .filter((entry) => entry.exceptions.some((ex) => ex.code === 'ESCROW_SHORTFALL'))
    .map((entry) => ({
      loan_id: entry.loan.id,
      borrower_name: entry.loan.borrower_name,
      escrow_balance: entry.snapshot.metrics?.escrow_balance ?? null
    }));

  const drawBottlenecks = snapshots
    .flatMap((entry) =>
      (entry.snapshot.draws || []).map((draw) => ({
        loan_id: entry.loan.id,
        borrower_name: entry.loan.borrower_name,
        draw_id: draw.id,
        status: draw.status,
        submitted_at: draw.submitted_at
      }))
    )
    .filter((draw) => draw.submitted_at)
    .filter((draw) => {
      const submitted = new Date(draw.submitted_at);
      const ageDays = (Date.now() - submitted.getTime()) / (1000 * 60 * 60 * 24);
      return ageDays > 14;
    });

  const { data: hazardLosses } = await supabase
    .from('hazard_losses')
    .select('id, draw_id, created_at, restoration')
    .is('restoration', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const hazardLossDelays = (hazardLosses || []).filter((loss) => {
    const created = new Date(loss.created_at);
    const ageDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > rangeDays;
  });

  const summary = `Servicing review covers ${snapshots.length} loans. ${needsAttention.length} loans need attention, ${overdueItems.length} overdue items, and ${maturitySoon.length} maturities within ${rangeDays} days.`;

  res.json({
    summary,
    needs_attention: needsAttention,
    overdue_items: overdueItems,
    maturity_soon: maturitySoon,
    escrow_shortfalls: escrowShortfalls,
    hazard_loss_delays: hazardLossDelays,
    draw_bottlenecks: drawBottlenecks
  });
});

router.post('/loans/:loanId/insights/draft-watchlist', requireOrg, async (req, res) => {
  const { loanId } = req.params;
  const snapshot = await getLoanServicingSnapshot(loanId, req.orgId || req.organizationId);
  if (!snapshot?.loan) {
    return res.status(404).json({ message: 'Loan not found' });
  }

  const exceptions = evaluateServicingExceptions(snapshot);
  const draft = buildWatchlistDraft(snapshot, exceptions);
  const stored = await storeDraft({
    loanId,
    type: 'draft_watchlist',
    subject: null,
    body: draft.text,
    userId: req.user?.id
  });

  res.json({
    watchlist_comment: draft.text,
    evidence_references: draft.evidence,
    stored
  });
});

router.post('/loans/:loanId/insights/draft-email', requireOrg, async (req, res) => {
  const { loanId } = req.params;
  const { purpose } = req.body || {};
  const snapshot = await getLoanServicingSnapshot(loanId, req.orgId || req.organizationId);
  if (!snapshot?.loan) {
    return res.status(404).json({ message: 'Loan not found' });
  }

  const draft = buildEmailDraft(snapshot, purpose);
  const stored = await storeDraft({
    loanId,
    type: 'draft_email',
    subject: draft.subject,
    body: draft.body,
    userId: req.user?.id
  });

  res.json({
    subject: draft.subject,
    body: draft.body,
    checklist: draft.checklist,
    stored
  });
});

module.exports = router;
