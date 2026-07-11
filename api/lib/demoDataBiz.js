'use strict';

const PROPERTY_ID = 'kontra-demo-biz';

const PROPERTY = {
  id: PROPERTY_ID,
  property_id: PROPERTY_ID,
  property_name: 'Brightline Services LLC',
  property_type: 'Professional Services',
  deal_type: 'Business Acquisition',
  deal_amount: '$6,200,000',
  address: 'San Francisco, CA',
  market: 'Bay Area',
  status: 'active',
  workflow_pack_id: 'business_acquisition',
  first_name: '',
  created_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
};

const now = Date.now();
const days = d => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

const TASKS = [
  {
    id: 'biz-task-cpa',
    property_id: PROPERTY_ID,
    title: 'QoE report is 10 days overdue',
    description:
      'Davidson Advisory (CPA) was engaged on June 20 but has not delivered the Quality of Earnings report. ' +
      'The purchase price cannot be confirmed and the deal cannot advance to Under Review without it.',
    status: 'open',
    owner_type: 'ai',
    owner_role: null,
    task_type: 'pending_submission',
    role_key: 'cpa',
    priority: 'critical',
    created_at: days(10),
    waiting_on: 'AI',
    draft_action: {
      type: 'email',
      to: 'sarah.davidson@davidsonadvisory.com',
      subject: 'Action required: QoE report needed — Brightline Services acquisition',
      body:
        'Hi Sarah, the Quality of Earnings report for Brightline Services is now 10 days past the agreed delivery date. ' +
        'We cannot confirm the purchase price structure or move this deal forward without it. ' +
        'Please provide a revised delivery date at your earliest convenience.',
    },
  },
  {
    id: 'biz-task-seller',
    property_id: PROPERTY_ID,
    title: 'Working capital schedule not submitted',
    description:
      'The seller has not yet provided the normalized working capital schedule. ' +
      'Required for closing adjustments and purchase price mechanics.',
    status: 'open',
    owner_type: 'ai',
    owner_role: null,
    task_type: 'pending_submission',
    role_key: 'seller',
    priority: 'high',
    created_at: days(6),
    waiting_on: 'AI',
    draft_action: {
      type: 'email',
      to: 'tom.briggs@brightlineservices.com',
      subject: 'Action required: Working capital schedule — Brightline Services',
      body:
        'Hi Tom, we are still waiting on the normalized working capital schedule from Brightline. ' +
        'This is needed to complete the purchase price mechanics before the deal can advance to Under Review. ' +
        'Please submit at your earliest convenience.',
    },
  },
  {
    id: 'biz-task-counsel',
    property_id: PROPERTY_ID,
    title: 'LOI drafted and under legal counsel review',
    description:
      'Vance & Partners has received the draft LOI and is reviewing. Expected turnaround: 2 business days.',
    status: 'open',
    owner_type: 'human',
    owner_role: 'counsel',
    task_type: 'document_review',
    role_key: 'counsel',
    priority: 'normal',
    created_at: days(2),
    waiting_on: null,
    draft_action: null,
  },
  {
    id: 'biz-task-broker',
    property_id: PROPERTY_ID,
    title: 'CIM and seller financials received',
    description:
      'Meridian Advisors delivered the Confidential Information Memorandum and 3-year financial statements.',
    status: 'resolved',
    owner_type: 'human',
    owner_role: 'broker',
    task_type: 'document_submission',
    role_key: 'broker',
    priority: 'normal',
    created_at: days(18),
    resolved_at: days(16),
    waiting_on: null,
    draft_action: null,
  },
];

const BRIEFING = {
  status: 'at_risk',
  statusLabel: 'At Risk',
  reviewedCount: 4,
  narrative:
    'The QoE report is 10 days overdue and is blocking everything downstream — the purchase price cannot be confirmed ' +
    'and this deal cannot advance to Under Review without it. ' +
    'Davidson Advisory needs to commit to a delivery date today. ' +
    'I have a follow-up drafted for your approval.',
  criticalPath: [
    {
      item: 'QoE report is 10 days overdue',
      note: 'Davidson Advisory engaged June 20. No delivery. Purchase price and advancement to Under Review are gated on this.',
      owner: 'AI',
      chainStep: 1,
    },
  ],
  nonBlockingTaskIds: ['biz-task-seller'],
  parallelNote:
    'The working capital schedule is also outstanding but can be finalized after the QoE — it will not cause additional delay once the QoE is received.',
  chain: [
    { step: 'uploading',    label: 'Due Diligence',  stepStatus: 'in_progress', openCount: 3 },
    { step: 'under_review', label: 'Under Review',   stepStatus: 'pending',     openCount: 0 },
    { step: 'approved',     label: 'Approved',       stepStatus: 'pending',     openCount: 0 },
    { step: 'closing',      label: 'Closing',        stepStatus: 'pending',     openCount: 0 },
  ],
  prepared: [
    'Follow-up email to Davidson Advisory (CPA) — ready to send on your approval',
    'Follow-up email to Tom Briggs (Seller) for working capital schedule — ready to send on your approval',
  ],
  expectedClosing: 'September 12, 2026 (if QoE delivered this week)',
};

const DEMO_QA_CONTEXT = `
You are the AI Operations Manager for a Kontra deal room.
Deal: Brightline Services LLC, $6.2M business acquisition in San Francisco.
Current status: At Risk. QoE report from Davidson Advisory is 10 days overdue.
Parties: Sarah Davidson (CPA, overdue QoE), Tom Briggs (Seller, working capital pending), Vance & Partners (Legal Counsel, reviewing LOI), Meridian Advisors (M&A Broker, submitted CIM).
Critical path: Due Diligence (3 open) → Under Review → Approved → Closing.
Expected closing: September 12, 2026 if QoE delivered this week.
Answer concisely and confidently, like a senior M&A transaction coordinator. Keep answers under 4 sentences.
`;

module.exports = { PROPERTY, TASKS, BRIEFING, DEMO_QA_CONTEXT };
