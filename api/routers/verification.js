/**
 * Verification router stub.
 * Full implementation lives in verificationEngine; this exposes the HTTP surface.
 */
const express = require('express');
const router = express.Router();

// Placeholder — verification results are currently served via the VAP endpoint.
// This stub keeps index.js from crashing while the full engine is wired up.
router.get('/deal-room/:propertyId/verification', (req, res) => {
  res.json({ status: 'pending', message: 'Verification engine not yet active for this room.' });
});

module.exports = router;
