import { api } from "../../lib/api";
import type { AiReview, AiReviewStatus, AiReviewType } from "./types";

type ReviewQuery = {
  type?: AiReviewType;
  status?: AiReviewStatus;
  loanId?: string;
  projectId?: string;
};

const isAiReview = (value: unknown): value is AiReview => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.org_id === "string" &&
    typeof record.type === "string" &&
    typeof record.status === "string" &&
    typeof record.title === "string" &&
    typeof record.summary === "string"
  );
};

function assertReviewsResponse(payload: unknown): asserts payload is { reviews: AiReview[] } {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid reviews response payload.");
  }
  const reviews = (payload as Record<string, unknown>).reviews;
  if (!Array.isArray(reviews) || reviews.some((review) => !isAiReview(review))) {
    throw new Error("Invalid review records returned by API.");
  }
}

function assertReviewResponse(payload: unknown): asserts payload is { review: AiReview } {
  if (!payload || typeof payload !== "object" || !isAiReview((payload as Record<string, unknown>).review)) {
    throw new Error("Invalid review response payload.");
  }
}

export async function getReviews(params: ReviewQuery = {}): Promise<AiReview[]> {
  const { data } = await api.get<unknown>("/ai/reviews", { params });
  assertReviewsResponse(data);
  return data.reviews;
}

export async function reviewPayment(paymentId: string) {
 const { data } = await api.post<unknown>("/ai/payments/review", {
    paymentId,
  });
  assertReviewResponse(data);
  return data.review;
}

export async function reviewInspection(inspectionId: string) {
 const { data } = await api.post<unknown>("/ai/inspections/review", {
    inspectionId,
  });
   assertReviewResponse(data);
  return data.review;
}

export async function markReview(id: string, status: AiReviewStatus) {
 const { data } = await api.post<unknown>(`/ai/reviews/${id}/mark`, {
    status,
  });
  assertReviewResponse(data);
  return data.review;
}

export async function approveAction(
  id: string,
  action_type: string,
  action_payload: Record<string, unknown>,
  notes?: string
) {
 const { data } = await api.post<{ message?: string }>(`/ai/reviews/${id}/approve-action`, {
    action_type,
    action_payload,
    notes,
  });
  return data;
}
