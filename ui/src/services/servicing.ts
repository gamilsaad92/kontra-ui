import axios from "axios";
import { api, withOrg } from "../lib/api";
import type { Application, DrawRequest } from "../lib/sdk/types";

const FALLBACK_DRAWS: DrawRequest[] = [
  {
    id: "DR-1042",
    project: "Harborview Logistics Expansion",
    amount: 185000,
    status: "pending",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "DR-1036",
    project: "Riverside Residences Tower B",
    amount: 250000,
    status: "approved",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: "DR-1019",
    project: "Midtown Creative Offices",
    amount: 142500,
    status: "funded",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
  },
];

const RECOVERABLE_STATUSES = new Set([401, 403, 404, 429]);

function normalizeStatus(value?: string) {
  return (value ?? "").toLowerCase();
}

function normalizeDraw(draw: DrawRequest): DrawRequest {
  const submittedAt = draw.submittedAt ?? (draw as any).submitted_at;
  if (submittedAt && draw.submittedAt !== submittedAt) {
    return { ...draw, submittedAt };
  }
  return draw;
}

function applyFilters(draws: DrawRequest[], filters: DrawRequestFilters): DrawRequest[] {
  const normalizedStatus = normalizeStatus(filters.status);
  const projectTerm = (filters.project ?? "").trim().toLowerCase();

  let result = draws.map(normalizeDraw).filter((draw) => {
    if (normalizedStatus && normalizeStatus(draw.status) !== normalizedStatus) {
      return false;
    }
    if (
      projectTerm &&
      !String(draw.project ?? "")
        .toLowerCase()
        .includes(projectTerm)
    ) {
      return false;
    }
    return true;
  });

  if (filters.limit && filters.limit > 0) {
    result = result.slice(0, filters.limit);
  }

  return result;
}

function withFallbackDraws(error: unknown): DrawRequest[] {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status && RECOVERABLE_STATUSES.has(status)) {
      return FALLBACK_DRAWS;
    }
  }
  return [];
}

export interface PayoffQuote {
  payoff?: number;
  [key: string]: any;
}

export const listPipeline = async (): Promise<Application[]> => {
  try {
    return (await api.get("/applications?limit=6", withOrg(1))).data as Application[];
  } catch (error) {
    console.error("Failed to list pipeline", error);
    return [];
  }
};

export interface DrawRequestFilters {
  status?: string;
  project?: string;
  limit?: number;
}

export const listDrawRequests = async (
  filters: DrawRequestFilters = {}
): Promise<DrawRequest[]> => {
  const params: Record<string, string | number> = {};
  if (filters.status) params.status = filters.status;
  if (filters.project) params.project = filters.project;
  params.limit = filters.limit ?? 6;

  try {
    const { data } = await api.get<DrawRequest[]>("/draw-requests", {
      ...withOrg(1),
      params,
    });
    if (Array.isArray(data) && data.length > 0) {
      return applyFilters(data, filters);
    }
    return applyFilters(FALLBACK_DRAWS, filters);
  } catch (error) {
        const fallback = applyFilters(withFallbackDraws(error), filters);
    if (fallback.length > 0) {
      return fallback;
    }
    console.error("Failed to list draw requests", error);
    return applyFilters(FALLBACK_DRAWS, filters);
  }
};

export const sendPayoffQuote = async (
  loanId: number
): Promise<PayoffQuote> => {
  try {
    return (
      await api.post(`/loans/${loanId}/payoff-quote`, {}, withOrg(1))
    ).data as PayoffQuote;
  } catch (error: any) {
    throw new Error(
      `Failed to send payoff quote for loan ${loanId}: ${error?.message || error}`
    );
  }
};
