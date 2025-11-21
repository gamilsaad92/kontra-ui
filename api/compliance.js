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

const INVESTOR_WHITELIST = {
  cp1: {
    id: 'cp1',
    wallet_address: '0xCP1',
    jurisdiction: 'US',
    investor_type: 'institutional',
    kycApproved: true
  },
  cp2: {
    id: 'cp2',
    wallet_address: '0xCP2',
    jurisdiction: 'GB',
    investor_type: 'qualified_purchaser',
    kycApproved: true
  },
  '0xSAFEWALLET': {
    id: '0xSAFEWALLET',
    wallet_address: '0xSAFEWALLET',
    jurisdiction: 'US',
    investor_type: 'institutional',
    kycApproved: true
  }
};

const RESTRICTED_JURISDICTIONS = (process.env.RESTRICTED_JURISDICTIONS || 'IR,KP,SY,CU,SD')
  .split(',')
  .map(j => j.trim().toUpperCase())
  .filter(Boolean);
const RESTRICTED_INVESTOR_TYPES = ['sanctioned', 'unaccredited'];

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

function isTransfersPaused() {
  return process.env.TRANSFERS_PAUSED === 'true';
}

function normalizeCounterpartyProfile(counterparty) {
  if (!counterparty) return null;
  const raw =
    typeof counterparty === 'string'
      ? { id: counterparty, wallet_address: counterparty }
      : { ...counterparty };
  const lookupKey = raw.wallet_address || raw.id;
  const whitelisted = lookupKey ? INVESTOR_WHITELIST[lookupKey] : null;
  const merged = {
    ...whitelisted,
    ...raw,
    id: raw.id || whitelisted?.id || raw.wallet_address,
    wallet_address: raw.wallet_address || whitelisted?.wallet_address || raw.id,
    jurisdiction: (raw.jurisdiction || whitelisted?.jurisdiction || '').toUpperCase(),
    investor_type: raw.investor_type || whitelisted?.investor_type || 'unspecified',
    kycApproved:
      raw.kycApproved ?? raw.kyc_status === 'approved' ?? whitelisted?.kycApproved ?? false
  };
  return merged;
}

function evaluateCounterparties(counterparties = [], counterpartyProfiles = []) {
  const profiles = (counterpartyProfiles.length ? counterpartyProfiles : counterparties)
    .map(normalizeCounterpartyProfile)
    .filter(Boolean);
  const flags = [];

  if (!profiles.length) {
    return { valid: false, message: 'Counterparties are required for compliance review' };
  }

  for (const profile of profiles) {
    const whitelistKey = profile.wallet_address || profile.id;
    if (!whitelistKey || !INVESTOR_WHITELIST[whitelistKey]) {
      return { valid: false, message: `Counterparty ${profile.id || 'unknown'} is not whitelisted` };
    }

    if (!profile.kycApproved) {
      return {
        valid: false,
        message: `Counterparty ${profile.id || profile.wallet_address} must complete KYC before trading`
      };
    }

    if (profile.jurisdiction && RESTRICTED_JURISDICTIONS.includes(profile.jurisdiction)) {
      return {
        valid: false,
        message: `Jurisdiction ${profile.jurisdiction} is restricted for transfers`
      };
    }

    if (RESTRICTED_INVESTOR_TYPES.includes((profile.investor_type || '').toLowerCase())) {
      return {
        valid: false,
        message: `Investor type ${profile.investor_type} is not eligible for this token`
      };
    }

    if (!profile.jurisdiction) {
      flags.push({ code: 'missing_jurisdiction', message: 'Jurisdiction not provided for counterparty' });
    }
  }

  return { valid: true, profiles, flags };
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

 if (isTransfersPaused()) {
    logAuditEntry({ ...auditBase, result: 'transfers_paused' });
    return { valid: false, message: 'Transfers are currently paused for compliance review' };
  }

  const counterpartyCheck = evaluateCounterparties(
    trade.counterparties,
    trade.counterparty_profiles || []
  );
  if (!counterpartyCheck.valid) {
    logAuditEntry({ ...auditBase, result: 'counterparty_rejected', reason: counterpartyCheck.message });
    return { valid: false, message: counterpartyCheck.message };
  }

  for (const cp of counterpartyCheck.profiles || []) {
    let kyc;
    try {
    const identifier = cp.wallet_address || cp.id || cp;
      kyc = await runKycCheck(identifier);
    } catch (err) {
      logAuditEntry({ ...auditBase, result: 'kyc_error', counterparty: cp, error: err.message });
      throw err;
    }
    if (!kyc.passed) {
      logAuditEntry({ ...auditBase, result: 'kyc_failed', counterparty: cp });
     return { valid: false, message: `KYC failed for counterparty ${cp.id || cp}` };
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
 return { valid: true, flags: counterpartyCheck.flags };
}

function getComplianceConstraints() {
  return {
    paused: isTransfersPaused(),
    restrictedJurisdictions: RESTRICTED_JURISDICTIONS,
    restrictedInvestorTypes: RESTRICTED_INVESTOR_TYPES,
    whitelist: Object.values(INVESTOR_WHITELIST).map(entry => ({
      id: entry.id || entry.wallet_address,
      wallet_address: entry.wallet_address,
      jurisdiction: entry.jurisdiction,
      investor_type: entry.investor_type
    }))
  };
}

module.exports = {
  scanForCompliance,
  gatherEvidence,
  validateTrade,
  runKycCheck,
  getComplianceConstraints,
  evaluateCounterparties
};
