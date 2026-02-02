const express = require('express');
const multer = require('multer');
const { buildAnalysis, summarizeStatement } = require('../services/financialsAnalysis');
const authenticate = require('../middlewares/authenticate');
const requireOrg = require('../middlewares/requireOrg');
const {
  ingestPaymentFile,
  getCashflowHistory,
  buildRemittanceSummary,
  updateNetAssetValue,
  calculateDistributionForPeriod,
} = require('../services/servicing');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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
    const { distribution } = calculateDistributionForPeriod(poolId, period);
    
    return res.status(201).json({
      ingested: ingested.length,
      remittance_summary,
      cashflows,
      distribution,
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
    const { remittance_summary, distribution } = calculateDistributionForPeriod(poolId, period);
    return res.json({ remittance_summary, distribution });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

router.post('/servicing/pools/:poolId/nav', (req, res) => {
  const { poolId } = req.params;
  const { nav_amount: navAmount, nav, period, as_of: asOf } = req.body || {};
  const resolvedNav = navAmount ?? nav;

  try {
    const navRecord = updateNetAssetValue({ poolId, navAmount: resolvedNav, period, asOf });
    const { remittance_summary, distribution } = calculateDistributionForPeriod(
      poolId,
      period || navRecord.period
    );

    return res.status(201).json({ nav: navRecord, remittance_summary, distribution });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

router.post('/servicing/financials/analyze', upload.single('file'), (req, res) => {
  console.info('[servicing] Financial analysis endpoint hit.');

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Financial file upload required.' });
    }

   const { originalname, size, mimetype, buffer } = req.file;
    let analysis = null;
    let notice = null;

    if (buffer && buffer.length) {
      const textSample = buffer.slice(0, Math.min(buffer.length, 8000)).toString('utf8');
      const nonPrintableCount = textSample.replace(/[\t\n\r\x20-\x7E]/g, '').length;
      const nonPrintableRatio = textSample.length
        ? nonPrintableCount / textSample.length
        : 1;

      if (nonPrintableRatio <= 0.2) {
        const summary = summarizeStatement(textSample);
        analysis = buildAnalysis(summary);
      } else {
        notice = 'Uploaded file received, but only text-based statements are supported for analysis.';
      }
    } else {
      notice = 'Uploaded file received, but the statement could not be read for analysis.';
    }
    
    return res.status(201).json({
      filename: originalname,
      size,
      mimetype,
      status: 'received',
      analysis,
      notice
    });
  } catch (err) {
    console.error('[servicing] Financial analysis failed.', err);
    return res.status(500).json({
      message: 'Financial analysis failed.',
      details: err.message,
    });
  }
});

router.get('/servicing/pools/:poolId/distribution/:period', (req, res) => {
  const { poolId, period } = req.params;

  try {
    const { remittance_summary, distribution } = calculateDistributionForPeriod(poolId, period);
    return res.json({ remittance_summary, distribution });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;
