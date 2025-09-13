const express = require('express');
const {
  listWebhooks,
  addWebhook,
  removeWebhook,
  WEBHOOK_TOPICS
} = require('../webhooks');

const router = express.Router();

router.get('/webhooks', async (req, res) => {
  const hooks = await listWebhooks();
  res.json({ webhooks: hooks });
});

router.post('/webhooks', async (req, res) => {
  const { event, url } = req.body || {};
  if (!event || !url) return res.status(400).json({ message: 'Missing event or url' });
  await addWebhook(event, url);
  res.status(201).json({ message: 'Webhook registered' });
});

router.delete('/webhooks', async (req, res) => {
  const { event, url } = req.body || {};
  if (!event || !url) return res.status(400).json({ message: 'Missing event or url' });
  await removeWebhook(event, url);
  res.json({ message: 'Webhook removed' });
});

router.get('/webhooks/topics', (req, res) => {
  res.json({ topics: WEBHOOK_TOPICS });
});

module.exports = router;
