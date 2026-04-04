import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/apiClient';

export function useOrganizationMembers(orgId?: string) {
  return useQuery({
    queryKey: ['org-members', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const response = await apiFetch(`/api/orgs/${orgId}/members`);
      if (!response.ok) throw new Error('Failed to load members');
      return response.json();
    },
  });
}

export function useCreateOrganizationMember(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (user_id: string) => {
      const response = await apiFetch(`/api/orgs/${orgId}/members`, { method: 'POST', body: JSON.stringify({ user_id }) });
      if (!response.ok) throw new Error('Failed to add member');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-members', orgId] }),
  });
}
