/**
 * events.js — Cross-portal activity event stream
 * POST /api/events  — record an event
 * GET  /api/events  — fetch recent events (last 50)
 */
const express = require('express');
const router  = express.Router();

const SEED_EVENTS = [
  { portal:'lender',   actor:'Sarah K.',        action:'Originated loan LN-4521',         detail:'$12.5M · Multifamily · Austin, TX',          ts: Date.now() - 1000*60*2  },
  { portal:'servicer', actor:'Draw Engine',      action:'Approved draw #3 for LN-2847',    detail:'$340,000 released · construction 71% complete', ts: Date.now() - 1000*60*7  },
  { portal:'agent',    actor:'Covenant Agent',   action:'Flagged DSCR watch on LN-3204',   detail:'DSCR 1.21x — covenant floor 1.20x',           ts: Date.now() - 1000*60*14 },
  { portal:'investor', actor:'0x7f3…a91',        action:'Purchased 500 KTRA-2847 tokens',  detail:'$51,365 · NAV $102.73',                        ts: Date.now() - 1000*60*22 },
  { portal:'lender',   actor:'AI Underwriter',   action:'Generated term sheet for LN-4521', detail:'65% LTV · SOFR+275 · 5yr IO',                ts: Date.now() - 1000*60*31 },
  { portal:'servicer', actor:'Inspection Bot',   action:'Completed inspection LN-2741',    detail:'Score 88/100 · No material deficiencies',      ts: Date.now() - 1000*60*45 },
  { portal:'borrower', actor:'Westlake RE',      action:'Submitted Q1 financials',          detail:'LN-2847 · NOI $2.31M · DSCR 1.42x',          ts: Date.now() - 1000*60*58 },
  { portal:'lender',   actor:'Policy Engine',    action:'Rate lock approved LN-4521',       detail:'6.875% fixed · 60-day lock',                  ts: Date.now() - 1000*60*72 },
];

const memEvents = [...SEED_EVENTS];

const PORTAL_COLORS = {
  lender:   { bg: '#800020', label: 'Lender'   },
  servicer: { bg: '#D97706', label: 'Servicer' },
  investor: { bg: '#7C3AED', label: 'Investor' },
  borrower: { bg: '#059669', label: 'Borrower' },
  agent:    { bg: '#0EA5E9', label: 'AI Agent' },
};

router.post('/events', (req, res) => {
  const { portal, actor, action, detail } = req.body || {};
  if (!portal || !action) return res.status(400).json({ error: 'portal and action required' });
  const ev = { portal, actor: actor || 'System', action, detail: detail || '', ts: Date.now() };
  memEvents.unshift(ev);
  if (memEvents.length > 200) memEvents.pop();
  return res.json({ ok: true, event: ev });
});

router.get('/events', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  return res.json({
    events: memEvents.slice(0, limit).map(e => ({
      ...e,
      portalMeta: PORTAL_COLORS[e.portal] || { bg: '#64748B', label: e.portal },
      relativeTime: formatRelative(e.ts),
    })),
  });
});

function formatRelative(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}

module.exports = { router };
