const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// initialize your Supabase client (or import it if you have a shared lib)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/dashboard-layout?key=home
router.get('/', async (req, res) => {
  const userId = req.user.id;                        // make sure you have an auth middleware that sets req.user
  const key    = req.query.key || 'home';

  const { data, error } = await supabase
    .from('user_dashboard_layout')
    .select('layout_json')
    .eq('user_id', userId)
    .eq('layout_key', key)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Dashboard GET error:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ layout: data?.layout_json || [] });
});

// POST /api/dashboard-layout
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { key, layout } = req.body;

  const { data, error } = await supabase
    .from('user_dashboard_layout')
    .upsert({
      user_id:     userId,
      layout_key:  key,
      layout_json: layout
    })
    .select()
    .single();

  if (error) {
    console.error('Dashboard POST error:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

module.exports = router;
