import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loans } from '../../lib/sdk';
import type { Loan } from '../../lib/sdk/types';

export function useLoans(params?: Record<string, any>) {
  return useQuery<Loan[]>({
    queryKey: ['loans', params],
    queryFn: () => loans.list(params),
  });
}

export function useLoan(id?: string | number) {
  return useQuery<Loan>({
    queryKey: ['loan', id],
    queryFn: () => loans.get(id as string | number),
    enabled: !!id,
  });
}

export function useUpdateLoanStatus() {
  const queryClient = useQueryClient();
  return useMutation<Loan, unknown, { id: string | number; status: string }>({
    mutationFn: ({ id, status }) => loans.updateStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan', variables.id] });
    },
  });
}
