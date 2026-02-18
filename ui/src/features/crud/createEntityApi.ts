import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/apiClient';
import type { CanonicalEntity, EntityListResponse } from './types';

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function createEntityApi(basePath: string, queryKey: string) {
  const listPath = `/api${basePath}`;

  const useEntityList = () =>
    useQuery<EntityListResponse>({
      queryKey: [queryKey, 'list'],
      queryFn: async () => {
        const response = await apiFetch(listPath);
        if (!response.ok) throw new Error('Failed to load list');
        return readJson<EntityListResponse>(response);
      },
    });

  const useCreateEntity = () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async () => {
        const defaultLabel = `New ${queryKey}`;
        const response = await apiFetch(listPath, {
          method: 'POST',
          body: JSON.stringify(basePath === '/orgs'
            ? { name: defaultLabel, status: 'active', data: {} }
            : { title: defaultLabel, status: 'active', data: {} }),
        });
        if (!response.ok) throw new Error('Failed to create entity');
        return readJson<CanonicalEntity>(response);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      },
    });
  };

  const useEntity = (id?: string) =>
    useQuery<CanonicalEntity>({
      queryKey: [queryKey, 'detail', id],
      enabled: Boolean(id),
      queryFn: async () => {
        const response = await apiFetch(`${listPath}/${id}`);
        if (!response.ok) throw new Error('Failed to load entity');
        return readJson<CanonicalEntity>(response);
      },
    });

  const useUpdateEntity = (id?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
    mutationFn: async (payload: Partial<Pick<CanonicalEntity, 'title' | 'name' | 'status' | 'data'>>) => {
        const response = await apiFetch(`${listPath}/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Failed to update entity');
        return readJson<CanonicalEntity>(response);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      },
    });
  };

  return { useEntityList, useCreateEntity, useEntity, useUpdateEntity };
}
