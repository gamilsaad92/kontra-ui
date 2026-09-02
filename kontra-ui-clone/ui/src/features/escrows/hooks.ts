import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { escrows } from '../../lib/sdk';
import type { Escrow } from '../../lib/sdk/types';

export function useEscrows() {
  return useQuery<Escrow[]>({
    queryKey: ['escrows'],
    queryFn: () => escrows.list(),
  });
}

export function useEscrow(id?: string | number) {
  return useQuery<Escrow>({
    queryKey: ['escrow', id],
    queryFn: () => escrows.get(id as string | number),
    enabled: !!id,
  });
}

export function usePayEscrow() {
  const queryClient = useQueryClient();
  return useMutation<Escrow, unknown, { id: string | number; payload: any }>({
    mutationFn: ({ id, payload }) => escrows.pay(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['escrows'] });
      queryClient.invalidateQueries({ queryKey: ['escrow', variables.id] });
    },
  });
}
