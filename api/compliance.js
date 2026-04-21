const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { logAuditEntry } = require('./auditLogger');
const { isFeatureEnabled } = require('./featureFlags');
const { getLegalConfiguration, enforceTransferControls } = require('./legalConfiguration');
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

const KYC_PROVIDERS = {
  sumsub: {
    name: 'Sumsub',
    amlProvider: 'Dow Jones PEP/Sanctions',
    hooks: ['webhooks', 'kyc/aml orchestration'],
    portalUrl: 'https://dashboard.sumsub.com'
  },
  persona: {
    name: 'Persona',
    amlProvider: 'Persona Watchlists',
    hooks: ['workflow templates', 'KYB + doc verification'],
    portalUrl: 'https://withpersona.com'
  },
  parallel: {
    name: 'Parallel Markets',
    amlProvider: 'Parallel Markets',
    hooks: ['broker-dealer attestations', 'accreditation vault'],
    portalUrl: 'https://parallelmarkets.com'
  }
};

const ISSUANCE_PARTNERS = {
  securitize: {
    name: 'Securitize',
    role: 'Transfer agent',
    exemptions: ['Reg D 506(c)', 'Reg S'],
    services: ['ATS onboarding', 'transfer restriction legends']
  },
  polymesh: {
    name: 'Polymesh',
    role: 'Purpose-built security chain',
    exemptions: ['Reg D', 'Reg S'],
    services: ['on-chain identity', 'regulated settlement']
  },
  tokeny: {
    name: 'Tokeny',
    role: 'Compliance agent',
    exemptions: ['Reg D', 'Reg S'],
    services: ['investor registry', 'T-REX transfer controls']
  }
};

const INVESTOR_WHITELIST = {
  cp1: {
    id: 'cp1',
    wallet_address: '0xCP1',
    jurisdiction: 'US',
    investor_type: 'institutional',
    kycApproved: true,
    amlApproved: true,
    verified: true,
    kyc_provider: 'Sumsub',
    aml_provider: 'Dow Jones PEP/Sanctions'
  },
  cp2: {
    id: 'cp2',
    wallet_address: '0xCP2',
    jurisdiction: 'GB',
    investor_type: 'qualified_purchaser',
 kycApproved: true,
    amlApproved: true,
    verified: true,
    kyc_provider: 'Persona',
    aml_provider: 'Persona Watchlists'
  },
  '0xSAFEWALLET': {
    id: '0xSAFEWALLET',
    wallet_address: '0xSAFEWALLET',
    jurisdiction: 'US',
    investor_type: 'institutional',
   kycApproved: true,
    amlApproved: true,
    verified: true,
    kyc_provider: 'Parallel Markets',
    aml_provider: 'Parallel Markets'
  },
  '0xYIELDCLEAR': {
    id: '0xYIELDCLEAR',
    wallet_address: '0xYIELDCLEAR',
    jurisdiction: 'SG',
    investor_type: 'institutional',
    kycApproved: true,
    amlApproved: true,
    verified: true,
    kyc_provider: 'Sumsub',
    aml_provider: 'Dow Jones PEP/Sanctions'
  }
};

const RESTRICTED_JURISDICTIONS = (process.env.RESTRICTED_JURISDICTIONS || 'IR,KP,SY,CU,SD')
  .split(',')
  .map(j => j.trim().toUpperCase())
  .filter(Boolean);
const RESTRICTED_INVESTOR_TYPES = ['sanctioned', 'unaccredited'];

function findWhitelistedEntry(identifier) {
  if (!identifier) return null;
  const direct = INVESTOR_WHITELIST[identifier];
  if (direct) return direct;
  const normalized = String(identifier).toLowerCase();
  return (
    Object.values(INVESTOR_WHITELIST).find(entry => {
      const value = String(entry.wallet_address || entry.id || '').toLowerCase();
      return value === normalized;
    }) || null
  );
}

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
  const kycProvider = getActiveKycProvider();
  const lookupKey = raw.wallet_address || raw.id;
 const whitelisted = findWhitelistedEntry(lookupKey);
  const merged = {
    ...whitelisted,
    ...raw,
    id: raw.id || whitelisted?.id || raw.wallet_address,
    wallet_address: raw.wallet_address || whitelisted?.wallet_address || raw.id,
    jurisdiction: (raw.jurisdiction || whitelisted?.jurisdiction || '').toUpperCase(),
    investor_type: raw.investor_type || whitelisted?.investor_type || 'unspecified',
    kycApproved:
     raw.kycApproved ?? raw.kyc_status === 'approved' ?? whitelisted?.kycApproved ?? false,
    amlApproved: raw.amlApproved ?? whitelisted?.amlApproved ?? false,
    verified: raw.verified ?? whitelisted?.verified ?? false,
    kyc_provider: raw.kyc_provider || whitelisted?.kyc_provider || kycProvider.name,
    aml_provider: raw.aml_provider || whitelisted?.aml_provider || kycProvider.amlProvider
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
    const whitelistEntry = findWhitelistedEntry(whitelistKey);
    if (!whitelistKey || !whitelistEntry) {
      return { valid: false, message: `Counterparty ${profile.id || 'unknown'} is not whitelisted` };
    }

        if (!profile.verified) {
      return {
        valid: false,
        message: `Counterparty ${profile.id || profile.wallet_address} must be verified in the investor registry`
      };
    }

    if (!profile.kycApproved) {
      return {
        valid: false,
        message: `Counterparty ${profile.id || profile.wallet_address} must complete KYC before trading`
      };
    }

       if (!profile.amlApproved) {
      return {
        valid: false,
        message: `Counterparty ${profile.id || profile.wallet_address} is pending AML screening`
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
    
    const legalConfig = getLegalConfiguration();
    const restrictions = legalConfig.transferRestrictions || {};
    const investorType = (profile.investor_type || '').toLowerCase();
    const isUsPerson = profile.jurisdiction === 'US' || profile.jurisdiction === 'USA';

    if (restrictions.regDAccreditedOnly && isUsPerson) {
      const accreditedTypes = new Set(['institutional', 'qualified_purchaser', 'accredited', 'qib']);
      if (!accreditedTypes.has(investorType)) {
        return {
          valid: false,
          message: 'US investors must be accredited or QIB to participate in the SPV tokens',
        };
      }
    }

    if (restrictions.regSOffshoreOnly && !isUsPerson && !profile.jurisdiction) {
      flags.push({
        code: 'offshore_jurisdiction_required',
        message: 'Non-US investors need a jurisdiction for Reg S controls',
      });
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

function getActiveKycProvider() {
  const key = (process.env.KYC_PROVIDER || 'sumsub').toLowerCase();
  return KYC_PROVIDERS[key] || {
    name: process.env.KYC_PROVIDER || 'Custom KYC',
    amlProvider: 'Sanctions + PEP list',
    hooks: []
  };
}

function getIssuancePartner() {
  const key = (process.env.ISSUANCE_PARTNER || 'securitize').toLowerCase();
  return (
    ISSUANCE_PARTNERS[key] || {
      name: process.env.ISSUANCE_PARTNER || 'Manual transfer agent',
      role: 'Transfer agent',
      exemptions: ['Reg D', 'Reg S'],
      services: ['cap table updates', 'investor onboarding']
    }
  );
}

async function runKycCheck(counterparty) {
  if (!isFeatureEnabled('kyc')) {
    return { passed: true, provider: getActiveKycProvider().name };
  }
  if (!process.env.KYC_API_URL || !process.env.KYC_API_KEY) {
    throw new Error('KYC provider not configured');
  }
  const provider = getActiveKycProvider();
  const resp = await fetch(process.env.KYC_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KYC_API_KEY}`,
      'Content-Type': 'application/json'
    },
   body: JSON.stringify({ counterparty, provider: provider.name })
  });
  if (!resp.ok) {
    throw new Error(`status ${resp.status}`);
  }
  const data = await resp.json();
 return { passed: !!data.passed, provider: provider.name, amlApproved: !!data.aml_passed };
}

async function runAmlScreening(counterparty) {
  const provider = getActiveKycProvider();
  if (!isFeatureEnabled('kyc')) {
    return { cleared: true, provider: provider.amlProvider };
  }

  const whitelisted = findWhitelistedEntry(counterparty);
  if (whitelisted?.amlApproved) {
    return { cleared: true, provider: whitelisted.aml_provider };
  }

  const resp = await fetch(process.env.KYC_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KYC_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ counterparty, screening: 'aml', provider: provider.amlProvider })
  });

  if (!resp.ok) {
    throw new Error(`status ${resp.status}`);
  }
  const data = await resp.json();
  return { cleared: !!data.passed, provider: provider.amlProvider };
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

    try {
      const identifier = cp.wallet_address || cp.id || cp;
      const aml = await runAmlScreening(identifier);
      if (!aml.cleared) {
        logAuditEntry({ ...auditBase, result: 'aml_failed', counterparty: cp });
        return { valid: false, message: `AML failed for counterparty ${cp.id || cp}` };
      }
    } catch (err) {
      logAuditEntry({ ...auditBase, result: 'aml_error', counterparty: cp, error: err.message });
      throw err;
    }
  }

 const legalControls = enforceTransferControls({
    trade,
    counterpartyProfiles: counterpartyCheck.profiles,
  });

  if (!legalControls.valid) {
    logAuditEntry({ ...auditBase, result: 'legal_controls_failed', reason: legalControls.message });
    return { valid: false, message: legalControls.message };
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
  const flags = [...(counterpartyCheck.flags || []), ...(legalControls.flags || [])];
  return { valid: true, flags };
}

function getComplianceConstraints() {
    const legal = getLegalConfiguration();
  const kycProvider = getActiveKycProvider();
  const issuancePartner = getIssuancePartner();
  return {
    paused: isTransfersPaused(),
     kycProvider,
    amlProvider: { name: kycProvider.amlProvider || kycProvider.name },
    issuancePartner,
    restrictedJurisdictions: RESTRICTED_JURISDICTIONS,
    restrictedInvestorTypes: RESTRICTED_INVESTOR_TYPES,
    transferRestrictions: legal.transferRestrictions,
    legalStructure: legal.structure,
       regulatoryExemptions: legal.structure?.exemptions || [],
    walletWhitelist: {
      enforced: true,
      requiresVerification: true,
      registrySize: Object.keys(INVESTOR_WHITELIST).length,
      transferAgent: issuancePartner.name
    },
    whitelist: Object.values(INVESTOR_WHITELIST).map(entry => ({
      id: entry.id || entry.wallet_address,
      wallet_address: entry.wallet_address,
      jurisdiction: entry.jurisdiction,
      investor_type: entry.investor_type,
      verified: entry.verified ?? entry.kycApproved,
      amlApproved: entry.amlApproved ?? entry.kycApproved,
      kyc_provider: entry.kyc_provider || kycProvider.name,
      aml_provider: entry.aml_provider || kycProvider.amlProvider
    }))
  };
}

module.exports = {
  scanForCompliance,
  gatherEvidence,
  validateTrade,
  runKycCheck,
  getComplianceConstraints,
 evaluateCounterparties,
  getActiveKycProvider,
  getIssuancePartner
};
