// GET /api/dashboard-layout?key=home
router.get('/', async (req, res) => {
  const userId = req.user.id;                          // from your auth middleware
  const { data, error } = await supabase
    .from('user_dashboard_layout')
    .select('layout_json')
    .eq('user_id', userId)
    .eq('layout_key', req.query.key || 'home')
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error });
  res.json({ layout: data?.layout_json || [] });
});

// POST /api/dashboard-layout
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { key, layout } = req.body;
  const { data, error } = await supabase
    .from('user_dashboard_layout')
    .upsert({ user_id: userId, layout_key: key, layout_json: layout })
    .select()
    .single();
  if (error) return res.status(500).json({ error });
  res.json(data);
});
