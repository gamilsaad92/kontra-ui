/**
 * Demo data for a Business Acquisition demo room.
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
  deal_stage: 'loi',
  activated_at: '2025-02-01T10:00:00.000Z',
};

const TASKS = [
  { id: 't1', title: 'Review financial statements (3yr)', priority: 'high', status: 'pending', role: 'buyer', due: 'Today' },
  { id: 't2', title: 'Upload customer contracts', priority: 'high', status: 'in_progress', role: 'seller', due: 'Today' },
  { id: 't3', title: 'Confirm IP ownership documentation', priority: 'medium', status: 'pending', role: 'buyer', due: 'Tomorrow' },
];

const BRIEFING = {
  hook: 'LOI signed — diligence clock starts now.',
  summary: 'Financial statements are the critical path item. Seller needs to upload 3 years of audited financials before the data room can be considered complete.',
  actions: [
    'Request audited financials from seller (overdue)',
    'Schedule management call with buyer team',
    'Confirm IP assignment documents are in order',
  ],
  risks: [
    'Audited financials not yet uploaded',
    'Customer concentration risk — top 3 customers = 61% of revenue',
  ],
};

const DEMO_QA_CONTEXT = `
You are the AI advisor for the Meridian Software Group acquisition.
Deal amount: $8.5M. Stage: LOI. Pack: Business Acquisition.
Key facts: SaaS business, $2.1M ARR, 85% gross margin, Austin TX.
Outstanding: audited financials, IP documentation.
Answer questions concisely based on this context.
`.trim();

module.exports = { PROPERTY, TASKS, BRIEFING, DEMO_QA_CONTEXT };
