// ── Custom Workflow Packs ────────────────────────────────────────────────────
//
// Backing store for packs assembled through the Workflow Pack Builder UI.
// Uses the shared Supabase client so it works in both local dev (pgAdapter)
// and production (Render + Supabase) without needing a separate DATABASE_URL.
//
const express = require('express');
const router  = express.Router();
const { supabase } = require('../db');

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') return ['config must be an object'];
  if (!config.name || typeof config.name !== 'string') errors.push('name is required');
  if (!Array.isArray(config.roles) || config.roles.length === 0) errors.push('at least one role is required');
  if (Array.isArray(config.roles)) {
    for (const r of config.roles) {
      if (!r.key || !r.label) errors.push('each role needs a key and label');
    }
  }
  if (!Array.isArray(config.stages) || config.stages.length < 2) errors.push('at least two stages are required');
  if (Array.isArray(config.stages)) {
    for (const s of config.stages) {
      if (!s.key || !s.label) errors.push('each stage needs a key and label');
    }
  }
  if (!Array.isArray(config.documents) || config.documents.length === 0) errors.push('at least one document is required');
  if (Array.isArray(config.documents)) {
    for (const d of config.documents) {
      if (!d.id || !d.label) errors.push('each document needs an id and label');
    }
  }
  return errors;
}

// GET /api/workflow-packs — list all custom packs
router.get('/workflow-packs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('custom_workflow_packs')
      .select('id, name, description, config, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[workflow-packs] list error:', error.message);
      return res.status(500).json({ error: 'Failed to list workflow packs' });
    }
    return res.json({ packs: data || [] });
  } catch (e) {
    console.warn('[workflow-packs] list error:', e.message);
    return res.status(500).json({ error: 'Failed to list workflow packs' });
  }
});

// GET /api/workflow-packs/:id — fetch a single pack
router.get('/workflow-packs/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('custom_workflow_packs')
      .select('id, name, description, config, created_at, updated_at')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Workflow pack not found' });
    return res.json({ pack: data });
  } catch (e) {
    console.warn('[workflow-packs] get error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch workflow pack' });
  }
});

// POST /api/workflow-packs — create a new custom pack
router.post('/workflow-packs', async (req, res) => {
  const { name, description = '', roles, stages, documents } = req.body || {};
  const config = { name, description, roles, stages, documents };
  const errors = validateConfig(config);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  let id = slugify(req.body?.id || name);
  if (!id) return res.status(400).json({ error: 'Could not derive a valid id from the pack name' });

  try {
    // Ensure uniqueness
    const { data: existing } = await supabase
      .from('custom_workflow_packs')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (existing) {
      id = `${id}_${Date.now().toString(36)}`;
    }

    const { data, error } = await supabase
      .from('custom_workflow_packs')
      .insert({ id, name, description, config })
      .select('id, name, description, config, created_at, updated_at')
      .single();

    if (error) {
      console.warn('[workflow-packs] create error:', error.message);
      return res.status(500).json({ error: 'Failed to create workflow pack' });
    }
    return res.status(201).json({ pack: data });
  } catch (e) {
    console.warn('[workflow-packs] create error:', e.message);
    return res.status(500).json({ error: 'Failed to create workflow pack' });
  }
});

// DELETE /api/workflow-packs/:id — remove a custom pack
router.delete('/workflow-packs/:id', async (req, res) => {
  const { id } = req.params;
  // Guard: never allow deleting the built-in packs
  const BUILTIN = ['cre_acquisition', 'business_acquisition', 'fundraising'];
  if (BUILTIN.includes(id)) {
    return res.status(403).json({ error: 'Built-in packs cannot be deleted' });
  }
  try {
    const { error } = await supabase
      .from('custom_workflow_packs')
      .delete()
      .eq('id', id);
    if (error) {
      console.warn('[workflow-packs] delete error:', error.message);
      return res.status(500).json({ error: 'Failed to delete workflow pack' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.warn('[workflow-packs] delete error:', e.message);
    return res.status(500).json({ error: 'Failed to delete workflow pack' });
  }
});

module.exports = { router };
