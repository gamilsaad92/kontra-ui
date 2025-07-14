const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { recordFeedback, retrainModel } = require('../feedback');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function calculateRiskScore({ amount, description, lastSubmittedAt }) {
  let score = 100;
  if (amount > 100000) score -= 20;
  if (description.length < 15) score -= 10;
  if (lastSubmittedAt) {
    const lastDate = new Date(lastSubmittedAt);
    const now = new Date();
    const diffInDays = (now - lastDate) / (1000 * 60 * 60 * 24);
    if (diffInDays < 7) score -= 15;
  }
  return Math.max(score, 0);
}

// Submit a draw request
router.post('/draw-request', async (req, res) => {
  const { project, amount, description, project_number, property_location } = req.body;
  if (!project || !amount || !description || !project_number || !property_location) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data: lastDraw } = await supabase
    .from('draw_requests')
    .select('submitted_at')
    .eq('project', project)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const riskScore = calculateRiskScore({
    amount,
    description,
    lastSubmittedAt: lastDraw?.submitted_at
  });

  const { data, error } = await supabase
    .from('draw_requests')
    .insert([{ project, amount, description, project_number, property_location, status: 'submitted', risk_score: riskScore, submitted_at: new Date().toISOString() }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to submit draw request' });
  res.status(200).json({ message: 'Draw request submitted!', data });
});

// Review or approve a draw
router.post('/review-draw', async (req, res) => {
  const { id, status, comment } = req.body;
  if (!id || !status) return res.status(400).json({ message: 'Missing id or status' });

  const updates = { status, reviewed_at: new Date().toISOString() };
  if (status === 'approved') updates.approved_at = new Date().toISOString();
  if (status === 'funded') updates.funded_at = new Date().toISOString();
  if (status === 'rejected') {
    updates.rejected_at = new Date().toISOString();
    updates.review_comment = comment || '';
  }

  const { data, error } = await supabase
    .from('draw_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to update draw request' });

  recordFeedback({ decision_type: 'draw', entity_id: id, decision: status, comments: comment || '' });
  retrainModel();
  res.status(200).json({ message: 'Draw request updated', data });
});

// List draw requests
router.get('/get-draws', async (req, res) => {
  const { status, project } = req.query;
  let q = supabase
    .from('draw_requests')
    .select(`
      id,
      project,
      amount,
      description,
      project_number,
      property_location,
      status,
      submitted_at    as submittedAt,
      reviewed_at     as reviewedAt,
      approved_at     as approvedAt,
      rejected_at     as rejectedAt,
      funded_at       as fundedAt,
      review_comment  as reviewComment,
      risk_score      as riskScore
    `)
    .order('submitted_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (project) q = q.eq('project', project);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to fetch draw requests' });
  res.json({ draws: data });
});

// Single draw
router.get('/draw-requests/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('draw_requests')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(500).json({ message: 'Failed to fetch draw request' });
  res.json({ draw: data });
});

// Export draws
router.get('/draw-requests/export', async (req, res) => {
  const { status } = req.query;
  let q = supabase.from('draw_requests').select('id, project, amount, status, submitted_at');
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to export draws' });
  const header = 'id,project,amount,status,submitted_at';
  const rows = data.map(d => [d.id, d.project, d.amount, d.status, d.submitted_at].join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.send([header, ...rows].join('\n'));
});

// Update draw
router.put('/draw-requests/:id', async (req, res) => {
  const updates = req.body || {};
  const { data, error } = await supabase
    .from('draw_requests')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update draw' });
  res.json({ draw: data });
});

// Delete draw
router.delete('/draw-requests/:id', async (req, res) => {
  const { error } = await supabase.from('draw_requests').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ message: 'Failed to delete draw' });
  res.json({ message: 'Deleted' });
});

// Upload lien waiver
router.post('/upload-lien-waiver', upload.single('file'), async (req, res) => {
  const { draw_id, contractor_name, waiver_type } = req.body;
  if (!draw_id || !contractor_name || !waiver_type || !req.file) {
    return res.status(400).json({ message: 'Missing required fields or file' });
  }
  const filePath = `lien-waivers/${draw_id}/${Date.now()}_${req.file.originalname}`;
  const { error: uploadError } = await supabase.storage
    .from('draw-inspections')
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
  if (uploadError) return res.status(500).json({ message: 'File upload failed' });
  const fileUrl = supabase.storage.from('draw-inspections').getPublicUrl(filePath).publicURL;
  const aiReport = await Promise.resolve({ errors: [], fields: {} });
  const passed = aiReport.errors.length === 0;
  const { data, error } = await supabase
    .from('lien_waivers')
    .insert([{ draw_id: parseInt(draw_id, 10), contractor_name, waiver_type, file_url: fileUrl, verified_at: new Date().toISOString(), verification_passed: passed, verification_report: aiReport }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to save waiver' });
  res.status(200).json({ message: 'Lien waiver uploaded', data });
});

// List lien waivers
router.get('/list-lien-waivers', async (req, res) => {
  const { draw_id, project_id } = req.query;
  if (!draw_id && !project_id) return res.status(400).json({ message: 'Missing draw_id or project_id' });
  let q = supabase.from('lien_waivers').select('id, contractor_name, waiver_type, file_url, verified_at, verification_passed, draw_id, project_id');
  if (draw_id) q = q.eq('draw_id', draw_id);
  if (project_id) q = q.eq('project_id', project_id);
  const { data, error } = await q.order('verified_at', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to list waivers' });
  res.json({ waivers: data });
});

router.get('/lien-waivers/:id', async (req, res) => {
  const { data, error } = await supabase.from('lien_waivers').select('*').eq('id', req.params.id).single();
  if (error) return res.status(500).json({ message: 'Failed to fetch waiver' });
  res.json({ waiver: data });
});

router.put('/lien-waivers/:id', async (req, res) => {
  const { data, error } = await supabase.from('lien_waivers').update(req.body || {}).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ message: 'Failed to update waiver' });
  res.json({ waiver: data });
});

router.delete('/lien-waivers/:id', async (req, res) => {
  const { error } = await supabase.from('lien_waivers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ message: 'Failed to delete waiver' });
  res.json({ message: 'Deleted' });
});

router.get('/lien-waivers/export', async (req, res) => {
  const { draw_id, project_id } = req.query;
  let q = supabase.from('lien_waivers').select('id, contractor_name, waiver_type, verification_passed, draw_id, project_id, verified_at');
  if (draw_id) q = q.eq('draw_id', draw_id);
  if (project_id) q = q.eq('project_id', project_id);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to export waivers' });
  const header = 'id,contractor_name,waiver_type,verification_passed,draw_id,project_id,verified_at';
  const rows = data.map(w => [w.id, w.contractor_name, w.waiver_type, w.verification_passed, w.draw_id, w.project_id, w.verified_at].join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.send([header, ...rows].join('\n'));
});

// Auto-generate lien waiver checklist for a draw
router.get('/waiver-checklist/:drawId', async (req, res) => {
  const { drawId } = req.params;
  const { data, error } = await supabase
    .from('lien_waivers')
    .select('waiver_type')
    .eq('draw_id', drawId);
  if (error) return res.status(500).json({ message: 'Failed to fetch waivers' });
  const types = (data || []).map(w => w.waiver_type.toLowerCase());
  const items = ['general contractor', 'subcontractor', 'supplier'];
  const checklist = items.map(it => ({
    item: `${it} waiver`,
    completed: types.some(t => t.includes(it))
  }));
  res.json({ checklist });
});

// List inspections
router.get('/list-inspections', async (req, res) => {
  const { draw_id, project_id } = req.query;
  if (!draw_id && !project_id) return res.status(400).json({ message: 'Missing draw_id or project_id' });
  let query = supabase.from('inspections').select('id, inspection_date, notes, draw_id, project_id');
  if (draw_id) query = query.eq('draw_id', draw_id);
  if (project_id) query = query.eq('project_id', project_id);
  query = query.order('inspection_date', { ascending: false });
  const { data, error } = await query;
  if (error) return res.status(500).json({ message: 'Failed to list inspections' });
  res.json({ inspections: data });
});

router.post('/hazard-loss', async (req, res) => {
  const { draw_id, part_i, follow_up, restoration } = req.body || {};
  if (!draw_id || !part_i) return res.status(400).json({ message: 'Missing draw_id or Part I data' });
  const { data, error } = await supabase
    .from('hazard_losses')
    .insert([{ draw_id, part_i, follow_up: follow_up || null, restoration: restoration || null }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to record hazard loss' });
  res.status(201).json({ hazard_loss: data });
});

module.exports = router;
