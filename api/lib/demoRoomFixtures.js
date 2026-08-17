/**
 * Read-only fixtures for the three public demo rooms.
 *
 * These deliberately mirror the response shapes used by the live coordinator
 * workspace. They are kept outside the route file so the demo handlers remain
 * small and the same fixtures can be mirrored with the API source tree.
 */

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
};

const CHECKLIST_DEFS = {
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
};

const RECORD_REQUIREMENTS = {
  cre_acquisition: [
    'transaction.type', 'transaction.stage', 'transaction.closing_date',
    'transaction.jurisdiction', 'transaction.purchase_price',
    'transaction.earnest_money', 'transaction.dd_expiration', 'asset.name',
    'asset.address', 'asset.type', 'asset.ownership_entity',
    'parties.buyer', 'parties.seller', 'parties.counsel',
    'parties.title_company', 'ownership.titled_owner',
    'ownership.acquiring_entity', 'ownership.liens', 'financial.noi',
    'legal.purchase_agreement', 'legal.title_status', 'legal.zoning',
    'legal.environmental', 'legal.material_litigation',
    'legal.encumbrances', 'approval.buyer', 'approval.seller',
    'approval.counsel', 'approval.closing',
  ],
  business_acquisition: [
    'transaction.type', 'transaction.stage', 'transaction.closing_date',
    'transaction.jurisdiction', 'transaction.purchase_price',
    'transaction.dd_expiration', 'asset.legal_name', 'asset.industry',
    'asset.entity_type', 'parties.buyer', 'parties.seller',
    'parties.counsel', 'ownership.existing_owners', 'ownership.cap_table',
    'financial.revenue', 'financial.ebitda', 'legal.purchase_agreement',
    'legal.contingencies', 'approval.board', 'approval.shareholder',
    'approval.closing',
  ],
  fundraising: [
    'transaction.type', 'transaction.stage', 'transaction.closing_date',
    'transaction.jurisdiction', 'transaction.instrument_type',
    'asset.issuer', 'asset.entity_type', 'asset.incorporation',
    'parties.counsel', 'ownership.pre_money_cap_table', 'ownership.founders',
    'financial.target_raise', 'financial.pre_money_val',
    'financial.instrument', 'legal.term_sheet',
    'legal.securities_exemption', 'approval.board',
  ],
};

const RECORD_LABELS = {
  'transaction.type': 'Transaction type',
  'transaction.stage': 'Current stage',
  'transaction.closing_date': 'Target closing date',
  'transaction.jurisdiction': 'Jurisdiction',
  'transaction.purchase_price': 'Purchase price',
  'transaction.earnest_money': 'Earnest money deposit',
  'transaction.dd_expiration': 'Due-diligence expiration',
  'asset.name': 'Asset name',
  'asset.address': 'Property address',
  'asset.type': 'Asset type',
  'asset.ownership_entity': 'Ownership entity',
  'asset.legal_name': 'Legal entity name',
  'asset.industry': 'Industry',
  'asset.entity_type': 'Entity type',
  'parties.buyer': 'Buyer',
  'parties.seller': 'Seller',
  'parties.counsel': 'Legal counsel',
  'parties.title_company': 'Title company',
  'ownership.titled_owner': 'Titled owner',
  'ownership.acquiring_entity': 'Acquiring entity',
  'ownership.liens': 'Liens & encumbrances',
  'financial.noi': 'Net operating income',
  'financial.revenue': 'Revenue',
  'financial.ebitda': 'EBITDA',
  'legal.purchase_agreement': 'Purchase agreement',
  'legal.title_status': 'Title status',
  'legal.zoning': 'Zoning',
  'legal.environmental': 'Environmental review',
  'legal.material_litigation': 'Material litigation',
  'legal.encumbrances': 'Encumbrances',
  'legal.contingencies': 'Contingencies',
  'approval.buyer': 'Buyer approval',
  'approval.seller': 'Seller approval',
  'approval.counsel': 'Counsel approval',
  'approval.closing': 'Closing authorization',
  'ownership.existing_owners': 'Existing shareholders',
  'ownership.cap_table': 'Cap table',
  'approval.board': 'Board approval',
  'approval.shareholder': 'Shareholder approval',
  'transaction.instrument_type': 'Instrument type',
  'asset.issuer': 'Issuer',
  'asset.incorporation': 'Place of incorporation',
  'ownership.pre_money_cap_table': 'Pre-money cap table',
  'ownership.founders': 'Founders',
  'financial.target_raise': 'Target raise',
  'financial.pre_money_val': 'Pre-money valuation',
  'financial.instrument': 'Financial instrument',
  'legal.term_sheet': 'Term sheet',
  'legal.securities_exemption': 'Securities exemption',
};

const VALUES = {
  cre_acquisition: {
    'transaction.type': 'Commercial real estate acquisition',
    'transaction.stage': 'Under Review',
    'transaction.closing_date': '2026-09-18',
    'transaction.jurisdiction': 'us_fl',
    'transaction.purchase_price': '$14,000,000',
    'transaction.earnest_money': '$280,000',
    'transaction.dd_expiration': '2026-08-28',
    'asset.name': 'Harbor View Apartments',
    'asset.address': '1425 Brickell Ave, Miami, FL 33131',
    'asset.type': 'Multifamily',
    'asset.ownership_entity': 'Harbor View Holdings LLC',
    'parties.buyer': 'Harbor View Capital',
    'parties.seller': 'Brickell Residential Partners',
    'parties.counsel': 'Riverside Title & Escrow',
    'parties.title_company': 'Riverside Title & Escrow',
    'ownership.titled_owner': 'Brickell Residential Partners',
    'ownership.acquiring_entity': 'Harbor View Holdings LLC',
    'ownership.liens': 'No material liens identified',
    'financial.noi': '$3,400,000',
    'legal.purchase_agreement': 'Executed purchase agreement',
    'legal.title_status': 'Commitment received; Schedule B exceptions under review',
    'legal.zoning': 'Confirmed multifamily use',
    'legal.environmental': 'Phase I ESA outstanding',
    'legal.material_litigation': 'None disclosed',
    'legal.encumbrances': 'Two Schedule B exceptions require confirmation',
    'approval.buyer': 'Confirmed',
    'approval.seller': 'Confirmed',
    'approval.counsel': 'Awaiting title exception review',
    'approval.closing': 'Not yet authorized',
  },
  business_acquisition: {
    'transaction.type': 'Business acquisition',
    'transaction.stage': 'Under Review',
    'transaction.closing_date': '2026-10-02',
    'transaction.jurisdiction': 'us_tx',
    'transaction.purchase_price': '$8,500,000',
    'transaction.dd_expiration': '2026-09-04',
    'asset.legal_name': 'Meridian Software Group, Inc.',
    'asset.industry': 'B2B vertical SaaS',
    'asset.entity_type': 'Delaware C-Corporation',
    'parties.buyer': 'Rachael Park / Meridian Growth Partners',
    'parties.seller': 'Tom Briggs',
    'parties.counsel': 'Vance & Partners',
    'ownership.existing_owners': 'Tom Briggs and early employees',
    'ownership.cap_table': 'Founder 62% · employees 18% · investors 20%',
    'financial.revenue': '$6,200,000',
    'financial.ebitda': '$1,180,000',
    'legal.purchase_agreement': 'Draft asset purchase agreement',
    'legal.contingencies': 'Quality of earnings and key customer retention',
    'approval.board': 'Pending final diligence package',
    'approval.shareholder': 'Not applicable',
    'approval.closing': 'Not yet authorized',
  },
  fundraising: {
    'transaction.type': 'Series B fundraising',
    'transaction.stage': 'Under Review',
    'transaction.closing_date': '2026-10-15',
    'transaction.jurisdiction': 'us_ca',
    'transaction.instrument_type': 'Preferred equity',
    'asset.issuer': 'Nexus AI, Inc.',
    'asset.entity_type': 'Delaware C-Corporation',
    'asset.incorporation': 'Delaware, United States',
    'parties.counsel': 'Thornton LLP',
    'ownership.pre_money_cap_table': 'Founder 38% · employees 14% · existing investors 48%',
    'ownership.founders': 'Aisha Rahman and Daniel Kim',
    'financial.target_raise': '$42,000,000',
    'financial.pre_money_val': '$210,000,000',
    'financial.instrument': 'Series B preferred stock',
    'legal.term_sheet': 'Executed term sheet',
    'legal.securities_exemption': 'Regulation D, Rule 506(b)',
    'approval.board': 'Approval recorded; closing conditions remain',
  },
};

const DEMO_PARTICIPANTS = {
  cre_acquisition: [
    ['buyer', 'Harbor View Capital', 'accepted', 'buyer@harborview.example'],
    ['seller', 'Brickell Residential Partners', 'accepted', 'seller@brickell.example'],
    ['legal_advisor', 'Riverside Title & Escrow', 'accepted', 'counsel@riverside.example'],
    ['financial_advisor', 'First Republic Capital', 'pending', 'finance@firstrepublic.example'],
  ],
  business_acquisition: [
    ['buyer', 'Rachael Park / Meridian Growth Partners', 'accepted', 'buyer@meridian.example'],
    ['seller', 'Tom Briggs', 'accepted', 'tom@meridian.example'],
    ['counsel', 'Vance & Partners', 'accepted', 'counsel@vance.example'],
    ['cpa', 'Davidson Advisory', 'pending', 'team@davidson.example'],
    ['broker', 'Meridian Advisors', 'accepted', 'broker@meridian.example'],
  ],
  fundraising: [
    ['investor', 'Clearwater Capital', 'pending', 'jessica@clearwater.example'],
    ['counsel', 'Thornton LLP', 'accepted', 'dealteam@thornton.example'],
    ['auditor', 'Deloitte', 'pending', 'audit@deloitte.example'],
    ['banker', 'Atlas Partners', 'accepted', 'atlas@partners.example'],
  ],
};

function buildChecklist(packId) {
  const completed = packId === 'cre_acquisition'
    ? new Set(['purchase_agreement', 'rent_roll', 'financials', 'title', 'estoppel'])
    : packId === 'business_acquisition'
      ? new Set(['loi', 'financials', 'tax_returns', 'cap_table', 'disclosure_schedule'])
      : new Set(['term_sheet', 'cap_table', 'financials', 'spa']);
  return CHECKLIST_DEFS[packId].map(([section, label, required, assignedTo, category], index) => ({
    id: section,
    section,
    label,
    required,
    ai: ['financials', 'rent_roll', 'title', 'inspection', 'environmental', 'qoe', 'audited_financials'].includes(section),
    assignedTo,
    category,
    sortOrder: index,
    status: completed.has(section) ? 'approved' : 'missing',
    uploaded: completed.has(section),
    isCustom: false,
  }));
}

function buildRecord(packId) {
  const values = VALUES[packId];
  const requiredKeys = RECORD_REQUIREMENTS[packId];
  const fields = requiredKeys.map((key, index) => {
    const value = values[key] || '';
    const conflict = packId === 'cre_acquisition' && key === 'legal.encumbrances';
    const awaiting = packId === 'cre_acquisition' && key === 'approval.counsel';
    return {
      id: `demo-record-${packId}-${index}`,
      property_id: `kontra-demo-${packId}`,
      field_key: key,
      field_category: key.split('.')[0],
      display_label: RECORD_LABELS[key] || key,
      value_text: value,
      status: conflict ? 'conflicting' : awaiting ? 'needs_review' : value ? 'verified' : 'missing',
      source_document: value ? 'Demo transaction materials' : null,
      updated_at: '2026-08-14T15:30:00.000Z',
    };
  });
  const stateFields = requiredKeys.map(key => {
    const value = values[key] || '';
    const conflict = packId === 'cre_acquisition' && key === 'legal.encumbrances';
    const awaiting = packId === 'cre_acquisition' && key === 'approval.counsel';
    return {
      key,
      label: RECORD_LABELS[key] || key,
      value,
      status: conflict ? 'conflict' : awaiting ? 'awaiting' : value ? 'confirmed' : 'missing',
      attention: conflict ? 'source_changed' : null,
      required: true,
    };
  });
  const confirmedCount = stateFields.filter(field => field.status === 'confirmed').length;
  return {
    fields,
    record_state: {
      schema: packId,
      fields: stateFields,
      requiredFields: stateFields,
      confirmedCount,
      requiredCount: requiredKeys.length,
      awaitingCount: stateFields.filter(field => field.status === 'awaiting').length,
      awaitingRequiredCount: stateFields.filter(field => field.status === 'awaiting').length,
      awaitingOptionalCount: 0,
      conflictCount: stateFields.filter(field => field.status === 'conflict').length,
    },
  };
}

function buildCoordination(packId) {
  const participants = DEMO_PARTICIPANTS[packId];
  const submissions = participants
    .filter(([, , status]) => status === 'accepted')
    .map(([role, name], index) => ({
      id: `demo-submission-${packId}-${index}`,
      role,
      name,
      status: 'submitted',
      doc_count: 1,
      submitted_at: '2026-08-13T16:00:00.000Z',
    }));
  const participantInvites = participants.map(([role, name, status, email], index) => ({
    id: `demo-invite-${packId}-${index}`,
    role_key: role,
    status,
    invited_email: email,
    created_at: '2026-08-08T16:00:00.000Z',
    last_used_at: status === 'accepted' ? '2026-08-14T14:10:00.000Z' : null,
    expires_at: '2026-09-08T16:00:00.000Z',
    display_name: name,
  }));
  return {
    stage: 'under_review',
    submissions,
    parties: submissions,
    docsByRole: Object.fromEntries(submissions.map(row => [row.role, row.doc_count])),
    participantInvites,
  };
}

function buildReadiness(packId, record) {
  const state = record.record_state;
  const percent = Math.round((state.confirmedCount / Math.max(1, state.requiredCount)) * 100);
  return {
    record_type: 'transaction_readiness',
    asset_id: `kontra-demo-${packId}`,
    overall_score: packId === 'cre_acquisition' ? 82 : packId === 'business_acquisition' ? 76 : 71,
    status: 'Building',
    closing_ready: false,
    transaction_ready: false,
    transaction_readiness: {
      overall_pct: percent,
      status: 'Building',
      categories: [],
      confirmed_fields: state.confirmedCount,
      required_fields: state.requiredCount,
      awaiting_fields: state.awaitingCount,
      awaiting_required_fields: state.awaitingRequiredCount,
      awaiting_optional_fields: 0,
      conflicts: state.conflictCount,
    },
    transaction_record: state,
    digital_asset_readiness: {
      status: 'Building quietly',
      percent,
      sufficient: false,
      captured_facts: state.confirmedCount,
      note: 'AI-prepared only. Kontra does not provide legal or regulatory verification.',
    },
  };
}

function buildEvents(packId) {
  const name = packId === 'cre_acquisition'
    ? 'Harbor View Capital'
    : packId === 'business_acquisition'
      ? 'Tom Briggs'
      : 'Thornton LLP';
  return [
    { id: `demo-event-${packId}-1`, event_type: 'document_analyzed', description: `${name} uploaded materials and Kontra completed AI analysis`, actor_role: 'coordinator', actor_name: name, created_at: '2026-08-14T15:30:00.000Z' },
    { id: `demo-event-${packId}-2`, event_type: 'field_verified', description: 'Key transaction facts were confirmed from source documents', actor_role: 'coordinator', actor_name: 'Demo Coordinator', created_at: '2026-08-13T17:10:00.000Z' },
    { id: `demo-event-${packId}-3`, event_type: 'participant_joined', description: 'A participant accepted their secure role invitation', actor_role: 'coordinator', actor_name: name, created_at: '2026-08-12T13:45:00.000Z' },
    { id: `demo-event-${packId}-4`, event_type: 'stage_advanced', description: 'Transaction moved from Diligence to Under Review', actor_role: 'coordinator', actor_name: 'Demo Coordinator', created_at: '2026-08-11T10:20:00.000Z' },
  ];
}

function getDemoFixture(packId, property) {
  const record = buildRecord(packId);
  return {
    packId,
    property: {
      ...property,
      workflow_pack_id: packId,
      deal_stage: 'under_review',
      is_demo: true,
      metadata_values: {
        target_close_date: VALUES[packId]['transaction.closing_date'],
        transaction_value: VALUES[packId]['transaction.purchase_price'] || VALUES[packId]['financial.target_raise'],
        transaction_type: VALUES[packId]['transaction.type'],
        transaction_structure: VALUES[packId]['financial.instrument'] || '',
      },
    },
    checklist: buildChecklist(packId),
    record,
    coordination: buildCoordination(packId),
    readiness: buildReadiness(packId, record),
    stages: STAGES[packId],
    events: buildEvents(packId),
  };
}

module.exports = { getDemoFixture, STAGES };