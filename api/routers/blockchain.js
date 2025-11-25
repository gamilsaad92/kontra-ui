const express = require('express');
const { describeContracts } = require('../services/blockchainContracts');
const {
  getPortfolioSnapshot,
  listTransactions,
  recordCashflow,
  recordTransaction,
} = require('../services/blockchainLedger');

const router = express.Router();

router.get('/blockchain/contracts', (_req, res) => {
  res.json(describeContracts());
});

router.get('/blockchain/overview', async (req, res) => {
  const { wallet } = req.query;
  const snapshot = await getPortfolioSnapshot(wallet);
  res.json(snapshot);
});

router.get('/blockchain/transactions', async (req, res) => {
  const { wallet } = req.query;
  const transactions = await listTransactions(wallet);
  res.json({ transactions });
});

router.post('/blockchain/transactions', async (req, res) => {
  const payload = req.body || {};
  if (!payload.wallet) {
    return res.status(400).json({ message: 'wallet is required' });
  }

  const transaction = await recordTransaction(payload);
  res.status(201).json({ transaction });
});

router.post('/blockchain/cashflows', async (req, res) => {
  const payload = req.body || {};
  if (!payload.loanId) {
    return res.status(400).json({ message: 'loanId is required' });
  }

  const cashflow = await recordCashflow(payload);
  res.status(201).json({ cashflow });
});

module.exports = { router };
