const express = require('express');

const router = express.Router();
const disbursementsByLoan = {};

router.get('/loans/:loanId/escrow/disbursements', (req, res) => {
  const { loanId } = req.params;
  const list = disbursementsByLoan[loanId] || [];
  res.json({ disbursements: list });
});

router.post('/loans/:loanId/escrow/disbursements', (req, res) => {
  const { loanId } = req.params;
  const { amount, payee, date } = req.body || {};
  if (typeof amount !== 'number' || !payee) {
    return res.status(400).json({ message: 'Missing amount or payee' });
  }
  const disb = { amount, payee, date: date || new Date().toISOString() };
  const list = disbursementsByLoan[loanId] || (disbursementsByLoan[loanId] = []);
  list.push(disb);
  res.status(201).json({ disbursement: disb });
});

module.exports = router;
