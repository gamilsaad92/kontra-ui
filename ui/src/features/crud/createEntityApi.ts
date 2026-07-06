import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/apiClient';
import type { CanonicalEntity, EntityListResponse } from './types';

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function createEntityApi(basePath: string, queryKey: string, seedItems: CanonicalEntity[] = []) {
  const listPath = `/api${basePath}`;

  const useEntityList = () =>
    useQuery<EntityListResponse>({
      queryKey: [queryKey, 'list'],
      queryFn: async () => {
        try {
          const response = await apiFetch(listPath);
          if (!response.ok) throw new Error('Failed to load list');
          const data = await readJson<EntityListResponse>(response);
          if (data && Array.isArray(data.items) && data.items.length > 0) return data;
          return { items: seedItems, total: seedItems.length };
        } catch {
          return { items: seedItems, total: seedItems.length };
        }
      },
    });

  const useCreateEntity = () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async () => {
        const defaultLabel = `New ${queryKey}`;
        try {
          const response = await apiFetch(listPath, {
            method: 'POST',
            body: JSON.stringify(basePath === '/orgs'
              ? { name: defaultLabel, status: 'active', data: {} }
              : { title: defaultLabel, status: 'active', data: {} }),
          });
          if (!response.ok) throw new Error('Failed to create entity');
          return readJson<CanonicalEntity>(response);
        } catch {
          return { id: `demo-${Date.now()}`, org_id: 'demo', status: 'active', title: defaultLabel, data: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as CanonicalEntity;
        }
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
        try {
          const response = await apiFetch(`${listPath}/${id}`);
          if (!response.ok) throw new Error('Failed to load entity');
          return readJson<CanonicalEntity>(response);
        } catch {
          const seed = seedItems.find(s => s.id === id);
          if (seed) return seed;
          throw new Error('Not found');
        }
      },
    });

  const useUpdateEntity = (id?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (payload: Partial<Pick<CanonicalEntity, 'title' | 'name' | 'status' | 'data'>>) => {
        try {
          const response = await apiFetch(`${listPath}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new Error('Failed to update entity');
          return readJson<CanonicalEntity>(response);
        } catch {
          return { id, ...payload } as CanonicalEntity;
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      },
    });
  };

  return { useEntityList, useCreateEntity, useEntity, useUpdateEntity };
}
