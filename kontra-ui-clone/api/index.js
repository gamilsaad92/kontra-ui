s(400).json({ message: 'File too large' });
    }
  } catch (err) {
    return res.status(400).json({ message: 'Unable to verify file_url' });
  }

  const { data, error } = await supabase
    .from('investor_reports')
    .insert([{ title, file_url }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to create report' });
  res.status(201).json({ report: data });
});

app.post('/api/financing-scorecard', (req, res) => {
  const { bureau_score, project_kpis = {}, payment_history = [] } = req.body || {};
  if (bureau_score === undefined) {
    return res.status(400).json({ message: 'Missing bureau_score' });
  }
  const result = financeScorecard({
    bureau_score: parseFloat(bureau_score),
    on_time_rate: parseFloat(project_kpis.on_time_rate || 0),
    budget_variance: parseFloat(project_kpis.budget_variance || 0),
    payment_history: Array.isArray(payment_history) ? payment_history.map(Number) : []
  });
  res.json(result);
});

app.post('/api/project-forecast', (req, res) => {
  const { progress_history = [], budget_history = [] } = req.body || {};
  if (!Array.isArray(progress_history) || !Array.isArray(budget_history)) {
    return res.status(400).json({ message: 'Missing arrays' });
  }
  const result = forecastProject({ progress_history, budget_history });
  res.json(result);
});

app.post('/api/match-invoice', upload.single('file'), async (req, res) => {
  const { project_id } = req.body || {};
  if (!project_id || !req.file) {
    return res.status(400).json({ message: 'Missing project_id or file' });
  }
  let items = [];
  try {
    const { data } = await supabase
      .from('budget_items')
      .select('id, description, amount')
      .eq('project_id', project_id);
    items = data || [];
  } catch (err) {
    console.error('Fetch budget items error:', err);
  }
  const text = req.file.buffer.toString('utf8');
  const matches = items.map((it) => ({
    id: it.id,
    description: it.description,
    amount: it.amount,
    matched: new RegExp(it.description, 'i').test(text)
  }));
  res.json({ matches });
});

app.post('/api/progress-photos/upload', upload.single('file'), async (req, res) => {
  const { project_id } = req.body || {};
  if (!project_id || !req.file) {
    return res.status(400).json({ message: 'Missing project_id or file' });
  }
  const filePath = `progress/${project_id}/${Date.now()}_${req.file.originalname}`;
  const { error: upErr } = await supabase.storage
    .from('project-photos')
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
  if (upErr) {
    console.error('Upload error:', upErr);
    return res.status(500).json({ message: 'File upload failed' });
  }
  const fileUrl = supabase.storage.from('project-photos').getPublicUrl(filePath).publicURL;
  const { data, error } = await supabase
    .from('progress_photos')
    .insert([{ project_id: parseInt(project_id, 10), file_url: fileUrl, status: 'pending', uploaded_at: new Date().toISOString() }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to record photo' });
  res.status(201).json({ photo: data });
});

app.get('/api/progress-photos', async (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ message: 'Missing project_id' });
  const { data, error } = await supabase
    .from('progress_photos')
    .select('*')
    .eq('project_id', project_id)
    .order('uploaded_at', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to fetch photos' });
  res.json({ photos: data });
});

app.post('/api/progress-photos/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!id || !status) return res.status(400).json({ message: 'Missing id or status' });
  const { data, error } = await supabase
    .from('progress_photos')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update photo' });
  res.json({ photo: data });
});

// ── Hospitality Features ───────────────────────────────────────────────────
if (isFeatureEnabled('hospitality')) {
  app.post('/api/guests', async (req, res) => {
  const { name, email, preferences } = req.body || {};
  if (!name || !email) return res.status(400).json({ message: 'Missing name or email' });
  try {
    const { data, error } = await supabase
      .from('guests')
      .insert([{ name, email, preferences }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ guest: data });
  } catch (err) {
    console.error('Guest create error:', err);
    res.status(500).json({ message: 'Failed to create guest' });
  }
});

app.get('/api/guests', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ guests: data });
  } catch (err) {
    console.error('List guests error:', err);
    res.status(500).json({ message: 'Failed to fetch guests' });
  }
});

app.post('/api/rate-recommendation', (req, res) => {
  const { property_id, date } = req.body || {};
  if (!property_id || !date)
    return res.status(400).json({ message: 'Missing property_id or date' });
  const base = 100;
  const day = new Date(date).getDay();
  const recommended_rate = base + (day === 5 || day === 6 ? 50 : 20);
  res.json({ recommended_rate });
});

app.post('/api/service-request', async (req, res) => {
  const { guest_id, request: reqText } = req.body || {};
  if (!guest_id || !reqText)
    return res.status(400).json({ message: 'Missing guest_id or request' });
  try {
    const { data, error } = await supabase
      .from('service_requests')
      .insert([
        { guest_id, request: reqText, status: 'pending', created_at: new Date().toISOString() }
      ])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ service_request: data });
  } catch (err) {
    console.error('Service request error:', err);
    res.status(500).json({ message: 'Failed to create request' });
  }
});

app.get('/api/service-requests', async (req, res) => {
  const { guest_id } = req.query || {};
  if (!guest_id) return res.status(400).json({ message: 'Missing guest_id' });
  try {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('guest_id', guest_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ requests: data });
  } catch (err) {
    console.error('Service requests fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

app.post('/api/forecast-inventory', (req, res) => {
  const { item, history } = req.body || {};
  if (!item || !Array.isArray(history)) {
    return res.status(400).json({ message: 'Missing item or history' });
  }
  const avg = history.length ? history.reduce((a, b) => a + b, 0) / history.length : 0;
  const forecast = avg * 1.1;
  res.json({ item, forecast });
});

app.post('/api/demand-forecast', (req, res) => {
  const { occupancy } = req.body || {};
  if (!Array.isArray(occupancy)) {
    return res.status(400).json({ message: 'Missing occupancy history' });
  }
  const avg = occupancy.reduce((a, b) => a + b, 0) / occupancy.length;
  const forecast = Array(7).fill(Math.round(avg));
  res.json({ forecast });
});

app.post('/api/suggest-upsells', (req, res) => {
  const { guest_id } = req.body || {};
  if (!guest_id) return res.status(400).json({ message: 'Missing guest_id' });
  const suggestions = ['Late checkout', 'Spa discount', 'Room upgrade'];
  res.json({ suggestions });
});

app.get('/api/hospitality/metrics', (_req, res) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const occDaily = days.map((d, i) => ({ day: d, occupancy: 70 + i }));
  const adrData = days.map((d, i) => ({ day: d, adr: 120 + i * 2 }));
  const revParData = days.map((d, i) => ({ day: d, revpar: 80 + i * 3 }));
  res.json({ occDaily, adrData, revParData });
});

  app.get('/api/hospitality/forecast', (_req, res) => {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + i + 1);
    return dt.toISOString().slice(0, 10);
  });
  const occupancy = dates.map((d, i) => ({ date: d, occupancy: 75 + i }));
  const revenue = dates.map((d, i) => ({ date: d, revenue: 10000 + i * 500 }));
  res.json({ occupancy, revenue });
});

} // end hospitality feature block

// ── Booking Endpoints ─────────────────────────────────────────────────────
app.post('/api/bookings', async (req, res) => {
  const { guest_id, room, start_date, end_date } = req.body || {};
  if (!guest_id || !room || !start_date || !end_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data, error } = await supabase
    .from('bookings')
    .insert([{ guest_id, room, start_date, end_date }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create booking' });
  await triggerWebhooks('booking.created', data);
  res.status(201).json({ booking: data });
});

app.get('/api/bookings', async (req, res) => {
   const { guest_id } = req.query || {};
  let query = supabase.from('bookings').select('*');
  if (guest_id) query = query.eq('guest_id', guest_id);
  const { data, error } = await query.order('start_date');
  if (error) return res.status(500).json({ message: 'Failed to fetch bookings' });
  res.json({ bookings: data });
});

app.patch('/api/bookings/:id', async (req, res) => {
  const { start_date, end_date } = req.body || {};
  if (!start_date && !end_date) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const updates = {};
  if (start_date) updates.start_date = start_date;
  if (end_date) updates.end_date = end_date;
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update booking' });
  res.json({ booking: data });
});

app.get('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to fetch booking' });
  if (!data) return res.status(404).json({ message: 'Booking not found' });
  res.json({ booking: data });
});

// ── Room Block Endpoints ──────────────────────────────────────────────────
app.post('/api/room-blocks', async (req, res) => {
  const { rooms, start_date, end_date, reason } = req.body || {};
  if (!rooms || !start_date || !end_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data, error } = await supabase
    .from('room_blocks')
    .insert([{ rooms, start_date, end_date, reason }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create room block' });
  res.status(201).json({ room_block: data });
});

app.get('/api/room-blocks', async (_req, res) => {
  const { data, error } = await supabase
    .from('room_blocks')
    .select('*')
    .order('start_date');
  if (error) return res.status(500).json({ message: 'Failed to fetch room blocks' });
  res.json({ room_blocks: data });
});

// ── Personalization & Insights ─────────────────────────────────────────────
app.get('/api/next-due', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('amortization_schedules')
      .select('loan_id, due_date')
      .gt('due_date', new Date().toISOString().slice(0, 10))
      .order('due_date')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    res.json({ next_due: data || null });
  } catch (err) {
    console.error('Next due error:', err);
    res.status(500).json({ next_due: null });
  }
});

app.get('/api/recommendations', async (_req, res) => {
  try {
    const { data: loans } = await supabase
      .from('assets')
      .select('id, name, predicted_risk')
      .gt('predicted_risk', 0.5)
      .order('predicted_risk', { ascending: false })
      .limit(3);
    const { data: guests } = await supabase
      .from('guests')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(3);
    res.json({ at_risk_loans: loans || [], upsell_guests: guests || [] });
  } catch (err) {
    console.error('Recommendation error:', err);
    res.status(500).json({ at_risk_loans: [], upsell_guests: [] });
  }
});

// ── Predictive Analytics ────────────────────────────────────────────────────
const {
  forecastNextValue,
  detectAnomalies,
  suggestPlan,
  predictChurn
} = require('./predictiveAnalytics');

app.post('/api/forecast-metrics', (req, res) => {
  const { history } = req.body || {};
  if (!Array.isArray(history) || history.length < 2) {
    return res.status(400).json({ message: 'Missing history' });
  }
  const next = forecastNextValue(history.map(Number));
  res.json({ next });
});

app.post('/api/detect-anomalies', (req, res) => {
  const { values } = req.body || {};
  if (!Array.isArray(values) || values.length < 2) {
    return res.status(400).json({ message: 'Missing values' });
  }
  const anomalies = detectAnomalies(values.map(Number));
  res.json({ anomalies });
});

app.post('/api/suggest-plan', (req, res) => {
  const { usage, threshold } = req.body || {};
  if (typeof usage !== 'number') {
    return res.status(400).json({ message: 'Missing usage' });
  }
  const suggestion = suggestPlan({ usage, threshold: Number(threshold) || 100 });
  res.json({ suggestion });
});

app.post('/api/predict-churn', (req, res) => {
  const { logins, days_since_login, tickets } = req.body || {};
  if (logins === undefined || days_since_login === undefined) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const result = predictChurn({
    logins: Number(logins),
    days_since_login: Number(days_since_login),
    tickets: Number(tickets) || 0
  });
  res.json(result);
});

app.get('/api/faqs', async (req, res) => {
  const { user_id } = req.query || {};
  const faqs = [
    { q: 'How do I make a payment?', a: 'You can pay online or mail a check.' },
    {
      q: 'What is my payoff amount?',
      a: 'Contact support for an official payoff quote.'
    }
  ];
  if (user_id) {
    try {
      const { data: loan } = await supabase
        .from('loans')
        .select('id')
        .eq('borrower_user_id', user_id)
        .order('start_date')
        .limit(1)
        .maybeSingle();
      if (loan) {
        const { data: sched } = await supabase
          .from('amortization_schedules')
          .select('due_date')
          .eq('loan_id', loan.id)
          .gt('due_date', new Date().toISOString().slice(0, 10))
          .order('due_date')
          .limit(1)
          .maybeSingle();
        if (sched)
          faqs.push({
            q: 'When is my next payment due?',
            a: `Your next payment is due on ${sched.due_date}.`
          });
      }
    } catch (err) {
      console.error('FAQ fetch error:', err);
    }
  }
  res.json({ faqs });
});

app.get('/api/saved-loan-queries', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json({ queries: [] });
  const { data, error } = await supabase
    .from('saved_loan_queries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  if (error) return res.status(500).json({ queries: [] });
  res.json({ queries: data });
});

app.post('/api/saved-loan-queries', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { name, query } = req.body || {};
  if (!userId || !name || !query)
    return res.status(400).json({ message: 'Missing fields' });
  const { data, error } = await supabase
    .from('saved_loan_queries')
    .insert([{ user_id: userId, name, query_json: query }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to save' });
  res.status(201).json({ query: data });
});

app.post('/api/feedback', (req, res) => {
  const { type, message } = req.body || {};
  if (!message) return res.status(400).json({ message: 'Missing message' });
  recordFeedback({ type: type || 'feature', message });
  retrainModel();
  res.status(201).json({ message: 'Feedback recorded' });
});

app.post('/api/user-events', authenticate, (req, res) => {
  const userId = req.user.id;
  const { event } = req.body || {};
  if (!event) return res.status(400).json({ message: 'Missing event' });
  logUserEvent(userId, event);
  res.status(201).json({ logged: true });
  
});

app.get('/api/personalized-suggestion', authenticate, async (req, res) => {
  const userId = req.user.id;
  const suggestion = await suggestNextFeature(userId, openai);
  res.json({ suggestion });
});

// ── Background Job Queue ─────────────────────────────────────────────────--
app.post('/api/jobs/score-loans', (_req, res) => {
  addJob('score-loans');
  res.json({ queued: true });
});
app.post('/api/jobs/score-assets', (_req, res) => {
  addJob('score-assets');
  res.json({ queued: true });
});
app.post('/api/jobs/score-troubled', (_req, res) => {
  addJob('score-troubled');
  res.json({ queued: true });
});

// ── Workflow Automation Engine ─────────────────────────────────────────────
app.get("/api/workflows", (_req, res) => {
  res.json(workflows);
});
app.post("/api/workflows", (req, res) => {
  const { name, steps } = req.body || {};
  if (!name || !Array.isArray(steps)) {
    return res.status(400).json({ message: "Missing name or steps" });
  }
  const workflow = { id: workflows.length + 1, name, steps };
  addWorkflow(workflow);
  res.status(201).json(workflow);
});

app.post("/api/workflows/:id/run", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const workflow = workflows.find(w => w.id === id);
  if (!workflow) return res.status(404).json({ message: "Workflow not found" });
  try {
    const results = await runWorkflow(workflow);
    res.json({ results });
  } catch (err) {
    console.error("Workflow run error:", err);
    res.status(500).json({ message: "Failed to run workflow" });
  }
});

// ── Voice Bot Endpoints ────────────────────────────────────────────────────
app.post('/api/voice', express.urlencoded({ extended: false }), handleVoice);
app.post('/api/voice/query', express.urlencoded({ extended: false }), handleVoiceQuery);

// 404 and error handlers moved to end of file (after all route registrations).

// ── Start Server ──────────────────────────────────────────────────────────

async function logBaselineSchemaHealth() {
  const checks = [
    ['assets', 'id,org_id'],
    ['loans', 'id,org_id'],
    ['inspections', 'id,org_id'],
    ['exchange_listings', 'id,org_id'],
    ['payments', 'id,org_id,currency'],
    ['escrows', 'id,org_id'],
    ['draws', 'id,org_id'],
    ['borrower_financials', 'id,org_id'],
    ['management_items', 'id,org_id'],
    ['pools', 'id,org_id'],
    ['tokens', 'id,org_id'],
    ['compliance_items', 'id,org_id'],
    ['legal_items', 'id,org_id'],
    ['regulatory_scans', 'id,org_id'],
    ['risk_items', 'id,org_id'],
    ['document_reviews', 'id,org_id'],
    ['reports', 'id,org_id'],
    ['org_memberships', 'id,org_id,user_id,role'],
  ];

  const missing = [];

  for (const [table, columns] of checks) {
    const { error } = await supabase.from(table).select(columns).limit(1);
    if (error) {
      missing.push({ table, code: error.code, message: error.message });
    }
  }

  if (missing.length > 0) {
    console.warn('[schema] Baseline migration appears missing or incomplete.');
    console.warn('[schema] Run: supabase db push (or supabase migration up) before using dev API.');
    console.warn('[schema] Failing checks:', missing);
    return;
  }

  console.log('[schema] Baseline migration check passed.');
}

// ── User Properties CRUD ──────────────────────────────────────────────────

function mapDbToProperty(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type || null,
    address: row.address || null,
    city: row.city || null,
    state: row.state || null,
    units: row.units || null,
    sqft: row.sqft || null,
    yearBuilt: row.year_built || null,
    occupancy: row.occupancy || null,
    noi: row.noi || null,
    status: row.status || 'Active',
    risk: 'Unknown',
    riskColor: '#6b7280',
    createdAt: row.created_at,
  };
}

app.get('/api/user-properties', authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data, error } = await supabase
      .from('user_properties')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ properties: (data || []).map(mapDbToProperty) });
  } catch (err) {
    console.error('[user-properties GET]', err.message);
    res.json({ properties: [] }); // Fail gracefully — client falls back to localStorage
  }
});

app.post('/api/user-properties', authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { name, type, address, city, state, units, sqft, yearBuilt, occupancy, noi } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Property name required' });
  try {
    const { data, error } = await supabase
      .from('user_properties')
      .insert([{
        user_id: userId,
        name,
        type: type || null,
        address: address || null,
        city: city || null,
        state: state || null,
        units: units ? Number(units) : null,
        sqft: sqft ? Number(sqft) : null,
        year_built: yearBuilt ? Number(yearBuilt) : null,
        occupancy: occupancy ? Number(occupancy) : null,
        noi: noi ? Number(noi) : null,
      }])
      .select()
      .single();
    if (error) throw error;
    res.json({ property: mapDbToProperty(data) });
  } catch (err) {
    console.error('[user-properties POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user-properties/:id', authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { name, type, address, city, state, units, sqft, yearBuilt, occupancy, noi } = req.body || {};
  try {
    const updates = {};
    if (name) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (units !== undefined) updates.units = units ? Number(units) : null;
    if (sqft !== undefined) updates.sqft = sqft ? Number(sqft) : null;
    if (yearBuilt !== undefined) updates.year_built = yearBuilt ? Number(yearBuilt) : null;
    if (occupancy !== undefined) updates.occupancy = occupancy ? Number(occupancy) : null;
    if (noi !== undefined) updates.noi = noi ? Number(noi) : null;
    const { data, error } = await supabase
      .from('user_properties')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ property: mapDbToProperty(data) });
  } catch (err) {
    console.error('[user-properties PUT]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user-properties/:id', authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { error } = await supabase
      .from('user_properties')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('[user-properties DELETE]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Stripe Checkout ────────────────────────────────────────────────────────
app.post('/api/checkout', authenticate, async (req, res) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.startsWith('placeholder') || stripeKey.length < 20) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Payments are not yet enabled. Contact hello@kontraplatform.com to upgrade.',
      });
    }
    const stripe = require('stripe')(stripeKey);
    const { propertyId, propertyName, plan = 'deal' } = req.body;
    const origin = req.headers.origin || 'https://kontraplatform.com';
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    // Plan config — inline pricing, no pre-created Stripe price IDs required
    const PLANS = {
      deal: {
        name: 'Kontra Deal Room',
        description: propertyName ? `Deal room for ${propertyName}` : 'Per-deal access for all parties',
        amount: 49900, // $499.00
        mode: 'payment',
      },
      pro_monthly: {
        name: 'Kontra Pro — Monthly',
        description: 'Unlimited deal rooms, full AI suite',
        amount: 29900, // $299/mo
        mode: 'subscription',
      },
      pro_annual: {
        name: 'Kontra Pro — Annual',
        description: 'Unlimited deal rooms, full AI suite (billed annually)',
        amount: 249900, // $2,499/yr
        mode: 'subscription',
      },
    };

    const cfg = PLANS[plan] || PLANS.deal;

    const lineItem = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        product_data: { name: cfg.name, description: cfg.description },
        unit_amount: cfg.amount,
        ...(cfg.mode === 'subscription' ? { recurring: { interval: plan === 'pro_annual' ? 'year' : 'month' } } : {}),
      },
    };

    const sessionParams = {
      mode: cfg.mode,
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: `${origin}/dashboard?checkout=success&plan=${plan}${propertyId ? `&property=${propertyId}` : ''}`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
      metadata: { userId: userId || '', plan, propertyId: propertyId || '' },
    };
    if (userEmail) sessionParams.customer_email = userEmail;

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[checkout]', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ── Link Revocation — owner regenerates invite links ──────────────────────────
app.post('/api/public/deal-room/:propertyId/regenerate-links', async (req, res) => {
  const { propertyId } = req.params;
  const access = await getRoomAccessContext(req, propertyId, req.body?.ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can regenerate links');
  try {
    const newToken = crypto.randomBytes(16).toString('hex');
    const { error } = await supabase.from('deal_rooms')
      .update({ link_token: newToken })
      .eq('property_id', propertyId);
    if (error) throw error;
    res.json({ ok: true, link_token: newToken });
  } catch (err) {
    console.error('[regenerate-links]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Upload / Multer error handler ─────────────────────────────────────────────
// ── Transaction Record ────────────────────────────────────────────────────────
// Architecture: Transaction → Verification → Verified Record → DA Readiness
// These routes power the Asset Record tab — field-level structured data,
// source-linked from uploaded documents.

app.get('/api/public/deal-room/:propertyId/transaction-record', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    const [{ data: fields, error: fieldsError }, { data: room, error: roomError }] = await Promise.all([
      supabase
        .from('transaction_record_fields')
        .select('*')
        .eq('property_id', propertyId)
        .order('field_category', { ascending: true })
        .order('display_label', { ascending: true }),
      supabase
        .from('deal_rooms')
        .select('workflow_pack_id, deal_type')
        .eq('property_id', propertyId)
        .maybeSingle(),
    ]);
    if (fieldsError) throw fieldsError;
    if (roomError) throw roomError;
    const schemaKey = await resolveTransactionSchemaKey(room);
    res.json({
      fields: fields || [],
      record_state: computeTransactionRecordState(fields || [], schemaKey),
    });
  } catch (err) {
    console.error('[transaction-record GET]', err.message);
    res.json({ fields: [] });
  }
});

app.get('/api/public/deal-room/:propertyId/transaction-record/fields/:fieldId/history', async (req, res) => {
  const { propertyId, fieldId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    const { data, error } = await supabase
      .from('transaction_record_history')
      .select('*')
      .eq('property_id', propertyId)
      .eq('field_id', fieldId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ history: data || [] });
  } catch (err) {
    console.error('[transaction-record history GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/public/deal-room/:propertyId/transaction-record/fields/:fieldId', async (req, res) => {
  const { propertyId, fieldId } = req.params;
  const { value_text, notes, status, ownerWriteToken } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');

  // Sealed workspaces: transaction_record_fields are immutable after the Transaction Seal is created.
  // Post-completion documents can still be uploaded (they are flagged post_completion=true).
  const { data: sealedRoom } = await supabase.from('deal_rooms').select('sealed_at').eq('property_id', propertyId).maybeSingle();
  if (sealedRoom?.sealed_at) {
    return res.status(400).json({
      error: 'WORKSPACE_SEALED',
      message: 'Transaction record fields are immutable after the workspace is sealed. The Transaction Seal was created at ' + sealedRoom.sealed_at + '. New documents can still be added as post-completion records.',
      sealed_at: sealedRoom.sealed_at,
    });
  }

  const ALLOWED_STATUSES = ['missing','extracted','needs_review','verified','conflicting','not_applicable'];
  const update = { updated_at: new Date().toISOString() };
  if (value_text !== undefined) { update.value_text = String(value_text).slice(0, 2000); update.extracted_by = 'coordinator'; }
  if (notes !== undefined)      update.notes = String(notes).slice(0, 500);
  if (status && ALLOWED_STATUSES.includes(status)) update.status = status;
  try {
    const { data: existing } = await supabase
      .from('transaction_record_fields')
      .select('id, field_key, value_text, status')
      .eq('id', fieldId)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Transaction Record field not found' });
    const { error } = await supabase
      .from('transaction_record_fields')
      .update(update)
      .eq('id', fieldId)
      .eq('property_id', propertyId);
    if (error) throw error;
    const nextStatus = update.status || existing.status;
    const nextValue = update.value_text !== undefined ? update.value_text : existing.value_text;
    const eventType = nextStatus === 'not_applicable'
      ? 'marked_not_applicable'
      : nextStatus === 'conflicting'
        ? 'conflict'
        : nextValue !== existing.value_text ? 'manual_edit' : null;
    if (eventType) {
      await recordTransactionFieldHistory({
        fieldId,
        propertyId,
        eventType,
        actorEmail: access.email || 'coordinator',
        actorRole: 'Deal Coordinator',
        priorValue: existing.value_text,
        newValue: nextValue,
        priorStatus: existing.status,
        newStatus: nextStatus,
      });
    }
    if (nextStatus === 'not_applicable') {
      await markDependentTransactionFieldsNotApplicable(propertyId, existing.field_key, access.email || 'coordinator');
    }
    recalculateTransactionState(propertyId, {
      source: 'transaction_record_field_updated',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] field update recalculation failed:', e.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('[transaction-record PATCH]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/public/deal-room/:propertyId/transaction-record/fields/:fieldId/verify', async (req, res) => {
  const { propertyId, fieldId } = req.params;
  const { ownerWriteToken, actorRole } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');

  // Sealed workspaces: transaction_record_fields and their approvals are immutable.
  const { data: sealedRoom } = await supabase.from('deal_rooms').select('sealed_at, customer_email').eq('property_id', propertyId).maybeSingle();
  if (sealedRoom?.sealed_at) {
    return res.status(400).json({
      error: 'WORKSPACE_SEALED',
      message: 'Transaction record fields are immutable after the workspace is sealed. The Transaction Seal was created at ' + sealedRoom.sealed_at + '.',
      sealed_at: sealedRoom.sealed_at,
    });
  }

  try {
    const room = sealedRoom; // already fetched above
    const email = room?.customer_email || 'coordinator';
    const { error: fErr } = await supabase
      .from('transaction_record_fields')
      .select('id').eq('id', fieldId).eq('property_id', propertyId).maybeSingle();
    if (fErr) throw fErr;
    const { data: existing } = await supabase.from('transaction_record_fields')
      .select('id, value_text, status')
      .eq('id', fieldId).eq('property_id', propertyId).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Transaction Record field not found' });
    const nextValue = existing.value_text;
    await supabase.from('transaction_record_fields').update({
      status: 'verified', verified_by: email,
      verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', fieldId).eq('property_id', propertyId);
    await recordTransactionFieldHistory({
      fieldId, propertyId, eventType: 'confirmed',
      actorEmail: email, actorRole: actorRole || 'coordinator',
      priorValue: existing.value_text, newValue: nextValue,
      priorStatus: existing.status, newStatus: 'verified',
    });
    await supabase.from('transaction_record_approvals').insert({
      field_id: fieldId, property_id: propertyId,
      action: 'approved', actor_email: email, actor_role: actorRole || 'coordinator',
    });
    recalculateTransactionState(propertyId, {
      source: 'transaction_record_field_confirmed',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] field confirmation recalculation failed:', e.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('[transaction-record verify]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create or upsert a field manually (coordinator enters value before extraction)
app.post('/api/public/deal-room/:propertyId/transaction-record/fields', async (req, res) => {
  const { propertyId } = req.params;
  const { field_key, display_label, field_category, value_text, notes, status, ownerWriteToken } = req.body || {};
  if (!field_key || !field_category) return res.status(400).json({ error: 'field_key and field_category required' });
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');

  // Sealed workspaces: transaction_record_fields are immutable after the Transaction Seal is created.
  const { data: sealedRoom } = await supabase.from('deal_rooms').select('sealed_at').eq('property_id', propertyId).maybeSingle();
  if (sealedRoom?.sealed_at) {
    return res.status(400).json({
      error: 'WORKSPACE_SEALED',
      message: 'Transaction record fields are immutable after the workspace is sealed. The Transaction Seal was created at ' + sealedRoom.sealed_at + '. New documents can still be added as post-completion records.',
      sealed_at: sealedRoom.sealed_at,
    });
  }

  const ALLOWED_STATUSES = ['missing','extracted','needs_review','verified','not_applicable'];
  const now = new Date().toISOString();
  try {
    // Try update first (in case a record already exists for this key)
      const { data: existing } = await supabase
      .from('transaction_record_fields')
        .select('id, field_key, value_text, status')
      .eq('property_id', propertyId)
      .eq('field_key', field_key)
      .maybeSingle();
    if (existing?.id) {
      const update = { updated_at: now };
      if (value_text !== undefined) { update.value_text = String(value_text).slice(0, 2000); update.extracted_by = 'coordinator'; }
      if (notes !== undefined)      update.notes = String(notes).slice(0, 500);
      if (status && ALLOWED_STATUSES.includes(status)) update.status = status;
      else if (value_text) update.status = 'needs_review';
      const { error } = await supabase.from('transaction_record_fields').update(update).eq('id', existing.id);
      if (error) throw error;
        const nextStatus = update.status || (value_text ? 'needs_review' : existing.status);
        const nextValue = value_text !== undefined ? String(value_text).slice(0, 2000) : existing.value_text;
        const eventType = nextStatus === 'not_applicable'
          ? 'marked_not_applicable'
          : nextValue !== existing.value_text ? 'manual_edit' : null;
        if (eventType) {
          await recordTransactionFieldHistory({
            fieldId: existing.id,
            propertyId,
            eventType,
            actorEmail: access.email || 'coordinator',
            actorRole: 'Deal Coordinator',
            priorValue: existing.value_text,
            newValue: nextValue,
            priorStatus: existing.status,
            newStatus: nextStatus,
          });
        }
        if (nextStatus === 'not_applicable') {
          await markDependentTransactionFieldsNotApplicable(propertyId, field_key, access.email || 'coordinator');
        }
        recalculateTransactionState(propertyId, {
          source: 'transaction_record_field_updated',
          actorId: access.actorId,
          actorType: access.actorType,
        }).catch(e => console.warn('[transaction-state] field update recalculation failed:', e.message));
      return res.json({ ok: true, action: 'updated', id: existing.id });
    }
    // Insert new
    const insert = {
      property_id:    propertyId,
      field_key:      String(field_key).slice(0, 100),
      display_label:  display_label ? String(display_label).slice(0, 200) : field_key,
      field_category: String(field_category).slice(0, 100),
      value_text:     value_text ? String(value_text).slice(0, 2000) : null,
      notes:          notes ? String(notes).slice(0, 500) : null,
      status:         (status && ALLOWED_STATUSES.includes(status)) ? status : (value_text ? 'needs_review' : 'missing'),
      extracted_by:   'coordinator',
      created_at:     now,
      updated_at:     now,
    };
    const { data, error } = await supabase.from('transaction_record_fields').insert(insert).select('id').single();
    if (error) throw error;
    const eventType = insert.status === 'not_applicable' ? 'marked_not_applicable' : 'manual_edit';
    await recordTransactionFieldHistory({
      fieldId: data.id,
      propertyId,
      eventType,
      actorEmail: access.email || 'coordinator',
      actorRole: 'Deal Coordinator',
      newValue: insert.value_text,
      newStatus: insert.status,
    });
    if (insert.status === 'not_applicable') {
      await markDependentTransactionFieldsNotApplicable(propertyId, field_key, access.email || 'coordinator');
    }
    recalculateTransactionState(propertyId, {
      source: 'transaction_record_field_created',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] field create recalculation failed:', e.message));
    res.json({ ok: true, action: 'created', id: data?.id });
  } catch (err) {
    console.error('[transaction-record POST field]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/public/deal-room/:propertyId/transaction-record/extract', async (req, res) => {
  const { propertyId } = req.params;
  const { ownerWriteToken } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');
  res.json({ ok: true, message: 'Re-extraction queued' });
  // Background: re-extract from all stored documents
  (async () => {
    try {
      // Fetch ALL analyses — documents with storage_path use the file,
      // documents without (e.g. LOI uploaded before storage was configured)
      // fall back to their AI-analysis summary text so we still extract what we can.
      const { data: analyses } = await supabase
        .from('deal_analyses')
        .select('id, section, filename, storage_path, analysis')
        .eq('property_id', propertyId);
      if (!analyses?.length) return;
      for (const doc of analyses) {
        try {
          let text = '';

          if (doc.storage_path) {
            // Primary path: re-download the stored file and extract text from it
            const { data: urlData } = await supabase.storage
              .from('deal-documents')
              .createSignedUrl(doc.storage_path, 60);
            if (urlData?.signedUrl) {
              const buf = Buffer.from(await (await fetch(urlData.signedUrl)).arrayBuffer());
              try {
                if (doc.filename?.match(/\.(pdf)$/i)) {
                  const { PDFParse } = require('pdf-parse');
                  const parser = new PDFParse({ data: buf });
                  const parsed = await parser.getText();
                  text = (parsed?.text || '').slice(0, 8000);
                } else {
                  text = buf.toString('utf8', 0, 6000);
                }
              } catch { text = buf.toString('utf8', 0, 4000); }
            }
          }

          // Fallback: if the file isn't in storage, use the AI analysis summary.
          // It's shorter than the full document but better than nothing — it often
          // contains the key extracted facts (buyer, price, asset) in sentence form.
          if (!text || text.trim().length < 50) {
            const summary = doc.analysis?.summary || '';
            if (summary.length > 50) {
              text = `Section: ${doc.section}\nFilename: ${doc.filename}\n\n${summary}`;
              console.log(`[tx-record re-extract] using summary fallback for ${doc.section} (no storage path)`);
            }
          }

          if (text.trim().length > 50) {
            await extractTransactionFields(propertyId, doc.id, text, doc.section);
          }
        } catch (docErr) {
          console.warn('[tx-record re-extract]', doc.id, docErr.message);
        }
      }
    } catch (err) {
      console.warn('[tx-record re-extract outer]', err.message);
    }
  })();
});

// ── Optional digital-asset preparation request ────────────────────────────────
// Uses the background transaction record without exposing token economics or a
// tokenization workflow in the deal-room UI. The response intentionally reports
// only missing facts that the owner can supply before an external handoff.
app.post('/api/public/deal-room/:propertyId/digital-asset-prep', async (req, res) => {
  const { propertyId } = req.params;
  const { ownerWriteToken } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');

  try {
    const [{ data: room, error: roomErr }, { data: fields, error: fieldsErr }] = await Promise.all([
      supabase.from('deal_rooms').select('metadata_values').eq('property_id', propertyId).maybeSingle(),
      supabase.from('transaction_record_fields')
        .select('field_key, display_label, value_text, status')
        .eq('property_id', propertyId)
        .order('display_label', { ascending: true }),
    ]);
    if (roomErr) throw roomErr;
    if (fieldsErr) throw fieldsErr;
    if (!room) return res.status(404).json({ error: 'room not found' });

    const recordFields = fields || [];
    const tokenizationGuidance = buildTokenizationGuidance({
      recordFields,
      enabled: true,
    });
    const missing = tokenizationGuidance.gaps
      .slice(0, 12)
      .map(field => ({
        field_key: field.key,
        label: field.label,
        reason: field.reason,
        status: field.status,
      }));
    const now = new Date().toISOString();
    const preparedPackage = {
      package_type: 'digital_asset_preparation',
      preparation_status: missing.length > 0 ? 'needs_information' : 'inputs_captured',
      prepared_at: now,
      facts: tokenizationGuidance.known,
      missing,
      optional: true,
      disclaimer: 'AI-prepared coordination data only. Kontra does not determine legal or regulatory outcomes and does not issue, sell, recommend, custody, or settle digital assets.',
    };
    const metadata = {
      ...(room.metadata_values || {}),
      digital_asset_prep_requested: true,
      digital_asset_prep_opted_in: true,
      digital_asset_prep_requested_at: now,
      digital_asset_prep_package: preparedPackage,
    };
    const { error: updateErr } = await supabase
      .from('deal_rooms')
      .update({ metadata_values: metadata })
      .eq('property_id', propertyId);
    if (updateErr) throw updateErr;

    logEvent(propertyId, 'digital_asset_prep_requested', 'owner', null, 'Digital asset preparation requested', {
      missing_count: missing.length,
    });

    res.json({
      ok: true,
      status: missing.length > 0 ? 'needs_information' : 'inputs_captured',
      missing,
      prepared_field_count: tokenizationGuidance.known.length,
      package: preparedPackage,
      requested_at: now,
    });
  } catch (err) {
    console.error('[digital-asset-prep]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large — maximum size is 20MB. Please compress the file and try again.' });
  }
  if (err.message?.includes('File type not allowed')) {
    return res.status(415).json({ error: 'Unsupported file type. Accepted formats: PDF, Word, Excel, CSV, JPEG, PNG.' });
  }
  console.error('[unhandled error]', err.message);
  res.status(500).json({ error: err.message || 'Server error' });
});

// ── Startup migration: ensure workflow_pack_id column exists ─────────────────
// Migration 005 is manual-only; run it automatically here so Render/production
// gets the column on first boot without a manual Supabase SQL editor step.
async function ensureWorkflowPackIdColumn() {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS workflow_pack_id text DEFAULT 'cre_acquisition'`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS stated_revenue NUMERIC`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS stated_ebitda NUMERIC`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS checklist_items JSONB`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS owner_write_token TEXT`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS stages_config JSONB`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS metadata_values JSONB`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(64)`
    );
    // transaction_record_fields and transaction_record_approvals are NOT created
    // here. They must be applied via the committed Supabase migration:
    //   kontra-ui-clone/api/migrations/015_transaction_record.sql
    // Startup checks are kept read-only beyond the deal_rooms column additions above.
    // analytics_events — created here so it's always present when first event arrives
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id           BIGSERIAL PRIMARY KEY,
        session_id   TEXT NOT NULL,
        event_name   TEXT NOT NULL,
        workspace_id TEXT,
        properties   JSONB DEFAULT '{}',
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx ON analytics_events (event_name)`);
    await pool.end();
    console.log('[startup] deal_rooms schema columns ready (workflow_pack_id, stated_revenue, stated_ebitda, checklist_items, owner_write_token, stages_config, metadata_values, jurisdiction)');
  } catch (err) {
    // Non-fatal: Supabase service role may not allow DDL via pooler — fall back gracefully
    console.warn('[startup] workflow_pack_id column ensure skipped:', err.message);
  }
}

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    startJobSchedulers();
  }
  const server = http.createServer(app);
  attachChatServer(server);
  attachCollabServer(server);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Kontra API listening on port ${PORT}`);
    void ensureWorkflowPackIdColumn();
    if (process.env.NODE_ENV !== 'production') {
      void logBaselineSchemaHealth();
    }
  });
}

// ── Generic Deal Room — AI Assistant (/brain/ask) ────────────────────────────
// Context-aware assistant that reasons from the actual room state.
// Registered BEFORE the static demo overrides so dynamic rooms hit this route.
app.post('/api/public/deal-room/:propertyId/brain/ask', async (req, res) => {
  const { propertyId } = req.params;
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: 'question required' });

  try {
    const [
      { data: room },
      { count: docCount },
      { data: fields },
      { data: invites },
    ] = await Promise.all([
      supabase.from('deal_rooms')
        .select('property_name, workflow_pack_id, deal_type, deal_amount')
        .eq('property_id', propertyId)
        .maybeSingle(),
      supabase.from('deal_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId),
      supabase.from('transaction_record_fields')
        .select('field_key, display_label, value_text, status, source_doc_id, source_page')
        .eq('property_id', propertyId),
      supabase.from('deal_room_invites')
        .select('role_key, status')
        .eq('property_id', propertyId),
    ]);

    const populated = (fields || []).filter(f => {
      const v = String(f.value_text || '').trim().toLowerCase();
      return v && !['n/a', 'na', 'not applicable', 'not_applicable', 'unknown'].includes(v) && f.status !== 'not_applicable';
    });
    const conflicts = (fields || []).filter(f => ['conflicting', 'source_changed'].includes(f.status));
    const needsReview = (fields || []).filter(f => ['needs_review', 'extracted'].includes(f.status) && f.value_text);
    const inviteCount = (invites || []).length;

    const CAT_PREFIXES = {
      'Identity & Parties': ['parties.', 'ownership.owner_name'],
      'Asset / Company': ['asset.'],
      'Transaction Terms': ['transaction.'],
      'Financial Information': ['financial.'],
      'Legal & Diligence': ['legal.', 'ownership.cap_table', 'ownership.beneficial_owners', 'ownership.liens'],
    };
    const catStatus = Object.entries(CAT_PREFIXES).map(([label, prefixes]) => {
      const count = populated.filter(f => prefixes.some(p => f.field_key?.startsWith(p) || f.field_key === p)).length;
      return `${label}: ${count === 0 ? 'Not started' : count >= 2 ? 'Building' : 'Needs information'}`;
    }).join('\n');

    const systemPrompt = `You are Kontra AI, a transaction-aware assistant embedded in a deal room called Kontra. You reason specifically from the current room state below. Never give generic advice — always tie your answer to the specific room context.

ROOM NAME: ${room?.property_name || 'Unnamed transaction'}
TYPE: ${room?.deal_type || room?.workflow_pack_id || 'General transaction'}
DOCUMENTS UPLOADED: ${docCount || 0}
PARTICIPANTS INVITED: ${inviteCount}
EXTRACTED FACTS: ${populated.length}
CONFLICTING / CHANGED FIELDS: ${conflicts.length}
NEEDS REVIEW: ${needsReview.length}

DIGITAL ASSET READINESS BY CATEGORY:
${catStatus}

${populated.length > 0 ? `KNOWN FACTS (up to 20):\n${populated.slice(0, 20).map(f => `• ${f.display_label || f.field_key}: ${f.value_text}${f.source_page ? ` (page ${f.source_page})` : ''}`).join('\n')}` : '(No facts have been extracted yet — no documents have been uploaded or analyzed.)'}

${conflicts.length > 0 ? `CONFLICTS TO RESOLVE:\n${conflicts.map(f => `• ${f.display_label || f.field_key}: conflicting sources — needs coordinator review`).join('\n')}` : ''}

RULES:
- If the room is empty (0 documents, 0 facts): clearly state this room has not started, recommend uploading the most relevant first document (e.g. Letter of Intent or Purchase Agreement), and explain what Kontra will extract from it.
- If asked about digital-asset readiness or tokenization: describe which categories have facts vs. which are still empty. Never quote a percentage. Never say "eligible for tokenization", "approved", or "issuance ready".
- If there are conflicts or needs-review fields: name them specifically.
- Keep answers concise (3–6 sentences), factual, and actionable.
- Do not provide legal, regulatory, or financial advice.
- Kontra organizes and prepares transaction information — it does not issue, sell, recommend, custody, or settle digital assets.`;

    const aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      max_tokens: 450,
      temperature: 0.3,
    });

    res.json({ answer: completion.choices[0]?.message?.content || 'I could not answer from the current transaction record.' });
  } catch (err) {
    console.error('[brain/ask]', err.message);
    res.status(500).json({ error: 'AI assistant error', answer: 'Kontra could not reach the transaction workspace. Try again in a moment.' });
  }
});

// ── Generic Deal Room — Transaction-Record Fact Summary (/brain/facts) ───────
// Distinct from /brain/briefing (which is served by the operationsManager
// router for deal health / chain status). This endpoint returns a machine-
// readable summary of extracted transaction facts plus a document count so the
// CoordinatorOverview can show "N documents uploaded" and known transaction
// values without a separate /transaction-record fetch.
// Returns a lightweight computed briefing from live room data.
// Static demo rooms register their own routes above and override this.
app.get('/api/public/deal-room/:propertyId/brain/facts', async (req, res) => {
  const { propertyId } = req.params;
  const access = await getRoomAccessContext(req, propertyId, req.body?.ownerWriteToken);
  if (access.mode === 'anonymous') return accessDenied(res, 'A verified deal-room invitation or owner access token is required');
  try {
    const [{ data: fields }, { count: docCount }] = await Promise.all([
      supabase.from('transaction_record_fields')
        .select('field_key, display_label, value_text, status, source_doc_id')
        .eq('property_id', propertyId),
      supabase.from('deal_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId),
    ]);

    const conflicts   = (fields || []).filter(f => ['conflicting', 'source_changed'].includes(f.status));
    const needsReview = (fields || []).filter(f => ['needs_review', 'extracted'].includes(f.status) && f.value_text);

    // Return null only when truly nothing has been uploaded or extracted yet
    if ((docCount || 0) === 0 && (fields || []).length === 0) {
      return res.json(null);
    }

    const risks = conflicts.map(f => ({
      text: `${f.display_label || f.field_key} has conflicting values from different sources`,
      field_key: f.field_key,
    }));
    const actions = needsReview.slice(0, 4).map(f => ({
      text: `Confirm "${f.display_label || f.field_key}" extracted as "${f.value_text}"`,
      field_key: f.field_key,
    }));

    res.json({
      actions,
      risks,
      open_items: [],
      snapshot: { document_count: docCount || 0, fact_count: (fields || []).length },
      // Surface the most important known values for the Overview snapshot row
      known_values: Object.fromEntries(
        (fields || [])
          .filter(f => f.value_text && f.status !== 'not_applicable')
          .map(f => [f.field_key, f.value_text])
      ),
    });
  } catch (err) {
    console.error('[brain/facts]', err.message);
    res.json(null);
  }
});

// ── 404 catch-all — MUST remain after all route registrations ─────────────────
// Placed here so that routes registered later in this file (transaction-record,
// brain/facts, extract, etc.) are not swallowed by the catch-all before they
// can be matched. Express evaluates handlers in registration order.
app.use('/api', (req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `${req.method} ${req.originalUrl} not found`
  });
});
if (Sentry.Handlers?.errorHandler) {
  app.use(Sentry.Handlers.errorHandler());
} else if (Sentry.errorHandler) {
  app.use(Sentry.errorHandler());
}
app.use(errorHandler);

// Kept on the Express app for focused authorization/checklist regression tests;
// these helpers do not change the public HTTP surface.
app.getRoomAccessContext = getRoomAccessContext;
app.filterChecklistItemsByRole = filterChecklistItemsByRole;
app.getChecklistItemAssignedRoles = getChecklistItemAssignedRoles;
app.getAssignedSectionsForAccess = getAssignedSectionsForAccess;
if (process.env.NODE_ENV === 'test') {
  app.setMyRoomsOtpForTest = (email, code) => {
    otpStore.set(email, { code, expiresAt: Date.now() + 60_000 });
  };
}

module.exports = app;
