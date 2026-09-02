const express = require('express');
const router = express.Router();
const {
  getVerificationState,
  runVerification,
} = require('../lib/verificationEngine');

router.get('/deal-room/:propertyId/verification', async (req, res) => {
  try {
    const state = await getVerificationState(req.params.propertyId);
    res.set('Cache-Control', 'no-store');
    res.json(state);
  } catch (error) {
    console.error('[verification GET]', error.message);
    res.status(500).json({ error: 'Could not load verification checks' });
  }
});

router.post('/deal-room/:propertyId/verification/run', async (req, res) => {
  try {
    const state = await runVerification(req.params.propertyId, req.body?.packId || null);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, ...state });
  } catch (error) {
    console.error('[verification POST]', error.message);
    res.status(500).json({ error: 'Could not run verification checks' });
  }
});

module.exports = router;
