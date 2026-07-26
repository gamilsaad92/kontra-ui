// routers/operationsManager.js — AI Operations Manager (answer engine)
//
// Mounted at /api/public/deal-room/:propertyId/brain* alongside the rest of
// the property-scoped public deal-room routes. Read-only: this surface never
// mutates deal_room_tasks — it only reasons over what the Task Engine already
// created. See lib/operationsManager.js and .agents/memory/kontra-task-architecture.md.
const express = require('express');
const router = express.Router();
const { getBriefing, askQuestion } = require('../lib/operationsManager');

router.get('/deal-room/:propertyId/brain/briefing', async (req, res) => {
  try {
    const briefing = await getBriefing(req.params.propertyId);
    res.json(briefing);
  } catch (err) {
    console.error('[operationsManager] briefing failed:', err.message);
    res.status(500).json({ error: 'Failed to load briefing' });
  }
});

router.post('/deal-room/:propertyId/brain/ask', async (req, res) => {
  try {
    const { question } = req.body || {};
    const result = await askQuestion(req.params.propertyId, question);
    res.json(result);
  } catch (err) {
    console.error('[operationsManager] ask failed:', err.message);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

module.exports = router;
