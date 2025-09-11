const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { supabase } = require('../db');

const router = express.Router();

router.use(authenticate);

// List all marketplace entries
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('trade_marketplace')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    return res.status(500).json({ message: 'Failed to list marketplace entries' });
  }
  res.json({ entries: data || [] });
});

// Submit a bid or ask
router.post('/', async (req, res) => {
  const { type, symbol, quantity, price } = req.body || {};
  if (!['bid', 'ask'].includes(type) || !symbol || quantity === undefined || price === undefined) {
    return res.status(400).json({ message: 'Missing type, symbol, quantity or price' });
  }
  const { data, error } = await supabase
    .from('trade_marketplace')
    .insert([{ type, symbol, quantity, price, investor_id: req.user.id }])
    .select()
    .single();
  if (error) {
    return res.status(500).json({ message: 'Failed to create entry' });
  }
  res.status(201).json({ entry: data });
});

module.exports = router;
