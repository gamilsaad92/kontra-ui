import { api } from "./apiClient";

export type CmToken = {
  id: string;
  org_id: string;
  symbol: string;
  name: string;
  decimals: number;
  total_supply: number;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CmAllocation = {
  id: string;
  token_id: string;
  holder_type: string;
  holder_ref: string;
  balance: number;
  created_at: string;
  updated_at: string;
};

export type CmEvent = {
  id: string;
  token_id: string;
  event_type: string;
  from_holder_type?: string;
  from_holder_ref?: string;
  to_holder_type?: string;
  to_holder_ref?: string;
  amount: number;
  memo?: string;
  created_at: string;
};

export const capitalMarketsApi = {
  listTokens: async (): Promise<{ tokens: CmToken[] }> => api.get("/api/capital-markets/tokens"),
  createToken: async (payload: { symbol: string; name: string; decimals?: number; metadata?: unknown }) =>
    api.post("/api/capital-markets/tokens", payload),
  getToken: async (id: string): Promise<{ token: CmToken; allocations: CmAllocation[] }> =>
    api.get(`/api/capital-markets/tokens/${id}`),
  getEvents: async (id: string): Promise<{ events: CmEvent[] }> =>
    api.get(`/api/capital-markets/tokens/${id}/events`),
  mint: async (
    id: string,
    payload: { holder_type: string; holder_ref: string; amount: number; memo?: string }
  ) => api.post(`/api/capital-markets/tokens/${id}/mint`, payload),
  burn: async (
    id: string,
    payload: { holder_type: string; holder_ref: string; amount: number; memo?: string }
  ) => api.post(`/api/capital-markets/tokens/${id}/burn`, payload),
  transfer: async (
    id: string,
    payload: {
      from: { holder_type: string; holder_ref: string };
      to: { holder_type: string; holder_ref: string };
      amount: number;
      memo?: string;
    }
  ) => api.post(`/api/capital-markets/tokens/${id}/transfer`, payload),
};
