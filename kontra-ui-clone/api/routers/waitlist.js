const express = require('express');
const router = express.Router();

let _pg = null;
function getPg() {
  if (!_pg && process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      _pg = new Pool({ connectionString: process.env.DATABASE_URL });
      _pg.query(`
        CREATE TABLE IF NOT EXISTS waitlist (
          id         SERIAL PRIMARY KEY,
          name       TEXT NOT NULL,
          email      TEXT NOT NULL UNIQUE,
          company    TEXT,
          role       TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `).then(() => console.log('[waitlist] table ready'))
        .catch(e => console.warn('[waitlist] table init:', e.message));
    } catch (e) {
      console.warn('[waitlist] pg unavailable:', e.message);
    }
  }
  return _pg;
}

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'kontra2024';
const memList = [];

router.post('/waitlist', async (req, res) => {
  const { name, email, company, role } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

  const entry = { name, email, company, role, created_at: new Date().toISOString() };
  memList.unshift(entry);

  const pg = getPg();
  if (pg) {
    try {
      await pg.query(
        `INSERT INTO waitlist (name, email, company, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [name, email, company || null, role || null]
      );
    } catch (e) {
      console.warn('[waitlist] insert error:', e.message);
    }
  }
  return res.json({ ok: true });
});

router.get('/waitlist', async (req, res) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const pg = getPg();
  if (pg) {
    try {
      const { rows } = await pg.query('SELECT * FROM waitlist ORDER BY created_at DESC');
      return res.json({ entries: rows });
    } catch {}
  }
  return res.json({ entries: memList });
});

getPg();
module.exports = { router };
