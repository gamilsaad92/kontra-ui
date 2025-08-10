import { useEffect, useState } from 'react';
import { API_BASE } from './apiBase';

interface FetchResult<T> {
  data: T | null;
  error: Error | null;
}

function useFetch<T>(url: string | null): FetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then(r => r.json())
      .then(json => {
        if (!cancelled) setData(json);
      })
      .catch(e => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, error };
}

export function useListings() {
  return useFetch<any[]>(`${API_BASE}/exchange/listings`);
}

export function useOffers(listingId?: string) {
  const url = listingId ? `${API_BASE}/exchange/listings/${listingId}/offers` : null;
  return useFetch<any[]>(url);
}

export function useTrade(tradeId?: string) {
  const url = tradeId ? `${API_BASE}/exchange/trades/${tradeId}` : null;
  return useFetch<any>(url);
}
