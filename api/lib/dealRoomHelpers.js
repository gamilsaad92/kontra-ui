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
  // schema cache is stale, so we always prefer deal_type inference for standard packs.
  const { data } = await supabase.from('deal_rooms')
    .select('workflow_pack_id, deal_type')
    .eq('property_id', propertyId).maybeSingle();
  if (!data) return DEFAULT_PACK_ID;
  // Custom workspace packs (ws_* IDs) always win — mirrors frontend resolvePackId in
  // workflowPacks/index.js. These packs were explicitly built for this workspace and
  // contain the actual roles/docs/stages chosen at creation; deal_type is only a fallback
  // for rooms created before the pack system existed.
  if (data.workflow_pack_id && data.workflow_pack_id.startsWith('ws_')) {
    return data.workflow_pack_id;
  }
  // deal_type inference for standard (non-ws_*) packs
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

    // ── Fetch stored VAP (generated by advance endpoint) or fall back to stored record ─
    // The verifiedAssetPackage router's generateAndStoreVAP is called by the advance
    // endpoint before sealClosingRecord, so the VAP should already exist in the table.
    // We read it here to embed a permanent copy in the closing record snapshot.
    let vapSnapshot = null;
    try {
      const { data: storedVAP } = await supabase
        .from('verified_asset_packages')
        .select('package, generated_at, sealed')
        .eq('property_id', propertyId)
        .maybeSingle();
      if (storedVAP?.package) {
        vapSnapshot = storedVAP.package;
      }
    } catch (vapErr) {
      // Table may not exist yet in older environments — non-fatal
      console.warn('[closing_record] VAP fetch skipped:', vapErr.message);
    }

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
      // Permanent copy of the Verified Asset Package at the time of funding
      verified_asset_package: vapSnapshot,
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
      console.log(`[closing_record] sealed — ${propertyId} (${documents.length} docs, ${parties.length} parties, VAP embedded: ${!!vapSnapshot})`);
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

// ── Notification audit log ─────────────────────────────────────────────────
// Appends a record to deal_notifications so owners can see what emails were sent.
// Fails silently if the table doesn't exist yet (migration may be pending).
async function logNotification(propertyId, type, toEmail, subject) {
  try {
    await supabase.from('deal_notifications').insert({
      property_id: propertyId,
      type,
      to_email: toEmail,
      subject,
      sent_at: new Date().toISOString(),
    });
  } catch (_) { /* silent — table may not exist */ }
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
    const subject = `${submitterName} submitted their documents — ${propName}`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Kontra <notifications@kontraplatform.com>',
        to: room.customer_email,
        subject,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
          <h2 style="color:#800020;margin-bottom:4px">Party documents submitted</h2>
          <p style="color:#555">Hi ${ownerName},</p>
          <p style="color:#555">The <strong>${roleLabel}</strong> for <strong>${propName}</strong> has submitted their documents and signaled they are ready for review.</p>
          <a href="https://kontraplatform.com/deal-room/${propertyId}?role=owner" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">View Workspace →</a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · Transaction Intelligence</p>
        </div>`,
      }),
    });
    await logNotification(propertyId, 'party_submitted', room.customer_email, subject);
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
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px"><h2 style="color:#800020;margin-bottom:4px">Document ready for review</h2><p style="color:#555">Hi ${lenderRes.data.name || 'there'},</p><p style="color:#555">The <strong>${uploaderLabel}</strong> uploaded a <strong>${SECTION_LABELS[section] || section}</strong> to <strong>${propName}</strong>. AI has analyzed it and it is ready for your review.</p>${summary ? `<p style="background:#f9fafb;border-radius:8px;padding:12px;color:#374151;font-size:14px">${summary}</p>` : ''}<a href="https://kontraplatform.com/deal-room/${propertyId}?role=lender" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">Review Workspace →</a><p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · Transaction Intelligence</p></div>`,
      }),
    });
    const lenderSubject = `New document ready for review: ${SECTION_LABELS[section] || section} — ${propName}`;
    await logNotification(propertyId, 'lender_doc_ready', lenderRes.data.email, lenderSubject);
    console.log(`[notifyLender] sent for ${section}`);
  } catch (e) { console.warn('[notifyLender]', e.message); }
}

// ── Stage advance email — all submitted parties + owner ──────────────────────
// resolvedLabel is optional — pass it when the caller already knows the custom
// stage label so we avoid a second DB lookup for stages_config here.
async function notifyStageAdvance(propertyId, stage, resolvedLabel) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return;
  try {
    const [roomRes, subsRes] = await Promise.all([
      supabase.from('deal_rooms').select('customer_email, property_name, first_name, workflow_pack_id, stages_config').eq('property_id', propertyId).single(),
      supabase.from('party_submissions').select('email, name, role').eq('property_id', propertyId),
    ]);
    const room = roomRes.data;
    const propName = room?.property_name || propertyId;
    const packId = room?.workflow_pack_id || DEFAULT_PACK_ID;
    // Prefer caller-supplied label, then custom stages_config lookup, then pack default
    const customMatch = Array.isArray(room?.stages_config)
      ? room.stages_config.find(s => s.key === stage)
      : null;
    const stageLabel = resolvedLabel || customMatch?.label || getPackStageLabel(packId, stage);
    const makeHtml = (toName, toRole) => `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
      <h2 style="color:#800020;margin-bottom:4px">Deal stage updated</h2>
      <p style="color:#555">Hi ${toName || 'there'},</p>
      <p style="color:#555">The deal for <strong>${propName}</strong> has advanced to <strong>${stageLabel}</strong>.</p>
      <a href="https://kontraplatform.com/deal-room/${propertyId}?role=${toRole}" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">View Workspace →</a>
      <p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · Transaction Intelligence</p>
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
    const stageSubject = `Deal advanced to ${stageLabel} — ${propName}`;
    await Promise.allSettled(emails.map(({ to, name, role }) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Kontra <notifications@kontraplatform.com>',
          to,
          subject: stageSubject,
          html: makeHtml(name, role),
        }),
      })
    ));
    await Promise.allSettled(emails.map(({ to }) => logNotification(propertyId, 'stage_advance', to, stageSubject)));
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
          <a href="https://kontraplatform.com/deal-room/${propertyId}?role=owner" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">View Workspace →</a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · Transaction Intelligence</p>
        </div>`,
      }),
    });
    await logNotification(propertyId, 'status_change', room.customer_email, `${partyLabel} submission: ${statusLabel} — ${propName}`);
    console.log(`[notifyStatusChange] sent for ${subRole} → ${status}`);
  } catch (e) { console.warn('[notifyStatusChange]', e.message); }
}

// ── VAP-ready notification — sent once when stage advances to closing/funded ──
async function notifyVAPReady(propertyId, stage, resolvedLabel) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return;
  try {
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('customer_email, property_name, first_name')
      .eq('property_id', propertyId)
      .single();
    if (!room?.customer_email) return;
    const ownerName = room.first_name || 'there';
    const propName = room.property_name || propertyId;
    // Prefer a caller-supplied label (e.g. owner's custom stage name) over the hardcoded default
    const stageLabel = resolvedLabel || (stage === 'funded' ? 'Funded' : 'Closing');
    const vapSubject = `Your Verified Transaction Package is ready — ${propName}`;
    await sendResendEmail(RESEND_KEY, {
      from: 'Kontra <notifications@kontraplatform.com>',
      to: room.customer_email,
      subject: vapSubject,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
        <h2 style="color:#800020;margin-bottom:4px">Your Verified Transaction Package is ready</h2>
        <p style="color:#555">Hi ${ownerName},</p>
        <p style="color:#555">Your deal for <strong>${propName}</strong> has reached the <strong>${stageLabel}</strong> stage. Kontra has assembled a Verified Transaction Package — a permanent, structured record of this transaction that you can share with lenders, investors, and advisors.</p>
        <p style="color:#555"><strong>What's inside:</strong></p>
        <ul style="color:#555;padding-left:20px;line-height:1.8">
          <li>Verification score and AI-generated verification summary</li>
          <li>Complete audit trail of deal activity and document uploads</li>
          <li>Participant approvals and party submissions record</li>
          <li>Structured financial metrics and key legal terms</li>
          <li>JSON export for integration with your systems</li>
        </ul>
        <a href="https://kontraplatform.com/deal-room/${propertyId}?role=owner" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">View Verified Transaction Package →</a>
        <p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · Transaction Intelligence</p>
      </div>`,
    });
    await logNotification(propertyId, 'vap_ready', room.customer_email, vapSubject);
    console.log(`[notifyVAPReady] sent to ${room.customer_email} for stage=${stage}`);
  } catch (e) {
    console.warn('[notifyVAPReady]', e.message);
  }
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
    const ownerSubject = `New document uploaded: ${sectionLabel} — ${propName}`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Kontra <notifications@kontraplatform.com>',
        to: room.customer_email,
        subject: ownerSubject,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
          <h2 style="color:#800020;margin-bottom:4px">New document analyzed</h2>
          <p style="color:#555">Hi ${name},</p>
          <p style="color:#555">A <strong>${sectionLabel}</strong> was just uploaded to the workspace for <strong>${propName}</strong> and analyzed by AI.</p>
          ${summary ? `<p style="background:#f9fafb;border-radius:8px;padding:12px;color:#374151;font-size:14px">${summary}</p>` : ''}
          <a href="https://kontraplatform.com/deal-room/${propertyId}?role=owner" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">View Workspace →</a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · Transaction Intelligence</p>
        </div>`
      })
    });
    await logNotification(propertyId, 'doc_uploaded', room.customer_email, ownerSubject);
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
  notifyVAPReady,
  logNotification,
};
