/**
 * Demo data for the kontra-demo deal room (CRE Acquisition pack).
 * Served directly from memory — no Supabase required for the demo.
 */

const PROPERTY = {
  id: 'kontra-demo',
  property_id: 'kontra-demo',
  property_name: 'Harbor View Apartments',
  property_type: 'Multifamily',
  address: '1425 Brickell Ave, Miami, FL 33131',
  deal_amount: '14000000',
  first_name: 'Demo',
  customer_email: 'demo@kontraplatform.com',
  workflow_pack_id: 'cre_acquisition',
  deal_stage: 'due_diligence',
  activated_at: '2025-01-15T10:00:00.000Z',
};

const TASKS = [
  {
    id: 'demo-task-inspector',
    title: 'Marcus Webb — Phase I ESA not yet submitted',
    priority: 'high',
    status: 'pending',
    role: 'inspector',
    due: 'Today',
    description: 'Environmental report is the last item blocking lender approval. Marcus Webb (inspector) has been invited but has not uploaded.',
  },
  {
    id: 'demo-task-insurer',
    title: 'Priya Nair — Insurance certificate expires in 32 days',
    priority: 'high',
    status: 'pending',
    role: 'insurer',
    due: 'Today',
    description: 'Current insurance certificate expires July 14. Priya Nair needs to provide a renewal binder before closing.',
  },
  {
    id: 'demo-task-title',
    title: 'Confirm Schedule B exceptions with escrow agent',
    priority: 'medium',
    status: 'in_progress',
    role: 'attorney',
    due: 'Tomorrow',
    description: 'Two Schedule B exceptions flagged in the title commitment. Riverside Title & Escrow needs to confirm these are non-material before closing proceeds.',
  },
  {
    id: 'demo-task-walk',
    title: 'Schedule final walk-through before lender appraisal',
    priority: 'medium',
    status: 'pending',
    role: 'broker',
    due: 'This week',
    description: 'First Republic Capital requires a property walk-through before issuing the appraisal. Coordinate with the site manager at Harbor View.',
  },
  {
    id: 'demo-task-rent',
    title: 'Verify rent roll against executed leases — 3 units flagged',
    priority: 'low',
    status: 'pending',
    role: 'lender',
    due: 'This week',
    description: 'Rent roll shows units 204, 318, and 412 at above-market rates. First Republic Capital has flagged these for lease-level verification.',
  },
];

const BRIEFING = {
  hook: 'Harbor View is 88% verified — one document away from a clean close.',
  summary: 'The deal is in strong shape. Financials, purchase agreement, and title are cleared. Environmental and insurance are the two remaining open threads. Lender review is on track for end of week.',
  actions: [
    'Follow up with Marcus Webb on Phase I ESA — overdue 1 day and blocks lender approval',
    'Request insurance renewal binder from Priya Nair before the 32-day expiry window closes',
    'Confirm Schedule B exceptions are non-material with Riverside Title & Escrow',
  ],
  risks: [
    'Phase I ESA not yet uploaded — blocks First Republic Capital approval',
    'Insurance certificate expires in 32 days — renewal binder not yet received',
  ],
};

const ANALYSES = [
  {
    id: 'demo-analysis-pa',
    section: 'purchase_agreement',
    filename: 'Harbor_View_Purchase_Agreement_Executed.pdf',
    uploaded_by_role: 'owner',
    created_at: '2025-01-16T09:00:00.000Z',
    version: 1,
    versionHistory: [{ id: 'demo-analysis-pa', version: 1, filename: 'Harbor_View_Purchase_Agreement_Executed.pdf', uploaded_by_role: 'owner', created_at: '2025-01-16T09:00:00.000Z' }],
    analysis: {
      documentType: 'Purchase & Sale Agreement',
      confidence: 97,
      summary: 'Executed PSA for Harbor View Apartments at $14,000,000. Standard commercial terms with a 45-day due diligence period and 30-day close window. Seller representations are broad with limited carve-outs.',
      keyTerms: [
        { term: 'Purchase Price', value: '$14,000,000' },
        { term: 'Earnest Money', value: '$280,000 (2%)' },
        { term: 'Due Diligence Period', value: '45 days from execution' },
        { term: 'Closing Date', value: 'March 1, 2025' },
        { term: 'Contingencies', value: 'Financing, inspection, environmental' },
      ],
      redFlags: [],
      actionItems: [
        'Confirm earnest money wire has cleared escrow',
        'Verify closing date aligns with lender commitment timeline',
      ],
      complianceStatus: 'Compliant',
    },
  },
  {
    id: 'demo-analysis-fin',
    section: 'financials',
    filename: 'Harbor_View_T12_Financials_2024.xlsx',
    uploaded_by_role: 'owner',
    created_at: '2025-01-17T10:30:00.000Z',
    version: 1,
    versionHistory: [{ id: 'demo-analysis-fin', version: 1, filename: 'Harbor_View_T12_Financials_2024.xlsx', uploaded_by_role: 'owner', created_at: '2025-01-17T10:30:00.000Z' }],
    analysis: {
      documentType: 'T-12 Financial Statement',
      confidence: 95,
      summary: 'Trailing 12-month financials show $3.42M NOI on $4.1M EGI. Occupancy averaged 97.1% across the period. Expense ratio of 17% is favorable vs. market comp of 22-25%.',
      keyTerms: [
        { term: 'Effective Gross Income', value: '$4,100,000' },
        { term: 'Net Operating Income', value: '$3,420,000' },
        { term: 'Occupancy Rate', value: '97.1% average' },
        { term: 'Cap Rate (implied)', value: '7.1% at ask price' },
        { term: 'Expense Ratio', value: '16.6%' },
      ],
      redFlags: [
        { issue: 'Units 204, 318, 412 show rents 18% above market — verify lease terms', severity: 'medium' },
      ],
      actionItems: [
        'Cross-reference rent roll against individual executed leases for flagged units',
        'Confirm property management fee is reflected correctly in operating expenses',
      ],
      complianceStatus: 'Compliant',
    },
  },
  {
    id: 'demo-analysis-ins',
    section: 'insurance',
    filename: 'Harbor_View_Insurance_Certificate_2024.pdf',
    uploaded_by_role: 'insurer',
    created_at: '2025-01-18T14:00:00.000Z',
    version: 1,
    versionHistory: [{ id: 'demo-analysis-ins', version: 1, filename: 'Harbor_View_Insurance_Certificate_2024.pdf', uploaded_by_role: 'insurer', created_at: '2025-01-18T14:00:00.000Z' }],
    analysis: {
      documentType: 'Insurance Certificate',
      confidence: 98,
      summary: 'Commercial property policy issued by Fidelity National. Coverage limits meet lender requirements. Certificate expires July 14, 2025 — renewal must be received before closing.',
      keyTerms: [
        { term: 'Policy Carrier', value: 'Fidelity National Insurance' },
        { term: 'Coverage Limit', value: '$18,500,000 (replacement cost)' },
        { term: 'Liability Coverage', value: '$5,000,000' },
        { term: 'Expiration', value: 'July 14, 2025' },
        { term: 'Additional Insured', value: 'First Republic Capital (lender)' },
      ],
      redFlags: [
        { issue: 'Policy expires July 14 — renewal binder required before closing', severity: 'medium' },
      ],
      actionItems: [
        'Request renewal binder from Priya Nair at least 30 days before expiry',
        'Confirm lender is named as additional insured on renewal policy',
      ],
      expiresInDays: 32,
      complianceStatus: 'Compliant',
    },
  },
  {
    id: 'demo-analysis-title',
    section: 'title',
    filename: 'Harbor_View_Title_Commitment_Riverside.pdf',
    uploaded_by_role: 'attorney',
    created_at: '2025-01-19T11:00:00.000Z',
    version: 1,
    versionHistory: [{ id: 'demo-analysis-title', version: 1, filename: 'Harbor_View_Title_Commitment_Riverside.pdf', uploaded_by_role: 'attorney', created_at: '2025-01-19T11:00:00.000Z' }],
    analysis: {
      documentType: 'Title Commitment',
      confidence: 96,
      summary: 'Title commitment issued by Riverside Title & Escrow. Schedule A is clean. Two Schedule B exceptions flagged for easements — both appear non-material but require confirmation from escrow agent.',
      keyTerms: [
        { term: 'Title Company', value: 'Riverside Title & Escrow' },
        { term: 'Effective Date', value: 'January 15, 2025' },
        { term: 'Schedule A', value: 'Clear — no ownership encumbrances' },
        { term: 'Schedule B Exceptions', value: '2 easements (utility access)' },
      ],
      redFlags: [
        { issue: 'Schedule B: Utility easement on northwest corner — verify it does not affect planned renovation', severity: 'low' },
        { issue: 'Schedule B: Drainage easement — confirm dimensions with survey', severity: 'low' },
      ],
      actionItems: [
        'Escrow agent to confirm both easements are non-material to intended use',
        'Cross-reference easement boundaries with ALTA survey',
      ],
      clearToClose: false,
      scheduleBExceptions: [
        { item: 'Utility easement — northwest corner', severity: 'low' },
        { item: 'Drainage easement — south boundary', severity: 'low' },
      ],
    },
  },
];

const DEMO_QA_CONTEXT = `
You are the AI advisor for Harbor View Apartments, a 312-unit multifamily deal in Miami, FL.
Deal amount: $14M. Stage: Due Diligence. Pack: CRE Acquisition.
Key facts: 97% occupancy, $3.42M NOI, $4.1M EGI, 7.1% cap rate, DSCR 1.42x, LTV 58%, expense ratio 16.6%.
Parties: Marcus Webb (inspector — Phase I ESA overdue), Priya Nair (insurance broker — renewal needed), First Republic Capital (lender), Riverside Title & Escrow (title agent).
Outstanding: Phase I ESA upload (blocks lender), insurance renewal binder (expires July 14), Schedule B exception confirmation.
Pre-seeded documents: Purchase Agreement (clean), T-12 Financials (strong NOI), Insurance Certificate (expiring), Title Commitment (2 minor Schedule B exceptions).
Answer questions concisely and factually based on this context.
`.trim();

module.exports = { PROPERTY, TASKS, BRIEFING, ANALYSES, DEMO_QA_CONTEXT };
