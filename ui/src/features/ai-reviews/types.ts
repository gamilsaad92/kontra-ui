export type AiReviewStatus = 'pass' | 'needs_review' | 'fail';

export type AiReviewType = 'payment' | 'inspection' | 'compliance' | 'general';

export type AiReviewReason = {
  code: string;
  message: string;
  severity: 'low' | 'med' | 'high';
};

export type AiReviewEvidence = {
  label: string;
  url: string;
 kind: 'doc' | 'image' | 'link';
  excerpt?: string;
};

export type AiReviewAction = {
  action_type: string;
  label: string;
  payload: Record<string, unknown>;
  requires_approval: true;
};

export type AiReview = {
  id: string;
  org_id: string;
  type: AiReviewType;
  entity_type: string;
  entity_id: string;
  status: AiReviewStatus;
  confidence: number;
  title: string;
  summary: string;
  reasons: AiReviewReason[];
  evidence: AiReviewEvidence[];
  recommended_actions: AiReviewAction[];
  proposed_updates: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};
