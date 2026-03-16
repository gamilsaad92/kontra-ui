import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applications } from '../../lib/sdk';
import type { Application, ApplicationOrchestration } from '../../lib/sdk/types';

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

export function useApplicationOrchestrations(params?: Record<string, any>) {
  return useQuery<ApplicationOrchestration[]>({
    queryKey: ['applicationOrchestrations', params],
    queryFn: () => applications.listOrchestrations(params),
  });
}

type OrchestrationQueryOptions = {
  enabled?: boolean;
  refetchInterval?: number | false;
};

export function useApplicationOrchestration(
  id?: string | number | null,
  options: OrchestrationQueryOptions = {}
) {
  return useQuery<ApplicationOrchestration>({
    queryKey: ['applicationOrchestration', id],
    queryFn: () => applications.getOrchestration(id as string | number),
    enabled: Boolean(id) && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
  });
}

export function useSubmitApplicationPackage() {
  const queryClient = useQueryClient();
  return useMutation<ApplicationOrchestration, unknown, FormData>({
    mutationFn: (formData) => applications.orchestrate(formData),
    onSuccess: (data) => {
      if (data?.id) {
        queryClient.setQueryData(['applicationOrchestration', data.id], data);
      }
      queryClient.invalidateQueries({ queryKey: ['applicationOrchestrations'] });
    },
  });
}

export function useHydratedApplicationFields(
  orchestrationId?: string | number | null,
  options: OrchestrationQueryOptions = {}
) {
  const query = useApplicationOrchestration(orchestrationId, options);
  const fields = useMemo(() => {
    const outputs = query.data?.outputs;
    return {
      ...(outputs?.documentFields ?? {}),
      ...(outputs?.autoFill ?? {}),
    } as Record<string, any>;
  }, [query.data]);

  return {
    ...query,
    fields,
    scorecard: query.data?.outputs?.scorecard,
  };
}
