'use strict';

const PROPERTY_ID = 'kontra-demo';

const PROPERTY = {
  id: PROPERTY_ID,
  property_id: PROPERTY_ID,
  property_name: '550 Madison Avenue',
  property_type: 'Office',
  deal_type: 'Acquisition',
  deal_amount: '$28,500,000',
  address: '550 Madison Ave, New York, NY 10022',
  market: 'Midtown Manhattan',
  status: 'active',
  workflow_pack_id: 'cre-acquisition',
  first_name: 'Jamil',
  created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
};

const now = Date.now();
const days = d => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

const TASKS = [
  {
    id: 'demo-task-inspector',
    property_id: PROPERTY_ID,
    title: 'Inspector report is 12 days overdue',
    description:
      'Marcus Webb (Inspector) was invited on June 24 but has not submitted the property inspection report. ' +
      'Due diligence cannot advance to underwriting without it.',
    status: 'open',
    owner_type: 'ai',
    owner_role: null,
    task_type: 'pending_submission',
    role_key: 'inspector',
    priority: 'critical',
    created_at: days(12),
    waiting_on: 'AI',
    draft_action: {
      type: 'email',
      to: 'marcus.webb@inspectpro.com',
      subject: 'Action required: Inspection report needed — 550 Madison Avenue',
      body:
        'Hi Marcus, your property inspection report for 550 Madison Avenue is now 12 days overdue. ' +
        'The deal cannot advance to underwriting until your report is on file. ' +
        'Please submit at your earliest convenience.',
    },
  },
  {
    id: 'demo-task-insurer',
    property_id: PROPERTY_ID,
    title: 'Insurance Broker has not submitted certificate',
    description:
      'Priya Nair (Insurance Broker) has been invited but has not submitted the insurance certificate. ' +
      'Required before underwriting begins.',
    status: 'open',
    owner_type: 'ai',
    owner_role: null,
    task_type: 'pending_submission',
    role_key: 'insurer',
    priority: 'high',
    created_at: days(5),
    waiting_on: 'AI',
    draft_action: {
      type: 'email',
      to: 'priya.nair@bridgeinsurance.com',
      subject: 'Action required: Insurance certificate needed — 550 Madison Avenue',
      body:
        'Hi Priya, the insurance certificate for 550 Madison Avenue has not yet been received. ' +
        'Insurance documentation is required before underwriting can begin. ' +
        'Please submit at your earliest convenience.',
    },
  },
  {
    id: 'demo-task-lender',
    property_id: PROPERTY_ID,
    title: 'Lender underwriting package received',
    description:
      'First Republic Capital submitted the full underwriting package including financial analysis, ' +
      'loan term sheet, and conditions precedent.',
    status: 'resolved',
    owner_type: 'human',
    owner_role: 'lender',
    task_type: 'document_submission',
    role_key: 'lender',
    priority: 'normal',
    created_at: days(8),
    resolved_at: days(3),
    waiting_on: null,
    draft_action: null,
  },
];

const BRIEFING = {
  status: 'at_risk',
  statusLabel: 'At Risk',
  reviewedCount: 3,
  narrative:
    'The inspection report is 12 days overdue and is the single item preventing the deal from advancing. ' +
    'Underwriting cannot begin — and therefore neither can the Loan Committee review or closing — ' +
    'until Marcus Webb submits his report. ' +
    'I have a reminder draft ready for your approval.',
  criticalPath: [
    {
      item: 'Inspector report is 12 days overdue',
      note: 'Marcus Webb was invited June 24. No submission on record. Underwriting is gated on this.',
      owner: 'AI',
      chainStep: 1,
    },
  ],
  nonBlockingTaskIds: ['demo-task-insurer'],
  parallelNote:
    'The insurance certificate is also outstanding but runs in parallel — it will not add delay once the inspection is resolved.',
  chain: [
    { step: 'due-diligence',  label: 'Due Diligence', stepStatus: 'in_progress', openCount: 2 },
    { step: 'underwriting',   label: 'Underwriting',  stepStatus: 'pending',     openCount: 0 },
    { step: 'loan-committee', label: 'Loan Committee', stepStatus: 'pending',    openCount: 0 },
    { step: 'closing',        label: 'Closing',        stepStatus: 'pending',    openCount: 0 },
  ],
  prepared: [
    'Reminder email to Marcus Webb (Inspector) — ready to send on your approval',
    'Reminder email to Priya Nair (Insurance Broker) — ready to send on your approval',
  ],
  expectedClosing: 'August 15, 2026 (if inspection resolved this week)',
};

const DEMO_QA_CONTEXT = `
You are the AI Operations Manager for a Kontra deal room.
Deal: 550 Madison Avenue, $28.5M office acquisition in Midtown Manhattan.
Current status: At Risk. Inspection report is 12 days overdue.
Parties: Marcus Webb (Inspector, overdue), Priya Nair (Insurance Broker, pending), First Republic Capital (Lender, submitted ✓).
Critical path: Due Diligence (2 open) → Underwriting → Loan Committee → Closing.
Expected closing: August 15, 2026 if inspection resolved this week.
Answer concisely and confidently, like a senior transaction coordinator. Keep answers under 4 sentences.
`;

module.exports = { PROPERTY, TASKS, BRIEFING, DEMO_QA_CONTEXT };
