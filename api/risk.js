const express = require('express');
const predictAssetRisk = require('../edge-functions/predictAssetRisk');
const predictTroubledRisk = require('../edge-functions/predictTroubledRisk');

const router = express.Router();

router.post('/run', async (req, res) => {
  try {
    await predictAssetRisk();
    await predictTroubledRisk();
    res.json({ message: 'Risk scripts executed' });
  } catch (err) {
    console.error('Risk run error:', err);
    res.status(500).json({ message: 'Failed to run risk scripts' });
  }
});

module.exports = router;
