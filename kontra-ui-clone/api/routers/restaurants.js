const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// List restaurants (organizations)
router.get('/restaurants', async (_req, res) => {
  const { data, error } = await supabase.from('organizations').select('*');
  if (error) return res.status(500).json({ message: 'Failed to fetch restaurants' });
  res.json({ restaurants: data });
});

// Register a new restaurant
router.post('/restaurants', async (req, res) => {
  const { name, branding } = req.body || {};
  if (!name) return res.status(400).json({ message: 'Missing name' });
  const { data, error } = await supabase
    .from('organizations')
    .insert([{ name, branding }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create restaurant' });
  res.status(201).json({ restaurant: data });
});

module.exports = router;
