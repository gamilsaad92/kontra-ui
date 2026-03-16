import { api, withOrg } from "../lib/api";
import type { Application, DrawRequest, Escrow } from "../lib/sdk/types";
import { api, withOrg } from "../lib/api";

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

const now = new Date();

const FALLBACK_APPLICATIONS: Application[] = [
  {
    id: "APP-4821",
    name: "Carla Jensen",
    email: "carla.jensen@example.com",
    amount: 420000,
    credit_score: 712,
    kyc_passed: true,
    status: "under_review",
    submitted_at: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "APP-4818",
    name: "Byron Mills",
    email: "byron.mills@example.com",
    amount: 375000,
    credit_score: 689,
    kyc_passed: false,
    status: "pending_docs",
    submitted_at: new Date(now.getTime() - 1000 * 60 * 60 * 27).toISOString(),
  },
  {
    id: "APP-4812",
    name: "Gina Patel",
    email: "gina.patel@example.com",
    amount: 510000,
    credit_score: 742,
    kyc_passed: true,
    status: "approved",
    submitted_at: new Date(now.getTime() - 1000 * 60 * 60 * 49).toISOString(),
  },
  {
    id: "APP-4809",
    name: "Frankie Adams",
    email: "frankie.adams@example.com",
    amount: 265000,
    credit_score: 668,
    kyc_passed: true,
    status: "in_review",
    submitted_at: new Date(now.getTime() - 1000 * 60 * 60 * 78).toISOString(),
  },
  {
    id: "APP-4801",
    name: "Whitney Flores",
    email: "whitney.flores@example.com",
    amount: 305000,
    credit_score: 701,
    kyc_passed: false,
    status: "awaiting_signature",
    submitted_at: new Date(now.getTime() - 1000 * 60 * 60 * 128).toISOString(),
  },
  {
    id: "APP-4794",
    name: "Devon Ross",
    email: "devon.ross@example.com",
    amount: 598000,
    credit_score: 725,
    kyc_passed: true,
    status: "funded",
    submitted_at: new Date(now.getTime() - 1000 * 60 * 60 * 154).toISOString(),
  },
];

const FALLBACK_ESCROWS: Escrow[] = [
  {
    loan_id: 1180,
    tax_amount: 8400,
    insurance_amount: 3600,
    escrow_balance: 26500,
    projected_balance: 21400,
    next_tax_due: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString(),
    next_insurance_due: new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString(),
  },
  {
    loan_id: 1216,
    tax_amount: 9200,
    insurance_amount: 4100,
    escrow_balance: 28750,
    projected_balance: 22900,
    next_tax_due: new Date(now.getFullYear(), now.getMonth() + 1, 22).toISOString(),
    next_insurance_due: new Date(now.getFullYear(), now.getMonth() + 3, 3).toISOString(),
  },
  {
    loan_id: 1242,
    tax_amount: 7600,
    insurance_amount: 3400,
    escrow_balance: 23800,
    projected_balance: 19650,
    next_tax_due: new Date(now.getFullYear(), now.getMonth() + 2, 11).toISOString(),
    next_insurance_due: new Date(now.getFullYear(), now.getMonth() + 4, 5).toISOString(),
  },
];

export interface EscrowProjectionPoint {
  month: number;
  balance: number;
}

function limitArray<T>(values: T[], limit?: number): T[] {
  if (!limit || limit <= 0) {
    return values;
  }
  return values.slice(0, limit);
}

function toNumber(value: unknown): number {
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function buildFallbackProjection(loanId?: string | number): EscrowProjectionPoint[] {
  const source = loanId
    ? FALLBACK_ESCROWS.find((entry) => String(entry.loan_id) === String(loanId))
    : undefined;
  const startingBalance = toNumber(
    source?.escrow_balance ?? source?.projected_balance ?? FALLBACK_ESCROWS[0]?.escrow_balance ?? 24000
  );
  const monthlyTax = toNumber(source?.tax_amount ?? FALLBACK_ESCROWS[0]?.tax_amount) / 12;
  const monthlyIns = toNumber(source?.insurance_amount ?? FALLBACK_ESCROWS[0]?.insurance_amount) / 12;
  let balance = startingBalance;
  const projection: EscrowProjectionPoint[] = [];
  for (let month = 1; month <= 12; month += 1) {
    balance = parseFloat(Math.max(0, balance - monthlyTax - monthlyIns).toFixed(2));
    projection.push({ month, balance });
  }
  return projection;
}

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
 const maybeError = error as ApiError;
  const status = maybeError?.status;
  if (status && RECOVERABLE_STATUSES.has(status)) {
    return FALLBACK_DRAWS;
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

export interface ListApplicationsOptions {
  limit?: number;
}

export const listApplications = async (
  options: ListApplicationsOptions = {}
): Promise<Application[]> => {
  const { limit } = options;
  try {
    const { data } = await api.get("/applications", {
      ...withOrg(1),
      params: limit && limit > 0 ? { limit } : undefined,
    });
    const rows: Application[] = Array.isArray(data?.applications)
      ? data.applications
      : Array.isArray(data)
      ? data
      : [];
    if (rows.length > 0) {
      return limitArray(rows, limit);
    }
  } catch (error) {
    console.error("Failed to fetch applications", error);
  }
  return limitArray(FALLBACK_APPLICATIONS, limit);
};

export interface ListUpcomingEscrowsOptions {
  limit?: number;
}

export const listUpcomingEscrows = async (
  options: ListUpcomingEscrowsOptions = {}
): Promise<Escrow[]> => {
  const { limit } = options;
  try {
    const { data } = await api.get("/escrows/upcoming", withOrg(1));
    const escrows: Escrow[] = Array.isArray(data?.escrows)
      ? data.escrows
      : Array.isArray(data)
      ? data
      : [];
    if (escrows.length > 0) {
      return limitArray(escrows, limit);
    }
  } catch (error) {
    console.error("Failed to fetch upcoming escrows", error);
  }
  return limitArray(FALLBACK_ESCROWS, limit);
};

export const getEscrowProjection = async (
  loanId: string | number
): Promise<EscrowProjectionPoint[]> => {
  try {
    const { data } = await api.get(`/loans/${loanId}/escrow/projection`, withOrg(1));
    const points: EscrowProjectionPoint[] = Array.isArray(data?.projection)
      ? data.projection
      : [];
    if (points.length > 0) {
      return points;
    }
  } catch (error) {
    console.error(`Failed to load escrow projection for loan ${loanId}`, error);
  }
  return buildFallbackProjection(loanId);
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

export interface RemittanceSummary {
  pool_id: string;
  period: string;
  gross_interest: number;
  gross_principal: number;
  fees: number;
  default_interest: number;
  advances: number;
  recoveries: number;
  net_to_investors: number;
}

export interface DistributionSnapshot {
  pool_id: string;
  period: string;
  nav: number | null;
  nav_updated_at?: string | null;
  tokens_outstanding: number;
  net_to_investors: number;
  per_token_distribution: number;
  status?: string;
}

export interface DistributionResponse {
  nav?: { pool_id: string; period: string; amount: number; updated_at: string } | null;
  remittance_summary?: RemittanceSummary;
  distribution?: DistributionSnapshot;
}

export async function updateNetAssetValue(
  poolId: string,
  navAmount: number,
  period?: string
): Promise<DistributionResponse> {
  const payload = {
    nav_amount: navAmount,
    period,
  };

  const { data } = await api.post(`/servicing/pools/${poolId}/nav`, payload, withOrg(1));
  return data as DistributionResponse;
}

export async function getDistributionSnapshot(
  poolId: string,
  period: string
): Promise<DistributionResponse> {
  const { data } = await api.get(`/servicing/pools/${poolId}/distribution/${period}`, withOrg(1));
  return data as DistributionResponse;
}
