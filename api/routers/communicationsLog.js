const express = require('express');

const router = express.Router();
const logs = {};

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
  const entry = { message, type: type || 'note', date: new Date().toISOString() };
  if (!logs[loanId]) logs[loanId] = [];
  logs[loanId].push(entry);
  res.json({ entry });
});

module.exports = router;
