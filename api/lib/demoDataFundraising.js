/**
 * Demo data for a Fundraising / Series B Capital Raise demo room.
 */

const PROPERTY = {
  id: 'kontra-demo-fundraising',
  property_id: 'kontra-demo-fundraising',
  property_name: 'Nexus AI — Series B',
  property_type: 'Technology',
  address: 'San Francisco, CA',
  deal_amount: '42000000',
  first_name: 'Demo',
  customer_email: 'demo@kontraplatform.com',
  workflow_pack_id: 'fundraising',
  deal_stage: 'due_diligence',
  activated_at: '2025-03-01T10:00:00.000Z',
};

const TASKS = [
  {
    id: 'fund-task-lp1',
    title: 'Clearwater Capital — subscription agreement unsigned, $12M at risk',
    priority: 'high',
    status: 'pending',
    role: 'investor_relations',
    due: 'Today',
    description: 'Clearwater Capital committed $12M but their subscription agreement has not been returned. Close is August 1 — follow up with Jessica Wu directly.',
  },
  {
    id: 'fund-task-lp2',
    title: 'Vantage Family Office — KYC package incomplete',
    priority: 'high',
    status: 'in_progress',
    role: 'investor_relations',
    due: 'Today',
    description: 'Vantage Family Office ($8M commitment) has uploaded 2 of 4 required KYC documents. Mark Chen is aware — passport and entity cert still outstanding.',
  },
  {
    id: 'fund-task-legal',
    title: 'Thornton LLP — finalize SPA for lead investor tranche',
    priority: 'medium',
    status: 'in_progress',
    role: 'attorney',
    due: 'Tomorrow',
    description: 'Stock Purchase Agreement needs to reflect the updated Series B valuation cap of $210M. Thornton LLP has the draft — awaiting redlines.',
  },
  {
    id: 'fund-task-audit',
    title: 'Upload FY2024 audited financials — required by 3 LPs',
    priority: 'medium',
    status: 'pending',
    role: 'founder',
    due: 'This week',
    description: 'Clearwater Capital, Atlas Partners, and Meridian Ventures have all requested audited FY2024 financials. Deloitte audit should be complete this week.',
  },
  {
    id: 'fund-task-wire',
    title: 'Confirm wire instructions with fund administrator',
    priority: 'low',
    status: 'pending',
    role: 'advisor',
    due: 'This week',
    description: 'Atlas Partners (financial advisor) needs confirmed wire instructions for the escrow account before capital calls are issued to LPs.',
  },
];

const BRIEFING = {
  hook: 'Series B is 81% committed — Clearwater\'s signature is the close gate.',
  summary: '$34M of $42M committed across 5 investors. Clearwater Capital ($12M) has not returned their subscription agreement and is the single largest open item. Vantage Family Office ($8M) needs KYC completion. Close date is August 1.',
  actions: [
    'Follow up with Jessica Wu (Clearwater Capital) on unsigned $12M subscription agreement',
    'Request passport and entity certificate from Mark Chen (Vantage Family Office)',
    'Confirm audit completion timeline with Deloitte for FY2024 financials',
  ],
  risks: [
    'Clearwater Capital — $12M commitment without signed subscription agreement',
    'Close deadline August 1 — 18 days remaining, 2 LPs still require KYC',
  ],
};

const ANALYSES = [
  {
    id: 'fund-analysis-ts',
    section: 'term_sheet',
    filename: 'Nexus_AI_Series_B_Term_Sheet_Executed.pdf',
    uploaded_by_role: 'founder',
    created_at: '2025-03-03T09:00:00.000Z',
    version: 1,
    versionHistory: [{ id: 'fund-analysis-ts', version: 1, filename: 'Nexus_AI_Series_B_Term_Sheet_Executed.pdf', uploaded_by_role: 'founder', created_at: '2025-03-03T09:00:00.000Z' }],
    analysis: {
      documentType: 'Term Sheet',
      confidence: 97,
      summary: 'Executed Series B term sheet at $210M pre-money valuation, raising $42M from a syndicate of 5 institutional investors. Lead investor is Clearwater Capital with a $12M anchor commitment. Standard Series B protective provisions and 1x non-participating liquidation preference.',
      keyTerms: [
        { term: 'Pre-Money Valuation', value: '$210,000,000' },
        { term: 'Round Size', value: '$42,000,000' },
        { term: 'Lead Investor', value: 'Clearwater Capital ($12M)' },
        { term: 'Liquidation Preference', value: '1x non-participating' },
        { term: 'Pro-Rata Rights', value: 'All investors ≥ $5M commitment' },
        { term: 'Board Seat', value: '1 new seat — Clearwater Capital nominee' },
      ],
      redFlags: [],
      actionItems: [
        'Confirm pro-rata rights are correctly reflected in the SPA for all qualifying investors',
        'Schedule board seat nomination process with Clearwater Capital post-close',
      ],
      complianceStatus: 'Compliant',
    },
  },
  {
    id: 'fund-analysis-fin',
    section: 'financials',
    filename: 'Nexus_AI_Financial_Model_Q4_2024.xlsx',
    uploaded_by_role: 'founder',
    created_at: '2025-03-05T11:00:00.000Z',
    version: 1,
    versionHistory: [{ id: 'fund-analysis-fin', version: 1, filename: 'Nexus_AI_Financial_Model_Q4_2024.xlsx', uploaded_by_role: 'founder', created_at: '2025-03-05T11:00:00.000Z' }],
    analysis: {
      documentType: 'Financial Statements',
      confidence: 93,
      summary: 'Q4 2024 financials show $8.4M ARR growing at 187% YoY with a 68% gross margin. Monthly burn of $620K gives 14 months of runway pre-raise. NRR of 138% signals strong expansion within existing accounts.',
      keyTerms: [
        { term: 'ARR (Q4 2024)', value: '$8,400,000' },
        { term: 'ARR Growth (YoY)', value: '187%' },
        { term: 'Gross Margin', value: '68%' },
        { term: 'Monthly Burn', value: '$620,000' },
        { term: 'Runway (pre-raise)', value: '14 months' },
        { term: 'Net Revenue Retention', value: '138%' },
      ],
      redFlags: [
        { issue: 'Burn rate increased 42% vs Q3 2024 — confirm headcount drivers', severity: 'medium' },
      ],
      actionItems: [
        'Prepare burn bridge explanation for LP diligence calls (Q3→Q4 increase)',
        'Update 18-month cash flow projection to reflect Series B proceeds',
      ],
      complianceStatus: 'Compliant',
      metrics: {
        arr: 8400000,
        runway_months: 14,
        gross_margin: 0.68,
      },
    },
  },
  {
    id: 'fund-analysis-cap',
    section: 'cap_table',
    filename: 'Nexus_AI_Cap_Table_PreClose_v3.xlsx',
    uploaded_by_role: 'founder',
    created_at: '2025-03-06T13:00:00.000Z',
    version: 1,
    versionHistory: [{ id: 'fund-analysis-cap', version: 1, filename: 'Nexus_AI_Cap_Table_PreClose_v3.xlsx', uploaded_by_role: 'founder', created_at: '2025-03-06T13:00:00.000Z' }],
    analysis: {
      documentType: 'Cap Table',
      confidence: 96,
      summary: 'Pre-close cap table shows founders at 48% combined, Series A investors at 31%, and 11% unissued option pool. Post-Series B dilution brings founders to approximately 37% on a fully diluted basis. Option pool is adequately sized for 18 months of hiring.',
      keyTerms: [
        { term: 'Founder Ownership (pre)', value: '48% combined (2 co-founders)' },
        { term: 'Series A Investors', value: '31% (Sequoia lead + 2 others)' },
        { term: 'Unissued Option Pool', value: '11% of fully diluted shares' },
        { term: 'Founder Ownership (post-B)', value: '~37% fully diluted' },
        { term: 'Total Shares Outstanding', value: '42,800,000' },
      ],
      redFlags: [],
      actionItems: [
        'Confirm option pool refresh included in Series B capitalization table',
        'Provide post-money cap table to all investors upon close',
      ],
      complianceStatus: 'Compliant',
    },
  },
];

const DEMO_QA_CONTEXT = `
You are the AI advisor for Nexus AI's Series B capital raise.
Target: $42M. Pre-money valuation: $210M. Stage: Due Diligence. Pack: Fundraising. Close date: August 1, 2025.
Key facts: $8.4M ARR, 187% YoY growth, 68% gross margin, 138% NRR, $620K/month burn, 14 months runway pre-raise, San Francisco CA.
Investors: Clearwater Capital ($12M lead — subscription agreement unsigned, contact: Jessica Wu), Vantage Family Office ($8M — KYC incomplete, contact: Mark Chen), 3 other committed LPs totaling $14M.
Parties: Thornton LLP (attorney — SPA in progress), Atlas Partners (financial advisor — wire instructions pending), Deloitte (auditor — FY2024 audit in progress).
Outstanding: Clearwater subscription agreement ($12M at risk), Vantage KYC package, FY2024 audited financials, confirmed wire instructions.
Pre-seeded documents: Term Sheet (clean), Financial Model (strong growth, burn question), Cap Table (clean, founders at 48% pre-close).
Answer questions concisely and factually based on this context.
`.trim();

module.exports = { PROPERTY, TASKS, BRIEFING, ANALYSES, DEMO_QA_CONTEXT };
