/**
 * Demo data for a Fundraising / Private Credit demo room.
 */

const PROPERTY = {
  id: 'kontra-demo-fund',
  property_id: 'kontra-demo-fund',
  property_name: 'Apex Growth Fund III',
  property_type: 'Private Credit',
  address: 'New York, NY',
  deal_amount: '50000000',
  first_name: 'Demo',
  customer_email: 'demo@kontraplatform.com',
  workflow_pack_id: 'fundraising',
  deal_stage: 'subscription',
  activated_at: '2025-03-01T10:00:00.000Z',
};

const TASKS = [
  { id: 't1', title: 'Review PPM and subscription docs', priority: 'high', status: 'pending', role: 'investor', due: 'Today' },
  { id: 't2', title: 'Upload KYC/AML documents', priority: 'high', status: 'in_progress', role: 'investor', due: 'Today' },
  { id: 't3', title: 'Confirm wire instructions', priority: 'medium', status: 'pending', role: 'owner', due: 'Tomorrow' },
];

const BRIEFING = {
  hook: 'Subscription round 78% committed — close is within reach.',
  summary: 'Two anchor LPs are pending KYC completion. Wire instructions need to be confirmed before the fund can call capital.',
  actions: [
    'Follow up with LP2 on outstanding KYC docs',
    'Confirm escrow wire instructions with fund admin',
    'Send subscription agreement to LP3',
  ],
  risks: [
    'KYC incomplete for 2 of 5 LPs',
    'Close deadline in 18 days',
  ],
};

const DEMO_QA_CONTEXT = `
You are the AI advisor for Apex Growth Fund III, a private credit fundraise.
Target: $50M. Stage: Subscription. 78% committed.
Key facts: 5 LPs, 2 pending KYC, close deadline in 18 days.
Answer questions concisely based on this context.
`.trim();

module.exports = { PROPERTY, TASKS, BRIEFING, DEMO_QA_CONTEXT };
