const { z } = require('../../../lib/zod');

const ReviewStatusSchema = z.enum(['pass', 'needs_review', 'fail']);
const ReviewTypeSchema = z.enum(['payment', 'inspection', 'compliance', 'general']);

const AiReasonSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['low', 'med', 'high']),
});

const AiEvidenceSchema = z.object({
  label: z.string(),
  url: z.string().url(),
  kind: z.enum(['doc', 'image', 'link']),
  excerpt: z.string().optional(),
});

const AiActionSchema = z.object({
  action_type: z.string(),
  label: z.string(),
  payload: z.unknown(),
  requires_approval: z.literal(true),
});

const AiReviewSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  type: ReviewTypeSchema,
  entity_type: z.string(),
  entity_id: z.string(),
  status: ReviewStatusSchema,
  confidence: z.number(),
  title: z.string(),
  summary: z.string(),
  reasons: z.array(AiReasonSchema),
  evidence: z.array(AiEvidenceSchema),
  recommended_actions: z.array(AiActionSchema),
  proposed_updates: z.record(z.unknown()),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const AiReviewsListResponseSchema = z.object({
  items: z.array(AiReviewSchema),
  total: z.number().int().nonnegative(),
});

const AiReviewResponseSchema = z.object({ review: AiReviewSchema });

const AiReviewsListQuerySchema = z.object({
  status: ReviewStatusSchema.optional(),
  type: ReviewTypeSchema.optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
});

const MarkReviewRequestSchema = z.object({ status: ReviewStatusSchema });

const ApproveActionRequestSchema = z.object({
  action_type: z.string().min(1),
  action_payload: z.unknown(),
  notes: z.string().optional(),
});

const PaymentReviewRequestSchema = z.object({ payment_id: z.string().uuid() });
const InspectionReviewRequestSchema = z.object({ inspection_id: z.string().uuid() });
const ComplianceReviewRequestSchema = z.object({ compliance_item_id: z.string().uuid() });

module.exports = {
  AiReasonSchema,
  AiEvidenceSchema,
  AiActionSchema,
  AiReviewSchema,
  AiReviewResponseSchema,
  AiReviewsListResponseSchema,
  AiReviewsListQuerySchema,
  MarkReviewRequestSchema,
  ApproveActionRequestSchema,
  PaymentReviewRequestSchema,
  InspectionReviewRequestSchema,
  ComplianceReviewRequestSchema,
};
