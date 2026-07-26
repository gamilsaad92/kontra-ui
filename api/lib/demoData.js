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
  { id: 't1', title: 'Review environmental report', priority: 'high', status: 'pending', role: 'buyer', due: 'Today' },
  { id: 't2', title: 'Confirm title insurance commitment', priority: 'high', status: 'pending', role: 'owner', due: 'Today' },
  { id: 't3', title: 'Upload Phase I ESA', priority: 'medium', status: 'in_progress', role: 'buyer', due: 'Tomorrow' },
  { id: 't4', title: 'Schedule property walk-through', priority: 'medium', status: 'pending', role: 'broker', due: 'This week' },
  { id: 't5', title: 'Verify rent roll against leases', priority: 'low', status: 'pending', role: 'lender', due: 'This week' },
];

const BRIEFING = {
  hook: 'Harbor View is 88% verified — one document away from a clean close.',
  summary: 'The deal is in strong shape. Environmental and title are the two remaining open threads. Lender review is on track for end of week.',
  actions: [
    'Follow up with buyer on Phase I upload (overdue 1 day)',
    'Confirm title insurance commitment with escrow agent',
    'Schedule final walk-through before lender appraisal',
  ],
  risks: [
    'Phase I ESA not yet uploaded — blocks lender approval',
    'Insurance certificate expires in 12 days',
  ],
};

const DEMO_QA_CONTEXT = `
You are the AI advisor for Harbor View Apartments, a 312-unit multifamily deal in Miami, FL.
Deal amount: $14M. Stage: Due Diligence. Pack: CRE Acquisition.
Key facts: 97% occupancy, $3.4M NOI, 7.1% cap rate, DSCR 1.42x, LTV 58%.
Outstanding: Phase I ESA upload, title insurance confirmation.
Answer questions concisely and factually based on this context.
`.trim();

module.exports = { PROPERTY, TASKS, BRIEFING, DEMO_QA_CONTEXT };
