import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/apiClient';
import { useOrg } from '../../../lib/OrgProvider';

export function useOrganizationMembers(orgId?: string) {
   const { authReady, orgReady } = useOrg();
  return useQuery({
    queryKey: ['org-members', orgId],  enabled: Boolean(orgId) && authReady && orgReady,
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
   const { authReady, orgReady } = useOrg();
  return useMutation({
    mutationFn: async (user_id: string) => {
           if (!authReady || !orgReady || !orgId) {
        throw new Error("Organization context is still loading.");
      }
      const response = await apiFetch(`/api/orgs/${orgId}/members`, { method: 'POST', body: JSON.stringify({ user_id }) });
      if (!response.ok) throw new Error('Failed to add member');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-members', orgId] }),
  });
}
