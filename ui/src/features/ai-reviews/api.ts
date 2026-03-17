import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/apiClient';
import type { AiReview, AiReviewStatus, AiReviewType } from './types';

type ReviewQuery = {
  status?: AiReviewStatus;
  type?: AiReviewType;
  entity_type?: string;
  entity_id?: string;
};

type ReviewsListResponse = { items: AiReview[]; total: number };
type ApproveActionResponse = { ok: boolean; message?: string };

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

const toQuery = (params: ReviewQuery) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) search.set(k, String(v));
  });
  return search.toString();
};

async function fetchReviews(params: ReviewQuery = {}) {
  const queryString = toQuery(params);
    const response = await apiFetch(`/api/ai/reviews${queryString ? `?${queryString}` : ''}`);
  if (!response.ok) throw new Error('Failed to load AI reviews');
  return readJson<ReviewsListResponse>(response);
}

export async function getReviews(params: ReviewQuery = {}) {
  const data = await fetchReviews(params);
  return data.items;
}

export async function markReview(id: string, status: AiReviewStatus) {
  const response = await apiFetch(`/api/ai/reviews/${id}/mark`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Failed to mark AI review');
  const data = await readJson<{ review: AiReview }>(response);
  return data.review;
}

export async function approveAction(id: string, action_type: string, action_payload: unknown, notes?: string) {
  const response = await apiFetch(`/api/ai/reviews/${id}/approve-action`, {
    method: 'POST',
    body: JSON.stringify({ id, action_type, action_payload, notes }),
  });
  if (!response.ok) throw new Error('Failed to approve AI action');
  return readJson<ApproveActionResponse>(response);
}

export async function reviewPayment(payment_id: string) {
  const response = await apiFetch('/api/ai/payments/review', {
    method: 'POST',
    body: JSON.stringify({ payment_id }),
  });
  if (!response.ok) throw new Error('Failed to run payment AI review');
  const data = await readJson<{ review: AiReview }>(response);
  return data.review;
}

export async function reviewInspection(inspection_id: string) {
  const response = await apiFetch('/api/ai/inspections/review', {
    method: 'POST',
    body: JSON.stringify({ inspection_id }),
  });
  if (!response.ok) throw new Error('Failed to run inspection AI review');
  const data = await readJson<{ review: AiReview }>(response);
  return data.review;
}

export function useAiReviewsList(params: ReviewQuery = {}) {
  return useQuery<ReviewsListResponse>({
       queryKey: ['ai-reviews', 'list', toQuery(params)],
    queryFn: async () => fetchReviews(params),
  });
}

export function useAiReview(id?: string) {
  return useQuery<{ review: AiReview }>({
    queryKey: ['ai-reviews', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await apiFetch(`/api/ai/reviews/${id}`);
      if (!response.ok) throw new Error('Failed to load AI review');
      return readJson<{ review: AiReview }>(response);
    },
  });
}

export function useMarkAiReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AiReviewStatus }) => ({ review: await markReview(id, status) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reviews'] }),
  });
}

export function useApproveAiAction() {
  const queryClient = useQueryClient();
  return useMutation({
       mutationFn: async (payload: { id: string; action_type: string; action_payload: unknown; notes?: string }) =>
      approveAction(payload.id, payload.action_type, payload.action_payload, payload.notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reviews'] }),
  });
}

export function useRunPaymentReview() {
  const queryClient = useQueryClient();
  return useMutation({
      mutationFn: async ({ payment_id }: { payment_id: string }) => ({ review: await reviewPayment(payment_id) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reviews'] }),
  });
}

export function useRunInspectionReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inspection_id }: { inspection_id: string }) => ({ review: await reviewInspection(inspection_id) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reviews'] }),
  });
}
