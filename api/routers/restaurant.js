const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Minimal Menu CRUD ---------------------------------------------------------
router.post('/menu/items', async (req, res) => {
  const { name, price, description } = req.body || {};
  if (!name || !price) {
    return res.status(400).json({ message: 'Missing name or price' });
  }
  const { data, error } = await supabase
    .from('menu_items')
    .insert([{ name, price, description }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create item' });
  res.status(201).json({ item: data });
});

router.get('/menu/items', async (_req, res) => {
  const { data, error } = await supabase.from('menu_items').select('*');
  if (error) return res.status(500).json({ message: 'Failed to fetch items' });
  res.json({ items: data });
});

// Orders --------------------------------------------------------------------
router.post('/orders', async (req, res) => {
  const { table, items } = req.body || {};
  if (!table || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Missing table or items' });
  }
  const { data, error } = await supabase
    .from('orders')
    .insert([{ table, items, status: 'pending', created_at: new Date().toISOString() }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create order' });
  res.status(201).json({ order: data });
});

router.patch('/orders/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ message: 'Missing status' });
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update order' });
  res.json({ order: data });
});

// QR Payment ---------------------------------------------------------------
router.post('/payments/qr', async (req, res) => {
  const { amount, order_id } = req.body || {};
  if (!amount) return res.status(400).json({ message: 'Missing amount' });
  const sessionId = uuidv4();
  await supabase
    .from('payment_sessions')
    .insert([{ id: sessionId, amount, order_id, status: 'pending', created_at: new Date().toISOString() }]);
  const url = `${process.env.PAYMENT_BASE_URL}/pay/${sessionId}`;
  try {
    const qr = await QRCode.toDataURL(url);
    res.status(201).json({ session_id: sessionId, qr });
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ message: 'Failed to generate QR' });
  }
});

module.exports = router;
