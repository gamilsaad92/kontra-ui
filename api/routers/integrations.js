const express = require('express');
const { supabase, replica } = require('../db');
const cache = require('../cache');

const allowedIntegrations = [
  'quickbooks',
  'yardi',
  'procore',
  'toast',
  'square',
  'xero'
];

const router = express.Router();

router.get('/integrations', async (req, res) => {
  const cached = await cache.get('integrations:list');
  if (cached) return res.json(cached);

  const { data, error } = await replica
    .from('integration_statuses')
    .select('name, connected');
  if (error) {
    console.error('List integrations error:', error);
    return res.status(500).json({ message: 'Failed to fetch integrations' });
  }
  const integrations = Object.fromEntries(
    allowedIntegrations.map(name => {
      const row = data.find(r => r.name === name);
      return [name, row ? row.connected : false];
    })
  );
  const payload = { integrations };
  await cache.set('integrations:list', payload, 120);
  res.json(payload);
});

router.post('/integrations/:name/connect', async (req, res) => {
  const { name } = req.params;
    if (!allowedIntegrations.includes(name)) {
    return res.status(400).json({ message: 'Unknown integration' });
  }
    const { error } = await supabase
    .from('integration_statuses')
    .upsert({ name, connected: true, updated_at: new Date().toISOString() }, { onConflict: 'name' });
  if (error) {
    console.error('Connect integration error:', error);
    return res.status(500).json({ message: 'Failed to connect integration' });
  }
  await cache.del('integrations:list');
  res.json({ message: `${name} connected` });
});
module.exports = { router };
