// routers/verifiedAssetPackage.js
// Assembles a Verified Asset Package for a deal room — a structured digital
// output summarising identity, verification, transaction record, and structured
// data extracted from uploaded documents + audit trail.
//
// Persistence layer:
//   - GET reads from verified_asset_packages only when a legacy package already exists
//   - Missing legacy packages are not generated from live state
//   - New immutable preparation artifacts use the snapshot-bound routes in index.js
//
// Share layer:
//   - POST /share generates a time-limited HMAC-signed token and optionally emails it
//   - GET  /api/public/verify/:token returns the read-only VAP for external viewers

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { supabase } = require('../db');
const { getRoomPackId, getPackStageConfig } = require('../lib/dealRoomHelpers');
const { selectActiveDocumentVersions } = require('../lib/documentVersions');
const { readTransactionState, getHazardLossRepairGate } = require('../lib/transactionState');
const { buildVerifiedAssetHandoff } = require('../lib/verifiedAssetHandoff');
const OpenAI = require('openai');
const cache = require('../cache');

// ── Share token helpers ──────────────────────────────────────────────────────
const SHARE_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'kontra-vap-share-fallback';
const SHARE_TTL_DAYS = 30;

function signShareToken(propertyId) {
  const expiresAt = Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(`${propertyId}:${expiresAt}`).toString('base64url');
  const sig = crypto.createHmac('sha256', SHARE_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyShareToken(token) {
  const [payload, sig] = (token || '').split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', SHARE_SECRET).update(payload).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  const [propertyId, expiresAtStr] = decoded.split(':');
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return null;
  return { propertyId, expiresAt };
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-not-configured' });

// ── Required document sections per pack + property type ──────────────────────
const REQUIRED_SECTIONS = {
  cre_acquisition: {
    Multifamily:        ['purchase_agreement', 'rent_roll', 'financials', 'insurance', 'inspection', 'environmental', 'title'],
    Office:             ['purchase_agreement', 'rent_roll', 'financials', 'insurance', 'inspection', 'estoppel', 'environmental', 'title'],
    Industrial:         ['purchase_agreement', 'financials', 'insurance', 'inspection', 'environmental', 'title'],
    Retail:             ['purchase_agreement', 'rent_roll', 'financials', 'insurance', 'inspection', 'title'],
    'Mixed-Use':        ['purchase_agreement', 'rent_roll', 'financials', 'insurance', 'inspection', 'title'],
    'Hotel / Hospitality': ['purchase_agreement', 'financials', 'insurance', 'inspection', 'environmental', 'title'],
    'Self-Storage':     ['purchase_agreement', 'financials', 'insurance', 'inspection', 'title'],
    'Land / Development': ['purchase_agreement', 'financials', 'insurance', 'environmental', 'survey', 'title'],
    default:            ['purchase_agreement', 'financials', 'insurance', 'inspection', 'title'],
  },
  business_acquisition: {
    default: ['purchase_agreement', 'financials', 'tax_returns', 'legal', 'insurance'],
  },
  fundraising: {
    default: ['pitch_deck', 'financials', 'legal', 'cap_table'],
  },
};

function getRequiredSections(packId, propertyType) {
  const packMap = REQUIRED_SECTIONS[packId] || REQUIRED_SECTIONS.cre_acquisition;
  return packMap[propertyType] || packMap.default || [];
}

function isHazardLossRoom(room) {
  const text = [
    room?.property_name,
    room?.workflow_pack_id,
    room?.base_pack,
    room?.transaction_type,
    room?.metadata_values?.transaction_description,
    room?.metadata_values?.workspace_name,
  ].filter(Boolean).join(' ').toLowerCase();
  return /\bhazard\s+loss\b|\bcasualty\b|\binsurance\s+proceeds?\b/.test(text);
}

function computeCompletenessScore(uploadedSections, requiredSections) {
  if (!requiredSections.length) return 100;
  const uploaded = new Set(uploadedSections);
  const present = requiredSections.filter(s => uploaded.has(s)).length;
  return Math.round((present / requiredSections.length) * 100);
}

function computeTokenizationReadiness(room, analyses, submissions, packId) {
  const checks = [];

  const ownershipPass = submissions.length >= 2;
  checks.push({ label: 'Ownership structure documented', pass: ownershipPass,
    note: ownershipPass ? null : 'Fewer than 2 parties have submitted — add parties via invite links' });

  const legalPass = analyses.some(a => ['title', 'legal', 'purchase_agreement'].includes(a.section));
  checks.push({ label: 'Legal entity documents present', pass: legalPass,
    note: legalPass ? null : 'Upload a title commitment, purchase agreement, or legal documents' });

  const finPass = analyses.some(a => ['financials', 'rent_roll', 'tax_returns', 'pitch_deck'].includes(a.section));
  checks.push({ label: 'Financial data verified', pass: finPass,
    note: finPass ? null : 'Upload financial statements or rent roll' });

  // Use position-based terminal keys so custom-staged workspaces pass this check correctly
  const { lastKey, secondToLastKey } = getTerminalStageKeys(room, packId);
  const stagePass = [lastKey, secondToLastKey].includes(room.deal_stage);
  checks.push({ label: 'Transaction at verified stage', pass: stagePass,
    note: stagePass ? null : 'Advance the deal to the closing or final stage' });

  const score = checks.filter(c => c.pass).length * 25;
  return { score, checks };
}

function buildFallbackSummary(completenessScore, uploadedSections, missingSections, riskFindings) {
  const status = completenessScore >= 80 ? 'Conditionally Verified' : completenessScore >= 50 ? 'Partially Verified' : 'Pending';
  return {
    headline: `${status} — ${uploadedSections.length} document type${uploadedSections.length !== 1 ? 's' : ''} reviewed`,
    status,
    summary: `${uploadedSections.length} document type${uploadedSections.length !== 1 ? 's' : ''} have been uploaded and analyzed by AI. ${missingSections.length > 0 ? `${missingSections.length} required document${missingSections.length !== 1 ? 's are' : ' is'} still missing.` : 'All required documents are present.'}`,
    keyFindings: riskFindings.slice(0, 3),
    confidence: completenessScore,
  };
}

// ── Derive terminal stage keys from custom config or pack defaults ────────────
// last stage  = "funded equivalent"  (seal + close record)
// second-to-last = "closing equivalent" (preview VAP, no seal)
function getTerminalStageKeys(room, packId) {
  const stages = Array.isArray(room?.stages_config) && room.stages_config.length >= 2
    ? room.stages_config
    : (getPackStageConfig(packId)?.stages || []);
  if (stages.length < 2) return { lastKey: 'funded', secondToLastKey: 'closing' };
  return {
    lastKey: stages[stages.length - 1].key,
    secondToLastKey: stages[stages.length - 2].key,
  };
}

// ── Core package builder ─────────────────────────────────────────────────────
// Exported so sealClosingRecord can call it without re-fetching everything.
async function buildVAP(propertyId) {
  const [roomRes, analysesRes, eventsRes, submissionsRes, transactionState, approvalsRes, historyRes] = await Promise.all([
    supabase.from('deal_rooms')
      .select('property_name, property_type, deal_amount, address, customer_email, first_name, activated_at, deal_stage, workflow_pack_id, deal_type, stages_config, metadata_values, settlement_mode')
      .eq('property_id', propertyId).maybeSingle(),
    supabase.from('deal_analyses')
      .select('id, section, filename, uploaded_by_role, created_at, analysis, is_active, superseded_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true }),
    supabase.from('deal_events')
      .select('event_type, actor_role, actor_name, description, metadata, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true }),
    supabase.from('party_submissions')
      .select('role, name, status, submitted_at')
      .eq('property_id', propertyId),
    readTransactionState(propertyId),
    supabase.from('transaction_record_approvals')
      .select('field_id, action, actor_role, is_manual, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true }),
    supabase.from('transaction_record_history')
      .select('field_id, event_type, new_status, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true }),
  ]);

  const room = roomRes.data;
  if (!room) throw new Error('Deal room not found');

  // The package is a live decision artifact. Historical replacements are
  // retained in deal_analyses for audit, but never contribute facts or risks.
  const analyses = selectActiveDocumentVersions(analysesRes.data || []);
  const events = eventsRes.data || [];
  const submissions = submissionsRes.data || [];

  const packId = await getRoomPackId(propertyId);
  const requiredSections = getRequiredSections(packId, room.property_type);
  const uploadedSections = [...new Set(analyses.map(a => a.section))];
  const missingSections = requiredSections.filter(s => !uploadedSections.includes(s));
  const completenessScore = computeCompletenessScore(uploadedSections, requiredSections);

  const riskFindings = [];
  for (const a of analyses) {
    const an = a.analysis || {};
    (an.redFlags || []).slice(0, 2).forEach(f =>
      riskFindings.push(typeof f === 'string' ? f : (f.issue || JSON.stringify(f))));
    (an.lifeSafetyFindings || []).slice(0, 1).forEach(f =>
      riskFindings.push(typeof f === 'string' ? f : (f.issue || f.finding || JSON.stringify(f))));
    if (an.covenantStatus === 'Breached') riskFindings.push('Financial covenant breach detected');
  }

  const financialMetrics = {};
  const finAn = analyses.find(a => a.section === 'financials')?.analysis || {};
  if (finAn.noi) financialMetrics.noi = finAn.noi;
  if (finAn.capRate) financialMetrics.capRate = finAn.capRate;
  if (finAn.occupancy) financialMetrics.occupancy = finAn.occupancy;
  if (finAn.grossRevenue) financialMetrics.grossRevenue = finAn.grossRevenue;
  if (finAn.dscr) financialMetrics.dscr = finAn.dscr;
  if (finAn.ltv) financialMetrics.ltv = finAn.ltv;

  const legalTerms = {};
  const paAn = analyses.find(a => a.section === 'purchase_agreement')?.analysis || {};
  if (paAn.purchasePrice) legalTerms.purchasePrice = paAn.purchasePrice;
  if (paAn.closingDate) legalTerms.closingDate = paAn.closingDate;
  if (paAn.contingencies?.length) legalTerms.contingencies = paAn.contingencies.slice(0, 4);
  if (paAn.earnestMoney) legalTerms.earnestMoney = paAn.earnestMoney;
  if (paAn.dueDiligencePeriod) legalTerms.dueDiligencePeriod = paAn.dueDiligencePeriod;

  const tokenizationReadiness = computeTokenizationReadiness(room, analyses, submissions, packId);
  const sourceStateAt = (transactionState?.recordState?.fields || [])
    .map(field => field.updatedAt || field.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1) || room.activated_at || new Date().toISOString();
  const handoff = buildVerifiedAssetHandoff({
    propertyId,
    sourceStateAt,
    recordState: transactionState?.recordState,
    approvals: approvalsRes?.data || [],
    history: historyRes?.data || [],
    conflicts: transactionState?.conflicts || [],
    closingContext: {
      current_stage: room.deal_stage || null,
      deal_amount: room.deal_amount || null,
      settlement_mode: room.settlement_mode || null,
      participant_count: submissions.length,
      document_count: analyses.length,
    },
    readiness: room.metadata_values?.digital_asset_enabled
      ? tokenizationReadiness
      : null,
  });

  // AI verification summary — cached per deal room (keyed by uploaded sections)
  const aiCacheKey = `vap-ai:${propertyId}:${uploadedSections.sort().join(',')}`;
  let aiSummary = await cache.get(aiCacheKey);
  if (!aiSummary) {
    try {
      const prompt = `You are a transaction verification specialist reviewing a completed deal room.

Deal: ${room.property_name || propertyId}
Type: ${room.property_type || 'Commercial Real Estate'}
Deal Amount: ${room.deal_amount || 'Not specified'}
Address: ${room.address || 'Not specified'}
Stage: ${room.deal_stage || 'closing'}
Documents uploaded: ${uploadedSections.join(', ') || 'none'}
Missing required documents: ${missingSections.join(', ') || 'none'}
Parties submitted: ${submissions.length} (${submissions.map(s => s.role).join(', ')})
Risk findings: ${riskFindings.slice(0, 3).join('; ') || 'none identified'}

Write a concise verification summary. Respond with valid JSON only:
{
  "headline": "one sentence — verification status and key outcome, e.g. \"Verified — 7 document types reviewed\"",
  "status": "Verified" or "Conditionally Verified" or "Pending",
  "summary": "2-3 sentence paragraph — what was verified, parties involved, any notable findings",
  "keyFindings": ["finding 1", "finding 2"],
  "confidence": <integer 0-100>
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 450,
      });
      aiSummary = JSON.parse(completion.choices[0].message.content);
      // Guard against the model returning template placeholders literally (e.g. "${uploadedSections.length}")
      if (typeof aiSummary.headline !== 'string' || aiSummary.headline.includes('${')) {
        aiSummary.headline = buildFallbackSummary(completenessScore, uploadedSections, missingSections, riskFindings).headline;
      }
      await cache.set(aiCacheKey, aiSummary, 600);
    } catch (e) {
      console.warn('[vap] AI summary failed:', e.message);
      aiSummary = buildFallbackSummary(completenessScore, uploadedSections, missingSections, riskFindings);
    }
  }

  return {
    generated_at: new Date().toISOString(),

    identity: {
      asset_name: room.property_name || propertyId,
      asset_type: room.property_type || 'Commercial',
      address: room.address || null,
      deal_amount: room.deal_amount || null,
      workflow_pack: packId,
      deal_stage: room.deal_stage || 'closing',
      owner_first_name: room.first_name || null,
      activated_at: room.activated_at || null,
      ownership_structure: submissions.map(s => ({
        role: s.role,
        name: s.name,
        status: s.status,
        submitted_at: s.submitted_at,
      })),
    },

    verification: {
      completeness_score: completenessScore,
      status: aiSummary.status || 'Pending',
      headline: aiSummary.headline || '',
      summary: aiSummary.summary || '',
      key_findings: aiSummary.keyFindings || [],
      confidence: aiSummary.confidence || completenessScore,
      missing_documents: missingSections,
      risk_findings: riskFindings.slice(0, 5),
      documents_reviewed: uploadedSections.length,
      required_total: requiredSections.length,
    },

    transaction_record: {
      participant_approvals: submissions.map(s => ({
        role: s.role,
        name: s.name,
        status: s.status,
        submitted_at: s.submitted_at,
      })),
      documents: analyses.map(a => ({
        section: a.section,
        filename: a.filename,
        uploaded_by: a.uploaded_by_role,
        uploaded_at: a.created_at,
      })),
      audit_trail: events.slice(-25).map(e => ({
        type: e.event_type,
        actor: e.actor_name || e.actor_role,
        description: e.description,
        timestamp: e.created_at,
      })),
      closing_timeline: {
        activated_at: room.activated_at,
        last_activity: events.length > 0 ? events[events.length - 1].created_at : null,
        current_stage: room.deal_stage,
        participant_count: submissions.length,
        document_count: analyses.length,
      },
    },

    structured_data: {
      financial_metrics: financialMetrics,
      key_legal_terms: legalTerms,
      document_inventory: uploadedSections,
      tokenization_readiness: tokenizationReadiness,
    },
    // Separate provider-neutral handoff contract. Existing package sections
    // remain unchanged for current consumers.
    handoff,
  };
}

// ── Persist a generated package to verified_asset_packages ──────────────────
// seal=true locks the record — further auto-regeneration will be skipped.
async function storeVAP(propertyId, pkg, seal = false) {
  try {
    const { data: existing } = await supabase.from('verified_asset_packages')
      .select('revision, handoff_key')
      .eq('property_id', propertyId)
      .maybeSingle();
    const revision = Number(existing?.revision || 0) + 1;
    const payload = {
        property_id: propertyId,
        package: pkg,
        generated_at: pkg.generated_at,
        sealed: seal,
        schema_version: pkg.handoff?.schema_version || null,
        revision,
        source_state_at: pkg.handoff?.source_state_at || null,
        handoff_key: pkg.handoff?.handoff_key || null,
        updated_at: new Date().toISOString(),
    };
    let { error } = await supabase.from('verified_asset_packages')
      .upsert(payload, { onConflict: 'property_id' });
    if (error && /column|schema cache/i.test(error.message || '')) {
      const legacyPayload = { ...payload };
      delete legacyPayload.schema_version;
      delete legacyPayload.revision;
      delete legacyPayload.source_state_at;
      delete legacyPayload.handoff_key;
      ({ error } = await supabase.from('verified_asset_packages')
        .upsert(legacyPayload, { onConflict: 'property_id' }));
    }
    if (error) {
      console.warn('[vap] storeVAP error:', error.message);
    } else {
      console.log(`[vap] stored${seal ? ' (sealed)' : ''} — ${propertyId}`);
    }
  } catch (e) {
    console.warn('[vap] storeVAP exception:', e.message);
  }
}

// ── GET /api/public/deal-room/:propertyId/verified-asset-package ─────────────
// Legacy read surface. It may serve an already-persisted legacy package, but
// it must never create one from live room state. New preparation artifacts use
// the snapshot-bound digital-asset-packages routes in api/index.js.
router.get('/api/public/deal-room/:propertyId/verified-asset-package', async (req, res) => {
  const { propertyId } = req.params;

  try {
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('property_name, workflow_pack_id, base_pack, transaction_type, metadata_values, deal_stage, stages_config')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (!room) return res.status(404).json({ error: 'Deal room not found' });
    if (isHazardLossRoom(room)) {
      const packId = await getRoomPackId(propertyId);
      const { lastKey, secondToLastKey } = getTerminalStageKeys(room, packId);
      if (![lastKey, secondToLastKey].includes(room.deal_stage)) {
        return res.status(409).json({
          error: 'VAP_LIFECYCLE_GATE',
          message: 'The Verified Transaction Package is available after the required lifecycle milestone is reached.',
          current_stage: room.deal_stage,
          required_stage: secondToLastKey,
        });
      }
      const transactionState = await readTransactionState(propertyId);
      const gate = getHazardLossRepairGate(transactionState);
      if (!gate.ok) {
        return res.status(409).json({
          error: 'VAP_HAZARD_LOSS_GATE',
          message: 'Confirm the required hazard-loss Transaction Record facts before generating the Verified Transaction Package.',
          unmet_fields: gate.unmetFields,
          unresolved_conflicts: gate.unresolvedConflicts,
        });
      }
    }
    // 1. Check for a persisted package
    const { data: stored } = await supabase
      .from('verified_asset_packages')
      .select('package, generated_at, sealed')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (stored?.package) {
      console.log(`[vap] serving stored package${stored.sealed ? ' (sealed)' : ''} — ${propertyId}`);
      return res.json({ ...stored.package, _stored: true, _sealed: stored.sealed });
    }

    return res.status(404).json({
      error: 'LEGACY_PACKAGE_NOT_FOUND',
      message: 'No legacy package is stored. Select an eligible immutable readiness snapshot to generate a Digital Asset Preparation Package.',
    });
  } catch (e) {
    console.error('[vap]', e.message);
    return res.status(500).json({ error: 'Failed to generate Verified Transaction Package' });
  }
});

// ── POST /api/public/deal-room/:propertyId/verified-asset-package/regenerate ─
// Allows the owner to force a fresh package. Sealed packages are protected
// unless ?force=true is passed (reserved for admin use).
router.post('/api/public/deal-room/:propertyId/verified-asset-package/regenerate', async (req, res) => {
  return res.status(410).json({
    error: 'SNAPSHOT_BOUND_PACKAGE_REQUIRED',
    message: 'Legacy package regeneration from live room state is disabled. Generate a Digital Asset Preparation Package from a selected eligible immutable readiness snapshot.',
  });
});

// ── POST /api/public/deal-room/:propertyId/verified-asset-package/share ──────
// Generates a signed 30-day read-only share link.
// Optional body: { email, recipientName } — if provided, sends the link via email.
router.post('/api/public/deal-room/:propertyId/verified-asset-package/share', async (req, res) => {
  const { propertyId } = req.params;
  const { email, recipientName } = req.body || {};

  try {
    // Verify the deal room exists and has a package worth sharing
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('property_name, customer_email, first_name, deal_stage')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (!room) {
      return res.status(404).json({ error: 'Deal room not found' });
    }

    const token = signShareToken(propertyId);
    const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Log the share event
    try {
      await supabase.from('deal_events').insert({
        property_id: propertyId,
        event_type: 'vap_shared',
        actor_role: 'owner',
        actor_name: room.first_name || 'Owner',
        description: email
          ? `Verified Transaction Package shared with ${email}`
          : 'Verified Transaction Package share link generated',
        metadata: JSON.stringify({ email: email || null, expires_at: expiresAt }),
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.warn('[vap/share] event log failed:', logErr.message);
    }

    // Send email via Resend if requested
    if (email) {
      const RESEND_KEY = process.env.RESEND_API_KEY;
      if (RESEND_KEY) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://kontraplatform.com';
        const shareUrl = `${frontendUrl}/verify/${token}`;
        const assetName = room.property_name || propertyId;
        const senderName = room.first_name || 'Your deal team';
        const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';

        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Kontra Platform <notifications@kontraplatform.com>',
              to: [email],
              subject: `Verified Transaction Package — ${assetName}`,
              html: `
                <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111827">
                  <div style="margin-bottom:24px">
                    <span style="font-size:22px;font-weight:900;color:#800020">Kontra</span>
                  </div>
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6">${greeting}</p>
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
                    ${senderName} has shared a <strong>Verified Transaction Package</strong> for
                    <strong>${assetName}</strong> with you.
                  </p>
                  <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6">
                    This package includes an AI-verified summary, transaction audit trail, structured
                    financial data, and tokenization readiness score for this asset.
                  </p>
                  <a href="${shareUrl}"
                    style="display:inline-block;background:#800020;color:#fff;font-size:14px;font-weight:700;
                           text-decoration:none;padding:12px 24px;border-radius:10px">
                    View Verified Transaction Package →
                  </a>
                  <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
                    This link expires in 30 days. It is read-only and does not grant access to the
                    full deal room.
                  </p>
                  <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0">
                  <p style="margin:0;font-size:11px;color:#d1d5db">Powered by Kontra · kontraplatform.com</p>
                </div>`,
            }),
          });
          console.log(`[vap/share] email sent to ${email} for ${propertyId}`);
        } catch (emailErr) {
          console.warn('[vap/share] email send failed:', emailErr.message);
        }
      }
    }

    return res.json({ token, expiresAt });
  } catch (e) {
    console.error('[vap/share]', e.message);
    return res.status(500).json({ error: 'Failed to generate share link' });
  }
});

// ── GET /api/public/verify/:token ─────────────────────────────────────────────
// Public read-only endpoint for shared VAP links. No auth required.
router.get('/api/public/verify/:token', async (req, res) => {
  const { token } = req.params;

  const decoded = verifyShareToken(token);
  if (!decoded) {
    return res.status(410).json({ error: 'This link has expired or is invalid.' });
  }

  const { propertyId, expiresAt } = decoded;

  try {
    // Try stored package first
    const { data: stored } = await supabase
      .from('verified_asset_packages')
      .select('package, generated_at, sealed')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (stored?.package) {
      return res.json({ ...stored.package, _shared: true, _expires_at: new Date(expiresAt).toISOString() });
    }

    return res.status(404).json({
      error: 'LEGACY_PACKAGE_NOT_FOUND',
      message: 'No persisted package is available for this share link.',
    });
  } catch (e) {
    console.error('[vap/verify]', e.message);
    return res.status(500).json({ error: 'Failed to load Verified Transaction Package' });
  }
});

module.exports = router;
module.exports.buildVAP = buildVAP;
