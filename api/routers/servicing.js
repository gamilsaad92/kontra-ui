const express = require('express');
const authenticate = require('../middlewares/authenticate');
const requireOrg = require('../middlewares/requireOrg');
const {
  ingestPaymentFile,
  getCashflowHistory,
  buildRemittanceSummary,
} = require('../services/servicing');

const router = express.Router();

router.use(authenticate);
router.use(requireOrg);

router.get('/escrows/upcoming', (req, res) => {
  return res.status(200).json({
    upcoming: [
      { type: 'tax', due_date: '2024-01-01', amount: 1200 },
       { type: 'insurance', due_date: '2024-06-01', amount: 800 },
    ],
  });
});

router.post('/loans/:id/escrow/pay', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid loan id' });
  const { type, amount } = req.body || {};
  if (!type || !amount) {
    return res.status(400).json({ message: 'type and amount required' });
  }
  res.json({ message: 'Payment processed' });
});

router.get('/loans/:id/escrow/projection', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid loan id' });
  const projection = Array.from({ length: 12 }).map((_, i) => ({
    month: i + 1,
    tax: 100,
     insurance: 80,
  }));
  res.json({ projection });
});

router.post('/servicing/pools/:poolId/payments/import', (req, res) => {
  const { poolId } = req.params;
  const { period, rows, file_content: fileContent, filename } = req.body || {};

  if (!period) {
    return res.status(400).json({ message: 'period is required' });
  }

  try {
    const ingested = ingestPaymentFile({
      poolId,
      orgId: req.orgId,
      period,
      rows,
      fileContent,
      filename,
    });

    const remittance_summary = buildRemittanceSummary(poolId, period);
    const cashflows = getCashflowHistory(poolId, { period });

    return res.status(201).json({
      ingested: ingested.length,
      remittance_summary,
      cashflows,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

router.get('/servicing/pools/:poolId/cashflows', (req, res) => {
  const { poolId } = req.params;
  const { loan_id: loanId, period } = req.query;
  const cashflows = getCashflowHistory(poolId, { loanId, period });
  return res.json({ cashflows });
});

router.get('/servicing/pools/:poolId/remittance/:period', (req, res) => {
  const { poolId, period } = req.params;
  try {
    const remittance_summary = buildRemittanceSummary(poolId, period);
    return res.json({ remittance_summary });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;
