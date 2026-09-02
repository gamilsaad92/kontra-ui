/**
 * Kontra Policy Engine — Phase 3
 *
 * The query layer between AI agents and the `kontra_rules` database.
 * Agents call this engine instead of hardcoded constants.
 *
 * Evaluation order:
 *   1. Org-level override (kontra_rule_overrides) — highest priority
 *   2. Published DB rule (kontra_rules) with effective date check
 *   3. Hardcoded fallback registry — lowest priority (development/demo)
 *
 * Every evaluation is logged to kontra_rule_audit_log for full traceability.
 */

const { createClient } = require('@supabase/supabase-js');

const adminDb = createClient(
  process.env.SUPABASE_URL              || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ── Hardcoded fallback registry ───────────────────────────────────────────────
// Used when the DB is unavailable or a rule hasn't been migrated to the DB yet.

const FALLBACK_RULES = {
  // ── Freddie Mac Inspection Rules ──────────────────────────────────────────
  'GSE-INSP-01': { description:'Critical structural deficiency: 30-day cure notice; active draws held', category:'freddie_mac', severity:'critical', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Seller/Servicer Guide §58.4', operator:'flag', threshold:null },
  'GSE-INSP-02': { description:'High-severity deficiency: 60-day cure window; notify borrower', category:'freddie_mac', severity:'high', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Seller/Servicer Guide §58.4', operator:'flag', threshold:null },
  'FREDDIE-5.3.2': { description:'Hazard insurance must cover structural damage at replacement cost value', category:'freddie_mac', severity:'high', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §58.2(b)', operator:'flag', threshold:null },

  // ── Freddie Mac Financial / Covenant Rules ────────────────────────────────
  'COV-DSCR-01': { description:'DSCR minimum 1.25x — tested quarterly', category:'freddie_mac', severity:'high', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §27.3', operator:'>=', threshold:1.25, threshold_unit:'x' },
  'COV-LTV-MAX': { description:'LTV maximum 80% — tested at annual review', category:'freddie_mac', severity:'medium', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §27.2', operator:'<=', threshold:80, threshold_unit:'percent' },
  'COV-OCC-MIN': { description:'Occupancy minimum 85% — tested quarterly', category:'freddie_mac', severity:'medium', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §27.4', operator:'>=', threshold:85, threshold_unit:'percent' },
  'COV-CURE-30': { description:'Material covenant breach: 30-day cure period', category:'freddie_mac', severity:'high', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §27.7', operator:'flag', threshold:null },
  'FREDDIE-ANNUAL': { description:'Annual financial review required within 120 days of fiscal year-end', category:'freddie_mac', severity:'medium', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §30.2', operator:'<=', threshold:120, threshold_unit:'days' },
  'FREDDIE-INS-MIN': { description:'Insurance coverage minimum: replacement cost value of improvements', category:'freddie_mac', severity:'high', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §58.2', operator:'flag', threshold:null },

  // ── PSA / Investor Notification Rules ─────────────────────────────────────
  'PSA-INVESTOR-NOTIFY': { description:'Material covenant breach: investor notification within 5 business days', category:'freddie_mac', severity:'high', source_agency:'freddie_mac', source_reference:'Pooling and Servicing Agreement §8.4', operator:'flag', threshold:null },

  // ── Hazard Loss Rules ─────────────────────────────────────────────────────
  'HAZARD-HOLD-50PCT': { description:'Insurance proceeds >$100K: 50% holdback until repairs 50% complete', category:'hazard_loss', severity:'high', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §59.3(b)', operator:'>', threshold:100000, threshold_unit:'usd' },
  'HAZARD-PSA-NOTIFY': { description:'Material hazard loss >$50K: PSA investor notification required', category:'hazard_loss', severity:'medium', source_agency:'freddie_mac', source_reference:'Pooling and Servicing Agreement §9.2', operator:'>', threshold:50000, threshold_unit:'usd' },
  'HAZARD-INSPECT-REQ': { description:'Disbursement requires post-repair inspection sign-off', category:'hazard_loss', severity:'high', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §59.4', operator:'flag', threshold:null },

  // ── Watchlist Rules ───────────────────────────────────────────────────────
  'WATCH-DQ90': { description:'90+ day delinquency: mandatory watchlist placement', category:'watchlist', severity:'critical', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §74.2', operator:'>=', threshold:90, threshold_unit:'days' },
  'WATCH-DSCR-SUB': { description:'DSCR < 1.00x: substandard risk classification', category:'watchlist', severity:'critical', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §74.3', operator:'<', threshold:1.0, threshold_unit:'x' },
  'WATCH-RESERVE-DEP': { description:'Capital reserve depletion: enhanced monitoring required', category:'watchlist', severity:'high', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §74.4', operator:'<=', threshold:0, threshold_unit:'usd' },

  // ── Draw Rules ────────────────────────────────────────────────────────────
  'DRAW-HOLD-CRIT': { description:'Active draw requests held pending critical deficiency cure', category:'freddie_mac', severity:'critical', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §58.4(c)', operator:'flag', threshold:null },

  // ── Tokenization Rules ────────────────────────────────────────────────────
  'TOKEN-DSCR-MIN': { description:'Tokenizable loans must maintain DSCR ≥ 1.20x', category:'tokenization', severity:'high', source_agency:'platform', source_reference:'Kontra Token Eligibility Standard §3.1', operator:'>=', threshold:1.20, threshold_unit:'x' },
  'TOKEN-LTV-MAX': { description:'Tokenizable loans must maintain LTV ≤ 75%', category:'tokenization', severity:'high', source_agency:'platform', source_reference:'Kontra Token Eligibility Standard §3.2', operator:'<=', threshold:75, threshold_unit:'percent' },
  'TOKEN-CURRENT': { description:'Loan must be current (0-29 days) for token inclusion', category:'tokenization', severity:'critical', source_agency:'platform', source_reference:'Kontra Token Eligibility Standard §3.3', operator:'<=', threshold:29, threshold_unit:'days' },
  'TOKEN-AUDIT': { description:'Annual appraisal required for tokenized positions', category:'tokenization', severity:'medium', source_agency:'platform', source_reference:'Kontra Token Eligibility Standard §3.4', operator:'<=', threshold:365, threshold_unit:'days' },

  // ── CFPB Compliance ───────────────────────────────────────────────────────
  'CFPB-LOSS-MIT-REQ': { description:'Loss mitigation procedures must be documented and available', category:'compliance', severity:'high', source_agency:'cfpb', source_reference:'12 CFR §1024.41 Loss Mitigation Procedures', operator:'flag', threshold:null },

  // ── Reserve Rules ─────────────────────────────────────────────────────────
  'RESERVE-TIER1-MIN': { description:'Tier 1 loans: minimum reserve balance 3 months PITI', category:'reserve', severity:'high', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §31.2', operator:'>=', threshold:3, threshold_unit:'months_piti' },
  'RESERVE-REPLENISH-90': { description:'Reserve draws must be replenished within 90 days', category:'reserve', severity:'medium', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §31.4', operator:'<=', threshold:90, threshold_unit:'days' },

  // ── Maturity Extension Rules ──────────────────────────────────────────────
  'MAT-EXT-PERFORMING': { description:'Maturity extension requires loan to be performing (DSCR ≥ 1.10x)', category:'maturity', severity:'high', source_agency:'lender', source_reference:'Lender Maturity Extension Policy §2.1', operator:'>=', threshold:1.10, threshold_unit:'x' },
  'MAT-EXT-MAX-TERM': { description:'Maximum maturity extension: 24 months beyond original maturity', category:'maturity', severity:'medium', source_agency:'lender', source_reference:'Lender Maturity Extension Policy §2.3', operator:'<=', threshold:24, threshold_unit:'months' },
  'MAT-T90-NOTICE': { description:'Borrower maturity notice required 90 days before maturity', category:'maturity', severity:'medium', source_agency:'freddie_mac', source_reference:'Freddie Mac Multifamily Guide §65.3', operator:'<=', threshold:90, threshold_unit:'days' },
};

// ── Condition evaluator (maps from DB rule to result) ─────────────────────────

function evalDbRule(dbRule, value) {
  const conds = Array.isArray(dbRule.conditions) ? dbRule.conditions : [];

  if (conds.length === 0) {
    // Flag rule — always triggered
    return { result: 'triggered', reason: dbRule.description || dbRule.name };
  }

  // Use the first condition for threshold evaluation
  const cond = conds[0];
  const numVal = Number(value);
  const threshold = cond.value !== undefined ? Number(cond.value) : null;

  let triggered = false;
  switch (cond.operator) {
    case 'gt':  triggered = numVal > threshold; break;
    case 'gte': triggered = numVal >= threshold; break;
    case 'lt':  triggered = numVal < threshold; break;
    case 'lte': triggered = numVal <= threshold; break;
    case 'eq':  triggered = String(value) === String(cond.value); break;
    case 'ne':  triggered = String(value) !== String(cond.value); break;
    case 'exists': triggered = Boolean(cond.value) ? value != null : value == null; break;
    default: triggered = true; // Unknown operator — flag as triggered
  }

  const reason = triggered
    ? `${value} ${triggered ? '' : 'does not '}violate rule: ${dbRule.description || dbRule.name}`
    : `${value} satisfies rule: ${dbRule.description || dbRule.name}`;

  return { result: triggered ? 'triggered' : 'clear', reason };
}

function evalFallbackRule(rule, value) {
  if (!rule) return { result: 'unknown', reason: 'Rule not found in registry' };

  const numVal = Number(value);
  let result = 'unknown';
  let reason = '';

  if (rule.operator === 'flag') {
    result = 'triggered';
    reason = rule.description;
  } else if (rule.operator === '>=' && value !== undefined) {
    result = numVal >= rule.threshold ? 'clear' : 'triggered';
    reason = result === 'triggered'
      ? `${value} is below minimum threshold of ${rule.threshold}${rule.threshold_unit ? ' ' + rule.threshold_unit : ''}. ${rule.description}`
      : `${value} meets or exceeds minimum threshold of ${rule.threshold}${rule.threshold_unit ? ' ' + rule.threshold_unit : ''}.`;
  } else if (rule.operator === '<=' && value !== undefined) {
    result = numVal <= rule.threshold ? 'clear' : 'triggered';
    reason = result === 'triggered'
      ? `${value} exceeds maximum threshold of ${rule.threshold}${rule.threshold_unit ? ' ' + rule.threshold_unit : ''}. ${rule.description}`
      : `${value} is within maximum threshold of ${rule.threshold}${rule.threshold_unit ? ' ' + rule.threshold_unit : ''}.`;
  } else if (rule.operator === '<' && value !== undefined) {
    result = numVal < rule.threshold ? 'triggered' : 'clear';
    reason = result === 'triggered'
      ? `${value} is below critical threshold of ${rule.threshold}${rule.threshold_unit ? ' ' + rule.threshold_unit : ''}. ${rule.description}`
      : `${value} is at or above threshold of ${rule.threshold}${rule.threshold_unit ? ' ' + rule.threshold_unit : ''}.`;
  } else if (rule.operator === '>' && value !== undefined) {
    result = numVal > rule.threshold ? 'triggered' : 'clear';
    reason = result === 'triggered'
      ? `${value} exceeds threshold of ${rule.threshold}${rule.threshold_unit ? ' ' + rule.threshold_unit : ''}. ${rule.description}`
      : `${value} does not exceed threshold of ${rule.threshold}${rule.threshold_unit ? ' ' + rule.threshold_unit : ''}.`;
  } else {
    result = 'triggered';
    reason = rule.description;
  }

  return { result, reason };
}

// ── Core: evaluateRule ────────────────────────────────────────────────────────

/**
 * Evaluate a single rule against a value.
 *
 * @param {string}  ruleId   — Rule key (e.g. "GSE-INSP-01")
 * @param {*}       value    — The measured value (number, string, boolean)
 * @param {object}  context  — { org_id, loan_id, agent_name, workflow_run_id }
 * @returns {Promise<RuleEvaluationResult>}
 */
async function evaluateRule(ruleId, value, context = {}) {
  const { org_id, loan_id, agent_name, workflow_run_id } = context;
  const today = new Date().toISOString();
  let source = 'hardcoded_fallback';
  let dbRuleId = null;
  let version = null;
  let description = null;
  let category = null;
  let severity = null;
  let source_reference = null;
  let evalResult;

  try {
    // 1. Check for org-level active override
    if (org_id) {
      const { data: override } = await adminDb
        .from('kontra_rule_overrides')
        .select('*')
        .eq('org_id', org_id)
        .eq('rule_key', ruleId)
        .eq('status', 'active')
        .lte('effective_from', today)
        .or(`effective_until.is.null,effective_until.gte.${today}`)
        .maybeSingle();

      if (override) {
        source = 'org_override';
        evalResult = override.override_result || { result: 'overridden', reason: override.override_reason };
        await logEvaluation({ ruleId, value, org_id, loan_id, agent_name, workflow_run_id, result: evalResult.result, source, dbRuleId });
        return buildResult({ ruleId, description: override.override_reason, category, severity, source_reference, version, source, ...evalResult });
      }
    }

    // 2. Query DB for published, effective rule
    let q = adminDb
      .from('kontra_rules')
      .select('*')
      .eq('rule_key', ruleId)
      .eq('status', 'published')
      .lte('effective_date', today);

    if (org_id) q = q.or(`organization_id.is.null,organization_id.eq.${org_id}`);

    const { data: rules } = await q.order('version', { ascending: false }).limit(1);
    const dbRule = rules?.[0];

    if (dbRule) {
      source = 'db_rule';
      dbRuleId = dbRule.id;
      version = dbRule.version;
      description = dbRule.description || dbRule.name;
      category = dbRule.category;
      severity = dbRule.severity;
      source_reference = dbRule.source_reference;
      evalResult = evalDbRule(dbRule, value);
    }
  } catch (dbErr) {
    // DB unavailable — fall through to hardcoded fallback
  }

  // 3. Hardcoded fallback
  if (!evalResult) {
    const fallback = FALLBACK_RULES[ruleId];
    if (fallback) {
      description = fallback.description;
      category = fallback.category;
      severity = fallback.severity;
      source_reference = fallback.source_reference;
      version = 0;
      evalResult = evalFallbackRule(fallback, value);
    } else {
      evalResult = { result: 'unknown', reason: `Rule ${ruleId} not found in policy engine or fallback registry` };
    }
  }

  // 4. Log evaluation (non-blocking)
  logEvaluation({ ruleId, value, org_id, loan_id, agent_name, workflow_run_id, result: evalResult.result, source, dbRuleId }).catch(() => {});

  return buildResult({ ruleId, description, category, severity, source_reference, version, source, ...evalResult });
}

// ── Evaluate a full category of rules ────────────────────────────────────────

/**
 * Run all published rules in a category against a context object.
 * Context fields are resolved using dot notation (e.g. loan.dscr).
 *
 * @param {string}  category  — Rule category (e.g. "freddie_mac", "watchlist")
 * @param {object}  ctx       — Data context (e.g. { loan: { dscr: 1.08, ltv: 72 } })
 * @param {object}  options   — { org_id, loan_id, agent_name, workflow_run_id }
 */
async function evaluateCategory(category, ctx, options = {}) {
  try {
    const today = new Date().toISOString();
    const { org_id } = options;

    let query = adminDb
      .from('kontra_rules')
      .select('*')
      .eq('category', category)
      .eq('status', 'published')
      .lte('effective_date', today);

    if (org_id) query = query.or(`organization_id.is.null,organization_id.eq.${org_id}`);

    const { data: rules } = await query;

    const results = [];
    for (const rule of (rules || [])) {
      const evalResult = evalDbRule(rule, ctx);
      results.push(buildResult({
        ruleId: rule.rule_key || rule.id,
        description: rule.description || rule.name,
        category: rule.category,
        severity: rule.severity,
        source_reference: rule.source_reference,
        version: rule.version,
        source: 'db_rule',
        ...evalResult,
      }));
    }

    // Supplement with fallback rules for this category if DB returned none
    if (results.length === 0) {
      const categoryFallbacks = Object.entries(FALLBACK_RULES).filter(([, r]) => r.category === category);
      for (const [ruleId, rule] of categoryFallbacks) {
        const val = ctx[rule.threshold_unit] ?? ctx.value;
        const evalResult = evalFallbackRule(rule, val);
        results.push(buildResult({ ruleId, description: rule.description, category: rule.category, severity: rule.severity, source_reference: rule.source_reference, version: 0, source: 'hardcoded_fallback', ...evalResult }));
      }
    }

    return { category, results, triggered_count: results.filter((r) => r.result === 'triggered').length, total: results.length };
  } catch (err) {
    return { category, results: [], error: err.message };
  }
}

// ── Get a single rule (for UI inspection) ────────────────────────────────────

async function getRuleById(ruleId, context = {}) {
  const { org_id } = context;
  try {
    let query = adminDb.from('kontra_rules').select('*').eq('rule_key', ruleId).eq('status', 'published');
    if (org_id) query = query.or(`organization_id.is.null,organization_id.eq.${org_id}`);
    const { data } = await query.order('version', { ascending: false }).limit(1);
    if (data?.[0]) return { ...data[0], source: 'db_rule' };
  } catch (_) {}

  const fallback = FALLBACK_RULES[ruleId];
  if (fallback) return { rule_key: ruleId, ...fallback, version: 0, status: 'published', source: 'hardcoded_fallback' };
  return null;
}

// ── Audit log helper ──────────────────────────────────────────────────────────

async function logEvaluation({ ruleId, value, org_id, loan_id, agent_name, workflow_run_id, result, source, dbRuleId }) {
  try {
    await adminDb.from('kontra_rule_audit_log').insert({
      event_type: 'rule_evaluated',
      rule_id: dbRuleId || null,
      context: { rule_key: ruleId, value, loan_id, agent_name, workflow_run_id, source },
      result,
      portal: 'agent',
    });
  } catch (_) {}
}

// ── Result builder ────────────────────────────────────────────────────────────

function buildResult({ ruleId, description, category, severity, source_reference, version, source, result, reason }) {
  return {
    rule_id: ruleId,
    description: description || ruleId,
    category: category || 'unknown',
    severity: severity || 'medium',
    source_reference: source_reference || null,
    version: version ?? null,
    source, // 'db_rule' | 'hardcoded_fallback' | 'org_override'
    result, // 'triggered' | 'clear' | 'overridden' | 'unknown'
    reason: reason || '',
    evaluated_at: new Date().toISOString(),
  };
}

// ── Stats for UI dashboard ────────────────────────────────────────────────────

async function getPolicyStats(org_id) {
  const stats = {
    total_rules: 0,
    active_rules: 0,
    pending_approval: 0,
    categories: {},
    source_agencies: {},
    evaluations_today: 0,
    fallback_rules: Object.keys(FALLBACK_RULES).length,
  };

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [rulesRes, pendingRes, auditsRes] = await Promise.all([
      adminDb.from('kontra_rules').select('category, status, severity, source_agency').or(`organization_id.is.null${org_id ? `,organization_id.eq.${org_id}` : ''}`),
      adminDb.from('kontra_rules').select('id').eq('status', 'pending_review'),
      adminDb.from('kontra_rule_audit_log').select('id').eq('event_type', 'rule_evaluated').gte('created_at', today.toISOString()),
    ]);

    const rules = rulesRes.data || [];
    stats.total_rules = rules.length;
    stats.active_rules = rules.filter((r) => r.status === 'published').length;
    stats.pending_approval = (pendingRes.data || []).length;
    stats.evaluations_today = (auditsRes.data || []).length;

    for (const rule of rules) {
      if (!stats.categories[rule.category]) stats.categories[rule.category] = { total: 0, active: 0 };
      stats.categories[rule.category].total++;
      if (rule.status === 'published') stats.categories[rule.category].active++;

      if (rule.source_agency) {
        stats.source_agencies[rule.source_agency] = (stats.source_agencies[rule.source_agency] || 0) + 1;
      }
    }
  } catch (_) {
    // Return fallback stats
    stats.total_rules = Object.keys(FALLBACK_RULES).length;
    stats.active_rules = Object.keys(FALLBACK_RULES).length;
    const catCounts = {};
    Object.values(FALLBACK_RULES).forEach((r) => {
      catCounts[r.category] = catCounts[r.category] || { total: 0, active: 0 };
      catCounts[r.category].total++;
      catCounts[r.category].active++;
    });
    stats.categories = catCounts;
  }

  return stats;
}

module.exports = { evaluateRule, evaluateCategory, getRuleById, getPolicyStats, FALLBACK_RULES };
