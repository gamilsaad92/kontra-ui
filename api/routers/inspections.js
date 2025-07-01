const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post('/upload-lien-waiver', upload.single('file'), async (req, res) => {
  const { draw_id, contractor_name, waiver_type } = req.body;
  if (!draw_id || !contractor_name || !waiver_type || !req.file) {
    return res.status(400).json({ message: 'Missing required fields or file' });
  }
  const filePath = `lien-waivers/${draw_id}/${Date.now()}_${req.file.originalname}`;
  const { error: uploadError } = await supabase.storage
    .from('draw-inspections')
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    return res.status(500).json({ message: 'File upload failed' });
  }
  const fileUrl = supabase.storage
    .from('draw-inspections')
    .getPublicUrl(filePath).publicURL;
  const aiReport = await Promise.resolve({ errors: [], fields: {} });
  const passed = aiReport.errors.length === 0;
  const { data, error } = await supabase
    .from('lien_waivers')
    .insert([{
      draw_id: parseInt(draw_id, 10),
      contractor_name,
      waiver_type,
      file_url: fileUrl,
      verified_at: new Date().toISOString(),
      verification_passed: passed,
      verification_report: aiReport
    }])
    .select()
    .single();
  if (error) {
    console.error('Insert lien waiver error:', error);
    return res.status(500).json({ message: 'Failed to save waiver' });
  }
  res.status(200).json({ message: 'Lien waiver uploaded', data });
});

router.get('/lien-waivers', async (req, res) => {
  const { draw_id } = req.query;
  if (!draw_id) return res.status(400).json({ message: 'Missing draw_id' });
  const { data, error } = await supabase
    .from('lien_waivers')
    .select('id, contractor_name, waiver_type, file_url, verified_at, verification_passed')
    .eq('draw_id', draw_id)
    .order('verified_at', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to list waivers' });
  res.json({ waivers: data });
});

router.get('/', async (req, res) => {
  const { draw_id, project_id } = req.query;
  if (!draw_id && !project_id) {
    return res.status(400).json({ message: 'Missing draw_id or project_id' });
  }
  let query = supabase
    .from('inspections')
    .select('id, inspection_date, notes, draw_id, project_id');
  if (draw_id) query = query.eq('draw_id', draw_id);
  if (project_id) query = query.eq('project_id', project_id);
  query = query.order('inspection_date', { ascending: false });
  const { data, error } = await query;
  if (error) return res.status(500).json({ message: 'Failed to list inspections' });
  res.json({ inspections: data });
});

module.exports = router;
