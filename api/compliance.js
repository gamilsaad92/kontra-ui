const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { logAuditEntry } = require('./auditLogger');
const { isFeatureEnabled } = require('./featureFlags');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const defaultRules = [
  { name: 'EHL disclosure', required: 'Equal Housing Lender' },
  { name: 'Old template', deprecated: '2019 Template' },
  { name: 'Placeholder', deprecated: '[INSERT CLAUSE]' }
];

function scanForCompliance(text, rules = defaultRules) {
  const issues = [];
  for (const rule of rules) {
    if (rule.required && !text.includes(rule.required)) {
      issues.push({ rule: rule.name, message: `Missing required text: ${rule.required}` });
    }
    if (rule.deprecated && text.includes(rule.deprecated)) {
      issues.push({ rule: rule.name, message: `Contains deprecated text: ${rule.deprecated}` });
    }
    if (rule.regex) {
      const re = new RegExp(rule.regex, 'i');
      if (re.test(text)) {
        issues.push({ rule: rule.name, message: `Flagged pattern: ${rule.regex}` });
      }
    }
  }
  return { issues };
}

async function gatherEvidence(loanId) {
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('loan_id', loanId);

  const { data: waivers } = await supabase
    .from('lien_waivers')
    .select('id, file_url, verified_at, verification_passed')
    .eq('loan_id', loanId);

  const { data: application } = await supabase
    .from('loan_applications')
    .select('*')
    .eq('id', loanId)
    .maybeSingle();

  return { notifications, waivers, application };
}

const ORG_RISK_LIMITS = {
  default: 1_000_000
};

async function runKycCheck(counterparty) {
  if (!isFeatureEnabled('kyc')) {
    return { passed: true };
  }
  if (!process.env.KYC_API_URL || !process.env.KYC_API_KEY) {
    throw new Error('KYC provider not configured');
  }
  const resp = await fetch(process.env.KYC_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KYC_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ counterparty })
  });
  if (!resp.ok) {
    throw new Error(`status ${resp.status}`);
  }
  const data = await resp.json();
  return { passed: !!data.passed };
}

async function validateTrade(trade) {
  const auditBase = {
    type: 'trade_compliance',
    trade_id: trade.id,
    organization_id: trade.orgId
  };

  for (const cp of trade.counterparties || []) {
    let kyc;
    try {
      kyc = await runKycCheck(cp);
    } catch (err) {
      logAuditEntry({ ...auditBase, result: 'kyc_error', counterparty: cp, error: err.message });
      throw err;
    }
    if (!kyc.passed) {
      logAuditEntry({ ...auditBase, result: 'kyc_failed', counterparty: cp });
      return { valid: false, message: `KYC failed for counterparty ${cp}` };
    }
  }

  const limit = ORG_RISK_LIMITS[trade.orgId] || ORG_RISK_LIMITS.default;
  const notional =
    trade.notional_amount !== undefined
      ? trade.notional_amount
      : (trade.quantity || 0) * (trade.price || 0);
  if (notional > limit) {
    logAuditEntry({ ...auditBase, result: 'limit_exceeded', notional, limit });
    return { valid: false, message: 'Trade exceeds risk limit' };
  }

  logAuditEntry({ ...auditBase, result: 'passed', notional, limit });
  return { valid: true };
}

module.exports = { scanForCompliance, gatherEvidence, validateTrade };
