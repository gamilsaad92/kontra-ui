import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { draws } from '../../lib/sdk';
import type { DrawRequest } from '../../lib/sdk/types';

export function useDraws(params?: Record<string, any>) {
  return useQuery<DrawRequest[]>({
    queryKey: ['draws', params],
    queryFn: () => draws.list(params),
  });
}

export function useDraw(id?: string | number) {
  return useQuery<DrawRequest>({
    queryKey: ['draw', id],
    queryFn: () => draws.get(id as string | number),
    enabled: !!id,
  });
}

export function useApproveDraw() {
  const queryClient = useQueryClient();
  return useMutation<DrawRequest, unknown, { id: string | number; payload?: any }>({
    mutationFn: ({ id, payload }) => draws.approve(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw', variables.id] });
    },
  });
}

export function useRejectDraw() {
  const queryClient = useQueryClient();
  return useMutation<DrawRequest, unknown, { id: string | number; payload?: any }>({
    mutationFn: ({ id, payload }) => draws.reject(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw', variables.id] });
    },
  });
}
