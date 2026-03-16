const express = require('express');
const authenticate = require('../middlewares/authenticate');
const {
  listWebhooks,
  addWebhook,
  removeWebhook,
  WEBHOOK_TOPICS
} = require('../webhooks');

const router = express.Router();

router.use(authenticate);

function isValidEvent(event) {
  return typeof event === 'string' && WEBHOOK_TOPICS.includes(event);
}

function isValidUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (err) {
    return false;
  }
}

router.get('/webhooks', async (req, res) => {
  const hooks = await listWebhooks();
  res.json({ webhooks: hooks });
});

router.post('/webhooks', async (req, res) => {
  const { event, url } = req.body || {};
  if (!event || !url) return res.status(400).json({ message: 'Missing event or url' });
  if (!isValidEvent(event)) return res.status(400).json({ message: 'Invalid event topic' });
  if (!isValidUrl(url)) return res.status(400).json({ message: 'Invalid webhook URL' });
  await addWebhook(event, url);
  res.status(201).json({ message: 'Webhook registered' });
});

router.delete('/webhooks', async (req, res) => {
  const { event, url } = req.body || {};
  if (!event || !url) return res.status(400).json({ message: 'Missing event or url' });
  if (!isValidEvent(event)) return res.status(400).json({ message: 'Invalid event topic' });
  if (!isValidUrl(url)) return res.status(400).json({ message: 'Invalid webhook URL' });
  await removeWebhook(event, url);
  res.json({ message: 'Webhook removed' });
});

router.get('/webhooks/topics', (req, res) => {
  res.json({ topics: WEBHOOK_TOPICS });
});

module.exports = router;
