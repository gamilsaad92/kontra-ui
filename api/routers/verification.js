/**
 * routers/verification.js — Verification status API endpoints
 *
 * GET  /api/public/deal-room/:propertyId/verification        — full log
 * GET  /api/public/deal-room/:propertyId/verification/status — summary + per-check badges
 * POST /api/public/deal-room/:propertyId/verification/run    — manually trigger re-run
 */

const express = require('express');
const router = express.Router();
const { runVerification, getVerificationStatus } = require('../lib/verificationEngine');
const { getRoomPackId } = require('../lib/dealRoomHelpers');

// Full verification log for a deal room
router.get('/deal-room/:propertyId/verification', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const { results, summary } = await getVerificationStatus(propertyId);
    res.set('Cache-Control', 'no-store');
    res.json({ results, summary });
  } catch (err) {
    console.error('[verification-log]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Badge-friendly summary — per-section status
router.get('/deal-room/:propertyId/verification/status', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const { results, summary } = await getVerificationStatus(propertyId);

    // Build per-section badge index
    const bySection = {};
    for (const r of results) {
      // Associate each check with both sections it covers
      for (const sec of [r.doc_section_a, r.doc_section_b].filter(Boolean)) {
        if (!bySection[sec]) bySection[sec] = { status: 'pending_review', checks: [] };
        // Escalate: discrepancy > pending > verified
        if (r.status === 'discrepancy') bySection[sec].status = 'discrepancy';
        else if (r.status === 'pending_review' && bySection[sec].status !== 'discrepancy') {
          bySection[sec].status = 'pending_review';
        } else if (r.status === 'verified' && bySection[sec].status !== 'discrepancy' && bySection[sec].status !== 'pending_review') {
          bySection[sec].status = 'verified';
        }
        bySection[sec].checks.push({
          check_type: r.check_type,
          status: r.status,
          badge_label: r.badge_label,
          description: r.description,
          severity: r.severity,
          value_a: r.value_a,
          value_b: r.value_b,
          delta_pct: r.delta_pct,
        });
      }
    }

    res.set('Cache-Control', 'no-store');
    res.json({ summary, bySection });
  } catch (err) {
    console.error('[verification-status]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Manually re-trigger verification (e.g. from deal room UI)
router.post('/deal-room/:propertyId/verification/run', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const packId = await getRoomPackId(propertyId);
    // Run in background — respond immediately
    runVerification(propertyId, packId).catch(e => console.warn('[verification-run]', e.message));
    res.json({ ok: true, message: 'Verification started in background' });
  } catch (err) {
    console.error('[verification-run]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
