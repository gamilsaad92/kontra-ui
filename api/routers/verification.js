/**
 * routers/verification.js — Verification status API endpoints
 *
 * GET  /api/public/deal-room/:propertyId/verification        — full append-only history log
 * GET  /api/public/deal-room/:propertyId/verification/status — latest-per-check summary + bySection badges
 * POST /api/public/deal-room/:propertyId/verification/run    — manually trigger re-run
 */

const express = require('express');
const router = express.Router();
const { runVerification, getVerificationStatus, getFullVerificationLog } = require('../lib/verificationEngine');
const { getRoomPackId } = require('../lib/dealRoomHelpers');

// ── Full append-only history log (all check rows, all runs) ──────────────────
router.get('/deal-room/:propertyId/verification', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const { runs, summary } = await getFullVerificationLog(propertyId);
    res.set('Cache-Control', 'no-store');
    res.json({ runs, summary });
  } catch (err) {
    console.error('[verification-log]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Badge-friendly status — latest check per check_type + per-section map ────
router.get('/deal-room/:propertyId/verification/status', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const { results, summary } = await getVerificationStatus(propertyId);

    // Build per-section badge map.
    // Escalation priority: discrepancy > pending_review > verified > (unset)
    // Bug-fix: initialize to null so that verified checks can actually land.
    const bySection = {};
    for (const r of results) {
      for (const sec of [r.doc_section_a, r.doc_section_b].filter(Boolean)) {
        if (!bySection[sec]) bySection[sec] = { status: null, checks: [] };
        const cur = bySection[sec].status;
        if (r.status === 'discrepancy') {
          bySection[sec].status = 'discrepancy';
        } else if (r.status === 'pending_review' && cur !== 'discrepancy') {
          bySection[sec].status = 'pending_review';
        } else if (r.status === 'verified' && cur == null) {
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

    // Fallback: any section that ended with status=null (only pending checks
    // exist and every one was already overridden) → pending_review
    for (const sec of Object.keys(bySection)) {
      if (!bySection[sec].status) bySection[sec].status = 'pending_review';
    }

    res.set('Cache-Control', 'no-store');
    res.json({ summary, bySection });
  } catch (err) {
    console.error('[verification-status]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Manually re-trigger verification ─────────────────────────────────────────
router.post('/deal-room/:propertyId/verification/run', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const packId = await getRoomPackId(propertyId);
    runVerification(propertyId, packId).catch(e => console.warn('[verification-run]', e.message));
    res.json({ ok: true, message: 'Verification started in background' });
  } catch (err) {
    console.error('[verification-run]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
