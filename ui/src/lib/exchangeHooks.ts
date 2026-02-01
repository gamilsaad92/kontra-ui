import { useEffect, useState } from 'react';
import { apiRequest } from './apiClient';

interface FetchResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

function useFetch<T>(path: string | null): FetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!path);
  
  useEffect(() => {
   if (!path) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const doFetch = async () => {
      try {
       const result = await apiRequest<T>("GET", path);
        if (cancelled) {
          return;
        }

      const nextData = (result as T | null | undefined) ?? null;
        setData(nextData);
        setIsLoading(false);
      } catch (e) {
        if (cancelled) {
          return;
        }

        const err =
          e instanceof Error ? e : new Error((e as { message?: string }).message ?? 'Request failed');
        setError(err);
        setIsLoading(false);
      }
    };

    doFetch();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, error, isLoading };
}

export function useListings(params?: Record<string, string>): FetchResult<any[]> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
 const { data, error, isLoading } = useFetch<{ listings?: any[] | null }>(
    `/exchange/listings${query}`
  );

  return {
    data: Array.isArray(data) ? data : data?.listings ?? [],
    error,
    isLoading,
  };
}

export function useOffers(listingId?: string) {
  const path = listingId ? `/exchange/listings/${listingId}/offers` : null;
  return useFetch<any[]>(path);
}

export function useTrade(tradeId?: string) {
  const path = tradeId ? `/exchange/trades/${tradeId}` : null;
  return useFetch<any>(path);
}
