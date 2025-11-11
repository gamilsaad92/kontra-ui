import { useEffect, useState } from 'react';
import { apiFetch } from './http';

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
        const result = await apiFetch<T>(path, { credentials: 'include' });
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

export function useListings(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
 return useFetch<any[]>(`/exchange/listings${query}`);
}

export function useOffers(listingId?: string) {
  const path = listingId ? `/exchange/listings/${listingId}/offers` : null;
  return useFetch<any[]>(path);
}

export function useTrade(tradeId?: string) {
  const path = tradeId ? `/exchange/trades/${tradeId}` : null;
  return useFetch<any>(path);
}
