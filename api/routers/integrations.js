const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const allowedIntegrations = [
  'quickbooks',
  'yardi',
  'procore',
  'toast',
  'square',
  'xero'
];

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

router.get('/integrations', async (req, res) => {
  const { data, error } = await supabase
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
  res.json({ integrations });
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
  res.json({ message: `${name} connected` });
});
module.exports = { router };
