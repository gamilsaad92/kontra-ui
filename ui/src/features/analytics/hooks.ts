import { useQuery } from '@tanstack/react-query';
import { analytics } from '../../lib/sdk';
import type { PortfolioSummary } from '../../lib/sdk/types';

export function usePortfolio() {
  return useQuery<PortfolioSummary>({
    queryKey: ['analytics', 'portfolio'],
    queryFn: () => analytics.portfolio(),
  });
}

export function useDelinquency() {
  return useQuery<PortfolioSummary>({
    queryKey: ['analytics', 'delinquency'],
    queryFn: () => analytics.delinquency(),
  });
}

export function useTrends(params?: Record<string, any>) {
  return useQuery<PortfolioSummary>({
    queryKey: ['analytics', 'trends', params],
    queryFn: () => analytics.trends(params),
  });
}
