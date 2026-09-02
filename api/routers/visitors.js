/**
 * visitors.js — Visitor tracking router for Kontra
 *
 * POST /api/track         — public, logs a page visit (called from frontend silently)
 * GET  /api/admin/visitors — admin-only, returns all visitor logs
 */
const express = require('express');
const router = express.Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'kontra2024';
const MAX_MEM = 1000;

let memVisitors = [];

// ── PostgreSQL (lazy init) ──────────────────────────────────────────────────
let _pg = null;
function getPg() {
  if (!_pg && process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      _pg = new Pool({ connectionString: process.env.DATABASE_URL });
      _pg.query(`
        CREATE TABLE IF NOT EXISTS visitor_logs (
          id          SERIAL PRIMARY KEY,
          ip          TEXT,
          company     TEXT,
          city        TEXT,
          country     TEXT,
          region      TEXT,
          org         TEXT,
          device      TEXT,
          browser     TEXT,
          os          TEXT,
          page        TEXT,
          portal      TEXT,
          referrer    TEXT,
          visited_at  TIMESTAMPTZ DEFAULT NOW()
        )
      `).then(() => console.log('[visitors] table ready'))
        .catch(e => console.warn('[visitors] table init:', e.message));
    } catch (e) {
      console.warn('[visitors] pg unavailable:', e.message);
    }
  }
  return _pg;
}

// ── User-agent parser ──────────────────────────────────────────────────────
function parseUA(ua = '') {
  const u = ua.toLowerCase();
  let browser = 'Unknown';
  if (u.includes('edg'))                                browser = 'Edge';
  else if (u.includes('chrome') && !u.includes('edg')) browser = 'Chrome';
  else if (u.includes('safari') && !u.includes('chrome')) browser = 'Safari';
  else if (u.includes('firefox'))                       browser = 'Firefox';
  else if (u.includes('opera'))                         browser = 'Opera';

  let os = 'Unknown';
  if (u.includes('windows'))                            os = 'Windows';
  else if (u.includes('android'))                       os = 'Android';
  else if (u.includes('iphone') || u.includes('ipad')) os = 'iOS';
  else if (u.includes('mac os'))                        os = 'macOS';
  else if (u.includes('linux'))                         os = 'Linux';

  const device = (u.includes('mobile') || u.includes('android') || u.includes('iphone'))
    ? 'Mobile' : (u.includes('tablet') || u.includes('ipad')) ? 'Tablet' : 'Desktop';

  return { browser, os, device };
}

// ── Get real IP ─────────────────────────────────────────────────────────────
function getIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || '';
}

// ── IP → geo via ip-api.com (free, no key) ─────────────────────────────────
async function geolocate(ip) {
  const isLocal = !ip || ip === '::1' || ip.startsWith('127.') ||
    ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');
  if (isLocal) {
    return { city: 'Local', country: 'Development', region: '', org: '', company: 'Local Dev' };
  }
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,country,regionName,org`,
      { signal: AbortSignal.timeout(3000) }
    );
    const d = await res.json();
    if (d.status === 'success') {
      return {
        city:    d.city || '',
        country: d.country || '',
        region:  d.regionName || '',
        org:     d.org || '',
        company: (d.org || '').replace(/^AS\d+\s+/, ''),
      };
    }
  } catch { /* timeout or parse error — skip */ }
  return { city: '', country: '', region: '', org: '', company: '' };
}

// ── Admin key guard ─────────────────────────────────────────────────────────
function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key === ADMIN_SECRET) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ── POST /api/track ─────────────────────────────────────────────────────────
router.post('/track', async (req, res) => {
  try {
    const ip = getIp(req);
    const ua = req.headers['user-agent'] || '';
    const { page = '/', portal = '', referrer = '' } = req.body || {};
    const { browser, os, device } = parseUA(ua);
    const geo = await geolocate(ip);

    const entry = {
      ip,
      company:    geo.company,
      city:       geo.city,
      country:    geo.country,
      region:     geo.region,
      org:        geo.org,
      device,
      browser,
      os,
      page,
      portal,
      referrer,
      visited_at: new Date().toISOString(),
    };

    // Memory store
    memVisitors.unshift(entry);
    if (memVisitors.length > MAX_MEM) memVisitors = memVisitors.slice(0, MAX_MEM);

    // Persist to PostgreSQL (fire and forget)
    const pg = getPg();
    if (pg) {
      pg.query(
        `INSERT INTO visitor_logs
           (ip, company, city, country, region, org, device, browser, os, page, portal, referrer)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [entry.ip, entry.company, entry.city, entry.country, entry.region,
         entry.org, entry.device, entry.browser, entry.os,
         entry.page, entry.portal, entry.referrer]
      ).catch(() => {});
    }

    return res.json({ ok: true });
  } catch {
    return res.json({ ok: false });
  }
});

// ── GET /api/admin/visitors ─────────────────────────────────────────────────
router.get('/admin/visitors', requireAdminKey, async (req, res) => {
  try {
    const pg = getPg();
    if (pg) {
      const { rows } = await pg.query(
        'SELECT * FROM visitor_logs ORDER BY visited_at DESC LIMIT 500'
      );
      return res.json({ visitors: rows });
    }
    return res.json({ visitors: memVisitors });
  } catch {
    return res.json({ visitors: memVisitors });
  }
});

// Initialize on load
getPg();

module.exports = { router };
