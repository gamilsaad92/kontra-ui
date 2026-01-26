export type AiReviewStatus = "pass" | "needs_review" | "fail";

export type AiReviewType = "payment" | "inspection";

export type AiReviewReason = {
  code: string;
  message: string;
  severity: "low" | "medium" | "high";
};

export type AiReviewEvidence = {
  label: string;
  url: string;
  kind: string;
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
  project_id?: string | null;
  loan_id?: string | null;
  type: AiReviewType;
  source_id: string;
  status: AiReviewStatus;
  confidence: number;
  title: string;
  summary: string;
  reasons: AiReviewReason[];
  evidence: AiReviewEvidence[];
  recommended_actions: AiReviewAction[];
  proposed_updates: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
};
