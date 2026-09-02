/**
 * Kontra Workflow Template Library
 *
 * Each template is a machine-readable workflow definition:
 *   id           — unique identifier, used as workflow_type
 *   name         — human label
 *   category     — grouping
 *   trigger_types — which event types auto-launch this workflow
 *   sla_hours    — expected completion window
 *   steps[]      — ordered execution graph
 *
 * Step types:
 *   automated        — runs without human input (AI agent, data fetch, calculation)
 *   human_approval   — blocks until a human approves/rejects
 *   notification     — fires webhook/email and continues
 *   ai_analysis      — runs AI model and stores artifact
 *   condition        — branches on data value
 *   external_trigger — waits for external callback
 */

const WORKFLOW_TEMPLATES = [

  // ─── 1. INSPECTION REVIEW ─────────────────────────────────────────────────
  {
    id: 'inspection_review',
    name: 'Inspection Review',
    description: 'Full property inspection lifecycle: scheduling → site visit → report upload → deficiency extraction → approval → cure tracking.',
    category: 'servicing',
    trigger_types: ['inspection-uploaded', 'draw-submitted'],
    sla_hours: 72,
    steps: [
      {
        id: 'sched',
        name: 'Schedule Inspection',
        type: 'human_approval',
        agent: null,
        assigned_role: 'servicer',
        description: 'Assign inspector and schedule site visit date.',
        required_fields: ['inspector_name', 'scheduled_date'],
        deadline_hours: 24,
        next_step: 'site_visit',
        on_reject: null,
      },
      {
        id: 'site_visit',
        name: 'Site Visit',
        type: 'external_trigger',
        agent: null,
        description: 'Inspector completes site visit. Upload of inspection report triggers next step.',
        deadline_hours: 96,
        next_step: 'extract_deficiencies',
        on_reject: null,
      },
      {
        id: 'extract_deficiencies',
        name: 'AI Deficiency Extraction',
        type: 'ai_analysis',
        agent: 'inspection_analyzer',
        description: 'AI reads inspection report PDF and extracts deficiencies with severity classification.',
        deadline_hours: 2,
        output_artifact: 'deficiency_list',
        next_step: 'deficiency_review',
        on_reject: null,
      },
      {
        id: 'deficiency_review',
        name: 'Deficiency Review & Classification',
        type: 'human_approval',
        assigned_role: 'servicer',
        description: 'Servicer reviews AI-extracted deficiencies, confirms severity, sets cure deadlines.',
        required_fields: ['deficiency_review_notes', 'cure_deadlines_confirmed'],
        deadline_hours: 48,
        next_step: 'borrower_notification',
        on_reject: 'site_visit',
      },
      {
        id: 'borrower_notification',
        name: 'Notify Borrower',
        type: 'notification',
        description: 'Send deficiency report and cure requirements to borrower via portal.',
        deadline_hours: 4,
        next_step: 'cure_monitoring',
        on_reject: null,
      },
      {
        id: 'cure_monitoring',
        name: 'Cure Period Monitoring',
        type: 'automated',
        agent: 'deadline_monitor',
        description: 'System monitors cure deadlines. Escalates critical/high deficiencies at T-7 days.',
        deadline_hours: null,
        next_step: 'final_approval',
        on_reject: null,
      },
      {
        id: 'final_approval',
        name: 'Final Inspection Sign-Off',
        type: 'human_approval',
        assigned_role: 'lender_admin',
        description: 'Lender signs off that deficiencies are cured or formally waived.',
        required_fields: ['sign_off_notes', 'remaining_open_items'],
        deadline_hours: 24,
        next_step: null,
        on_reject: 'deficiency_review',
      },
    ],
  },

  // ─── 2. HAZARD LOSS DISBURSEMENT ──────────────────────────────────────────
  {
    id: 'hazard_loss_disbursement',
    name: 'Hazard Loss Disbursement',
    description: 'End-to-end insurance claim processing: event filing → adjuster coordination → reserve calculation → approval waterfall → controlled disbursement.',
    category: 'servicing',
    trigger_types: ['hazard-loss-filed'],
    sla_hours: 120,
    steps: [
      {
        id: 'claim_intake',
        name: 'Claim Intake & Validation',
        type: 'human_approval',
        assigned_role: 'servicer',
        description: 'Record event details, confirm insurance coverage, file claim with insurer.',
        required_fields: ['event_type', 'event_date', 'claim_number', 'estimated_loss_usd'],
        deadline_hours: 24,
        next_step: 'adjuster_coordination',
        on_reject: null,
      },
      {
        id: 'adjuster_coordination',
        name: 'Adjuster Coordination',
        type: 'external_trigger',
        description: 'Wait for insurance adjuster report. System polls for upload or manual entry.',
        deadline_hours: 336,
        next_step: 'reserve_calculation',
        on_reject: null,
      },
      {
        id: 'reserve_calculation',
        name: 'Reserve & Disbursement Calculation',
        type: 'ai_analysis',
        agent: 'reserve_calculator',
        description: 'Calculate required holdback, disbursement schedule, and release conditions based on policy and loan docs.',
        deadline_hours: 4,
        output_artifact: 'disbursement_schedule',
        next_step: 'lender_approval',
        on_reject: null,
      },
      {
        id: 'lender_approval',
        name: 'Lender Approval',
        type: 'human_approval',
        assigned_role: 'lender_admin',
        description: 'Lender approves disbursement amount, holdback amount, and release schedule.',
        required_fields: ['approved_disbursement_usd', 'holdback_usd', 'release_conditions'],
        deadline_hours: 48,
        next_step: 'investor_notification',
        on_reject: 'reserve_calculation',
      },
      {
        id: 'investor_notification',
        name: 'Investor Notification',
        type: 'notification',
        description: 'Notify investors of material hazard event per PSA reporting requirements.',
        deadline_hours: 4,
        next_step: 'disbursement_execution',
        on_reject: null,
      },
      {
        id: 'disbursement_execution',
        name: 'Execute Disbursement',
        type: 'human_approval',
        assigned_role: 'servicer',
        description: 'Wire approved funds to borrower. Record disbursement in system.',
        required_fields: ['wire_reference', 'disbursed_amount_usd', 'disbursed_at'],
        deadline_hours: 24,
        next_step: 'repair_monitoring',
        on_reject: null,
      },
      {
        id: 'repair_monitoring',
        name: 'Repair Progress Monitoring',
        type: 'automated',
        agent: 'deadline_monitor',
        description: 'Monitor repair completion deadlines. Trigger inspection for holdback release.',
        deadline_hours: null,
        next_step: null,
        on_reject: null,
      },
    ],
  },

  // ─── 3. WATCHLIST REVIEW ──────────────────────────────────────────────────
  {
    id: 'watchlist_review',
    name: 'Watchlist Review',
    description: 'Periodic enhanced monitoring workflow for at-risk loans: data aggregation → AI risk scoring → committee review → action plan → investor alert.',
    category: 'risk',
    trigger_types: ['watchlist-added', 'delinquency-threshold'],
    sla_hours: 48,
    steps: [
      {
        id: 'data_aggregation',
        name: 'Data Aggregation',
        type: 'automated',
        agent: 'data_aggregator',
        description: 'Pull all loan data: payment history, financials, inspection history, covenant status, market data.',
        deadline_hours: 2,
        output_artifact: 'loan_data_package',
        next_step: 'risk_scoring',
        on_reject: null,
      },
      {
        id: 'risk_scoring',
        name: 'AI Risk Scoring',
        type: 'ai_analysis',
        agent: 'risk_scorer',
        description: 'AI generates risk score (1-100), identifies key risk drivers, compares to portfolio peers.',
        deadline_hours: 4,
        output_artifact: 'risk_score_memo',
        next_step: 'servicer_assessment',
        on_reject: null,
      },
      {
        id: 'servicer_assessment',
        name: 'Servicer Assessment',
        type: 'human_approval',
        assigned_role: 'servicer',
        description: 'Servicer reviews AI risk memo, adds context, confirms or adjusts risk rating.',
        required_fields: ['risk_assessment_notes', 'confirmed_risk_rating'],
        deadline_hours: 24,
        next_step: 'committee_review',
        on_reject: null,
      },
      {
        id: 'committee_review',
        name: 'Credit Committee Review',
        type: 'human_approval',
        assigned_role: 'lender_admin',
        description: 'Credit committee reviews full package, decides: hold/modify/transfer/REO/special servicing.',
        required_fields: ['committee_decision', 'action_plan', 'next_review_date'],
        deadline_hours: 48,
        next_step: 'action_execution',
        on_reject: 'servicer_assessment',
      },
      {
        id: 'action_execution',
        name: 'Execute Action Plan',
        type: 'automated',
        agent: 'action_router',
        description: 'Routes to appropriate sub-workflow based on committee decision (modification, special servicing, etc.).',
        deadline_hours: 4,
        next_step: 'investor_alert',
        on_reject: null,
      },
      {
        id: 'investor_alert',
        name: 'Investor Alert',
        type: 'notification',
        description: 'Send risk alert to investor portal per PSA reporting obligations.',
        deadline_hours: 4,
        next_step: null,
        on_reject: null,
      },
    ],
  },

  // ─── 4. BORROWER FINANCIAL ANALYSIS ──────────────────────────────────────
  {
    id: 'borrower_financial_analysis',
    name: 'Borrower Financial Analysis',
    description: 'Annual/quarterly financial review: upload → AI extraction → DSCR/LTV recalculation → covenant check → approval → investor metrics update.',
    category: 'servicing',
    trigger_types: ['financial-uploaded', 'annual-review-due'],
    sla_hours: 96,
    steps: [
      {
        id: 'document_validation',
        name: 'Document Validation',
        type: 'ai_analysis',
        agent: 'document_classifier',
        description: 'Validate financial package completeness: operating statements, rent roll, tax returns, bank statements.',
        deadline_hours: 2,
        output_artifact: 'document_checklist',
        next_step: 'ai_extraction',
        on_reject: null,
      },
      {
        id: 'ai_extraction',
        name: 'AI Financial Extraction',
        type: 'ai_analysis',
        agent: 'financial_extractor',
        description: 'Extract key metrics: NOI, EGI, vacancy, expenses, DSCR, debt yield, occupancy.',
        deadline_hours: 4,
        output_artifact: 'financial_summary',
        next_step: 'covenant_check',
        on_reject: null,
      },
      {
        id: 'covenant_check',
        name: 'Covenant Compliance Check',
        type: 'automated',
        agent: 'covenant_checker',
        description: 'Test all active covenants against extracted values. Flag violations.',
        deadline_hours: 1,
        output_artifact: 'covenant_status',
        next_step: 'servicer_review',
        on_reject: null,
      },
      {
        id: 'servicer_review',
        name: 'Servicer Review',
        type: 'human_approval',
        assigned_role: 'servicer',
        description: 'Review AI analysis, verify key figures, note discrepancies or concerns.',
        required_fields: ['review_notes', 'dscr_confirmed', 'occupancy_confirmed'],
        deadline_hours: 48,
        next_step: 'lender_approval',
        on_reject: 'ai_extraction',
      },
      {
        id: 'lender_approval',
        name: 'Lender Approval',
        type: 'human_approval',
        assigned_role: 'lender_admin',
        description: 'Lender approves updated financials. If covenant breach detected, triggers watchlist workflow.',
        required_fields: ['approval_notes', 'final_dscr', 'final_ltv'],
        deadline_hours: 48,
        next_step: 'metrics_update',
        on_reject: 'servicer_review',
      },
      {
        id: 'metrics_update',
        name: 'Update Portfolio Metrics',
        type: 'automated',
        agent: 'metrics_updater',
        description: 'Push updated DSCR/LTV/occupancy to portfolio dashboard, token NAV engine, and investor portal.',
        deadline_hours: 1,
        next_step: 'borrower_confirmation',
        on_reject: null,
      },
      {
        id: 'borrower_confirmation',
        name: 'Borrower Confirmation',
        type: 'notification',
        description: 'Send financial review receipt and any covenant notices to borrower.',
        deadline_hours: 4,
        next_step: null,
        on_reject: null,
      },
    ],
  },

  // ─── 5. MATURITY TRACKING ─────────────────────────────────────────────────
  {
    id: 'maturity_tracking',
    name: 'Maturity Tracking & Extension',
    description: 'Maturity management from T-90 alert through payoff or extension execution, including investor vote when required.',
    category: 'risk',
    trigger_types: ['maturity-t90', 'extension-requested'],
    sla_hours: 168,
    steps: [
      {
        id: 't90_alert',
        name: 'T-90 Alert & Payoff Analysis',
        type: 'automated',
        agent: 'maturity_monitor',
        description: 'System auto-generates T-90 alert. Pulls payoff quote, extension option eligibility, and sponsor capacity assessment.',
        deadline_hours: 4,
        output_artifact: 'maturity_analysis',
        next_step: 'borrower_outreach',
        on_reject: null,
      },
      {
        id: 'borrower_outreach',
        name: 'Borrower Outreach',
        type: 'notification',
        description: 'Send formal maturity notice to borrower with payoff quote and extension option details.',
        deadline_hours: 4,
        next_step: 'borrower_response',
        on_reject: null,
      },
      {
        id: 'borrower_response',
        name: 'Await Borrower Response',
        type: 'external_trigger',
        description: 'Wait for borrower to submit: payoff intent, extension request, or refinance confirmation.',
        deadline_hours: 336,
        next_step: 'lender_evaluation',
        on_reject: null,
      },
      {
        id: 'lender_evaluation',
        name: 'Lender Evaluation',
        type: 'human_approval',
        assigned_role: 'lender_admin',
        description: 'Evaluate extension request: review updated financials, appraisal, extension fee. Approve/deny.',
        required_fields: ['decision', 'extension_terms', 'extension_fee_usd'],
        deadline_hours: 120,
        next_step: 'investor_vote_check',
        on_reject: null,
      },
      {
        id: 'investor_vote_check',
        name: 'Investor Vote Required?',
        type: 'condition',
        description: 'Check PSA thresholds: if extension > 12 months or UPB > $5M, trigger investor governance vote.',
        condition_field: 'investor_vote_required',
        next_step_if_true: 'investor_vote',
        next_step_if_false: 'execute_extension',
        on_reject: null,
      },
      {
        id: 'investor_vote',
        name: 'Investor Governance Vote',
        type: 'external_trigger',
        description: 'Create governance proposal in investor portal. Wait for quorum + threshold result.',
        deadline_hours: 504,
        next_step: 'execute_extension',
        on_reject: null,
      },
      {
        id: 'execute_extension',
        name: 'Execute Extension or Payoff',
        type: 'human_approval',
        assigned_role: 'servicer',
        description: 'Process loan documents, collect extension fee, update maturity date in system.',
        required_fields: ['execution_type', 'new_maturity_date', 'fee_collected'],
        deadline_hours: 48,
        next_step: 'notification_close',
        on_reject: null,
      },
      {
        id: 'notification_close',
        name: 'Close & Notify',
        type: 'notification',
        description: 'Send confirmation to borrower, update investor portal, archive workflow.',
        deadline_hours: 4,
        next_step: null,
        on_reject: null,
      },
    ],
  },

  // ─── 6. COVENANT MONITORING ───────────────────────────────────────────────
  {
    id: 'covenant_monitoring',
    name: 'Covenant Monitoring',
    description: 'Scheduled covenant test cycle: automated data pull → calculation → violation detection → cure period management → escalation.',
    category: 'compliance',
    trigger_types: ['covenant-test-due', 'covenant-breach'],
    sla_hours: 24,
    steps: [
      {
        id: 'data_pull',
        name: 'Pull Latest Data',
        type: 'automated',
        agent: 'data_aggregator',
        description: 'Fetch current financials, payment status, and market data for covenant calculations.',
        deadline_hours: 2,
        output_artifact: 'covenant_data_package',
        next_step: 'calculate_covenants',
        on_reject: null,
      },
      {
        id: 'calculate_covenants',
        name: 'Calculate Covenant Values',
        type: 'automated',
        agent: 'covenant_checker',
        description: 'Run all covenant tests. DSCR, LTV, occupancy, debt yield, liquidity, net worth.',
        deadline_hours: 1,
        output_artifact: 'covenant_test_results',
        next_step: 'violation_check',
        on_reject: null,
      },
      {
        id: 'violation_check',
        name: 'Violation Detection',
        type: 'condition',
        description: 'Are any covenants failing?',
        condition_field: 'has_violations',
        next_step_if_true: 'violation_notification',
        next_step_if_false: 'log_passing',
        on_reject: null,
      },
      {
        id: 'log_passing',
        name: 'Log Passing Results',
        type: 'automated',
        agent: 'audit_logger',
        description: 'Record all covenant test results to audit log. Update covenant records.',
        deadline_hours: 1,
        next_step: null,
        on_reject: null,
      },
      {
        id: 'violation_notification',
        name: 'Violation Alert',
        type: 'notification',
        description: 'Alert servicer and lender of covenant violations. Set cure period deadlines.',
        deadline_hours: 2,
        next_step: 'cure_period',
        on_reject: null,
      },
      {
        id: 'cure_period',
        name: 'Cure Period Management',
        type: 'automated',
        agent: 'deadline_monitor',
        description: 'Monitor cure period. Send reminders at T-14 and T-7. Track borrower cure evidence.',
        deadline_hours: null,
        next_step: 'cure_review',
        on_reject: null,
      },
      {
        id: 'cure_review',
        name: 'Cure Review',
        type: 'human_approval',
        assigned_role: 'lender_admin',
        description: 'Review borrower cure evidence. Accept cure, extend period, or declare default.',
        required_fields: ['cure_decision', 'cure_notes'],
        deadline_hours: 48,
        next_step: 'watchlist_check',
        on_reject: null,
      },
      {
        id: 'watchlist_check',
        name: 'Watchlist Escalation Check',
        type: 'condition',
        description: 'If violation not cured: add to watchlist, notify investors of material breach.',
        condition_field: 'cure_accepted',
        next_step_if_true: 'log_passing',
        next_step_if_false: 'investor_breach_alert',
        on_reject: null,
      },
      {
        id: 'investor_breach_alert',
        name: 'Investor Breach Notification',
        type: 'notification',
        description: 'Send material covenant breach notice to investor portal. Trigger watchlist workflow.',
        deadline_hours: 4,
        next_step: null,
        on_reject: null,
      },
    ],
  },
];

/** Returns the full list of workflow templates */
function getTemplates() {
  return WORKFLOW_TEMPLATES;
}

/** Returns a single template by id */
function getTemplate(id) {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id) || null;
}

/** Maps an inbound trigger event to a workflow template id */
function resolveTemplate(triggerType) {
  const template = WORKFLOW_TEMPLATES.find(
    (t) => t.trigger_types.includes(triggerType)
  );
  return template?.id || null;
}

/** Returns all event types that can trigger a workflow (for webhook config) */
function getAllTriggerTypes() {
  const types = new Set();
  WORKFLOW_TEMPLATES.forEach((t) => t.trigger_types.forEach((tt) => types.add(tt)));
  return [...types];
}

module.exports = { WORKFLOW_TEMPLATES, getTemplates, getTemplate, resolveTemplate, getAllTriggerTypes };
