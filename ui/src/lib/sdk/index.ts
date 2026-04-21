import { request } from "../http";
import type {
  Loan,
  Application,
  DrawRequest,
  Escrow,
  PortfolioSummary,
  ApplicationOrchestration,
} from "./types";

function withParams(params?: Record<string, any>): string {
  if (!params) return "";
  const q = new URLSearchParams(params as Record<string, string>);
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

export const applications = {
  list: (): Promise<Application[]> => request<Application[]>("GET", "/applications"),
  create: (payload: Partial<Application>): Promise<Application> =>
    request<Application>("POST", "/applications", payload),
  get: (id: string | number): Promise<Application> =>
    request<Application>("GET", `/applications/${id}`),
  update: (id: string | number, payload: Partial<Application>): Promise<Application> =>
    request<Application>("PUT", `/applications/${id}`, payload),
  orchestrate: (payload: FormData): Promise<ApplicationOrchestration> =>
    request<{ orchestration: ApplicationOrchestration }>(
      "POST",
      "/applications/orchestrations",
      payload
    ).then((response) => response.orchestration),
  listOrchestrations: (params?: Record<string, any>): Promise<ApplicationOrchestration[]> =>
    request<{ orchestrations: ApplicationOrchestration[] }>(
      "GET",
      `/applications/orchestrations${withParams(params)}`
    ).then((response) => response.orchestrations),
  getOrchestration: (id: string | number): Promise<ApplicationOrchestration> =>
    request<{ orchestration: ApplicationOrchestration }>(
      "GET",
      `/applications/orchestrations/${id}`
    ).then((response) => response.orchestration),
};

export const loans = {
  list: (params?: Record<string, any>): Promise<Loan[]> =>
    request<Loan[]>("GET", `/loans${withParams(params)}`),
  get: (id: string | number): Promise<Loan> =>
    request<Loan>("GET", `/loans/${id}`),
  updateStatus: (id: string | number, status: string): Promise<Loan> =>
    request<Loan>("PATCH", `/loans/${id}/status`, { status })
};

export const draws = {
  list: (params?: Record<string, any>): Promise<DrawRequest[]> =>
    request<DrawRequest[]>("GET", `/draw-requests${withParams(params)}`),
  get: (id: string | number): Promise<DrawRequest> =>
    request<DrawRequest>("GET", `/draw-requests/${id}`),
  approve: (id: string | number, payload?: any): Promise<DrawRequest> =>
    request<DrawRequest>("POST", `/draw-requests/${id}/approve`, payload),
  reject: (id: string | number, payload?: any): Promise<DrawRequest> =>
    request<DrawRequest>("POST", `/draw-requests/${id}/reject`, payload)
};

export const escrows = {
  list: (): Promise<Escrow[]> => request<Escrow[]>("GET", "/escrows"),
  get: (id: string | number): Promise<Escrow> =>
    request<Escrow>("GET", `/escrows/${id}`),
  schedule: (id: string | number): Promise<Escrow> =>
    request<Escrow>("POST", `/escrows/${id}/schedule`),
  pay: (id: string | number, payload: any): Promise<Escrow> =>
    request<Escrow>("POST", `/escrows/${id}/pay`, payload)
};

export const analytics = {
  portfolio: (): Promise<PortfolioSummary> =>
    request<PortfolioSummary>("GET", "/analytics/portfolio"),
  delinquency: (): Promise<PortfolioSummary> =>
    request<PortfolioSummary>("GET", "/analytics/delinquency"),
  trends: (params?: Record<string, any>): Promise<PortfolioSummary> =>
    request<PortfolioSummary>("GET", `/analytics/trends${withParams(params)}`)
};

export default { applications, loans, draws, escrows, analytics };
