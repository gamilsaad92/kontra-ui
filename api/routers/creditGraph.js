const express = require('express');
const { autonomousCreditGraph } = require('../autonomousCreditGraph');

const router = express.Router();

router.post('/ingest', (req, res) => {
  const { borrowers = [], assets = [], covenants = [], telemetry = [] } = req.body || {};
  if (!borrowers.length && !assets.length && !covenants.length && !telemetry.length) {
    return res.status(400).json({ error: 'At least one borrower, asset, covenant, or telemetry payload is required.' });
  }

  try {
    borrowers.forEach(borrower => autonomousCreditGraph.upsertBorrower(borrower));
    assets.forEach(asset => autonomousCreditGraph.upsertAsset(asset));
    covenants.forEach(covenant => autonomousCreditGraph.upsertCovenant(covenant));
    telemetry.forEach(event => autonomousCreditGraph.ingestTelemetry(event));

    const fabric = autonomousCreditGraph.getDecisionFabric();
    res.json({ status: 'ingested', fabric });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/snapshot', (_req, res) => {
  const fabric = autonomousCreditGraph.getDecisionFabric();
  res.json(fabric);
});

router.get('/borrowers/:id', (req, res) => {
  const summary = autonomousCreditGraph.getBorrowerSummary(req.params.id);
  if (!summary) {
    return res.status(404).json({ error: 'Borrower not found in knowledge graph.' });
  }
  res.json(summary);
});

router.post('/feedback', (req, res) => {
  const { borrowerId, signal, direction, magnitude, notes } = req.body || {};
  if (!borrowerId || !signal || !direction) {
    return res.status(400).json({ error: 'borrowerId, signal, and direction are required.' });
  }

  try {
    const response = autonomousCreditGraph.applyFeedback({ borrowerId, signal, direction, magnitude, notes });
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
