// ── Custom Workflow Packs ────────────────────────────────────────────────────
//
// Backing store for packs assembled through the Workflow Pack Builder UI —
// the "no hand-coded .js file" path for Sprint 6. A custom pack is pure JSON
// (roles/stages/documents) that the frontend turns into a working pack at
// runtime via genericPackFactory.createGenericPack(config). This router is
// deliberately pack-agnostic: it doesn't validate domain semantics, only
// shape (id/name/roles/stages/documents present).
const express = require('express');
const router = express.Router();

let _pg = null;
function getPg() {
  if (!_pg && process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      _pg = new Pool({ connectionString: process.env.DATABASE_URL });
      _pg.query(`
        CREATE TABLE IF NOT EXISTS custom_workflow_packs (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          description TEXT,
          config      JSONB NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT NOW(),
          updated_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `).then(() => console.log('[workflow-packs] table ready'))
        .catch(e => console.warn('[workflow-packs] table init:', e.message));
    } catch (e) {
      console.warn('[workflow-packs] pg unavailable:', e.message);
    }
  }
  return _pg;
}

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

router.get('/workflow-packs', async (req, res) => {
  const pg = getPg();
  if (!pg) return res.json({ packs: [] });
  try {
    const { rows } = await pg.query(
      'SELECT id, name, description, config, created_at, updated_at FROM custom_workflow_packs ORDER BY created_at DESC'
    );
    return res.json({ packs: rows });
  } catch (e) {
    console.warn('[workflow-packs] list error:', e.message);
    return res.status(500).json({ error: 'Failed to list workflow packs' });
  }
});

router.get('/workflow-packs/:id', async (req, res) => {
  const pg = getPg();
  if (!pg) return res.status(404).json({ error: 'Not found' });
  try {
    const { rows } = await pg.query(
      'SELECT id, name, description, config, created_at, updated_at FROM custom_workflow_packs WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Workflow pack not found' });
    return res.json({ pack: rows[0] });
  } catch (e) {
    console.warn('[workflow-packs] get error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch workflow pack' });
  }
});

router.post('/workflow-packs', async (req, res) => {
  const pg = getPg();
  if (!pg) return res.status(503).json({ error: 'Database unavailable' });

  const { name, description = '', roles, stages, documents } = req.body || {};
  const config = { name, description, roles, stages, documents };
  const errors = validateConfig(config);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  let id = slugify(req.body?.id || name);
  if (!id) return res.status(400).json({ error: 'Could not derive a valid id from the pack name' });

  try {
    const { rows: existing } = await pg.query('SELECT id FROM custom_workflow_packs WHERE id = $1', [id]);
    if (existing[0]) {
      id = `${id}_${Date.now().toString(36)}`;
    }
    const { rows } = await pg.query(
      `INSERT INTO custom_workflow_packs (id, name, description, config)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, config, created_at, updated_at`,
      [id, name, description, JSON.stringify(config)]
    );
    return res.status(201).json({ pack: rows[0] });
  } catch (e) {
    console.warn('[workflow-packs] create error:', e.message);
    return res.status(500).json({ error: 'Failed to create workflow pack' });
  }
});

getPg();
module.exports = { router };
