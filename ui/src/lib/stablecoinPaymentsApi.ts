import { api } from "./apiClient";

export type StablecoinPayment = {
  id: string;
  org_id: string;
  reference: string;
  status: string;
  token: string;
  chain: string;
  expected_amount: number;
  received_amount: number;
  destination_address: string;
  tx_hash?: string;
  confirmations: number;
  auto_convert_to_usd: boolean;
  created_at: string;
  expires_at?: string;
  invoice_id?: string;
  draw_id?: string;
  loan_id?: string;
};

export type StablecoinEvent = {
  id: string;
  request_id: string;
  event_type: string;
  old_status?: string;
  new_status?: string;
  tx_hash?: string;
  amount?: number;
  raw: unknown;
  created_at: string;
};

export const stablecoinPaymentsApi = {
  list: async (): Promise<{ payments: StablecoinPayment[] }> => {
    const response = await api.get("/api/payments/stablecoin");
    return response.data;
  },
  create: async (payload: {
    expected_amount: number;
    loan_id?: string;
    invoice_id?: string;
    draw_id?: string;
    auto_convert_to_usd?: boolean;
    expires_in_minutes?: number;
    metadata?: unknown;
  }): Promise<{ payment: StablecoinPayment }> => {
    const response = await api.post("/api/payments/stablecoin", payload);
    return response.data;
  },
  get: async (id: string): Promise<{ payment: StablecoinPayment; events: StablecoinEvent[] }> => {
    const response = await api.get(`/api/payments/stablecoin/${id}`);
    return response.data;
  },
};
