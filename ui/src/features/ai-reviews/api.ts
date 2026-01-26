import { api } from "../../lib/api";
import type { AiReview, AiReviewStatus, AiReviewType } from "./types";

type ReviewQuery = {
  type?: AiReviewType;
  status?: AiReviewStatus;
  loanId?: string;
  projectId?: string;
};

export async function getReviews(params: ReviewQuery = {}): Promise<AiReview[]> {
  const { data } = await api.get<{ reviews: AiReview[] }>("/ai/reviews", { params });
  return data.reviews ?? [];
}

export async function reviewPayment(paymentId: string) {
  const { data } = await api.post<{ review: AiReview }>("/ai/payments/review", {
    paymentId,
  });
  return data.review;
}

export async function reviewInspection(inspectionId: string) {
  const { data } = await api.post<{ review: AiReview }>("/ai/inspections/review", {
    inspectionId,
  });
  return data.review;
}

export async function markReview(id: string, status: AiReviewStatus) {
  const { data } = await api.post<{ review: AiReview }>(`/ai/reviews/${id}/mark`, {
    status,
  });
  return data.review;
}

export async function approveAction(
  id: string,
  action_type: string,
  action_payload: Record<string, unknown>,
  notes?: string
) {
  const { data } = await api.post(`/ai/reviews/${id}/approve-action`, {
    action_type,
    action_payload,
    notes,
  });
  return data;
}
