// dealRoomHelpers.js
// Shared helpers used by both the public deal-room routes (index.js) and the
// AI document-review router (routers/aiDealReview.js). Extracted so both call
// sites use one implementation instead of duplicating storage/event/email
// logic — see kontra-workflow-roles / kontra-workflow-packs memory notes for
// why role/stage labels must always resolve through the active Workflow Pack.
const { supabase } = require('../db');

// ── Lifecycle stage keys, per Workflow Pack ─────────────────────────────────
// Single source of truth lives in shared/workflowStages.json — the same file
// the frontend workflow pack modules (ui/src/lib/workflowPacks/*.js) import.
const WORKFLOW_STAGES_CONFIG = require('../../shared/workflowStages.json');
const DEFAULT_PACK_ID = 'cre_acquisition';

// ── Pack inference from deal_type (mirrors frontend lib/workflowPacks/index.js) ─
// When a room's workflow_pack_id is null or CRE-default, we infer the correct
// pack from deal_type so the task engine, briefing, and analyses always use
// the right pack without requiring a DB write (PostgREST schema cache may be
// stale for workflow_pack_id writes, but deal_type is a base column).
const DEAL_TYPE_TO_PACK = {
  full_acquisition:    'business_acquisition',
  asset_purchase:      'business_acquisition',
  stock_purchase:      'business_acquisition',
  business_acquisition:'business_acquisition',
  seed:                'fundraising',
  series_a:            'fundraising',
  series_b:            'fundraising',
  series_c:            'fundraising',
  debt_raise:          'fundraising',
  equity_raise:        'fundraising',
  fundraising:         'fundraising',
};

function getPackStageConfig(packId) {
  return WORKFLOW_STAGES_CONFIG[packId] || WORKFLOW_STAGES_CONFIG[DEFAULT_PACK_ID];
}
function getPackStageKeys(packId) {
  return getPackStageConfig(packId).stages.map(s => s.key);
}
function getPackStageLabel(packId, stageKey) {
  const stage = getPackStageConfig(packId).stages.find(s => s.key === stageKey);
  return stage ? stage.label : stageKey;
}

// ── Participant roles, per Workflow Pack ────────────────────────────────────
// Single source of truth lives in shared/workflowRoles.json — never hardcode
// a role key's meaning, since the same key can carry a different label in a
// different pack. Always resolve display names via getPackRoleLabel.
const WORKFLOW_ROLES_CONFIG = require('../../shared/workflowRoles.json');

function getPackRoleConfig(packId) {
  return WORKFLOW_ROLES_CONFIG[packId] || WORKFLOW_ROLES_CONFIG[DEFAULT_PACK_ID];
}
function getPackRoleLabel(packId, roleKey) {
  const role = getPackRoleConfig(packId).roles.find(r => r.key === roleKey);
  return role ? role.label : roleKey;
}
async function getRoomPackId(propertyId) {
  // Select both columns; workflow_pack_id may silently return null if PostgREST
  // schema cache is stale, so we always prefer deal_type inference first.
  const { data } = await supabase.from('deal_rooms')
    .select('workflow_pack_id, deal_type')
    .eq('property_id', propertyId).maybeSingle();
  if (!data) return DEFAULT_PACK_ID;
  // deal_type inference wins — mirrors frontend resolvePackId in workflowPacks/index.js
  const inferred = data.deal_type ? (DEAL_TYPE_TO_PACK[data.deal_type] ?? null) : null;
  if (inferred) return inferred;
  return data.workflow_pack_id || DEFAULT_PACK_ID;
}

// ── Shared email helper — logs Resend errors instead of swallowing them ──────
async function sendResendEmail(key, payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) {
    console.error('[resend-error]', r.status, JSON.stringify(data));
    throw new Error(data.message || `Resend error ${r.status}`);
  }
  console.log('[resend-ok] id:', data.id, 'to:', payload.to);
  return data;
}

// ── File versioning: count existing analyses for a section to derive version ──
async function getNextVersion(propertyId, section) {
  try {
    const { count } = await supabase
      .from('deal_analyses')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('section', section);
    return (count || 0) + 1;
  } catch { return 1; }
}

// ── Upload original file to Supabase Storage (fire-and-forget) ───────────────
async function uploadToStorage(buffer, mimetype, propertyId, section, filename) {
  try {
    const safe = (filename || 'doc').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${propertyId}/${section}/${Date.now()}-${safe}`;
    const { data, error } = await supabase.storage
      .from('deal-documents')
      .upload(path, buffer, { contentType: mimetype || 'application/octet-stream', upsert: false });
    if (error) { console.warn('[storage] upload failed:', error.message); return null; }
    console.log('[storage] saved:', path);
    return data.path;
  } catch (err) {
    console.warn('[storage] upload error:', err.message);
    return null;
  }
}

// ── Event logger ────────────────────────────────────────────────────────────
async function logEvent(propertyId, eventType, actorRole, actorName, description, metadata = {}) {
  try {
    await supabase.from('deal_events').insert({
      property_id: propertyId, event_type: eventType, actor_role: actorRole,
      actor_name: actorName, description, metadata,
    });
  } catch (e) { console.warn('[logEvent]', e.message); }
}

// ── Seals a closing record — called when deal_stage → funded ──────────────────
async function sealClosingRecord(propertyId) {
  try {
    const [roomRes, partiesRes, docsRes] = await Promise.all([
      supabase.from('deal_rooms')
        .select('property_name, property_type, deal_amount, address, customer_email, first_name, activated_at')
        .eq('property_id', propertyId).maybeSingle(),
      supabase.from('party_submissions')
        .select('role, name, email, status, submitted_at')
        .eq('property_id', propertyId),
      supabase.from('deal_analyses')
        .select('section, filename, uploaded_by_role, created_at, storage_path')
        .eq('property_id', propertyId),
    ]);
    const room = roomRes.data || {};
    const parties = partiesRes.data || [];
    const documents = docsRes.data || [];

    const snapshot = {
      sealed_at: new Date().toISOString(),
      asset_id: propertyId,
      property_name: room.property_name,
      property_type: room.property_type,
      deal_amount: room.deal_amount,
      address: room.address,
      owner_email: room.customer_email,
      activated_at: room.activated_at,
      parties: parties.map(p => ({
        role: p.role, name: p.name, email: p.email,
        status: p.status, submitted_at: p.submitted_at,
      })),
      documents: documents.map(d => ({
        section: d.section, filename: d.filename,
        uploaded_by: d.uploaded_by_role, uploaded_at: d.created_at,
      })),
      document_count: documents.length,
      participant_count: parties.length,
    };

    const { error } = await supabase.from('closing_records').insert({
      property_id: propertyId,
      asset_id: propertyId,
      property_name: room.property_name,
      property_type: room.property_type,
      deal_amount: room.deal_amount,
      owner_email: room.customer_email,
      document_count: documents.length,
      participant_count: parties.length,
      snapshot,
    });
    if (error) {
      console.warn('[closing_record] insert:', error.message);
    } else {
      console.log(`[closing_record] sealed — ${propertyId} (${documents.length} docs, ${parties.length} parties)`);
      logEvent(
        propertyId, 'ownership_transfer', 'owner', room.first_name || null,
        `Deal closed — ${room.property_name || propertyId} funding recorded`,
        { asset_id: propertyId, document_count: documents.length, participant_count: parties.length }
      ).catch(() => {});
    }
  } catch (e) {
    console.warn('[sealClosingRecord]', e.message);
  }
}

// ── Owner email notification helper ───────────────────────────────────────
async function notifyPartySubmitted(propertyId, role, name) {
  try {
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('customer_email, property_name, first_name, workflow_pack_id')
      .eq('property_id', propertyId)
      .single();
    if (!room?.customer_email) return;
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) return;
    const roleLabel = getPackRoleLabel(room.workflow_pack_id || DEFAULT_PACK_ID, role);
    const submitterName = name || roleLabel;
    const ownerName = room.first_name || 'there';
    const propName = room.property_name || propertyId;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Kontra <notifications@kontraplatform.com>',
        to: room.customer_email,
        subject: `${submitterName} submitted their documents — ${propName}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
          <h2 style="color:#800020;margin-bottom:4px">Party documents submitted</h2>
          <p style="color:#555">Hi ${ownerName},</p>
          <p style="color:#555">The <strong>${roleLabel}</strong> for <strong>${propName}</strong> has submitted their documents and signaled they are ready for review.</p>
          <a href="https://kontraplatform.com/deal-room/${propertyId}?role=owner" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">View Deal Room →</a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · CRE Deal Intelligence</p>
        </div>`,
      }),
    });
  } catch (e) {
    console.warn('[notifyPartySubmitted]', e.message);
  }
}

// ── Lender notification (inspector/insurer → lender) ───────────────────────
async function notifyLender(propertyId, uploaderRole, section, summary) {
  try {
    const [lenderRes, roomRes] = await Promise.all([
      supabase.from('party_submissions').select('email,name').eq('property_id', propertyId).eq('role', 'lender').maybeSingle(),
      supabase.from('deal_rooms').select('property_name, workflow_pack_id').eq('property_id', propertyId).single(),
    ]);
    if (!lenderRes.data?.email) return;
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) return;
    const propName = roomRes.data?.property_name || propertyId;
    const packId = roomRes.data?.workflow_pack_id || DEFAULT_PACK_ID;
    const SECTION_LABELS = { inspection: 'Inspection Report', insurance: 'Insurance Certificate', financials: 'Financial Statement', legal: 'Legal Document', 'brand-standards': 'Brand Standards / PIP' };
    const uploaderLabel = getPackRoleLabel(packId, uploaderRole);
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Kontra <notifications@kontraplatform.com>',
        to: lenderRes.data.email,
        subject: `New document ready for review: ${SECTION_LABELS[section] || section} — ${propName}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px"><h2 style="color:#800020;margin-bottom:4px">Document ready for review</h2><p style="color:#555">Hi ${lenderRes.data.name || 'there'},</p><p style="color:#555">The <strong>${uploaderLabel}</strong> uploaded a <strong>${SECTION_LABELS[section] || section}</strong> to <strong>${propName}</strong>. AI has analyzed it and it is ready for your review.</p>${summary ? `<p style="background:#f9fafb;border-radius:8px;padding:12px;color:#374151;font-size:14px">${summary}</p>` : ''}<a href="https://kontraplatform.com/deal-room/${propertyId}?role=lender" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">Review Deal Room →</a><p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · CRE Deal Intelligence</p></div>`,
      }),
    });
    console.log(`[notifyLender] sent for ${section}`);
  } catch (e) { console.warn('[notifyLender]', e.message); }
}

// ── Stage advance email — all submitted parties + owner ──────────────────────
async function notifyStageAdvance(propertyId, stage) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return;
  try {
    const [roomRes, subsRes] = await Promise.all([
      supabase.from('deal_rooms').select('customer_email, property_name, first_name, workflow_pack_id').eq('property_id', propertyId).single(),
      supabase.from('party_submissions').select('email, name, role').eq('property_id', propertyId),
    ]);
    const room = roomRes.data;
    const propName = room?.property_name || propertyId;
    const packId = room?.workflow_pack_id || DEFAULT_PACK_ID;
    const stageLabel = getPackStageLabel(packId, stage);
    const makeHtml = (toName, toRole) => `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
      <h2 style="color:#800020;margin-bottom:4px">Deal stage updated</h2>
      <p style="color:#555">Hi ${toName || 'there'},</p>
      <p style="color:#555">The deal for <strong>${propName}</strong> has advanced to <strong>${stageLabel}</strong>.</p>
      <a href="https://kontraplatform.com/deal-room/${propertyId}?role=${toRole}" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">View Deal Room →</a>
      <p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · CRE Deal Intelligence</p>
    </div>`;

    const emails = [];
    if (room?.customer_email) {
      emails.push({ to: room.customer_email, name: room.first_name, role: getPackRoleConfig(packId).roles.find(r => r.canManage)?.key || 'owner' });
    }
    for (const sub of subsRes.data || []) {
      if (sub.email && sub.email !== room?.customer_email) {
        emails.push({ to: sub.email, name: sub.name, role: sub.role });
      }
    }
    await Promise.allSettled(emails.map(({ to, name, role }) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Kontra <notifications@kontraplatform.com>',
          to,
          subject: `Deal advanced to ${stageLabel} — ${propName}`,
          html: makeHtml(name, role),
        }),
      })
    ));
    console.log(`[notifyStageAdvance] sent to ${emails.length} recipient(s) for stage=${stage}`);
  } catch (e) { console.warn('[notifyStageAdvance]', e.message); }
}

// ── Status change email — notify owner of the update ────────────────────────
async function notifyStatusChange(propertyId, subRole, status, statusNote, updaterRole) {
  const STATUS_LABELS = { approved: 'Approved ✓', needs_revision: 'Needs Revision', rejected: 'Rejected' };
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return;
  try {
    const { data: room } = await supabase.from('deal_rooms')
      .select('customer_email, property_name, first_name, workflow_pack_id').eq('property_id', propertyId).single();
    if (!room?.customer_email) return;
    const propName = room.property_name || propertyId;
    const packId = room.workflow_pack_id || DEFAULT_PACK_ID;
    const partyLabel = getPackRoleLabel(packId, subRole);
    const statusLabel = STATUS_LABELS[status] || status;
    const updaterLabel = getPackRoleLabel(packId, updaterRole);
    const noteHtml = statusNote ? `<p style="background:#f9fafb;border-radius:8px;padding:12px;color:#374151;font-size:14px;margin-top:8px">"${statusNote}"</p>` : '';
    const color = status === 'approved' ? '#16a34a' : status === 'rejected' ? '#dc2626' : '#d97706';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Kontra <notifications@kontraplatform.com>',
        to: room.customer_email,
        subject: `${partyLabel} submission: ${statusLabel} — ${propName}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
          <h2 style="color:${color};margin-bottom:4px">Submission status updated</h2>
          <p style="color:#555">Hi ${room.first_name || 'there'},</p>
          <p style="color:#555">The <strong>${partyLabel}</strong> submission for <strong>${propName}</strong> has been marked <strong style="color:${color}">${statusLabel}</strong> by the ${updaterLabel}.</p>
          ${noteHtml}
          <a href="https://kontraplatform.com/deal-room/${propertyId}?role=owner" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">View Deal Room →</a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · CRE Deal Intelligence</p>
        </div>`,
      }),
    });
    console.log(`[notifyStatusChange] sent for ${subRole} → ${status}`);
  } catch (e) { console.warn('[notifyStatusChange]', e.message); }
}

// ── Document-upload email to the deal-room owner ────────────────────────────
async function notifyOwner(propertyId, section, summary) {
  try {
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('customer_email, property_name, first_name')
      .eq('property_id', propertyId)
      .single();
    if (!room?.customer_email) return;
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) return;
    const sectionLabel = { inspection: 'Inspection Report', insurance: 'Insurance Certificate', financials: 'Financial Statement' }[section] || section;
    const name = room.first_name || 'there';
    const propName = room.property_name || propertyId;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Kontra <notifications@kontraplatform.com>',
        to: room.customer_email,
        subject: `New document uploaded: ${sectionLabel} — ${propName}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
          <h2 style="color:#800020;margin-bottom:4px">New document analyzed</h2>
          <p style="color:#555">Hi ${name},</p>
          <p style="color:#555">A <strong>${sectionLabel}</strong> was just uploaded to your deal room for <strong>${propName}</strong> and analyzed by AI.</p>
          ${summary ? `<p style="background:#f9fafb;border-radius:8px;padding:12px;color:#374151;font-size:14px">${summary}</p>` : ''}
          <a href="https://kontraplatform.com/deal-room/${propertyId}?role=owner" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">View Deal Room →</a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · CRE Deal Intelligence</p>
        </div>`
      })
    });
    console.log(`[notifyOwner] email sent to ${room.customer_email} for ${section}`);
  } catch (e) {
    console.warn('[notifyOwner]', e.message);
  }
}

module.exports = {
  DEFAULT_PACK_ID,
  WORKFLOW_STAGES_CONFIG,
  WORKFLOW_ROLES_CONFIG,
  getPackStageConfig,
  getPackStageKeys,
  getPackStageLabel,
  getPackRoleConfig,
  getPackRoleLabel,
  getRoomPackId,
  sendResendEmail,
  getNextVersion,
  uploadToStorage,
  logEvent,
  sealClosingRecord,
  notifyPartySubmitted,
  notifyLender,
  notifyStageAdvance,
  notifyStatusChange,
  notifyOwner,
};
