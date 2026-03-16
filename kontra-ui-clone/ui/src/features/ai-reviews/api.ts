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

export function useAiReviewsList(params: ReviewQuery = {}) {
  const queryString = toQuery(params);
  return useQuery<ReviewsListResponse>({
    queryKey: ['ai-reviews', 'list', queryString],
    queryFn: async () => {
      const response = await apiFetch(`/api/ai/reviews${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) throw new Error('Failed to load AI reviews');
      return readJson<ReviewsListResponse>(response);
    },
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
    mutationFn: async ({ id, status }: { id: string; status: AiReviewStatus }) => {
      const response = await apiFetch(`/api/ai/reviews/${id}/mark`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to mark AI review');
      return readJson<{ review: AiReview }>(response);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reviews'] }),
  });
}

export function useApproveAiAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; action_type: string; action_payload: unknown; notes?: string }) => {
      const response = await apiFetch(`/api/ai/reviews/${payload.id}/approve-action`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to approve AI action');
      return readJson<{ ok: boolean }>(response);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reviews'] }),
  });
}

export function useRunPaymentReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payment_id }: { payment_id: string }) => {
      const response = await apiFetch('/api/ai/payments/review', {
        method: 'POST',
        body: JSON.stringify({ payment_id }),
      });
      if (!response.ok) throw new Error('Failed to run payment AI review');
      return readJson<{ review: AiReview }>(response);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reviews'] }),
  });
}

export function useRunInspectionReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inspection_id }: { inspection_id: string }) => {
      const response = await apiFetch('/api/ai/inspections/review', {
        method: 'POST',
        body: JSON.stringify({ inspection_id }),
      });
      if (!response.ok) throw new Error('Failed to run inspection AI review');
      return readJson<{ review: AiReview }>(response);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-reviews'] }),
  });
}
