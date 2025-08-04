const express = require('express');
const { addJob } = require('../jobQueue');

const router = express.Router();

router.post('/run', (req, res) => {
  const results = [];

  try {
    addJob('score-assets');
    results.push({ script: 'predictAssetRisk', status: 'queued' });
  } catch (err) {
    console.error('Failed to enqueue predictAssetRisk:', err);
    results.push({ script: 'predictAssetRisk', status: 'error', error: err.message });
  }

  try {
    addJob('score-troubled');
    results.push({ script: 'predictTroubledRisk', status: 'queued' });
  } catch (err) {
    console.error('Failed to enqueue predictTroubledRisk:', err);
    results.push({ script: 'predictTroubledRisk', status: 'error', error: err.message });
  }

  res.json({ message: 'Risk scripts enqueued', results });  
});

module.exports = router;
