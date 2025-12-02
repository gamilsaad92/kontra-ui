const express = require('express');
const { dispatchPortfolioCampaign } = require('../communications');

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
router.post('/send-communication', async (req, res) => {
  const { loanId, borrower = {}, event = {}, channels } = req.body || {};
  if (!borrower.email && !borrower.phone && !borrower.user_id && !borrower.pushToken) {
    return res.status(400).json({ message: 'A borrower email, phone, push token, or user id is required' });
  }

  try {
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
