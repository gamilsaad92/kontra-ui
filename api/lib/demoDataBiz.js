/**
 * Demo data for a Business Acquisition demo room (Business Acquisition pack).
 */

const PROPERTY = {
  id: 'kontra-demo-biz',
  property_id: 'kontra-demo-biz',
  property_name: 'Meridian Software Group',
  property_type: 'Business Acquisition',
  address: 'Austin, TX',
  deal_amount: '8500000',
  first_name: 'Demo',
  customer_email: 'demo@kontraplatform.com',
  workflow_pack_id: 'business_acquisition',
  deal_stage: 'due_diligence',
  activated_at: '2025-02-01T10:00:00.000Z',
};

const TASKS = [
  {
    id: 'biz-task-cpa',
    title: 'Davidson Advisory — QoE report requested, 4 days overdue',
    priority: 'high',
    status: 'pending',
    role: 'cpa',
    due: 'Today',
    description: 'Quality of Earnings report was requested from Davidson Advisory on Feb 5. It is the final item before the LOI can be finalized. CPA has not uploaded yet.',
  },
  {
    id: 'biz-task-seller',
    title: 'Tom Briggs — 3 material contracts still missing',
    priority: 'high',
    status: 'in_progress',
    role: 'seller',
    due: 'Today',
    description: 'Tom Briggs (seller) has uploaded 4 of 7 material contracts. SaaS agreements with Apex Corp, Bluewater Logistics, and NovaTech are still outstanding.',
  },
  {
    id: 'biz-task-counsel',
    title: 'Vance & Partners — rep and warranty schedule review pending',
    priority: 'medium',
    status: 'pending',
    role: 'attorney',
    due: 'Tomorrow',
    description: 'Disclosure schedule uploaded. Vance & Partners have 48 hours to review rep and warranty provisions before the purchase agreement draft is circulated.',
  },
  {
    id: 'biz-task-mgt',
    title: 'Schedule management Q&A call with buyer team',
    priority: 'medium',
    status: 'pending',
    role: 'buyer',
    due: 'This week',
    description: 'Buyer team (led by Rachael Park, VP Corp Dev) wants a call with Meridian founder Tom Briggs to discuss product roadmap and key person dependencies.',
  },
  {
    id: 'biz-task-cap',
    title: 'Cap table — confirm option pool fully accounted for',
    priority: 'low',
    status: 'pending',
    role: 'counsel',
    due: 'This week',
    description: 'Cap table shows 18% unissued option pool. Counsel needs to confirm whether options are included in the $8.5M purchase price or treated as dilutive.',
  },
];

const BRIEFING = {
  hook: 'LOI signed — QoE report is the critical path to close.',
  summary: 'Financials and disclosure schedule are uploaded and reviewed. The Quality of Earnings report from Davidson Advisory is 4 days overdue and blocks LOI finalization. Three material customer contracts are still outstanding from the seller.',
  actions: [
    'Send follow-up to Davidson Advisory on the QoE report — 4 days overdue',
    'Request outstanding contracts from Tom Briggs: Apex Corp, Bluewater, NovaTech',
    'Confirm with Vance & Partners that rep/warranty review is on track for tomorrow',
  ],
  risks: [
    'QoE report overdue — LOI cannot be finalized without it',
    'Customer concentration risk: top 3 customers = 61% of ARR',
  ],
};

const ANALYSES = [
  {
    id: 'biz-analysis-loi',
    section: 'loi',
    filename: 'Meridian_Software_LOI_Executed_Feb2025.pdf',
    uploaded_by_role: 'buyer',
    created_at: '2025-02-03T09:00:00.000Z',
    version: 1,
    versionHistory: [{ id: 'biz-analysis-loi', version: 1, filename: 'Meridian_Software_LOI_Executed_Feb2025.pdf', uploaded_by_role: 'buyer', created_at: '2025-02-03T09:00:00.000Z' }],
    analysis: {
      documentType: 'Letter of Intent',
      confidence: 98,
      summary: 'Executed LOI for 100% acquisition of Meridian Software Group at $8,500,000 on a cash-free, debt-free basis. 60-day exclusivity granted. Includes standard no-shop and confidentiality obligations.',
      keyTerms: [
        { term: 'Purchase Price', value: '$8,500,000 (cash-free, debt-free)' },
        { term: 'Structure', value: '100% equity purchase' },
        { term: 'Exclusivity', value: '60 days from signing' },
        { term: 'Earnest Deposit', value: '$250,000' },
        { term: 'Diligence Period', value: '45 days' },
      ],
      redFlags: [],
      actionItems: [
        'Confirm earnest deposit wire has been received by escrow',
        'Track exclusivity expiration — 60-day window began February 3',
      ],
      complianceStatus: 'Compliant',
    },
  },
  {
    id: 'biz-analysis-fin',
    section: 'financials',
    filename: 'Meridian_Financials_3yr_Audited_2022-2024.xlsx',
    uploaded_by_role: 'seller',
    created_at: '2025-02-05T11:00:00.000Z',
    version: 1,
    versionHistory: [{ id: 'biz-analysis-fin', version: 1, filename: 'Meridian_Financials_3yr_Audited_2022-2024.xlsx', uploaded_by_role: 'seller', created_at: '2025-02-05T11:00:00.000Z' }],
    analysis: {
      documentType: 'Financial Statements (3-Year)',
      confidence: 94,
      summary: 'Three-year audited financials show strong SaaS growth: ARR grew from $1.2M (2022) to $2.1M (2024), 75% gross margin, and EBITDA of $420K trailing. Customer concentration is the primary risk — top 3 accounts represent 61% of ARR.',
      keyTerms: [
        { term: 'ARR (2024)', value: '$2,100,000' },
        { term: 'Revenue CAGR', value: '32% (2022–2024)' },
        { term: 'Gross Margin', value: '75%' },
        { term: 'EBITDA (TTM)', value: '$420,000' },
        { term: 'Churn Rate', value: '4.2% annual' },
      ],
      redFlags: [
        { issue: 'Top 3 customers represent 61% of ARR — key account concentration risk', severity: 'high' },
        { issue: 'Owner salary add-back of $180K may overstate normalized EBITDA', severity: 'medium' },
      ],
      actionItems: [
        'Request multi-year contracts for top 3 customers to assess churn risk',
        'Confirm owner add-back methodology with QoE provider (Davidson Advisory)',
      ],
      complianceStatus: 'Compliant',
      metrics: {
        revenue: 2100000,
        ebitda: 420000,
        gross_margin: 0.75,
      },
    },
  },
  {
    id: 'biz-analysis-disc',
    section: 'disclosure_schedule',
    filename: 'Meridian_Disclosure_Schedule_Draft.pdf',
    uploaded_by_role: 'seller',
    created_at: '2025-02-07T14:30:00.000Z',
    version: 1,
    versionHistory: [{ id: 'biz-analysis-disc', version: 1, filename: 'Meridian_Disclosure_Schedule_Draft.pdf', uploaded_by_role: 'seller', created_at: '2025-02-07T14:30:00.000Z' }],
    analysis: {
      documentType: 'Disclosure Schedule',
      confidence: 91,
      summary: 'Disclosure schedule covers IP ownership, outstanding litigation, employment agreements, and material contracts. One item flagged: a pending IP assignment from a former contractor has not been fully executed.',
      keyTerms: [
        { term: 'IP Ownership', value: 'Substantially clear — 1 outstanding assignment' },
        { term: 'Litigation', value: 'None disclosed' },
        { term: 'Employee Agreements', value: '12 employees — NDAs and IP assignments on file' },
        { term: 'Material Contracts', value: '7 identified — 4 uploaded, 3 pending' },
      ],
      redFlags: [
        { issue: 'IP assignment from former contractor (Dev #3) not fully executed — potential ownership gap', severity: 'high' },
      ],
      actionItems: [
        'Obtain executed IP assignment from former contractor before purchase agreement is signed',
        'Counsel (Vance & Partners) to review employment agreement provisions for change-of-control triggers',
      ],
      complianceStatus: 'Issues Found',
    },
  },
];

const DEMO_QA_CONTEXT = `
You are the AI advisor for the Meridian Software Group acquisition.
Deal amount: $8.5M (cash-free, debt-free, 100% equity). Stage: Due Diligence. Pack: Business Acquisition.
Key facts: SaaS business, $2.1M ARR, 75% gross margin, $420K EBITDA, 32% revenue CAGR, 4.2% churn, Austin TX.
Parties: Davidson Advisory (CPA — QoE report 4 days overdue), Tom Briggs (seller — 3 contracts outstanding), Vance & Partners (attorney — rep/warranty review), Rachael Park (buyer lead), Meridian Advisors (M&A broker).
Outstanding: QoE report (blocks LOI), 3 material contracts, IP assignment from former contractor.
Pre-seeded documents: LOI (clean), 3-year financials (strong growth, concentration risk), disclosure schedule (IP gap found).
Answer questions concisely and factually based on this context.
`.trim();

module.exports = { PROPERTY, TASKS, BRIEFING, ANALYSES, DEMO_QA_CONTEXT };
