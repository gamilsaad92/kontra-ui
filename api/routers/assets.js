const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function summarizeTroubledAssetBuffer(buffer) {
  const text = buffer.toString('utf8');
  let notes = text.slice(0, 200);
  if (process.env.OPENAI_API_KEY) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Summarize the condition issues and next steps.' },
          { role: 'user', content: text.slice(0, 12000) }
        ]
      });
      notes = resp.choices[0].message.content.trim();
    } catch (err) {
      console.error('OpenAI troubled asset summary error:', err);
    }
  }
  return notes;
}

async function fetchRecentComps(asset) {
  const base = asset?.value ? parseFloat(asset.value) : 500000;
  return [
    { address: '123 Main St', sale_price: Math.round(base * 0.95) },
    { address: '456 Oak Ave', sale_price: Math.round(base * 1.05) }
  ];
}

async function suggestPriceAndBlurb(comps, features = {}) {
  let price_suggestion = null;
  let blurb = '';
  if (process.env.OPENAI_API_KEY) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a real estate marketing assistant.' },
          {
            role: 'user',
            content: `Given sale comps ${JSON.stringify(comps)} and property features ${JSON.stringify(features)}, recommend an asking price and short marketing blurb.`
          }
        ]
      });
      blurb = resp.choices[0].message.content.trim();
      const m = blurb.match(/\$([0-9,]+)/);
      if (m) price_suggestion = parseInt(m[1].replace(/,/g, ''), 10);
    } catch (err) {
      console.error('OpenAI price suggestion error:', err);
    }
  }
  return { price_suggestion, blurb };
}

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to fetch assets' });
  res.json({ assets: data });
});

router.post('/', async (req, res) => {
  const { name, value, status, occupancy } = req.body;
  if (!name) return res.status(400).json({ message: 'Missing name' });
  const { data, error } = await supabase
    .from('assets')
    .insert([{ name, value, status, occupancy }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create asset' });
  res.status(201).json({ asset: data });
});

router.get('/troubled', async (_req, res) => {
  const { data, error } = await supabase
    .from('assets')
    .select('id, name, address, status, predicted_risk')
    .gt('predicted_risk', 0.5)
    .order('predicted_risk', { ascending: false });
  if (error) return res.status(500).json({ assets: [] });
  res.json({ assets: data || [] });
});

router.post('/:id/upload', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ message: 'File required' });
  const filePath = `troubled/${id}/${Date.now()}_${req.file.originalname}`;
  const { error: upErr } = await supabase.storage
    .from('asset-inspections')
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
  if (upErr) {
    console.error('Upload error:', upErr);
    return res.status(500).json({ message: 'File upload failed' });
  }
  const fileUrl = supabase.storage
    .from('asset-inspections')
    .getPublicUrl(filePath).publicURL;
  const ai_notes = await summarizeTroubledAssetBuffer(req.file.buffer);
  const { data, error } = await supabase
    .from('troubled_assets')
    .insert([{ asset_id: parseInt(id, 10), file_url: fileUrl, ai_notes }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to record troubled asset' });
  res.status(201).json({ troubled_asset: data });
});

router.post('/:id/revive', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: asset, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    let data_json = {};
    try {
      data_json = typeof asset.data_json === 'string' ? JSON.parse(asset.data_json) : asset.data_json || {};
    } catch {}
    const comps = await fetchRecentComps(asset);
    const { price_suggestion, blurb } = await suggestPriceAndBlurb(comps, data_json);
    if (price_suggestion !== null) data_json.price_suggestion = price_suggestion;
    if (blurb) data_json.ai_notes = blurb;
    const { data: updated, error: upErr } = await supabase
      .from('assets')
      .update({ status: 'revived', data_json, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (upErr) throw upErr;
    res.json({ asset: updated });
  } catch (err) {
    console.error('Asset revive error:', err);
    res.status(500).json({ message: 'Failed to revive asset' });
  }
});

router.get('/revived', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('id, address, status, data_json')
      .eq('status', 'revived')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const assets = (data || []).map(a => {
      let dj = {};
      try {
        dj = typeof a.data_json === 'string' ? JSON.parse(a.data_json) : a.data_json || {};
      } catch {}
      return {
        id: a.id,
        address: a.address,
        status: a.status,
        price_suggestion: dj.price_suggestion ?? null,
        blurb: dj.ai_notes || ''
      };
    });
    res.json({ assets });
  } catch (err) {
    console.error('Revived assets fetch error:', err);
    res.status(500).json({ assets: [] });
  }
});

module.exports = router;
