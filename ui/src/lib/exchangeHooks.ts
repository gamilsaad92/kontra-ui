import { useEffect, useState } from 'react';
import { API_BASE } from './apiBase';

interface FetchResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

function useFetch<T>(url: string | null): FetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!url);
  
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setIsLoading(true);
      setError(null);

    const doFetch = async () => {
      try {
        const response = await fetch(url);
        if (cancelled) return;

        if (!response.ok) {
          const err = new Error(`Request failed with status ${response.status}`);
          setError(err);
          setIsLoading(false);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const json = await response.json();
          if (!cancelled) {
            setData(json);
          }
        } else if (!cancelled) {
          setData(null);
        }

        if (!cancelled) {
          setIsLoading(false);
        }
           } catch (e) {
        if (!cancelled) {
          setError(e as Error);
          setIsLoading(false);
        }
        }
    };

    doFetch();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, error, isLoading };
}

export function useListings(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
 return useFetch<any[]>(`${API_BASE}/api/exchange/listings${query}`);
}

export function useOffers(listingId?: string) {
  const url = listingId ? `${API_BASE}/api/exchange/listings/${listingId}/offers` : null;
  return useFetch<any[]>(url);
}

export function useTrade(tradeId?: string) {
 const url = tradeId ? `${API_BASE}/api/exchange/trades/${tradeId}` : null;
  return useFetch<any>(url);
}
