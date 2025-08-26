import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applications } from '../../lib/sdk';
import type { Application } from '../../lib/sdk/types';

export function useApplications() {
  return useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => applications.list(),
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation<Application, unknown, Partial<Application>>({
    mutationFn: (payload) => applications.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
