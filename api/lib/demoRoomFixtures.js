// Pack-specific, read-only response fixtures for the public demo workspaces.
// Keep these response shapes aligned with the live coordinator endpoints.

const DEMO_AI_MAX_TOKENS = 900;

const STAGES = {
  cre_acquisition: [
    { key: 'uploading', label: 'Uploading', icon: '📤' },
    { key: 'under_review', label: 'Under Review', icon: '🔍' },
    { key: 'approved', label: 'Approved', icon: '✅' },
    { key: 'closing', label: 'Closing', icon: '✍️' },
    { key: 'funded', label: 'Funded', icon: '🏦' },
  ],
  business_acquisition: [
    { key: 'uploading', label: 'Due Diligence', icon: '📤' },
    { key: 'under_review', label: 'Under Review', icon: '🔍' },
    { key: 'approved', label: 'Approved', icon: '✅' },
    { key: 'closing', label: 'Closing', icon: '✍️' },
    { key: 'funded', label: 'Closed', icon: '🏦' },
  ],
  fundraising: [
    { key: 'uploading', label: 'Diligence', icon: '📤' },
    { key: 'under_review', label: 'Under Review', icon: '🔍' },
    { key: 'approved', label: 'Term Sheet Executed', icon: '✅' },
    { key: 'closing', label: 'Closing', icon: '✍️' },
    { key: 'funded', label: 'Funded', icon: '🏦' },
  ],
  tokenization: [
    { key: 'structuring', label: 'Structuring', icon: '📐' },
    { key: 'onboarding', label: 'Investor Onboarding', icon: '✅' },
    { key: 'subscription', label: 'Subscription Period', icon: '📋' },
    { key: 'issuance', label: 'Token Issuance', icon: '🏛️' },
    { key: 'secondary', label: 'Secondary Market', icon: '📈' },
  ],
};

const DEFINITIONS = {
  cre_acquisition: [
    ['purchase_agreement', 'Purchase Agreement', true, ['buyer', 'legal_advisor'], 'Legal'],
    ['rent_roll', 'Rent Roll', true, ['seller', 'financial_advisor'], 'Financial'],
    ['financials', 'T-12 Financial Statement', true, ['seller', 'financial_advisor'], 'Financial'],
    ['insurance', 'Insurance Certificate', true, ['seller', 'financial_advisor'], 'Insurance'],
    ['inspection', 'Property Inspection Report', true, ['buyer', 'financial_advisor'], 'Property / Asset'],
    ['estoppel', 'Estoppel Certificates', false, ['seller', 'legal_advisor'], 'Legal'],
    ['environmental', 'Environmental Report (Phase I)', true, ['buyer', 'financial_advisor'], 'Operational'],
    ['survey', 'Survey / ALTA', false, ['seller', 'legal_advisor'], 'Property / Asset'],
    ['title', 'Title Commitment', true, ['legal_advisor'], 'Legal'],
  ],
  business_acquisition: [
    ['loi', 'Letter of Intent', true, ['buyer'], 'Legal'],
    ['purchase_agreement', 'Purchase Agreement', true, ['counsel'], 'Legal'],
    ['financials', 'Financial Statements (3-yr)', true, ['seller'], 'Financial'],
    ['tax_returns', 'Tax Returns (3-yr)', true, ['seller'], 'Financial'],
    ['cap_table', 'Cap Table / Ownership', true, ['seller'], 'Financial'],
    ['qoe', 'Quality of Earnings Report', false, ['cpa'], 'Financial'],
    ['contracts', 'Material Contracts', false, ['seller', 'counsel'], 'Legal'],
    ['disclosure_schedule', 'Disclosure Schedule', false, ['seller'], 'Legal'],
  ],
  fundraising: [
    ['term_sheet', 'Term Sheet', true, ['founder'], 'Legal'],
    ['cap_table', 'Cap Table / Ownership', true, ['founder'], 'Financial'],
    ['financials', 'Financial Statements', true, ['founder'], 'Financial'],
    ['audited_financials', 'Audited Financials', false, ['auditor'], 'Financial'],
    ['spa', 'Stock Purchase Agreement / SAFE', true, ['counsel'], 'Legal'],
    ['disclosure_schedule', 'Disclosure Schedule', false, ['founder'], 'Legal'],
  ],
  tokenization: [
    ['tom', 'Token Offering Memorandum', true, ['issuer'], 'Legal'],
    ['subscription_agreement', 'Subscription Agreement', true, ['counsel'], 'Legal'],
    ['kyc_aml', 'KYC / AML Completion Certificate', true, ['compliance'], 'Regulatory'],
    ['regulatory_filing', 'ADGM / DFSA Regulatory Filing', true, ['counsel', 'compliance'], 'Regulatory'],
    ['accreditation', 'Investor Accreditation Documents', true, ['lead_investor'], 'Regulatory'],
    ['cap_table', 'Capitalization Table', true, ['transfer_agent'], 'Financial'],
  ],
};

const REQUIRED = {
  cre_acquisition: ['transaction.type', 'transaction.stage', 'transaction.closing_date', 'transaction.jurisdiction', 'transaction.purchase_price', 'transaction.earnest_money', 'transaction.dd_expiration', 'asset.name', 'asset.address', 'asset.type', 'asset.ownership_entity', 'parties.buyer', 'parties.seller', 'parties.counsel', 'parties.title_company', 'ownership.titled_owner', 'ownership.acquiring_entity', 'ownership.liens', 'financial.noi', 'legal.purchase_agreement', 'legal.title_status', 'legal.zoning', 'legal.environmental', 'legal.material_litigation', 'legal.encumbrances', 'approval.buyer', 'approval.seller', 'approval.counsel', 'approval.closing'],
  business_acquisition: ['transaction.type', 'transaction.stage', 'transaction.closing_date', 'transaction.jurisdiction', 'transaction.purchase_price', 'transaction.dd_expiration', 'asset.legal_name', 'asset.industry', 'asset.entity_type', 'parties.buyer', 'parties.seller', 'parties.counsel', 'ownership.existing_owners', 'ownership.cap_table', 'financial.revenue', 'financial.ebitda', 'legal.purchase_agreement', 'legal.contingencies', 'approval.board', 'approval.shareholder', 'approval.closing'],
  fundraising: ['transaction.type', 'transaction.stage', 'transaction.closing_date', 'transaction.jurisdiction', 'transaction.instrument_type', 'asset.issuer', 'asset.entity_type', 'asset.incorporation', 'parties.counsel', 'ownership.pre_money_cap_table', 'ownership.founders', 'financial.target_raise', 'financial.pre_money_val', 'financial.instrument', 'legal.term_sheet', 'legal.securities_exemption', 'approval.board'],
  tokenization: ['transaction.target_raise', 'transaction.instrument_type', 'asset.name', 'asset.type', 'asset.ownership_entity', 'parties.issuer', 'parties.counsel', 'parties.issuance_provider', 'parties.transfer_agent', 'ownership.beneficial_owners', 'ownership.cap_table', 'ownership.aml_kyc', 'financial.asset_valuation', 'financial.use_of_proceeds', 'legal.exemption', 'legal.offering_docs', 'legal.legal_opinion', 'approval.legal', 'approval.compliance'],
};

const VALUES = {
  cre_acquisition: { 'transaction.type': 'Commercial real estate acquisition', 'transaction.stage': 'Under Review', 'transaction.closing_date': '2026-09-18', 'transaction.jurisdiction': 'us_fl', 'transaction.purchase_price': '$14,000,000', 'transaction.earnest_money': '$280,000', 'transaction.dd_expiration': '2026-08-28', 'asset.name': 'Harbor View Apartments', 'asset.address': '1425 Brickell Ave, Miami, FL 33131', 'asset.type': 'Multifamily', 'asset.ownership_entity': 'Harbor View Holdings LLC', 'parties.buyer': 'Harbor View Capital', 'parties.seller': 'Brickell Residential Partners', 'parties.counsel': 'Riverside Title & Escrow', 'parties.title_company': 'Riverside Title & Escrow', 'ownership.titled_owner': 'Brickell Residential Partners', 'ownership.acquiring_entity': 'Harbor View Holdings LLC', 'ownership.liens': 'No material liens identified', 'financial.noi': '$3,400,000', 'legal.purchase_agreement': 'Executed purchase agreement', 'legal.title_status': 'Schedule B exceptions under review', 'legal.zoning': 'Confirmed multifamily use', 'legal.environmental': 'Phase I ESA outstanding', 'legal.material_litigation': 'None disclosed', 'legal.encumbrances': 'Two Schedule B exceptions require confirmation', 'approval.buyer': 'Confirmed', 'approval.seller': 'Confirmed', 'approval.counsel': 'Awaiting title exception review', 'approval.closing': 'Not yet authorized' },
  business_acquisition: { 'transaction.type': 'Business acquisition', 'transaction.stage': 'Under Review', 'transaction.closing_date': '2026-10-02', 'transaction.jurisdiction': 'us_tx', 'transaction.purchase_price': '$8,500,000', 'transaction.dd_expiration': '2026-09-04', 'asset.legal_name': 'Meridian Software Group, Inc.', 'asset.industry': 'B2B vertical SaaS', 'asset.entity_type': 'Delaware C-Corporation', 'parties.buyer': 'Rachael Park / Meridian Growth Partners', 'parties.seller': 'Tom Briggs', 'parties.counsel': 'Vance & Partners', 'ownership.existing_owners': 'Tom Briggs and early employees', 'ownership.cap_table': 'Founder 62% · employees 18% · investors 20%', 'financial.revenue': '$6,200,000', 'financial.ebitda': '$1,180,000', 'legal.purchase_agreement': '', 'legal.contingencies': 'QoE and key customer retention', 'approval.board': 'Pending final diligence package', 'approval.shareholder': 'Not applicable', 'approval.closing': 'Not yet authorized' },
  fundraising: { 'transaction.type': 'Series B fundraising', 'transaction.stage': 'Under Review', 'transaction.closing_date': '2026-10-15', 'transaction.jurisdiction': 'us_ca', 'transaction.instrument_type': 'Preferred equity', 'asset.issuer': 'Nexus AI, Inc.', 'asset.entity_type': 'Delaware C-Corporation', 'asset.incorporation': 'Delaware, United States', 'parties.counsel': 'Thornton LLP', 'ownership.pre_money_cap_table': 'Founder 38% · employees 14% · existing investors 48%', 'ownership.founders': 'Aisha Rahman and Daniel Kim', 'financial.target_raise': '$42,000,000', 'financial.pre_money_val': '$210,000,000', 'financial.instrument': 'Series B preferred stock', 'legal.term_sheet': 'Executed term sheet', 'legal.securities_exemption': 'Regulation D, Rule 506(b)', 'approval.board': 'Approval recorded; closing conditions remain' },
  tokenization: { 'transaction.type': 'Regulated security token offering', 'transaction.closing_date': '2026-11-20', 'transaction.target_raise': '$22,000,000', 'transaction.instrument_type': 'Security token offering', 'asset.name': 'Meridian Digital Securities STO', 'asset.type': 'Private credit fund interests', 'asset.ownership_entity': 'Meridian Digital Securities SPC', 'parties.issuer': 'Meridian Digital Securities SPC', 'parties.counsel': 'Al Tamimi & Company', 'parties.issuance_provider': 'ADGM-licensed issuance provider (under review)', 'parties.transfer_agent': 'Meridian Transfer Services', 'ownership.beneficial_owners': 'Meridian Capital Partners and affiliated management', 'ownership.cap_table': '3 onboarded investors · 1 investor pending KYC · 60% allocation available', 'ownership.aml_kyc': '3 investors verified; 1 pending enhanced due diligence', 'financial.asset_valuation': '$36,700,000 independent valuation', 'financial.use_of_proceeds': 'Senior private-credit originations and liquidity reserve', 'legal.exemption': 'ADGM / DFSA professional client offering — counsel confirmation pending', 'legal.offering_docs': 'Token Offering Memorandum and subscription agreement prepared', 'legal.legal_opinion': 'ADGM counsel review in progress', 'approval.legal': 'Offering documents approved; filing review outstanding', 'approval.compliance': '3 investors cleared; 1 enhanced due diligence review pending' },
};

const PARTICIPANTS = {
  cre_acquisition: [['buyer', 'Harbor View Capital', 'accepted'], ['seller', 'Brickell Residential Partners', 'accepted'], ['legal_advisor', 'Riverside Title & Escrow', 'accepted'], ['financial_advisor', 'First Republic Capital', 'pending']],
  business_acquisition: [['buyer', 'Rachael Park / Meridian Growth Partners', 'accepted'], ['seller', 'Tom Briggs', 'accepted'], ['counsel', 'Vance & Partners', 'accepted'], ['cpa', 'Davidson Advisory', 'pending'], ['broker', 'Meridian Advisors', 'accepted']],
  fundraising: [['investor', 'Clearwater Capital', 'pending'], ['counsel', 'Thornton LLP', 'accepted'], ['auditor', 'Deloitte', 'pending'], ['banker', 'Atlas Partners', 'accepted']],
  tokenization: [['issuer', 'Meridian Digital Securities SPC', 'accepted'], ['lead_investor', 'GCC Growth Fund', 'accepted'], ['counsel', 'Al Tamimi & Company', 'accepted'], ['compliance', 'Apex Compliance', 'accepted'], ['transfer_agent', 'Meridian Transfer Services', 'pending']],
};

const label = key => key.split('.').map(part => part.replace(/_/g, ' ')).map(part => part.replace(/^\w/, c => c.toUpperCase())).join(' / ');

function buildRecord(packId) {
  const values = VALUES[packId];
  const requiredKeys = REQUIRED[packId];
  const fields = requiredKeys.map((key, index) => {
    const value = values[key] || '';
    const conflict = packId === 'cre_acquisition' && key === 'legal.encumbrances';
    const notApplicable = packId === 'business_acquisition' && key === 'approval.shareholder';
    const awaiting = (packId === 'cre_acquisition' && key === 'approval.counsel')
      || (packId === 'business_acquisition' && ['legal.contingencies', 'approval.board'].includes(key));
    const status = notApplicable
      ? 'not_applicable'
      : conflict
        ? 'conflicting'
        : awaiting
          ? 'needs_review'
          : value
            ? 'verified'
            : 'missing';
    return { id: `demo-record-${packId}-${index}`, field_key: key, field_category: key.split('.')[0], display_label: label(key), value_text: value, status, source_document: value ? 'Demo transaction materials' : null, updated_at: '2026-08-14T15:30:00.000Z' };
  });
  const stateFields = fields.map(field => ({
    key: field.field_key,
    label: field.display_label,
    value: field.value_text,
    status: field.status === 'conflicting'
      ? 'conflict'
      : field.status === 'needs_review'
        ? 'awaiting'
        : field.status === 'not_applicable'
          ? 'not_applicable'
          : field.value_text
            ? 'confirmed'
            : 'missing',
    attention: field.status === 'conflicting' ? 'source_changed' : null,
    required: true,
  }));
  const notApplicableCount = stateFields.filter(field => field.status === 'not_applicable').length;
  const requiredFields = stateFields.filter(field => field.status !== 'not_applicable');
  const confirmedCount = requiredFields.filter(field => field.status === 'confirmed').length;
  const awaitingCount = stateFields.filter(field => field.status === 'awaiting').length;
  const awaitingRequiredCount = requiredFields.filter(field => field.status === 'awaiting').length;
  return {
    fields,
    record_state: {
      schema: packId,
      fields: stateFields,
      requiredFields,
      confirmedCount,
      requiredCount: requiredFields.length,
      awaitingCount,
      awaitingRequiredCount,
      awaitingOptionalCount: awaitingCount - awaitingRequiredCount,
      conflictCount: stateFields.filter(f => f.status === 'conflict').length,
      notApplicableCount,
    },
  };
}

function getDemoFixture(packId, property) {
  const completed = packId === 'cre_acquisition'
    ? new Set(['purchase_agreement', 'rent_roll', 'financials', 'title', 'estoppel'])
    : packId === 'business_acquisition'
      ? new Set(['loi', 'financials', 'tax_returns', 'cap_table', 'disclosure_schedule'])
      : packId === 'tokenization'
        ? new Set(['tom', 'subscription_agreement', 'kyc_aml', 'accreditation', 'cap_table'])
        : new Set(['term_sheet', 'cap_table', 'financials', 'spa']);
  const checklist = DEFINITIONS[packId].map(([section, text, required, assignedTo, category], index) => ({ id: section, section, label: text, required, ai: ['financials', 'rent_roll', 'title', 'inspection', 'environmental', 'qoe', 'audited_financials'].includes(section), assignedTo, category, sortOrder: index, status: completed.has(section) ? 'approved' : 'missing', uploaded: completed.has(section), isCustom: false }));
  const record = buildRecord(packId);
  const participants = PARTICIPANTS[packId];
  const submissions = participants.filter(([, , status]) => status === 'accepted').map(([role, name], index) => ({ id: `demo-submission-${packId}-${index}`, role, name, status: 'submitted', doc_count: 1, submitted_at: '2026-08-13T16:00:00.000Z' }));
  const participantInvites = participants.map(([role, name, status], index) => ({ id: `demo-invite-${packId}-${index}`, role_key: role, status, invited_email: `${role}@demo.example`, created_at: '2026-08-08T16:00:00.000Z', last_used_at: status === 'accepted' ? '2026-08-14T14:10:00.000Z' : null, expires_at: '2026-09-08T16:00:00.000Z', display_name: name }));
  const currentStage = packId === 'tokenization' ? 'subscription' : 'under_review';
  const coordination = { stage: currentStage, submissions, parties: submissions, docsByRole: Object.fromEntries(submissions.map(row => [row.role, row.doc_count])), participantInvites };
  const state = record.record_state;
  const readiness = { record_type: 'transaction_readiness', asset_id: property.property_id, overall_score: packId === 'cre_acquisition' ? 82 : packId === 'business_acquisition' ? 76 : packId === 'tokenization' ? 78 : 71, status: 'Building', closing_ready: false, transaction_ready: false, transaction_readiness: { overall_pct: Math.round((state.confirmedCount / state.requiredCount) * 100), status: 'Building', categories: [], confirmed_fields: state.confirmedCount, required_fields: state.requiredCount, awaiting_fields: state.awaitingCount, awaiting_required_fields: state.awaitingRequiredCount, awaiting_optional_fields: state.awaitingOptionalCount, conflicts: state.conflictCount }, transaction_record: state, digital_asset_readiness: { status: 'Building quietly', percent: Math.round((state.confirmedCount / state.requiredCount) * 100), sufficient: false, captured_facts: state.confirmedCount, note: 'AI-prepared only. Kontra does not provide legal or regulatory verification.' } };
  const events = [
    { id: `demo-event-${packId}-1`, event_type: 'document_analyzed', description: 'Kontra completed AI analysis on newly uploaded transaction materials', actor_role: 'coordinator', actor_name: 'Demo Coordinator', created_at: '2026-08-14T15:30:00.000Z' },
    { id: `demo-event-${packId}-2`, event_type: 'field_verified', description: 'Key transaction facts were confirmed from source documents', actor_role: 'coordinator', actor_name: 'Demo Coordinator', created_at: '2026-08-13T17:10:00.000Z' },
    { id: `demo-event-${packId}-3`, event_type: 'participant_joined', description: 'A participant accepted their secure role invitation', actor_role: 'coordinator', actor_name: 'Demo Coordinator', created_at: '2026-08-12T13:45:00.000Z' },
    { id: `demo-event-${packId}-4`, event_type: 'stage_advanced', description: 'Transaction moved from Diligence to Under Review', actor_role: 'coordinator', actor_name: 'Demo Coordinator', created_at: '2026-08-11T10:20:00.000Z' },
  ];
  return { packId, property: { ...property, workflow_pack_id: packId, deal_stage: currentStage, is_demo: true, metadata_values: { ...(property.metadata_values || {}), target_close_date: VALUES[packId]['transaction.closing_date'], transaction_value: VALUES[packId]['transaction.purchase_price'] || VALUES[packId]['financial.target_raise'] || VALUES[packId]['transaction.target_raise'], transaction_type: VALUES[packId]['transaction.type'] || 'Regulated security token offering', transaction_structure: VALUES[packId]['financial.instrument'] || VALUES[packId]['transaction.instrument_type'] || '' } }, checklist, record, coordination, readiness, stages: STAGES[packId], events };
}

function sanitizeDemoTokenizationAnswer(answer) {
  return String(answer || '')
    .replace(/\bcan be tokenized\b/gi, 'may be technically or structurally possible to prepare for tokenization review')
    .replace(/\bwill be tokenized\b/gi, 'may be considered for tokenization after required information and professional review')
    .replace(/\btokenization[- ]ready\b/gi, 'prepared for further tokenization-readiness review')
    .replace(/\beligible for tokenization\b/gi, 'requiring legal/regulatory eligibility review for tokenization');
}

module.exports = { DEMO_AI_MAX_TOKENS, getDemoFixture, sanitizeDemoTokenizationAnswer, STAGES };