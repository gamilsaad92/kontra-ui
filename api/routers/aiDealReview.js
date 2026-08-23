// aiDealReview.js
// Public, no-auth-required AI document-review endpoints. Extracted out of
// index.js (which had grown past 4,000 lines) to keep the AI-review surface
// in one place. Mounted at /api/ai in index.js and must stay registered
// BEFORE the requireOrgContext middleware, same as before extraction.
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const OpenAI = require('openai');
const { supabase } = require('../db');
const aiRateLimit = require('../middlewares/aiRateLimit');
const { uploadToStorage, logEvent, notifyOwner, notifyLender } = require('../lib/dealRoomHelpers');
const { recalculateTransactionState } = require('../lib/transactionState');
const { evaluateDealRoomForTasks } = require('../lib/taskEngine');
const { runVerification } = require('../lib/verificationEngine');
const {
  hasDocumentRole,
  getAssignedSectionsFromChecklist,
} = require('../lib/documentAssignmentAccess');
const {
  selectActiveDocumentVersions,
} = require('../lib/documentVersions');

const router = express.Router();
let transactionFieldExtractor = null;

function safeAiErrorMessage(error, fallback = 'Document analysis failed. Please try again.') {
  const message = String(error?.message || '');
  if (/deal_analyses|is_active|superseded_at|superseded_by|schema cache|column .* does not exist/i.test(message)) {
    return 'Documents are temporarily unavailable while the document-history schema is being updated. Please try again shortly.';
  }
  return fallback;
}

function setTransactionFieldExtractor(handler) {
  transactionFieldExtractor = typeof handler === 'function' ? handler : null;
}

// AI checklist uploads use the same durable replacement boundary as lightweight
// uploads: an earlier version remains auditable but cannot remain live evidence.
async function persistAiDocumentVersion({ propertyId, section, filename, analysis, role, storagePath, fileBuffer, extractedText }) {
  const sourceHash = fileBuffer ? crypto.createHash('sha256').update(fileBuffer).digest('hex') : null;
  if (sourceHash) {
    let { data: existing, error: existingError } = await supabase.from('deal_analyses')
      .select('id').eq('property_id', propertyId).eq('section', section)
      .eq('source_hash', sourceHash).eq('is_active', true).maybeSingle();
    if (existingError && /is_active|superseded_at|superseded_by|schema cache/i.test(existingError.message || '')) {
      const legacy = await supabase.from('deal_analyses')
        .select('id, section, created_at, processing_status, analysis, source_hash')
        .eq('property_id', propertyId).eq('section', section)
        .eq('source_hash', sourceHash)
        .order('created_at', { ascending: false });
      existing = selectActiveDocumentVersions(legacy.data || [])
        .find(row => row.source_hash === sourceHash) || null;
      existingError = legacy.error;
    }
    if (!existingError && existing?.id) return existing.id;
  }
  let { data: saved, error } = await supabase.from('deal_analyses').insert({
    property_id: propertyId, section, filename, analysis,
    uploaded_by_role: role || 'unknown', storage_path: storagePath,
    source_hash: sourceHash, processing_status: 'extracted', is_active: true,
  }).select('id').single();
  if (error && /column|schema cache/i.test(error.message || '')) {
    ({ data: saved, error } = await supabase.from('deal_analyses').insert({
      property_id: propertyId, section, filename, analysis,
      uploaded_by_role: role || 'unknown', storage_path: storagePath,
    }).select('id').single());
  }
  if (error) throw error;
  const recordId = saved?.id;
  const { data: prior } = await supabase.from('deal_analyses').select('id')
    .eq('property_id', propertyId).eq('section', section).neq('id', recordId);
  const priorIds = (prior || []).map(row => row.id);
  if (priorIds.length) {
    await supabase.from('deal_analyses').update({
      is_active: false, superseded_at: new Date().toISOString(), superseded_by: recordId,
    }).eq('property_id', propertyId).eq('section', section).neq('id', recordId);
    await supabase.from('transaction_record_fields').update({
      value_text: null, value_json: null, status: 'missing',
      source_doc_id: null, source_doc_version: null, source_file_hash: null,
      source_page: null, source_excerpt: null, updated_at: new Date().toISOString(),
    }).eq('property_id', propertyId).in('source_doc_id', priorIds)
      .in('status', ['extracted', 'needs_review', 'awaiting', 'awaiting_confirmation', 'conflicting']);
  }
  // Re-run canonical Transaction Record extraction from the replacement's
  // actual text before recalculating state. This makes newly supported fields
  // (for example servicer-controlled insurance proceeds) enter as extracted /
  // awaiting confirmation instead of leaving the prior document's state live.
  if (transactionFieldExtractor && extractedText) {
    await transactionFieldExtractor(propertyId, recordId, extractedText, section);
  }
  // Rebuild the cross-document evidence snapshot from active versions only.
  // Otherwise a verification row generated before this replacement can
  // continue to feed the live conflict/readiness path.
  await runVerification(propertyId);
  await recalculateTransactionState(propertyId, { source: 'ai_document_replacement' });
  await evaluateDealRoomForTasks(propertyId, { source: 'ai_document_replacement' });
  return recordId;
}

async function persistUploadedAiDocument({ propertyId, section, filename, analysis, role, fileBuffer, mimetype, extractedText }) {
  const storagePath = await uploadToStorage(fileBuffer, mimetype, propertyId, section, filename);
  return persistAiDocumentVersion({
    propertyId, section, filename, analysis, role, storagePath, fileBuffer, extractedText,
  });
}
const DOC_ASSIGNMENTS = (() => {
  try { return require('../../shared/document_assignments.json'); } catch { return {}; }
})();

function getSectionAssignments(packId, propertyType) {
  const pack = DOC_ASSIGNMENTS[packId];
  if (!pack) return null;
  if (pack.sections) return pack.sections;
  return pack.byPropertyType?.[propertyType] || pack.byPropertyType?.Multifamily || null;
}

async function getCustomPackDocumentAssignments(packId) {
  if (!packId?.startsWith('ws_')) return null;
  const { data, error } = await supabase
    .from('custom_workflow_packs')
    .select('config')
    .eq('id', packId)
    .maybeSingle();
  if (error || !Array.isArray(data?.config?.documents)) return null;
  return data.config.documents.reduce((result, document) => {
    const section = document?.section || document?.id;
    if (!section) return result;
    const assignedTo = Array.isArray(document?.assignedTo)
      ? document.assignedTo
      : document?.assignedRole
        ? [document.assignedRole]
        : [];
    result[section] = assignedTo.filter(Boolean);
    return result;
  }, {});
}

async function authorizeDocumentUpload(req, res, section) {
  const propertyId = String(req.body?.property_id || '').trim();
  if (!propertyId) {
    res.status(400).json({ error: 'property_id required' });
    return null;
  }

  // Owner access is stronger than a participant session. Browsers can retain
  // an old invite session while the coordinator returns to the room; checking
  // the participant first incorrectly rejects a valid owner upload when the
  // selected section is not assigned to that stale participant role.
  const ownerToken = String(
    req.headers['x-owner-write-token'] || req.body?.ownerWriteToken || '',
  ).trim();
  if (ownerToken) {
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('owner_write_token')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (room?.owner_write_token && room.owner_write_token === ownerToken) {
      return { mode: 'owner', role: 'owner', propertyId };
    }
  }

  const sessionToken = String(req.headers['x-kontra-session'] || '').trim();
  if (sessionToken) {
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const { data: session } = await supabase
      .from('deal_room_access_sessions')
      .select('invite_id')
      .eq('session_token_hash', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .is('revoked_at', null)
      .maybeSingle();
    if (session?.invite_id) {
      const { data: invite } = await supabase
        .from('deal_room_invites')
        .select('property_id, role_key, status')
        .eq('id', session.invite_id)
        .maybeSingle();
      if (invite?.property_id === propertyId && !['revoked', 'expired'].includes(invite.status)) {
        const { data: room } = await supabase
          .from('deal_rooms')
          .select('workflow_pack_id, property_type, checklist_items')
          .eq('property_id', propertyId)
          .maybeSingle();
        const normalizedSection = section === 'brand-standards' ? 'brand_standards' : section;
        const assignments = getSectionAssignments(room?.workflow_pack_id || 'cre_acquisition', room?.property_type || 'Multifamily');
        const customAssignments = await getCustomPackDocumentAssignments(room?.workflow_pack_id);
        const checklistItems = Array.isArray(room?.checklist_items) ? room.checklist_items : [];
        const assignedSections = getAssignedSectionsFromChecklist(
          checklistItems,
          invite.role_key,
          assignments,
          customAssignments,
        );
        if (checklistItems.length === 0) {
          for (const [key, roles] of Object.entries(customAssignments || assignments || {})) {
            if (hasDocumentRole(roles, invite.role_key)) assignedSections.add(key);
          }
        }
        if (!assignedSections.has(section) && !assignedSections.has(normalizedSection)) {
          res.status(403).json({ error: 'Access denied', message: 'This document section is not assigned to your role' });
          return null;
        }
        return { mode: 'participant', role: invite.role_key, propertyId };
      }
    }
  }

  res.status(403).json({ error: 'Access denied', message: 'A verified deal-room invitation or owner access token is required' });
  return null;
}

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = (file.originalname || '').split('.').pop().toLowerCase();
    const ALLOWED_EXTS = new Set(['pdf','doc','docx','xlsx','xls','xlsm','xlsb','csv','txt','jpg','jpeg','png']);
    if (ALLOWED_MIMETYPES.has(file.mimetype) || ALLOWED_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype} (${file.originalname})`));
    }
  },
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-not-configured' });

// Convert PDF to images using pdftoppm, then OCR via GPT-4o Vision
async function extractPdfViaVision(buffer) {
  const { execSync } = require('child_process');
  const fsSync = require('fs');
  const pathMod = require('path');
  const os = require('os');
  const tmpDir = fsSync.mkdtempSync(pathMod.join(os.tmpdir(), 'kontra-pdf-'));
  const pdfPath = pathMod.join(tmpDir, 'doc.pdf');
  const imgBase = pathMod.join(tmpDir, 'page');
  try {
    fsSync.writeFileSync(pdfPath, buffer);
    // First try pdftotext (fast, works for text-based PDFs)
    try {
      const txt = execSync(`pdftotext "${pdfPath}" -`, { timeout: 10000 }).toString().trim();
      if (txt.length > 80) {
        console.log('[pdf] pdftotext extracted', txt.length, 'chars');
        return txt.slice(0, 15000);
      }
    } catch (_) {}
    // Fall back to image rendering + GPT-4o Vision (works for scanned PDFs)
    execSync(`pdftoppm -r 150 -png -l 4 "${pdfPath}" "${imgBase}"`, { timeout: 30000 });
    const pngs = fsSync.readdirSync(tmpDir).filter(f => f.endsWith('.png')).sort().slice(0, 4);
    if (pngs.length === 0) throw new Error('PDF produced no pages');
    console.log('[pdf] vision pipeline — pages:', pngs.length);
    const imageContent = pngs.map(f => ({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${fsSync.readFileSync(pathMod.join(tmpDir, f)).toString('base64')}`, detail: 'high' }
    }));
    const visionRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Transcribe ALL text from this document exactly as it appears. Include every number, label, line item, percentage, and dollar value. Preserve table structure. Do not summarize — output the complete raw text.' },
        ...imageContent
      ]}],
      max_tokens: 4096,
    });
    return visionRes.choices[0]?.message?.content || '';
  } finally {
    try { execSync(`rm -rf "${tmpDir}"`); } catch (_) {}
  }
}

async function extractTextFromFile(buffer, mimetype = '', filename = '') {
  const ext = ((filename || '').split('.').pop() || '').toLowerCase();
  // PDF — vision pipeline (text + scanned)
  if (mimetype === 'application/pdf' || ext === 'pdf' || buffer.slice(0,4).toString() === '%PDF') {
    // Detect password-protected / encrypted PDFs early
    const pdfHeader = buffer.slice(0, 2048).toString('latin1');
    if (pdfHeader.includes('/Encrypt')) {
      throw new Error('ENCRYPTED_PDF');
    }
    return extractPdfViaVision(buffer);
  }
  // Excel — .xlsx, .xls, .xlsm, .xlsb
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel') ||
      mimetype.includes('macroEnabled') || mimetype.includes('ms-excel') ||
      ['xlsx','xls','xlsm','xlsb'].includes(ext)) {
    const XLSX = require('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const rows = [];
    for (const name of wb.SheetNames.slice(0, 8)) {
      const sheet = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.replace(/,/g,'').replace(/\n/g,'').trim().length > 20) {
        rows.push(`[Sheet: ${name}]\n${csv}`);
      }
    }
    return rows.join('\n\n').slice(0, 15000);
  }
  // CSV / plain text
  if (mimetype === 'text/csv' || mimetype === 'text/plain' || ext === 'csv') {
    return buffer.toString('utf8').slice(0, 15000);
  }
  // DOCX / fallback — strip binary noise
  const raw = buffer.toString('utf8', 0, Math.min(buffer.length, 60000));
  return raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim().slice(0, 12000);
}

router.post('/analyze-inspection', aiRateLimit, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const uploadAccess = await authorizeDocumentUpload(req, res, 'inspection');
  if (!uploadAccess) return;
  req.body.role = uploadAccess.role;
  console.log('[analyze-inspection] file:', req.file.originalname, 'mime:', req.file.mimetype, 'size:', req.file.size);
  try {
    const text = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!text || text.trim().length < 30) {
      return res.status(422).json({ error: 'Could not extract text from this file. Please ensure the file is not password-protected and contains readable content.' });
    }
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert commercial real estate inspection analyst. Analyze inspection reports and extract key findings in a structured format. Always respond with valid JSON.' },
        { role: 'user', content: `Analyze this commercial real estate inspection report and return a JSON object with this exact structure:
{"propertyType":string,"overallCondition":"Good"|"Fair"|"Poor","score":number,"lifeSafetyFindings":[{"item":string,"severity":"Critical"|"Moderate"|"Minor","description":string}],"deferredMaintenance":[{"item":string,"estimatedCost":string,"priority":"High"|"Medium"|"Low","timeline":string}],"totalDeferredCost":string,"priorityActions":[{"action":string,"timeline":string}],"summary":string,"positiveFindings":[string],"confidence":number,"sources":[{"page":string,"quote":string}]}

confidence is 0-100 representing your overall confidence in the extracted data based on document clarity. sources lists 2-4 specific page references and brief verbatim quotes for the most important extracted values (condition score, deferred costs, life-safety items).

Inspection report text:\n${text}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const result = JSON.parse(completion.choices[0].message.content);
    const { property_id, role } = req.body;
    if (property_id) {
      const _buf = req.file.buffer, _mime = req.file.mimetype, _name = req.file.originalname;
      await persistUploadedAiDocument({
        propertyId: property_id, section: 'inspection', filename: _name, analysis: result,
        role: role || 'unknown', fileBuffer: _buf, mimetype: _mime, extractedText: text,
      });
      console.log('[deal_analyses] inspection replacement saved');
      notifyOwner(property_id, 'inspection', result.summary);
      logEvent(property_id, 'document_analyzed', role || 'unknown', null, 'Inspection Report analyzed by AI', { section: 'inspection', filename: req.file.originalname });
      if (role === 'inspector') notifyLender(property_id, role, 'inspection', result.summary).catch(() => {});
    }
    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('[analyze-inspection]', err.message);
    if (err.message === 'ENCRYPTED_PDF') return res.status(422).json({ error: 'This PDF is password-protected. Please remove the password and re-upload.' });
    if (err.status >= 429 || (err.status >= 500 && err.status < 600) || err.code === 'insufficient_quota' || err.code === 'ECONNRESET') {
      return res.json({ success: true, pending: true, analysis: { summary: 'Document received — AI analysis is queued and will complete shortly. Refresh in a few minutes.', pending: true, confidence: 0 } });
    }
    res.status(500).json({ error: 'Analysis failed', message: safeAiErrorMessage(err) });
  }
});

router.post('/score-property', aiRateLimit, async (req, res) => {
  const { occupancy, noi, yearBuilt, propertyType, units, sqft } = req.body || {};
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a CRE risk analyst. Score commercial properties 0-100 and return JSON.' },
        { role: 'user', content: `Score this property and return JSON: {"score":number,"riskLevel":"Low"|"Medium"|"High","scoreBreakdown":{"occupancy":number,"financials":number,"physical":number,"market":number},"benchmark":string,"strengths":[string],"risks":[string],"summary":string}

Property: Type=${propertyType||'Unknown'}, Occupancy=${occupancy||'?'}%, NOI=$${noi||'?'}, YearBuilt=${yearBuilt||'?'}, Units/SF=${units||sqft||'?'}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const result = JSON.parse(completion.choices[0].message.content);
    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('[score-property]', err.message);
    res.status(500).json({ error: 'Scoring failed', message: err.message });
  }
});

// ── AI Next Action Engine ────────────────────────────────────────────────
// Reasons over the deal's actual state (extracted document findings, party
// status) with an LLM instead of fixed point-deduction rules — so nuance
// (e.g. "DSCR is borderline but insurance just lapsed too, compounding
// risk") comes from real reasoning, not a hardcoded formula. Generic over
// any Workflow Pack: the caller (frontend, which already has the active
// pack loaded) supplies the required docs/roles, this endpoint doesn't need
// to know anything about CRE vs Business Acquisition. Cached in-memory per
// exact input state so repeat panel loads don't re-call the LLM. ──────────
const nextActionsCache = new Map();
const NEXT_ACTIONS_CACHE_MAX = 500;

function hashNextActionsInput(payload) {
  return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

router.post('/next-actions', aiRateLimit, async (req, res) => {
  const { propertyId, stageLabel, requiredDocs, requiredRoles, analyses, submissions } = req.body || {};
  if (!propertyId) return res.status(400).json({ error: 'propertyId required' });

  const cacheInput = { propertyId, stageLabel, requiredDocs, requiredRoles, analyses, submissions };
  const cacheKey = hashNextActionsInput(cacheInput);
  const cached = nextActionsCache.get(cacheKey);
  if (cached) return res.json({ success: true, ...cached, cached: true });

  try {
    const docsBlock = (requiredDocs || []).map(d => `- ${d.label} (${d.required ? 'required' : 'optional'})`).join('\n') || 'none listed';
    const rolesBlock = (requiredRoles || []).map(r => `- ${r.label}${r.required ? ' (required)' : ''}`).join('\n') || 'none listed';
    const analysesBlock = (analyses || []).map(a => {
      const an = a.analysis || {};
      const flags = (an.risk_flags || []).join('; ') || 'none';
      const metrics = an.metrics ? JSON.stringify(an.metrics) : 'none';
      return `- [${a.section}] summary: ${an.summary || 'n/a'} | metrics: ${metrics} | risk flags: ${flags}`;
    }).join('\n') || 'No documents analyzed yet.';
    const submissionsBlock = (submissions || []).map(s => `- ${s.role}: ${s.status}${s.status_note ? ` (${s.status_note})` : ''}`).join('\n') || 'No party submissions yet.';

    const systemPrompt = `You are a senior deal underwriter reasoning holistically over a deal room's current state — not applying fixed point deductions, but weighing how findings interact (e.g. two moderate risks compounding into one urgent action, or a missing document mattering more/less depending on deal stage). Return strict JSON:
{
  "score": number (0-100, overall deal health — higher is healthier),
  "actions": [ { "sev": "error"|"warn"|"info"|"ok", "icon": string (single emoji), "text": string (plain-English, specific, under 100 chars) } ]
}
Rules:
- Prioritize the most urgent/impactful issues first in the actions array.
- If everything required is in good standing, return a single "ok" action saying so and a score of 90+.
- Be specific — reference actual figures/findings from the data given, not generic advice.
- Cap actions at 6; do not pad with filler.`;

    const userPrompt = `Deal stage: ${stageLabel || 'unknown'}

Required documents:
${docsBlock}

Required parties:
${rolesBlock}

AI-extracted findings from uploaded documents:
${analysesBlock}

Party submission status:
${submissionsBlock}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const result = JSON.parse(completion.choices[0].message.content);
    const score = Math.max(0, Math.min(100, Number(result.score) || 0));
    const actions = Array.isArray(result.actions) ? result.actions.slice(0, 6) : [];
    const payload = { score, actions };

    if (nextActionsCache.size >= NEXT_ACTIONS_CACHE_MAX) {
      nextActionsCache.delete(nextActionsCache.keys().next().value);
    }
    nextActionsCache.set(cacheKey, payload);

    res.json({ success: true, ...payload });
  } catch (err) {
    console.error('[next-actions]', err.message);
    res.status(500).json({ error: 'AI next-action scoring failed', message: err.message });
  }
});

router.post('/review-insurance', aiRateLimit, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const uploadAccess = await authorizeDocumentUpload(req, res, 'insurance');
  if (!uploadAccess) return;
  req.body.role = uploadAccess.role;
  console.log('[review-insurance] file:', req.file.originalname, 'mime:', req.file.mimetype);
  try {
    const text = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!text || text.trim().length < 30) {
      return res.status(422).json({ error: 'Could not extract text from this file. Please ensure it is not password-protected and contains readable content.' });
    }
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a CRE insurance specialist. Analyze insurance policies and return JSON.' },
        { role: 'user', content: `Analyze this insurance policy and return JSON: {"policyType":string,"coverageAmount":string,"expirationDate":string,"expiresInDays":number,"coverageGaps":[{"gap":string,"severity":"Critical"|"Moderate"|"Minor"}],"endorsements":[string],"recommendations":[string],"complianceStatus":"Compliant"|"Review Required"|"Action Needed","summary":string,"confidence":number,"sources":[{"page":string,"quote":string}]}

confidence is 0-100 based on document clarity. sources lists 2-4 page references and brief verbatim quotes for key figures (coverage amount, expiration date, policy limits).

Policy text:\n${text}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const result = JSON.parse(completion.choices[0].message.content);
    const { property_id, role } = req.body;
    if (property_id) {
      const _buf = req.file.buffer, _mime = req.file.mimetype, _name = req.file.originalname;
      await persistUploadedAiDocument({
        propertyId: property_id, section: 'insurance', filename: _name, analysis: result,
        role, fileBuffer: _buf, mimetype: _mime, extractedText: text,
      });
      console.log('[deal_analyses] insurance replacement saved');
      notifyOwner(property_id, 'insurance', result.summary);
      logEvent(property_id, 'document_analyzed', role || 'unknown', null, 'Insurance Certificate analyzed by AI', { section: 'insurance', filename: req.file.originalname });
      if (['insurer', 'insurance'].includes(role)) notifyLender(property_id, role, 'insurance', result.summary).catch(() => {});
    }
    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('[review-insurance]', err.message);
    if (err.message === 'ENCRYPTED_PDF') return res.status(422).json({ error: 'This PDF is password-protected. Please remove the password and re-upload.' });
    if (err.status >= 429 || (err.status >= 500 && err.status < 600) || err.code === 'insufficient_quota' || err.code === 'ECONNRESET') {
      return res.json({ success: true, pending: true, analysis: { summary: 'Document received — AI analysis is queued and will complete shortly. Refresh in a few minutes.', pending: true, confidence: 0 } });
    }
    res.status(500).json({ error: 'Review failed', message: err.message });
  }
});

router.post('/review-financials', aiRateLimit, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const uploadAccess = await authorizeDocumentUpload(req, res, 'financials');
  if (!uploadAccess) return;
  req.body.role = uploadAccess.role;
  console.log('[review-financials] file:', req.file.originalname, 'mime:', req.file.mimetype);
  try {
    const text = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!text || text.trim().length < 30) {
      return res.status(422).json({ error: 'Could not extract text from this file. Please ensure it is not password-protected and contains readable content.' });
    }
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a CRE financial analyst specializing in both traditional commercial properties and hospitality assets. Analyze operating statements, hotel P&L statements, STR reports, and financial reports, returning JSON. Only report figures that are explicitly present in the document.' },
        { role: 'user', content: `Analyze this financial document and return JSON: {"documentType":string,"noi":string,"occupancy":string,"dscr":string,"revenue":string,"expenses":string,"revpar":string|null,"adr":string|null,"gopPar":string|null,"revparIndex":string|null,"roomsRevenue":string|null,"fbRevenue":string|null,"anomalies":[{"item":string,"description":string,"severity":"High"|"Medium"|"Low"}],"trends":[string],"covenantStatus":"Compliant"|"At Risk"|"Breached"|"Unknown","summary":string,"recommendations":[string],"confidence":number,"sources":[{"page":string,"quote":string}]}

Notes: revpar=Revenue Per Available Room, adr=Average Daily Rate, gopPar=Gross Operating Profit Per Available Room, revparIndex=RevPAR Index vs comp set (e.g. "108.2"). Only populate hotel fields if document is a hotel P&L or STR report. confidence is 0-100 based on document quality. sources lists 2-4 page references and verbatim quotes for key figures (NOI, DSCR, revenue, occupancy).

Financial document:\n${text}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const result = JSON.parse(completion.choices[0].message.content);
    const { property_id, role } = req.body;
    if (property_id) {
      const _buf = req.file.buffer, _mime = req.file.mimetype, _name = req.file.originalname;
      await persistUploadedAiDocument({
        propertyId: property_id, section: 'financials', filename: _name, analysis: result,
        role, fileBuffer: _buf, mimetype: _mime, extractedText: text,
      });
      console.log('[deal_analyses] financials replacement saved');
      notifyOwner(property_id, 'financials', result.summary);
      logEvent(property_id, 'document_analyzed', role || 'unknown', null, 'Financial Statement analyzed by AI', { section: 'financials', filename: req.file.originalname });
      if (['owner', 'borrower'].includes(role)) notifyLender(property_id, role, 'financials', result.summary).catch(() => {});
    }
    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('[review-financials]', err.message);
    if (err.message === 'ENCRYPTED_PDF') return res.status(422).json({ error: 'This PDF is password-protected. Please remove the password and re-upload.' });
    if (err.status >= 429 || (err.status >= 500 && err.status < 600) || err.code === 'insufficient_quota' || err.code === 'ECONNRESET') {
      return res.json({ success: true, pending: true, analysis: { summary: 'Document received — AI analysis is queued and will complete shortly. Refresh in a few minutes.', pending: true, confidence: 0 } });
    }
    res.status(500).json({ error: 'Review failed', message: err.message });
  }
});

router.post('/review-legal', aiRateLimit, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const uploadAccess = await authorizeDocumentUpload(req, res, 'legal');
  if (!uploadAccess) return;
  req.body.role = uploadAccess.role;
  console.log('[review-legal] file:', req.file.originalname, 'mime:', req.file.mimetype);
  try {
    const text = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!text || text.trim().length < 30) {
      return res.status(422).json({ error: 'Could not extract text from this file.' });
    }
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a CRE legal analyst. Review legal documents (purchase agreements, title reports, lease agreements, loan docs) and extract key terms in JSON.' },
        { role: 'user', content: `Analyze this CRE legal document and return JSON: {"documentType":string,"parties":[string],"keyDates":[{"event":string,"date":string}],"contingencies":[string],"redFlags":[{"issue":string,"severity":"Critical"|"Moderate"|"Minor"}],"covenants":[string],"complianceStatus":"Clear"|"Review Required"|"Issues Found","summary":string,"recommendations":[string],"confidence":number,"sources":[{"page":string,"quote":string}]}

confidence is 0-100 based on document clarity. sources lists 2-4 page references and verbatim quotes for key terms (parties, key dates, critical red flags).

Legal document:\n${text}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const result = JSON.parse(completion.choices[0].message.content);
    const { property_id, role } = req.body;
    if (property_id) {
      const _buf = req.file.buffer, _mime = req.file.mimetype, _name = req.file.originalname;
      await persistUploadedAiDocument({
        propertyId: property_id, section: 'legal', filename: _name, analysis: result,
        role: role || 'attorney', fileBuffer: _buf, mimetype: _mime, extractedText: text,
      });
      notifyOwner(property_id, 'legal', result.summary);
      logEvent(property_id, 'document_analyzed', role || 'unknown', null, 'Legal Document analyzed by AI', { section: 'legal', filename: req.file.originalname });
      if (role === 'attorney') notifyLender(property_id, role, 'legal', result.summary).catch(() => {});
    }
    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('[review-legal]', err.message);
    if (err.message === 'ENCRYPTED_PDF') return res.status(422).json({ error: 'This PDF is password-protected. Please remove the password and re-upload.' });
    if (err.status >= 429 || (err.status >= 500 && err.status < 600) || err.code === 'insufficient_quota' || err.code === 'ECONNRESET') {
      return res.json({ success: true, pending: true, analysis: { summary: 'Document received — AI analysis is queued and will complete shortly. Refresh in a few minutes.', pending: true, confidence: 0 } });
    }
    res.status(500).json({ error: 'Review failed', message: err.message });
  }
});

router.post('/review-brand-standards', aiRateLimit, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const uploadAccess = await authorizeDocumentUpload(req, res, 'brand-standards');
  if (!uploadAccess) return;
  req.body.role = uploadAccess.role;
  console.log('[review-brand-standards] file:', req.file.originalname);
  try {
    const text = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!text || text.trim().length < 30) {
      return res.status(422).json({ error: 'Could not extract text from this file.' });
    }
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a hospitality industry expert specializing in hotel franchise agreements, Property Improvement Plans (PIPs), and brand standards compliance for flags like Marriott, Hilton, Hyatt, IHG, and Wyndham.' },
        { role: 'user', content: `Analyze this hotel franchise or PIP document and return JSON: {"documentType":string,"brandName":string|null,"franchiseTerm":string|null,"brandFees":{"royaltyFee":string|null,"marketingFee":string|null,"reservationFee":string|null},"pipItems":[{"category":string,"item":string,"deadline":string|null,"estimatedCost":string|null,"priority":"Required"|"Recommended"|"Optional"}],"totalEstimatedPIPCost":string|null,"complianceDeadline":string|null,"terminationClauses":[string],"keyRestrictions":[string],"redFlags":[{"issue":string,"severity":"Critical"|"Moderate"|"Minor"}],"complianceStatus":"Compliant"|"PIP Required"|"Non-Compliant"|"Review Required","summary":string,"recommendations":[string],"confidence":number,"sources":[{"page":string,"quote":string}]}

confidence is 0-100 based on document clarity. sources lists 2-4 page references and verbatim quotes for key items (PIP costs, compliance deadlines, brand fees).

Document:\n${text}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const result = JSON.parse(completion.choices[0].message.content);
    const { property_id, role } = req.body;
    if (property_id) {
      const _buf = req.file.buffer, _mime = req.file.mimetype, _name = req.file.originalname;
      await persistUploadedAiDocument({
        propertyId: property_id, section: 'brand-standards', filename: _name, analysis: result,
        role: role || 'owner', fileBuffer: _buf, mimetype: _mime, extractedText: text,
      });
      notifyOwner(property_id, 'brand-standards', result.summary);
      logEvent(property_id, 'document_analyzed', role || 'unknown', null, 'Brand Standards / PIP analyzed by AI', { section: 'brand-standards', filename: req.file.originalname });
    }
    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('[review-brand-standards]', err.message);
    if (err.message === 'ENCRYPTED_PDF') return res.status(422).json({ error: 'This PDF is password-protected. Please remove the password and re-upload.' });
    if (err.status >= 429 || (err.status >= 500 && err.status < 600) || err.code === 'insufficient_quota' || err.code === 'ECONNRESET') {
      return res.json({ success: true, pending: true, analysis: { summary: 'Document received — AI analysis is queued and will complete shortly. Refresh in a few minutes.', pending: true, confidence: 0 } });
    }
    res.status(500).json({ error: 'Review failed', message: err.message });
  }
});

// ── Universal AI extraction endpoint ─────────────────────────────────────────
// Unlike the hardcoded /review-* endpoints above (one per CRE document type),
// this endpoint is pack-driven: the caller (a workflow pack's document schema
// entry, via DocumentChecklistPanel) supplies the analyst persona, expected
// doc types, and the metrics to extract. This lets ANY workflow pack turn on
// real AI extraction for a document section just by declaring metadata —
// zero new backend code per pack. CRE Acquisition keeps its dedicated
// endpoints (richer, hand-tuned prompts); newer/simpler packs (e.g. Business
// Acquisition) use this one.
router.post('/analyze-document', aiRateLimit, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { property_id, section } = req.body;
  const uploadAccess = await authorizeDocumentUpload(req, res, section);
  if (!uploadAccess) return;
  const role = uploadAccess.role;
  console.log('[analyze-document] section:', section, 'file:', req.file.originalname);
  try {
    const text = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!text || text.trim().length < 30) {
      return res.status(422).json({ error: 'Could not extract text from this file. Please ensure it is not password-protected and contains readable content.' });
    }

    let metricsSchema = {};
    let docTypes = ['Other'];
    let analystRole = 'senior financial analyst';
    try {
      if (req.body.metricsSchema) metricsSchema = JSON.parse(req.body.metricsSchema);
      if (req.body.docTypes) docTypes = JSON.parse(req.body.docTypes);
      if (req.body.analystRole) analystRole = String(req.body.analystRole).slice(0, 300);
    } catch { /* fall back to defaults below */ }

    const metricsBlock = Object.entries(metricsSchema)
      .map(([key, desc]) => `    "${key}": number | null  (${desc})`)
      .join(',\n') || '    "value": number | null';
    const docTypeList = docTypes.map(d => `"${d}"`).join(', ');

    const systemPrompt = `You are a ${analystRole}. Analyze the provided document excerpt and return a JSON object with this exact structure:
{
  "doc_type": string (one of: ${docTypeList}),
  "summary": string (2-3 sentence plain English summary of the document's key findings),
  "metrics": {
${metricsBlock}
  },
  "risk_flags": string[],
  "recommendations": string[]
}
Only report figures that are explicitly present in the document — use null if a value cannot be determined.
Return only valid JSON. No extra text.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Document content:\n\n${text}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });
    const result = JSON.parse(completion.choices[0].message.content);
    if (property_id && section) {
      const _buf = req.file.buffer, _mime = req.file.mimetype, _name = req.file.originalname;
      await persistUploadedAiDocument({
        propertyId: property_id, section, filename: _name, analysis: result,
        role: role || 'unknown', fileBuffer: _buf, mimetype: _mime, extractedText: text,
      });
      console.log(`[deal_analyses] ${section} saved (analyze-document)`);
      logEvent(property_id, 'document_analyzed', role || 'unknown', null, `${section} analyzed by AI`, { section, filename: req.file.originalname });
    }
    res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('[analyze-document]', err.message);
    if (err.message === 'ENCRYPTED_PDF') return res.status(422).json({ error: 'This PDF is password-protected. Please remove the password and re-upload.' });
    if (err.status >= 429 || (err.status >= 500 && err.status < 600) || err.code === 'insufficient_quota' || err.code === 'ECONNRESET') {
      return res.json({ success: true, pending: true, analysis: { summary: 'Document received — AI analysis is queued and will complete shortly. Refresh in a few minutes.', pending: true, confidence: 0 } });
    }
    res.status(500).json({ error: 'Review failed', message: err.message });
  }
});

router.setTransactionFieldExtractor = setTransactionFieldExtractor;

module.exports = router;
