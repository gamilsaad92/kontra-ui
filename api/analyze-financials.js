const express = require('express');
const { buildAnalysis, summarizeStatement } = require('./services/financialsAnalysis');

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { statement = '' } = req.body || {};
    const summary = summarizeStatement(statement);
  res.json({ analysis: buildAnalysis(summary) });
  } catch (err) {
    console.error('Financial analysis error:', err);
    res.json({
      analysis: 'Unable to analyze the statement right now. Try again later or verify the data format.'
    });
  }
});

module.exports = router;
