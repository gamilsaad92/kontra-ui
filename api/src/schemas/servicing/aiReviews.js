const { z } = require('../../../lib/zod');

const ReviewStatusSchema = z.enum(['pass', 'needs_review', 'fail']);
const ReviewTypeSchema = z.enum(['payment', 'inspection']);

const ReviewReasonSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
});

const ReviewEvidenceSchema = z.object({
  label: z.string(),
  url: z.string().url(),
  kind: z.string().optional(),
});

const ReviewActionSchema = z.object({
  action_type: z.string(),
  label: z.string(),
  payload: z.record(z.unknown()).default({}),
  requires_approval: z.boolean().default(true),
});

const ProposedAllocationSchema = z.record(z.number()).default({});

const AiReviewSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  org_id: z.string(),
  project_id: z.string().nullable().optional(),
  loan_id: z.string().nullable().optional(),
  type: ReviewTypeSchema,
  source_id: z.string(),
  status: ReviewStatusSchema,
  confidence: z.number().min(0).max(1),
  title: z.string(),
  summary: z.string(),
  reasons: z.array(ReviewReasonSchema).default([]),
  evidence: z.array(ReviewEvidenceSchema).default([]),
  recommended_actions: z.array(ReviewActionSchema).default([]),
  proposed_updates: z
    .object({
      proposed_allocation: ProposedAllocationSchema.optional(),
      posting_notes: z.string().optional(),
    })
    .passthrough()
    .optional(),
  created_by: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

const PaymentReviewRequestSchema = z.object({
  paymentId: z.string().min(1),
  sourceId: z.string().optional(),
  loanId: z.string().optional(),
  projectId: z.string().optional(),
  attachments: z.array(z.record(z.unknown())).optional(),
  context: z
    .object({
      expected_amount: z.number().optional(),
      due_date: z.string().optional(),
      received_amount: z.number().optional(),
      received_date: z.string().optional(),
      remitter_name: z.string().optional(),
      memo: z.string().optional(),
      expected_remitter: z.string().optional(),
      expected_memo: z.string().optional(),
      escrow_due: z.number().optional(),
      suspected_fraud: z.boolean().optional(),
      proposed_allocation: ProposedAllocationSchema.optional(),
      posting_notes: z.string().optional(),
    })
    .partial()
    .optional(),
});

const ReviewInspectionRequestSchema = z.object({
  inspectionId: z.string().min(1),
  sourceId: z.string().optional(),
  loanId: z.string().optional(),
  projectId: z.string().optional(),
  attachments: z.array(z.record(z.unknown())).optional(),
  context: z.record(z.unknown()).optional(),
});

const ReviewsListQuerySchema = z.object({
  type: ReviewTypeSchema.optional(),
  status: ReviewStatusSchema.optional(),
  loanId: z.string().optional(),
  projectId: z.string().optional(),
});

const MarkReviewRequestSchema = z.object({
  status: ReviewStatusSchema,
});

const ApproveActionRequestSchema = z.object({
  action_type: z.string().min(1),
  action_payload: z.record(z.unknown()).default({}),
  notes: z.string().optional(),
});

const ReviewResponseSchema = z.object({ review: AiReviewSchema });
const ReviewsListResponseSchema = z.object({ reviews: z.array(AiReviewSchema) });
const ApproveActionResponseSchema = z.object({
  approval: z.record(z.unknown()),
  executionEnabled: z.boolean(),
  message: z.string(),
});

module.exports = {
  PaymentReviewRequestSchema,
  ReviewInspectionRequestSchema,
  ReviewsListQuerySchema,
  MarkReviewRequestSchema,
  ApproveActionRequestSchema,
  ReviewResponseSchema,
  ReviewsListResponseSchema,
  ApproveActionResponseSchema,
};
