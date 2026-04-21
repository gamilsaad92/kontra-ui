/**
 * Rules & Policy Engine Router
 *
 * Centralized policy enforcement for all portals and workflow stages.
 * Provides CRUD, maker-checker approval, versioning, evaluation,
 * simulation, rollback, and full audit logging.
 *
 * Endpoints:
 *   GET    /api/rules               – list rules
 *   POST   /api/rules               – create draft rule
 *   GET    /api/rules/evaluate      – evaluate rules against a context
 *   POST   /api/rules/simulate      – simulate (dry-run) evaluation
 *   GET    /api/rules/audit         – audit log
 *   GET    /api/rules/pending       – approval queue
 *   GET    /api/rules/:id           – single rule + latest version
 *   PUT    /api/rules/:id           – update (bumps version, resets to draft)
 *   POST   /api/rules/:id/submit    – submit for review
 *   POST   /api/rules/:id/approve   – approve (checker — different user)
 *   POST   /api/rules/:id/reject    – reject with note
 *   POST   /api/rules/:id/publish   – publish approved rule
 *   POST   /api/rules/:id/emergency – emergency override (platform_admin only)
 *   POST   /api/rules/:id/archive   – archive rule
 *   POST   /api/rules/:id/rollback  – rollback to a previous version
 *   GET    /api/rules/:id/history   – version history
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const adminDb = createClient(
  process.env.SUPABASE_URL             || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ── Role guards ─────────────────────────────────────────────────
const ADMIN_ROLES = ['platform_admin', 'lender_admin'];
const CHECKER_ROLES = ['platform_admin', 'lender_admin'];

function requireAdmin(req, res, next) {
  if (!ADMIN_ROLES.includes(req.role)) {
    return res.status(403).json({ error: 'Forbidden: admin role required' });
  }
  next();
}

// ── Decision evaluator ──────────────────────────────────────────
/**
 * Resolves a dot-notation field path against a context object.
 * e.g. "loan.ltv_ratio" against { loan: { ltv_ratio: 0.85 } } → 0.85
 */
function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

/**
 * Evaluates a single condition against the context.
 * Supported operators: eq, ne, gt, gte, lt, lte, in, nin, contains, exists
 */
function evalCondition(cond, ctx) {
  const actual = resolvePath(ctx, cond.field);
  const expected = cond.value;
  switch (cond.operator) {
    case 'eq':       return actual === expected;
    case 'ne':       return actual !== expected;
    case 'gt':       return Number(actual) > Number(expected);
    case 'gte':      return Number(actual) >= Number(expected);
    case 'lt':       return Number(actual) < Number(expected);
    case 'lte':      return Number(actual) <= Number(expected);
    case 'in':       return Array.isArray(expected) && expected.includes(actual);
    case 'nin':      return Array.isArray(expected) && !expected.includes(actual);
    case 'contains': return String(actual ?? '').includes(String(expected));
    case 'exists':   return expected ? actual != null : actual == null;
    default:         return false;
  }
}

/**
 * Evaluates all conditions for a rule against context.
 * Supports AND / OR condition_logic at the top level.
 */
function ruleMatches(rule, ctx) {
  const conds = Array.isArray(rule.conditions) ? rule.conditions : [];
  if (conds.length === 0) return true;
  const logic = rule.condition_logic ?? 'AND';
  return logic === 'OR'
    ? conds.some((c) => evalCondition(c, ctx))
    : conds.every((c) => evalCondition(c, ctx));
}

/**
 * Master evaluate function — runs all published rules against context,
 * returns matched rules and aggregated actions.
 */
async function evaluateRules(ctx, options = {}) {
  const { category, jurisdiction, loan_type, token_type, workflow_stage, org_id } = options;

  let query = adminDb
    .from('kontra_rules')
    .select('*')
    .eq('status', 'published')
    .lte('effective_date', new Date().toISOString())
    .or('end_date.is.null,end_date.gt.' + new Date().toISOString());

  if (category) query = query.eq('category', category);
  if (org_id) query = query.or(`organization_id.is.null,organization_id.eq.${org_id}`);

  const { data: rules, error } = await query;
  if (error) throw error;

  const matched = [];
  const actions = [];
  let blocked = false;

  for (const rule of (rules ?? [])) {
    // Scope filters
    if (jurisdiction && rule.jurisdictions?.length > 0 && !rule.jurisdictions.includes(jurisdiction) && !rule.jurisdictions.includes('GLOBAL')) continue;
    if (loan_type && rule.loan_types?.length > 0 && !rule.loan_types.includes(loan_type)) continue;
    if (token_type && rule.token_types?.length > 0 && !rule.token_types.includes(token_type)) continue;
    if (workflow_stage && rule.workflow_stages?.length > 0 && !rule.workflow_stages.includes(workflow_stage)) continue;

    if (ruleMatches(rule, ctx)) {
      matched.push({ id: rule.id, name: rule.name, version: rule.version, severity: rule.severity });
      const ruleActions = Array.isArray(rule.actions) ? rule.actions : [];
      actions.push(...ruleActions.map((a) => ({ ...a, rule_id: rule.id, rule_name: rule.name, rule_version: rule.version })));
      if (ruleActions.some((a) => a.type === 'block')) blocked = true;
    }
  }

  return { allowed: !blocked, blocked, matched_rules: matched, actions };
}

// ── Audit helper ────────────────────────────────────────────────
async function audit(event_type, opts = {}) {
  try {
    await adminDb.from('kontra_rule_audit_log').insert({
      event_type,
      rule_id: opts.rule_id ?? null,
      rule_version: opts.rule_version ?? null,
      actor_id: opts.actor_id ?? null,
      context: opts.context ?? null,
      result: opts.result ?? null,
      portal: opts.portal ?? null,
    });
  } catch (e) {
    console.warn('[rules] audit insert failed:', e.message);
  }
}

// ── Snapshot helper ─────────────────────────────────────────────
async function snapshotVersion(rule, actorId, changeNote) {
  await adminDb.from('kontra_rule_versions').insert({
    rule_id: rule.id,
    version: rule.version,
    snapshot: rule,
    changed_by: actorId,
    change_note: changeNote ?? null,
  }).select();
}

// ══════════════════════════════════════════════════════════════════
// LIST RULES
// ══════════════════════════════════════════════════════════════════
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { category, status, jurisdiction, search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = adminDb
      .from('kontra_rules')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, count, error } = await query;
    if (error) throw error;

    return res.json({ rules: data ?? [], total: count ?? 0, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('[rules] list error', err);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// DECISION SERVICE — evaluate rules
// ══════════════════════════════════════════════════════════════════
router.post('/evaluate', async (req, res) => {
  try {
    const { context, category, jurisdiction, loan_type, token_type, workflow_stage } = req.body;
    if (!context) return res.status(400).json({ error: 'context is required' });

    const result = await evaluateRules(context, { category, jurisdiction, loan_type, token_type, workflow_stage, org_id: req.orgId });

    await audit('rule_evaluated', {
      actor_id: req.user?.id,
      context: { ...context, category, workflow_stage },
      result,
      portal: req.body.portal,
    });

    return res.json(result);
  } catch (err) {
    console.error('[rules] evaluate error', err);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// SIMULATION — dry-run evaluation with impact preview
// ══════════════════════════════════════════════════════════════════
router.post('/simulate', requireAdmin, async (req, res) => {
  try {
    const { context, rule_id, category, jurisdiction, loan_type, token_type, workflow_stage } = req.body;
    if (!context) return res.status(400).json({ error: 'context is required' });

    // If simulating a specific rule (even draft)
    if (rule_id) {
      const { data: rule, error } = await adminDb.from('kontra_rules').select('*').eq('id', rule_id).single();
      if (error || !rule) return res.status(404).json({ error: 'Rule not found' });

      const matches = ruleMatches(rule, context);
      const actions = matches ? (Array.isArray(rule.actions) ? rule.actions : []) : [];
      const blocked = actions.some((a) => a.type === 'block');

      await audit('rule_simulated', { rule_id, rule_version: rule.version, actor_id: req.user?.id, context, result: { matches, actions, blocked } });
      return res.json({ simulated: true, rule_id, rule_name: rule.name, rule_version: rule.version, matches, actions, blocked });
    }

    // Full evaluation simulation
    const result = await evaluateRules(context, { category, jurisdiction, loan_type, token_type, workflow_stage, org_id: req.orgId });
    return res.json({ simulated: true, ...result });
  } catch (err) {
    console.error('[rules] simulate error', err);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// AUDIT LOG
// ══════════════════════════════════════════════════════════════════
router.get('/audit', requireAdmin, async (req, res) => {
  try {
    const { rule_id, event_type, limit = 100, page = 1 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = adminDb
      .from('kontra_rule_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (rule_id) query = query.eq('rule_id', rule_id);
    if (event_type) query = query.eq('event_type', event_type);

    const { data, count, error } = await query;
    if (error) throw error;

    return res.json({ entries: data ?? [], total: count ?? 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// APPROVAL QUEUE — pending rules
// ══════════════════════════════════════════════════════════════════
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await adminDb
      .from('kontra_rule_approvals')
      .select('*, policy_rules(*)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// CREATE RULE
// ══════════════════════════════════════════════════════════════════
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description, category, rule_key, jurisdictions, loan_types, token_types, workflow_stages, conditions, condition_logic, actions, severity, source_reference, effective_date, end_date, organization_id } = req.body;

    if (!name || !category || !rule_key) {
      return res.status(400).json({ error: 'name, category, and rule_key are required' });
    }

    const { data: rule, error } = await adminDb
      .from('kontra_rules')
      .insert({
        name, description, category, rule_key,
        jurisdictions: jurisdictions ?? [],
        loan_types: loan_types ?? [],
        token_types: token_types ?? [],
        workflow_stages: workflow_stages ?? [],
        conditions: conditions ?? [],
        condition_logic: condition_logic ?? 'AND',
        actions: actions ?? [],
        severity: severity ?? 'medium',
        source_reference,
        effective_date: effective_date ?? new Date().toISOString(),
        end_date: end_date ?? null,
        organization_id: organization_id ?? null,
        status: 'draft',
        version: 1,
        created_by: req.user?.id,
        updated_by: req.user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    await snapshotVersion(rule, req.user?.id, 'Initial draft');
    await audit('rule_created', { rule_id: rule.id, rule_version: 1, actor_id: req.user?.id });

    return res.status(201).json(rule);
  } catch (err) {
    console.error('[rules] create error', err);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET SINGLE RULE
// ══════════════════════════════════════════════════════════════════
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { data: rule, error } = await adminDb.from('kontra_rules').select('*').eq('id', req.params.id).single();
    if (error || !rule) return res.status(404).json({ error: 'Rule not found' });

    const { data: versions } = await adminDb.from('kontra_rule_versions').select('version, change_note, created_at, changed_by').eq('rule_id', rule.id).order('version', { ascending: false });
    const { data: approvals } = await adminDb.from('kontra_rule_approvals').select('*').eq('rule_id', rule.id).order('submitted_at', { ascending: false }).limit(5);

    return res.json({ ...rule, _versions: versions ?? [], _approvals: approvals ?? [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// UPDATE RULE — bumps version, resets to draft
// ══════════════════════════════════════════════════════════════════
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { data: existing } = await adminDb.from('kontra_rules').select('*').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    if (['published', 'emergency'].includes(existing.status)) {
      return res.status(409).json({ error: 'Published rules cannot be edited directly. Create a new version.' });
    }

    const newVersion = existing.version + 1;
    const { name, description, category, jurisdictions, loan_types, token_types, workflow_stages, conditions, condition_logic, actions, severity, source_reference, effective_date, end_date, change_note } = req.body;

    const { data: updated, error } = await adminDb
      .from('kontra_rules')
      .update({
        name: name ?? existing.name,
        description: description ?? existing.description,
        category: category ?? existing.category,
        jurisdictions: jurisdictions ?? existing.jurisdictions,
        loan_types: loan_types ?? existing.loan_types,
        token_types: token_types ?? existing.token_types,
        workflow_stages: workflow_stages ?? existing.workflow_stages,
        conditions: conditions ?? existing.conditions,
        condition_logic: condition_logic ?? existing.condition_logic,
        actions: actions ?? existing.actions,
        severity: severity ?? existing.severity,
        source_reference: source_reference ?? existing.source_reference,
        effective_date: effective_date ?? existing.effective_date,
        end_date: end_date ?? existing.end_date,
        status: 'draft',
        version: newVersion,
        updated_by: req.user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    await snapshotVersion(updated, req.user?.id, change_note ?? 'Rule updated');
    await audit('rule_updated', { rule_id: updated.id, rule_version: newVersion, actor_id: req.user?.id });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// SUBMIT FOR REVIEW
// ══════════════════════════════════════════════════════════════════
router.post('/:id/submit', requireAdmin, async (req, res) => {
  try {
    const { data: rule } = await adminDb.from('kontra_rules').select('*').eq('id', req.params.id).single();
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    if (rule.status !== 'draft') return res.status(409).json({ error: 'Only draft rules can be submitted' });

    await adminDb.from('kontra_rules').update({ status: 'pending_review', updated_by: req.user?.id }).eq('id', req.params.id);
    await adminDb.from('kontra_rule_approvals').insert({ rule_id: req.params.id, rule_version: rule.version, submitted_by: req.user?.id, status: 'pending' });
    await audit('rule_submitted', { rule_id: rule.id, rule_version: rule.version, actor_id: req.user?.id });

    return res.json({ message: 'Rule submitted for review' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// APPROVE
// ══════════════════════════════════════════════════════════════════
router.post('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { note } = req.body;
    const { data: rule } = await adminDb.from('kontra_rules').select('*').eq('id', req.params.id).single();
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    if (rule.status !== 'pending_review') return res.status(409).json({ error: 'Rule is not pending review' });

    // Maker-checker: approver must differ from submitter
    const { data: pending } = await adminDb.from('kontra_rule_approvals').select('*').eq('rule_id', req.params.id).eq('status', 'pending').single();
    if (pending?.submitted_by === req.user?.id) {
      return res.status(403).json({ error: 'Maker-checker violation: approver cannot be the same user who submitted' });
    }

    await adminDb.from('kontra_rule_approvals').update({ status: 'approved', reviewed_by: req.user?.id, reviewed_at: new Date().toISOString(), review_note: note ?? null }).eq('id', pending.id);
    await adminDb.from('kontra_rules').update({ status: 'approved', updated_by: req.user?.id }).eq('id', req.params.id);
    await audit('rule_approved', { rule_id: rule.id, rule_version: rule.version, actor_id: req.user?.id, result: { note } });

    return res.json({ message: 'Rule approved. Ready to publish.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// REJECT
// ══════════════════════════════════════════════════════════════════
router.post('/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'Rejection note is required' });

    const { data: rule } = await adminDb.from('kontra_rules').select('*').eq('id', req.params.id).single();
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    const { data: pending } = await adminDb.from('kontra_rule_approvals').select('*').eq('rule_id', req.params.id).eq('status', 'pending').maybeSingle();
    if (pending) {
      await adminDb.from('kontra_rule_approvals').update({ status: 'rejected', reviewed_by: req.user?.id, reviewed_at: new Date().toISOString(), review_note: note }).eq('id', pending.id);
    }

    await adminDb.from('kontra_rules').update({ status: 'draft', updated_by: req.user?.id }).eq('id', req.params.id);
    await audit('rule_rejected', { rule_id: rule.id, rule_version: rule.version, actor_id: req.user?.id, result: { note } });

    return res.json({ message: 'Rule rejected and returned to draft' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PUBLISH
// ══════════════════════════════════════════════════════════════════
router.post('/:id/publish', requireAdmin, async (req, res) => {
  try {
    const { data: rule } = await adminDb.from('kontra_rules').select('*').eq('id', req.params.id).single();
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    if (rule.status !== 'approved') return res.status(409).json({ error: 'Only approved rules can be published' });

    await adminDb.from('kontra_rules').update({ status: 'published', updated_by: req.user?.id }).eq('id', req.params.id);
    await audit('rule_published', { rule_id: rule.id, rule_version: rule.version, actor_id: req.user?.id });

    return res.json({ message: 'Rule is now live' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// EMERGENCY OVERRIDE — platform_admin only, bypasses maker-checker
// ══════════════════════════════════════════════════════════════════
router.post('/:id/emergency', async (req, res) => {
  try {
    if (req.role !== 'platform_admin') return res.status(403).json({ error: 'Emergency override requires platform_admin' });
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Emergency reason is required' });

    const { data: rule } = await adminDb.from('kontra_rules').select('*').eq('id', req.params.id).single();
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    await adminDb.from('kontra_rules').update({ status: 'emergency', updated_by: req.user?.id }).eq('id', req.params.id);
    await adminDb.from('kontra_rule_approvals').insert({ rule_id: req.params.id, rule_version: rule.version, submitted_by: req.user?.id, reviewed_by: req.user?.id, reviewed_at: new Date().toISOString(), status: 'approved', is_emergency: true, review_note: `EMERGENCY: ${reason}` });
    await audit('rule_emergency_override', { rule_id: rule.id, rule_version: rule.version, actor_id: req.user?.id, result: { reason } });

    return res.json({ message: 'Emergency rule activated' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// ARCHIVE
// ══════════════════════════════════════════════════════════════════
router.post('/:id/archive', requireAdmin, async (req, res) => {
  try {
    await adminDb.from('kontra_rules').update({ status: 'archived', updated_by: req.user?.id }).eq('id', req.params.id);
    await audit('rule_archived', { rule_id: req.params.id, actor_id: req.user?.id });
    return res.json({ message: 'Rule archived' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// VERSION HISTORY
// ══════════════════════════════════════════════════════════════════
router.get('/:id/history', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await adminDb
      .from('kontra_rule_versions')
      .select('*')
      .eq('rule_id', req.params.id)
      .order('version', { ascending: false });

    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// ROLLBACK to a previous version
// ══════════════════════════════════════════════════════════════════
router.post('/:id/rollback', requireAdmin, async (req, res) => {
  try {
    const { version, reason } = req.body;
    if (!version) return res.status(400).json({ error: 'version is required' });

    const { data: snapshot, error } = await adminDb.from('kontra_rule_versions').select('*').eq('rule_id', req.params.id).eq('version', version).single();
    if (error || !snapshot) return res.status(404).json({ error: `Version ${version} not found` });

    const { data: current } = await adminDb.from('kontra_rules').select('version').eq('id', req.params.id).single();
    const newVersion = (current?.version ?? version) + 1;

    const snap = snapshot.snapshot;
    const { data: rolled, error: updateErr } = await adminDb
      .from('kontra_rules')
      .update({
        ...snap,
        id: req.params.id,
        version: newVersion,
        status: 'draft',
        updated_by: req.user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    await snapshotVersion(rolled, req.user?.id, `Rolled back to v${version}${reason ? ': ' + reason : ''}`);
    await audit('rule_rolled_back', { rule_id: req.params.id, rule_version: newVersion, actor_id: req.user?.id, result: { rolled_back_to: version, reason } });

    return res.json({ message: `Rolled back to v${version} as new draft v${newVersion}`, rule: rolled });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
