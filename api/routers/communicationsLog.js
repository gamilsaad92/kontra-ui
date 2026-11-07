const express = require('express');
const { dispatchPortfolioCampaign } = require('../communications');
const { supabase } = require('../db');
const authenticate = require('../middlewares/authenticate');
const { isAuthenticatedTenantMember } = require('../lib/tenantEmailAuthorization');

const router = express.Router();
const logs = {};
const recent = [];

function addLog({ loanId, message, type = 'note', channel = 'note', status = 'logged', metadata }) {
  const entry = {
    message,
    type,
    channel,
    status,
    date: new Date().toISOString(),
    metadata: metadata || {},
  };

  const key = loanId || 'unassigned';
  if (!logs[key]) logs[key] = [];
  logs[key].push(entry);

  recent.push({ loanId: key, ...entry });
  if (recent.length > 50) recent.shift();
  return entry;
}

// Get communications log for a loan
router.get('/loans/:loanId/communications', (req, res) => {
  const { loanId } = req.params;
  res.json({ communications: logs[loanId] || [] });
});

// Add a communication entry
router.post('/loans/:loanId/communications', (req, res) => {
  const { loanId } = req.params;
  const { message, type } = req.body || {};
  if (!message) {
    return res.status(400).json({ message: 'message required' });
  }
  const entry = addLog({ loanId, message, type });
  res.json({ entry });
});

// Trigger a communication campaign from a portfolio event
router.post('/send-communication', authenticate, async (req, res) => {
  const { loanId, event = {}, channels } = req.body || {};
  if (!req.orgId || !loanId) return res.status(400).json({ message: 'Organization and loan are required' });

  try {
    if (!await isAuthenticatedTenantMember(supabase, req)) {
      return res.status(403).json({ message: 'Organization access denied' });
    }
    const { data: loan, error } = await supabase.from('loans')
      .select('id, borrower_name, borrower_email, borrower_phone')
      .eq('id', loanId)
      .eq('organization_id', req.orgId)
      .maybeSingle();
    if (error) return res.status(500).json({ message: 'Unable to verify loan ownership' });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    const borrower = {
      name: loan.borrower_name,
      email: loan.borrower_email,
      phone: loan.borrower_phone,
    };
    if (!borrower.email && !borrower.phone) {
      return res.status(400).json({ message: 'This loan has no verified contact method' });
    }
    const campaign = await dispatchPortfolioCampaign({ loanId, borrower, event, channels });
    const preview = campaign.emailText || campaign.smsText || 'Campaign sent';
    const entry = addLog({
      loanId,
      message: preview.slice(0, 500),
      type: campaign.eventName,
      channel: (campaign.channelsUsed || []).join(', ') || 'campaign',
      status: 'sent',
      metadata: { event, campaign },
    });
    res.json({ campaign, entry });
  } catch (err) {
    const entry = addLog({
      loanId,
      message: `Campaign failed: ${err.message}`,
      type: event.name || 'portfolio_event',
      channel: 'campaign',
      status: 'error',
    });
    res.status(500).json({ message: 'Failed to dispatch communication', error: err.message, entry });
  }
});

// Aggregate log view for dashboard widgets
router.get('/communications/logs', (_req, res) => {
  res.json({ communications: recent.slice().reverse() });
});

module.exports = router;
