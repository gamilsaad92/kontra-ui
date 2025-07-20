const express = require('express');
const { webhooks } = require('../webhooks');

const router = express.Router();

router.get('/webhooks', (req, res) => {
  res.json({ webhooks });
});

router.post('/webhooks', (req, res) => {
  const { event, url } = req.body || {};
  if (!event || !url) return res.status(400).json({ message: 'Missing event or url' });
  webhooks.push({ event, url });
  res.status(201).json({ message: 'Webhook registered' });
});

router.delete('/webhooks', (req, res) => {
  const { event, url } = req.body || {};
  const index = webhooks.findIndex(w => w.event === event && w.url === url);
  if (index !== -1) webhooks.splice(index, 1);
  res.json({ message: 'Webhook removed' });
});

module.exports = router;
