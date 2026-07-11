'use strict';

const PROPERTY_ID = 'kontra-demo-fundraising';

const PROPERTY = {
  id: PROPERTY_ID,
  property_id: PROPERTY_ID,
  property_name: 'Nexus Ventures Fund II',
  property_type: 'Venture / Growth',
  deal_type: 'Fundraising',
  deal_amount: '$25,000,000',
  address: 'San Francisco, CA',
  market: 'Venture Capital',
  status: 'active',
  workflow_pack_id: 'fundraising',
  first_name: '',
  created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
};

const now = Date.now();
const days = d => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

const TASKS = [
  {
    id: 'fund-task-lp1',
    property_id: PROPERTY_ID,
    title: 'Subscription agreement from Anchor LP not returned',
    description:
      'Clearwater Capital committed $5M at the close meeting on June 28 but has not returned the signed subscription agreement. ' +
      'Final close cannot proceed until all signed subscription agreements are on file.',
    status: 'open',
    owner_type: 'ai',
    owner_role: null,
    task_type: 'pending_submission',
    role_key: 'investor_relations',
    priority: 'critical',
    created_at: days(13),
    waiting_on: 'AI',
    draft_action: {
      type: 'email',
      to: 'jessica.wu@clearwatercapital.com',
      subject: 'Action required: Subscription agreement — Nexus Ventures Fund II',
      body:
        'Hi Jessica, we are still waiting on the signed subscription agreement from Clearwater Capital for your $5M commitment to Fund II. ' +
        'Final close is scheduled for August 1 and we need all subscription agreements on file at least 5 business days prior. ' +
        'Please return the signed agreement at your earliest convenience.',
    },
  },
  {
    id: 'fund-task-lp2',
    property_id: PROPERTY_ID,
    title: 'LP #2 subscription agreement pending',
    description:
      'Vantage Family Office committed $3M but subscription agreement has not been returned.',
    status: 'open',
    owner_type: 'ai',
    owner_role: null,
    task_type: 'pending_submission',
    role_key: 'investor_relations',
    priority: 'high',
    created_at: days(8),
    waiting_on: 'AI',
    draft_action: {
      type: 'email',
      to: 'mark.chen@vantagefamily.com',
      subject: 'Action required: Subscription agreement — Nexus Ventures Fund II',
      body:
        'Hi Mark, we are following up on the subscription agreement for Vantage Family Office\'s $3M commitment to Nexus Ventures Fund II. ' +
        'Please return the signed agreement before July 25 to remain on track for the August 1 close.',
    },
  },
  {
    id: 'fund-task-legal',
    property_id: PROPERTY_ID,
    title: 'PPM and LPA finalized by Thornton LLP',
    description:
      'Private Placement Memorandum and Limited Partnership Agreement reviewed, marked-up, and delivered by legal counsel.',
    status: 'resolved',
    owner_type: 'human',
    owner_role: 'attorney',
    task_type: 'document_submission',
    role_key: 'attorney',
    priority: 'normal',
    created_at: days(28),
    resolved_at: days(21),
    waiting_on: null,
    draft_action: null,
  },
  {
    id: 'fund-task-advisor',
    property_id: PROPERTY_ID,
    title: 'Financial model and fund projections delivered',
    description:
      'Atlas Partners delivered fund-level model, IRR projections, and vintage year benchmarking. Ready for LP review.',
    status: 'resolved',
    owner_type: 'human',
    owner_role: 'advisor',
    task_type: 'document_submission',
    role_key: 'advisor',
    priority: 'normal',
    created_at: days(25),
    resolved_at: days(20),
    waiting_on: null,
    draft_action: null,
  },
];

const BRIEFING = {
  status: 'on_track',
  statusLabel: 'On Track',
  reviewedCount: 4,
  narrative:
    '$8M soft-circled from two committed LPs, but neither has returned their subscription agreement — and final close is August 1. ' +
    'Clearwater Capital\'s $5M agreement is 13 days overdue and is the most urgent item. ' +
    'Vantage Family Office needs to return their $3M agreement by July 25. ' +
    'I have follow-up drafts ready for both LPs.',
  criticalPath: [
    {
      item: 'Clearwater Capital subscription agreement — 13 days outstanding',
      note: '$5M commitment confirmed June 28. No signed agreement on file. Final close August 1.',
      owner: 'AI',
      chainStep: 1,
    },
  ],
  nonBlockingTaskIds: ['fund-task-lp2'],
  parallelNote:
    'Vantage Family Office subscription is also outstanding but does not affect Clearwater\'s timeline — both can proceed in parallel.',
  chain: [
    { step: 'preparation',  label: 'Preparation',   stepStatus: 'complete',    openCount: 0 },
    { step: 'marketing',    label: 'LP Marketing',  stepStatus: 'complete',    openCount: 0 },
    { step: 'soft-circle',  label: 'Soft Circle',   stepStatus: 'in_progress', openCount: 2 },
    { step: 'subscription', label: 'Subscription',  stepStatus: 'pending',     openCount: 0 },
    { step: 'close',        label: 'Final Close',   stepStatus: 'pending',     openCount: 0 },
  ],
  prepared: [
    'Follow-up to Jessica Wu (Clearwater Capital) re: $5M subscription agreement — ready to send on your approval',
    'Follow-up to Mark Chen (Vantage Family Office) re: $3M subscription agreement — ready to send on your approval',
  ],
  expectedClosing: 'August 1, 2026 (on track if agreements received by July 25)',
};

const DEMO_QA_CONTEXT = `
You are the AI Operations Manager for a Kontra deal room.
Deal: Nexus Ventures Fund II, $25M target raise. $8M soft-circled from 2 LPs.
Current status: On Track. Two subscription agreements outstanding before August 1 final close.
Parties: Jessica Wu / Clearwater Capital ($5M committed, subscription overdue), Mark Chen / Vantage Family Office ($3M committed, subscription pending), Thornton LLP (legal — PPM/LPA complete), Atlas Partners (financial advisor — model delivered).
Pipeline: Preparation ✓ → LP Marketing ✓ → Soft Circle (active) → Subscription → Final Close (August 1).
Answer concisely and confidently, like a senior fund operations manager. Keep answers under 4 sentences.
`;

module.exports = { PROPERTY, TASKS, BRIEFING, DEMO_QA_CONTEXT };
