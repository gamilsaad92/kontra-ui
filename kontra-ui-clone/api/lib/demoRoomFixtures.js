// Pack-specific, read-only response fixtures for the public demo workspaces.
// Keep these response shapes aligned with the live coordinator endpoints.

const { buildVerifiedAssetSnapshot } = require('./verifiedAssetSnapshot');
const {
  buildDigitalAssetPreparationPackage,
  updateDigitalAssetPreparationPackage,
  PREPARATION_FIELD_DEFINITIONS,
} = require('./digitalAssetPreparationPackage');

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
};

const REQUIRED = {
  cre_acquisition: ['transaction.type', 'transaction.stage', 'transaction.closing_date', 'transaction.jurisdiction', 'transaction.purchase_price', 'transaction.earnest_money', 'transaction.dd_expiration', 'asset.name', 'asset.address', 'asset.type', 'asset.ownership_entity', 'parties.buyer', 'parties.seller', 'parties.counsel', 'parties.title_company', 'ownership.titled_owner', 'ownership.acquiring_entity', 'ownership.liens', 'financial.noi', 'legal.purchase_agreement', 'legal.title_status', 'legal.zoning', 'legal.environmental', 'legal.material_litigation', 'legal.encumbrances', 'approval.buyer', 'approval.seller', 'approval.counsel', 'approval.closing'],
  business_acquisition: ['transaction.type', 'transaction.stage', 'transaction.closing_date', 'transaction.jurisdiction', 'transaction.purchase_price', 'transaction.dd_expiration', 'asset.legal_name', 'asset.industry', 'asset.entity_type', 'parties.buyer', 'parties.seller', 'parties.counsel', 'ownership.existing_owners', 'ownership.cap_table', 'financial.revenue', 'financial.ebitda', 'legal.purchase_agreement', 'legal.contingencies', 'approval.board', 'approval.shareholder', 'approval.closing'],
  fundraising: ['transaction.type', 'transaction.stage', 'transaction.closing_date', 'transaction.jurisdiction', 'transaction.instrument_type', 'asset.issuer', 'asset.entity_type', 'asset.incorporation', 'parties.counsel', 'ownership.pre_money_cap_table', 'ownership.founders', 'financial.target_raise', 'financial.pre_money_val', 'financial.instrument', 'legal.term_sheet', 'legal.securities_exemption', 'approval.board'],
};

const VALUES = {
  cre_acquisition: { 'transaction.type': 'Commercial real estate acquisition', 'transaction.stage': 'Under Review', 'transaction.closing_date': '2026-09-18', 'transaction.jurisdiction': 'us_fl', 'transaction.purchase_price': '$14,000,000', 'transaction.earnest_money': '$280,000', 'transaction.dd_expiration': '2026-08-28', 'asset.name': 'Harbor View Apartments', 'asset.address': '1425 Brickell Ave, Miami, FL 33131', 'asset.type': 'Multifamily', 'asset.ownership_entity': 'Harbor View Holdings LLC', 'parties.buyer': 'Harbor View Capital', 'parties.seller': 'Brickell Residential Partners', 'parties.counsel': 'Riverside Title & Escrow', 'parties.title_company': 'Riverside Title & Escrow', 'ownership.titled_owner': 'Brickell Residential Partners', 'ownership.acquiring_entity': 'Harbor View Holdings LLC', 'ownership.liens': 'No material liens identified', 'financial.noi': '$3,400,000', 'legal.purchase_agreement': 'Executed purchase agreement', 'legal.title_status': 'Schedule B exceptions under review', 'legal.zoning': 'Confirmed multifamily use', 'legal.environmental': 'Phase I ESA outstanding', 'legal.material_litigation': 'None disclosed', 'legal.encumbrances': 'Two Schedule B exceptions require confirmation', 'approval.buyer': 'Confirmed', 'approval.seller': 'Confirmed', 'approval.counsel': 'Awaiting title exception review', 'approval.closing': 'Not yet authorized' },
  business_acquisition: { 'transaction.type': 'Business acquisition', 'transaction.stage': 'Under Review', 'transaction.closing_date': '2026-10-02', 'transaction.jurisdiction': 'us_tx', 'transaction.purchase_price': '$8,500,000', 'transaction.dd_expiration': '2026-09-04', 'asset.legal_name': 'Meridian Software Group, Inc.', 'asset.industry': 'B2B vertical SaaS', 'asset.entity_type': 'Delaware C-Corporation', 'parties.buyer': 'Rachael Park / Meridian Growth Partners', 'parties.seller': 'Tom Briggs', 'parties.counsel': 'Vance & Partners', 'ownership.existing_owners': 'Tom Briggs and early employees', 'ownership.cap_table': 'Founder 62% · employees 18% · investors 20%', 'financial.revenue': '$6,200,000', 'financial.ebitda': '$1,180,000', 'legal.purchase_agreement': '', 'legal.contingencies': 'QoE and key customer retention', 'approval.board': 'Pending final diligence package', 'approval.shareholder': 'Not applicable', 'approval.closing': 'Not yet authorized' },
  fundraising: { 'transaction.type': 'Series B fundraising', 'transaction.stage': 'Under Review', 'transaction.closing_date': '2026-10-15', 'transaction.jurisdiction': 'us_ca', 'transaction.instrument_type': 'Preferred equity', 'asset.issuer': 'Nexus AI, Inc.', 'asset.entity_type': 'Delaware C-Corporation', 'asset.incorporation': 'Delaware, United States', 'parties.counsel': 'Thornton LLP', 'ownership.pre_money_cap_table': 'Founder 38% · employees 14% · existing investors 48%', 'ownership.founders': 'Aisha Rahman and Daniel Kim', 'financial.target_raise': '$42,000,000', 'financial.pre_money_val': '$210,000,000', 'financial.instrument': 'Series B preferred stock', 'legal.term_sheet': 'Executed term sheet', 'legal.securities_exemption': 'Regulation D, Rule 506(b)', 'approval.board': 'Approval recorded; closing conditions remain' },
};

const PARTICIPANTS = {
  cre_acquisition: [['buyer', 'Harbor View Capital', 'accepted'], ['seller', 'Brickell Residential Partners', 'accepted'], ['legal_advisor', 'Riverside Title & Escrow', 'accepted'], ['financial_advisor', 'First Republic Capital', 'pending']],
  business_acquisition: [['buyer', 'Rachael Park / Meridian Growth Partners', 'accepted'], ['seller', 'Tom Briggs', 'accepted'], ['counsel', 'Vance & Partners', 'accepted'], ['cpa', 'Davidson Advisory', 'pending'], ['broker', 'Meridian Advisors', 'accepted']],
  fundraising: [['investor', 'Clearwater Capital', 'pending'], ['counsel', 'Thornton LLP', 'accepted'], ['auditor', 'Deloitte', 'pending'], ['banker', 'Atlas Partners', 'accepted']],
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

function buildReadinessExhibit(property, liveRecordState, packId) {
  const recordedAt = '2026-08-29T16:00:00.000Z';
  const sourceStateAt = '2026-08-29T15:45:00.000Z';
  const exhibitValues = {
    cre_acquisition: {
      'transaction.stage': 'Ready for external review',
      'legal.title_status': 'Title commitment reviewed; Schedule B exceptions resolved as non-material',
      'legal.environmental': 'Phase I ESA received and reviewed; no material environmental conditions identified',
      'legal.encumbrances': 'Schedule B exceptions confirmed as non-material; no unresolved encumbrances',
      'approval.counsel': 'Counsel review complete',
      'approval.closing': 'Closing authorization recorded for illustrative exhibit',
    },
    business_acquisition: {
      'transaction.stage': 'Ready for external review',
      'legal.purchase_agreement': 'Executed purchase agreement reviewed by counsel',
      'legal.contingencies': 'Quality of Earnings and key customer retention conditions satisfied',
      'approval.board': 'Board approval recorded',
      'approval.closing': 'Closing authorization recorded for illustrative exhibit',
    },
    fundraising: {
      'transaction.stage': 'Ready for external review',
      'legal.term_sheet': 'Executed Series B term sheet reviewed',
      'legal.securities_exemption': 'Regulation D, Rule 506(b) recorded for counsel review',
      'approval.board': 'Board approval recorded; closing conditions satisfied for external review',
    },
  }[packId] || {};
  const preparationValues = {
    cre_acquisition: {
      issuer: 'Harbor View Holdings LLC',
      jurisdiction: { choice: 'united_states', detail: 'Florida, United States' },
      legal_entity: 'Harbor View Holdings LLC',
      underlying_asset: 'Harbor View Apartments — 1425 Brickell Ave, Miami, Florida',
      settlement_method: { choice: 'traditional', detail: 'Provider-neutral institutional settlement review' },
      ownership_evidence: 'Illustrative recorded deed, title commitment, and executed purchase agreement',
      governing_documents: 'Illustrative purchase agreement, title materials, and counsel review record',
      investor_restrictions: {
        choices: ['qualified_investors', 'transfer_restrictions'],
        detail: 'Any participation restrictions remain subject to qualified professional review.',
      },
      security_offering_structure: {
        choice: 'provider_neutral_participation',
        detail: 'Illustrative participation structure for external review only',
      },
    },
    business_acquisition: {
      issuer: 'Meridian Software Group, Inc.',
      jurisdiction: { choice: 'united_states', detail: 'Texas, United States' },
      legal_entity: 'Meridian Software Group, Inc.',
      underlying_asset: 'Meridian Software Group, Inc. — B2B vertical SaaS operating business',
      settlement_method: { choice: 'traditional', detail: 'Provider-neutral institutional settlement review' },
      ownership_evidence: 'Illustrative cap table, stock ledger, and executed purchase agreement',
      governing_documents: 'Illustrative purchase agreement, disclosure schedule, cap table, and counsel review record',
      investor_restrictions: {
        choices: ['transfer_restrictions'],
        detail: 'Transfer and participation terms remain subject to transaction counsel review.',
      },
      security_offering_structure: {
        choice: 'equity_interest',
        detail: 'Illustrative acquisition equity interest for external review only',
      },
    },
    fundraising: {
      issuer: 'Nexus AI, Inc.',
      jurisdiction: { choice: 'united_states', detail: 'California, United States' },
      legal_entity: 'Nexus AI, Inc.',
      underlying_asset: 'Nexus AI, Inc. — Series B preferred equity fundraising',
      settlement_method: { choice: 'traditional', detail: 'Provider-neutral institutional settlement review' },
      ownership_evidence: 'Illustrative pre-money cap table, stock ledger, and board approval record',
      governing_documents: 'Illustrative Series B term sheet, stock purchase agreement, and counsel review record',
      investor_restrictions: {
        choices: ['qualified_investors', 'transfer_restrictions'],
        detail: 'Participation and transfer restrictions remain subject to qualified professional review.',
      },
      security_offering_structure: {
        choice: 'regulation_d',
        detail: 'Rule 506(b) recorded for counsel review; not a legal or regulatory conclusion',
      },
    },
  }[packId] || {};
  const sourcePrefix = `demo-${String(packId || 'transaction').replace(/_/g, '-')}`;
  const sourceLabel = property.property_name || property.name || 'demo transaction';
  const sourceCategory = {
    transaction: 'transaction',
    asset: 'asset_identity',
    parties: 'parties',
    ownership: 'beneficial_ownership',
    financial: 'financial',
    legal: 'legal',
    approval: 'approvals',
  };
  const fields = (liveRecordState.requiredFields || []).map((field, index) => {
    const fieldKey = field.key || field.field_key;
    const categoryKey = String(fieldKey || '').split('.')[0];
    const sourceDocumentId = `${sourcePrefix}-source-${String(index + 1).padStart(2, '0')}`;
    return {
      id: `${sourcePrefix}-snapshot-field-${index + 1}`,
      key: fieldKey,
      label: field.label || field.display_label || fieldKey,
      category: sourceCategory[categoryKey] || categoryKey || 'transaction',
      value: exhibitValues[fieldKey] ?? field.value ?? `Confirmed in illustrative ${sourceLabel} source materials`,
      status: 'confirmed',
      sourceDocId: sourceDocumentId,
      sourceFileHash: `sha256:${sourcePrefix}-${String(index + 1).padStart(2, '0')}`,
      sourcePage: (index % 8) + 1,
      sourceExcerpt: `Illustrative ${sourceLabel} source confirmation for ${field.label || fieldKey}.`,
      sourceType: 'illustrative_demo_record',
      extractionTimestamp: sourceStateAt,
      extractedBy: 'Kontra demo fixture',
      verifiedBy: 'demo-coordinator@kontra.example',
      verifiedRole: 'deal_coordinator',
      verifiedAt: recordedAt,
      updatedAt: sourceStateAt,
    };
  });
  const completedRecordState = {
    schemaKey: liveRecordState.schema || 'cre_acquisition',
    fields,
    requiredFields: fields,
    requiredCount: fields.length,
    confirmedCount: fields.length,
    awaitingRequiredCount: 0,
    awaitingOptionalCount: 0,
    missingRequiredCount: 0,
    unresolvedConflictCount: 0,
  };
  const confirmationHistory = fields.map(field => ({
    field_id: field.id,
    field_key: field.key,
    event_type: 'confirmed',
    actor_role: 'deal_coordinator',
    actor_email: field.verifiedBy,
    new_status: 'confirmed',
    new_value: field.value,
    source_doc_id: field.sourceDocId,
    source_page: field.sourcePage,
    source_excerpt: field.sourceExcerpt,
    created_at: field.verifiedAt,
  }));
  const approvals = fields
    .filter(field => String(field.key || '').startsWith('approval.'))
    .map(field => ({
       id: `${sourcePrefix}-approval-${field.id}`,
      field_id: field.id,
      action: 'approved',
      actor_role: 'deal_coordinator',
      actor_email: field.verifiedBy,
      is_manual: true,
      source_doc_id: field.sourceDocId,
      source_file_hash: field.sourceFileHash,
      created_at: field.verifiedAt,
    }));
  const snapshot = buildVerifiedAssetSnapshot({
    propertyId: property.property_id,
    room: { settlement_mode: 'traditional', updated_at: sourceStateAt },
    recordState: completedRecordState,
    conflicts: [],
    approvals,
    confirmationHistory,
    sourceStateAt,
  });
  const snapshotRow = {
    id: `${sourcePrefix}-verified-asset-v1`,
    version: 1,
    eligibility_status: 'eligible',
    source_state_at: sourceStateAt,
    snapshot_hash: snapshot.snapshot_hash,
    snapshot,
    created_by: 'Kontra demo exhibit',
    created_at: recordedAt,
  };
  const initialPackage = buildDigitalAssetPreparationPackage({
    propertyId: property.property_id,
    snapshotRow,
    generatedAt: recordedAt,
  });
  const packagePayload = updateDigitalAssetPreparationPackage({
    packagePayload: initialPackage,
    revision: 1,
    preparationValues,
    explicitKeys: Object.keys(PREPARATION_FIELD_DEFINITIONS),
     revisionMetadata: { save_request_id: `${sourcePrefix}-preparation-revision-1` },
  });
  const packageRow = {
    id: `${sourcePrefix}-preparation-package-v1`,
    property_id: property.property_id,
    source_snapshot_id: snapshotRow.id,
    source_snapshot_version: snapshotRow.version,
    source_snapshot_hash: snapshotRow.snapshot_hash,
    package_hash: packagePayload.package_hash,
    package: packagePayload,
    revision: 1,
    revision_id: `${sourcePrefix}-preparation-revision-1`,
    created_by: 'Kontra demo exhibit',
    created_at: recordedAt,
  };
  const readiness = snapshot.digital_asset_readiness;
  return {
    snapshot: {
      id: snapshotRow.id,
      version: snapshotRow.version,
      snapshot_version: snapshotRow.version,
      timestamp: snapshotRow.created_at,
      recorded_at: snapshotRow.created_at,
      eligibility_status: snapshotRow.eligibility_status,
      status: readiness.status,
      source_state_at: snapshotRow.source_state_at,
      snapshot_hash: snapshotRow.snapshot_hash,
      created_by: snapshotRow.created_by,
      created_at: snapshotRow.created_at,
      snapshot,
    },
    package: packageRow,
    readiness: {
      eligibility: 'eligible',
      status: readiness.status,
      summary: {
        confirmed_count: completedRecordState.confirmedCount,
        required_count: completedRecordState.requiredCount,
        unresolved_exception_count: 0,
        provenance_intact: true,
        provenance_gap_count: 0,
        approvals_satisfied: true,
        missing_approval_count: 0,
      },
      reasons: {
        incomplete_required_fields: [],
        unresolved_conflicts: [],
        missing_approvals: [],
        provenance_gaps: [],
      },
      latest_snapshot: {
        id: snapshotRow.id,
        version: snapshotRow.version,
        eligibility_status: snapshotRow.eligibility_status,
        source_state_at: snapshotRow.source_state_at,
        snapshot_hash: snapshotRow.snapshot_hash,
        created_at: snapshotRow.created_at,
      },
      settlement_mode: 'traditional',
      disclosure: 'Illustrative, provider-neutral preparation data only. Kontra does not issue, sell, recommend, custody, perform KYC/AML, transfer, trade, or settle digital assets.',
      demo_exhibit: true,
    },
  };
}

function getDemoFixture(packId, property) {
  const completed = packId === 'cre_acquisition'
    ? new Set(['purchase_agreement', 'rent_roll', 'financials', 'title', 'estoppel'])
    : packId === 'business_acquisition'
      ? new Set(['loi', 'financials', 'tax_returns', 'cap_table', 'disclosure_schedule'])
      : new Set(['term_sheet', 'cap_table', 'financials', 'spa']);
  const checklist = DEFINITIONS[packId].map(([section, text, required, assignedTo, category], index) => ({ id: section, section, label: text, required, ai: ['financials', 'rent_roll', 'title', 'inspection', 'environmental', 'qoe', 'audited_financials'].includes(section), assignedTo, category, sortOrder: index, status: completed.has(section) ? 'approved' : 'missing', uploaded: completed.has(section), isCustom: false }));
  const record = buildRecord(packId);
  const participants = PARTICIPANTS[packId];
  const submissions = participants.filter(([, , status]) => status === 'accepted').map(([role, name], index) => ({ id: `demo-submission-${packId}-${index}`, role, name, status: 'submitted', doc_count: 1, submitted_at: '2026-08-13T16:00:00.000Z' }));
  const participantInvites = participants.map(([role, name, status], index) => ({ id: `demo-invite-${packId}-${index}`, role_key: role, status, invited_email: `${role}@demo.example`, created_at: '2026-08-08T16:00:00.000Z', last_used_at: status === 'accepted' ? '2026-08-14T14:10:00.000Z' : null, expires_at: '2026-09-08T16:00:00.000Z', display_name: name }));
  const coordination = { stage: 'under_review', submissions, parties: submissions, docsByRole: Object.fromEntries(submissions.map(row => [row.role, row.doc_count])), participantInvites };
  const state = record.record_state;
  const readiness = { record_type: 'transaction_readiness', asset_id: property.property_id, overall_score: packId === 'cre_acquisition' ? 82 : packId === 'business_acquisition' ? 76 : 71, status: 'Building', closing_ready: false, transaction_ready: false, transaction_readiness: { overall_pct: Math.round((state.confirmedCount / state.requiredCount) * 100), status: 'Building', categories: [], confirmed_fields: state.confirmedCount, required_fields: state.requiredCount, awaiting_fields: state.awaitingCount, awaiting_required_fields: state.awaitingRequiredCount, awaiting_optional_fields: state.awaitingOptionalCount, conflicts: state.conflictCount }, transaction_record: state, digital_asset_readiness: { status: 'Building quietly', percent: Math.round((state.confirmedCount / state.requiredCount) * 100), sufficient: false, captured_facts: state.confirmedCount, note: 'AI-prepared only. Kontra does not provide legal or regulatory verification.' } };
   const verifiedAssetExhibit = buildReadinessExhibit(property, state, packId);
  const events = [
    { id: `demo-event-${packId}-1`, event_type: 'document_analyzed', description: 'Kontra completed AI analysis on newly uploaded transaction materials', actor_role: 'coordinator', actor_name: 'Demo Coordinator', created_at: '2026-08-14T15:30:00.000Z' },
    { id: `demo-event-${packId}-2`, event_type: 'field_verified', description: 'Key transaction facts were confirmed from source documents', actor_role: 'coordinator', actor_name: 'Demo Coordinator', created_at: '2026-08-13T17:10:00.000Z' },
    { id: `demo-event-${packId}-3`, event_type: 'participant_joined', description: 'A participant accepted their secure role invitation', actor_role: 'coordinator', actor_name: 'Demo Coordinator', created_at: '2026-08-12T13:45:00.000Z' },
    { id: `demo-event-${packId}-4`, event_type: 'stage_advanced', description: 'Transaction moved from Diligence to Under Review', actor_role: 'coordinator', actor_name: 'Demo Coordinator', created_at: '2026-08-11T10:20:00.000Z' },
  ];
  return { packId, property: { ...property, workflow_pack_id: packId, deal_stage: 'under_review', is_demo: true, metadata_values: { target_close_date: VALUES[packId]['transaction.closing_date'], transaction_value: VALUES[packId]['transaction.purchase_price'] || VALUES[packId]['financial.target_raise'], transaction_type: VALUES[packId]['transaction.type'], transaction_structure: VALUES[packId]['financial.instrument'] || '' } }, checklist, record, coordination, readiness, stages: STAGES[packId], events, verifiedAssetExhibit };
}

function sanitizeDemoTokenizationAnswer(answer) {
  return String(answer || '')
    .replace(/\bcan be tokenized\b/gi, 'may be technically or structurally possible to prepare for tokenization review')
    .replace(/\bwill be tokenized\b/gi, 'may be considered for tokenization after required information and professional review')
    .replace(/\btokenization[- ]ready\b/gi, 'prepared for further tokenization-readiness review')
    .replace(/\beligible for tokenization\b/gi, 'requiring legal/regulatory eligibility review for tokenization');
}

module.exports = { DEMO_AI_MAX_TOKENS, getDemoFixture, sanitizeDemoTokenizationAnswer, STAGES };