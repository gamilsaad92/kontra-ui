/**
 * Demo data for a regulated token issuance workspace using the tokenization pack.
 */

const PROPERTY = {
  id: 'kontra-demo-tokenization',
  property_id: 'kontra-demo-tokenization',
  property_name: 'Meridian Digital Securities STO',
  property_type: 'Token Issuance',
  address: 'Abu Dhabi Global Market, Abu Dhabi, UAE',
  deal_amount: '22000000',
  deal_type: 'tokenization',
  jurisdiction: 'uae_adgm',
  first_name: 'Demo',
  customer_email: 'demo@kontraplatform.com',
  workflow_pack_id: 'tokenization',
  deal_stage: 'subscription',
  activated_at: '2026-08-01T10:00:00.000Z',
  metadata_values: {
    investors_onboarded: 3,
    digital_asset_enabled: true,
  },
};

const TASKS = [
  {
    id: 'token-task-filing',
    title: 'Al Tamimi & Company — confirm ADGM filing package',
    priority: 'high',
    status: 'in_progress',
    role: 'counsel',
    due: 'Today',
    description: 'The Token Offering Memorandum and subscription agreement are prepared. Confirm the remaining ADGM / DFSA filing package before the subscription period closes.',
  },
  {
    id: 'token-task-kyc',
    title: 'Complete enhanced due diligence for one investor',
    priority: 'high',
    status: 'pending',
    role: 'compliance',
    due: 'This week',
    description: 'Three investors are onboarded and KYC/AML-verified. One prospective investor still needs enhanced due diligence before allocation can be finalized.',
  },
  {
    id: 'token-task-transfer',
    title: 'Meridian Transfer Services — review final allocation register',
    priority: 'medium',
    status: 'pending',
    role: 'transfer_agent',
    due: 'This week',
    description: 'Review the capitalization table and confirm the allocation register for the three onboarded investors before token issuance.',
  },
];

const BRIEFING = {
  hook: 'Subscription is open — ADGM filing confirmation and one investor review remain.',
  summary: 'Meridian Digital Securities is raising $22M through a regulated security token offering in ADGM. Three investors have completed onboarding and KYC/AML verification. The Token Offering Memorandum, subscription agreement, and capitalization table are ready; counsel must confirm the regulatory filing package and Compliance must complete one enhanced due diligence review.',
  actions: [
    'Ask Al Tamimi & Company to confirm the ADGM / DFSA filing package before closing the subscription period',
    'Complete enhanced due diligence for the remaining prospective investor',
    'Have Meridian Transfer Services verify the allocation register for the 3 onboarded investors',
  ],
  risks: [
    'Regulatory filing confirmation remains outstanding before token issuance',
    'One prospective investor has not completed enhanced due diligence',
  ],
};

const ANALYSES = [
  {
    id: 'token-analysis-tom',
    section: 'tom',
    filename: 'Meridian_Digital_Securities_Token_Offering_Memorandum.pdf',
    uploaded_by_role: 'issuer',
    created_at: '2026-08-03T09:00:00.000Z',
    version: 1,
    versionHistory: [{ id: 'token-analysis-tom', version: 1, filename: 'Meridian_Digital_Securities_Token_Offering_Memorandum.pdf', uploaded_by_role: 'issuer', created_at: '2026-08-03T09:00:00.000Z' }],
    analysis: {
      documentType: 'Token Offering Memorandum',
      confidence: 96,
      summary: 'Offering memorandum describes a $22M security token offering for private-credit fund interests through an ADGM issuer. The proposed structure is limited to professional clients and requires external legal and regulatory review before issuance.',
      keyTerms: [
        { term: 'Target Raise', value: '$22,000,000' },
        { term: 'Offering Framework', value: 'ADGM / DFSA professional client offering' },
        { term: 'Underlying Asset', value: 'Private credit fund interests' },
        { term: 'Use of Proceeds', value: 'Senior private-credit originations and reserve' },
      ],
      redFlags: [],
      actionItems: ['Confirm the final filing package with ADGM counsel before issuance.'],
      complianceStatus: 'In Review',
      metrics: { raise_amount: 22000000, token_price: 1000, total_tokens: 22000, minimum_investment: 100000, offering_type: 'ADGM / DFSA professional client offering', use_of_proceeds: 'Private-credit originations and liquidity reserve' },
    },
  },
  {
    id: 'token-analysis-kyc',
    section: 'kyc_aml',
    filename: 'Meridian_KYC_AML_Completion_Certificate.pdf',
    uploaded_by_role: 'compliance',
    created_at: '2026-08-06T11:30:00.000Z',
    version: 1,
    versionHistory: [{ id: 'token-analysis-kyc', version: 1, filename: 'Meridian_KYC_AML_Completion_Certificate.pdf', uploaded_by_role: 'compliance', created_at: '2026-08-06T11:30:00.000Z' }],
    analysis: {
      documentType: 'KYC Certificate',
      confidence: 94,
      summary: 'Three investors have completed KYC/AML and professional-client verification. One prospective investor requires enhanced due diligence before an allocation can be accepted.',
      keyTerms: [
        { term: 'Investors Verified', value: '3' },
        { term: 'Pending Enhanced Due Diligence', value: '1' },
        { term: 'Rejected Investors', value: '0' },
      ],
      redFlags: [{ issue: 'One prospective investor remains pending enhanced due diligence.', severity: 'medium' }],
      actionItems: ['Complete enhanced due diligence before accepting the remaining subscription.'],
      complianceStatus: 'In Review',
      metrics: { investors_verified: 3, investors_pending: 1, investors_rejected: 0 },
    },
  },
  {
    id: 'token-analysis-cap',
    section: 'cap_table',
    filename: 'Meridian_Token_Capitalization_Table_v2.xlsx',
    uploaded_by_role: 'transfer_agent',
    created_at: '2026-08-07T14:00:00.000Z',
    version: 1,
    versionHistory: [{ id: 'token-analysis-cap', version: 1, filename: 'Meridian_Token_Capitalization_Table_v2.xlsx', uploaded_by_role: 'transfer_agent', created_at: '2026-08-07T14:00:00.000Z' }],
    analysis: {
      documentType: 'Capitalization Table',
      confidence: 95,
      summary: 'The allocation register records three onboarded investors. The largest allocation is 24%, leaving sufficient capacity for the remaining subscription target.',
      keyTerms: [
        { term: 'Onboarded Investors', value: '3' },
        { term: 'Largest Allocation', value: '24%' },
        { term: 'Institutional Allocation', value: '72%' },
      ],
      redFlags: [],
      actionItems: ['Confirm the allocation register after the final investor clears due diligence.'],
      complianceStatus: 'Compliant',
      metrics: { total_investors: 3, largest_holder_pct: 24, institutional_pct: 72 },
    },
  },
];

const DEMO_QA_CONTEXT = `
You are the AI advisor for Meridian Digital Securities STO.
Target raise: $22M. Stage: Subscription Period. Pack: Tokenization. Jurisdiction: UAE ADGM / DFSA.
Three investors have completed onboarding and KYC/AML verification; one prospective investor requires enhanced due diligence.
The Token Offering Memorandum, subscription agreement, KYC certificate, and capitalization table are prepared. ADGM filing confirmation and final investor review remain before token issuance.
Kontra coordinates preparation and records for external professional review; it does not determine legal, regulatory, or investor eligibility.
Answer questions concisely and factually based on this context.
`.trim();

module.exports = { PROPERTY, TASKS, BRIEFING, ANALYSES, DEMO_QA_CONTEXT };