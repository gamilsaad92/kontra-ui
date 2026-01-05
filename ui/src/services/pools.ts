import { api } from "../lib/api";

export type LoanInventoryItem = {
  id: string;
  borrower: string;
  property: string;
  city: string;
  state: string;
  upb: number;
  rate: number;
  dscr: number;
  status: string;
  remainingTermMonths: number;
};

export type InvestorHolding = {
  name: string;
  wallet: string;
  balance: number;
  ownership: number;
};

export type CashflowEntry = {
  period: string;
  gross: number;
  fees: number;
  distributed: number;
  distributionDate: string;
};

export type PoolAdminOverview = {
  id: string;
  name: string;
  tokenAddress?: string;
  status: string;
  nav: number;
  totalSupply: number;
  outstanding: number;
  geography: Record<string, number>;
  metrics: {
    waCoupon: number;
    waDscr: number;
    waTerm: number;
    leverage?: number;
    coverage?: number;
  };
  loans: LoanInventoryItem[];
  investors: InvestorHolding[];
  cashflows: CashflowEntry[];
};

export type CreatePoolRequest = {
  name: string;
  symbol?: string;
  target_size?: number;
  admin_wallet?: string;
  loans: Array<{ id: string; upb: number; rate?: number; dscr?: number }>;
  parameters?: {
    advance_rate?: number;
    min_dscr?: number;
  };
};

export type CreatePoolResponse = {
  poolId?: string;
  tokenAddress?: string;
  pool?: PoolAdminOverview;
};

const FALLBACK_LOANS: LoanInventoryItem[] = [
  {
    id: "LN-4102",
    borrower: "Summit Partners",
    property: "Summit Logistics Center",
    city: "Dallas",
    state: "TX",
    upb: 12500000,
    rate: 0.0685,
    dscr: 1.32,
    status: "current",
    remainingTermMonths: 44,
  },
  {
    id: "LN-4120",
    borrower: "Hudson River Holdings",
    property: "Riverside Flex Park",
    city: "Jersey City",
    state: "NJ",
    upb: 9800000,
    rate: 0.064,
    dscr: 1.21,
    status: "watchlist",
    remainingTermMonths: 58,
  },
  {
    id: "LN-4177",
    borrower: "Sunbelt Capital",
    property: "Sunbelt Multifamily",
    city: "Atlanta",
    state: "GA",
    upb: 16300000,
    rate: 0.071,
    dscr: 1.45,
    status: "current",
    remainingTermMonths: 61,
  },
  {
    id: "LN-4219",
    borrower: "Seaport Ventures",
    property: "Pier 9 Offices",
    city: "San Francisco",
    state: "CA",
    upb: 13750000,
    rate: 0.073,
    dscr: 1.18,
    status: "surveillance",
    remainingTermMonths: 39,
  },
  {
    id: "LN-4255",
    borrower: "Frontier Development",
    property: "Frontier Industrial",
    city: "Phoenix",
    state: "AZ",
    upb: 8600000,
    rate: 0.066,
    dscr: 1.27,
    status: "current",
    remainingTermMonths: 47,
  },
];

const FALLBACK_POOL: PoolAdminOverview = {
  id: "POOL-2024-1",
  name: "Kontra Bridge 2024-1",
  tokenAddress: "0x4f4b9c71a10b6c2a99bdf4c8a6a3d5af7d0c0021",
  status: "open",
  nav: 48200000,
  totalSupply: 50000000,
  outstanding: 36500000,
  geography: { TX: 2, GA: 1, CA: 1, NJ: 1 },
  metrics: {
    waCoupon: 0.0695,
    waDscr: 1.29,
    waTerm: 50,
    leverage: 0.74,
    coverage: 1.12,
  },
  loans: FALLBACK_LOANS,
  investors: [
    { name: "Apex Credit", wallet: "0xa5c4...1d9b", balance: 15000000, ownership: 0.3 },
    { name: "Mariner Capital", wallet: "0x9b22...7c41", balance: 12000000, ownership: 0.24 },
    { name: "Beacon Hill", wallet: "0x17de...f2a8", balance: 8000000, ownership: 0.16 },
  ],
  cashflows: [
    { period: "Q1 2024", gross: 1850000, fees: 210000, distributed: 1285000, distributionDate: "2024-04-15" },
    { period: "Q2 2024", gross: 1910000, fees: 225000, distributed: 1334000, distributionDate: "2024-07-15" },
    { period: "Q3 2024", gross: 1985000, fees: 230000, distributed: 1392000, distributionDate: "2024-10-15" },
  ],
};

function extractErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const maybeAny = error as any;
    const axiosMessage = maybeAny?.response?.data?.message;
    if (typeof axiosMessage === "string" && axiosMessage.trim()) {
      return axiosMessage;
    }
    if (typeof maybeAny?.message === "string" && maybeAny.message.trim()) {
      return maybeAny.message;
    }
  }
  return "Unable to complete request";
}

function normalizePoolResponse(pool: any): PoolAdminOverview {
  if (!pool) {
    return FALLBACK_POOL;
  }

  return {
    id: pool.id ?? FALLBACK_POOL.id,
    name: pool.name ?? FALLBACK_POOL.name,
    tokenAddress: pool.tokenAddress ?? pool.token_address ?? FALLBACK_POOL.tokenAddress,
    status: pool.status ?? pool.pool_status ?? FALLBACK_POOL.status,
    nav: Number(pool.nav ?? FALLBACK_POOL.nav),
    totalSupply: Number(pool.totalSupply ?? pool.total_supply ?? FALLBACK_POOL.totalSupply),
    outstanding: Number(pool.outstanding ?? pool.outstanding_balance ?? FALLBACK_POOL.outstanding),
    geography: pool.geography ?? pool.geo_breakdown ?? FALLBACK_POOL.geography,
    metrics: {
      waCoupon: Number(pool.metrics?.waCoupon ?? pool.wa_coupon ?? FALLBACK_POOL.metrics.waCoupon),
      waDscr: Number(pool.metrics?.waDscr ?? pool.wa_dscr ?? FALLBACK_POOL.metrics.waDscr),
      waTerm: Number(pool.metrics?.waTerm ?? pool.wa_term ?? FALLBACK_POOL.metrics.waTerm),
      leverage: pool.metrics?.leverage ?? pool.leverage ?? FALLBACK_POOL.metrics.leverage,
      coverage: pool.metrics?.coverage ?? pool.coverage ?? FALLBACK_POOL.metrics.coverage,
    },
    loans: Array.isArray(pool.loans) && pool.loans.length > 0 ? pool.loans : FALLBACK_POOL.loans,
    investors:
      Array.isArray(pool.investors) && pool.investors.length > 0
        ? pool.investors
        : FALLBACK_POOL.investors,
    cashflows:
      Array.isArray(pool.cashflows) && pool.cashflows.length > 0
        ? pool.cashflows
        : FALLBACK_POOL.cashflows,
  };
}

export type LoanInventoryResult = {
  loans: LoanInventoryItem[];
  usedFallback: boolean;
  errorMessage?: string;
};

export type PoolAdminResult = {
  poolAdmin: PoolAdminOverview;
  usedFallback: boolean;
  errorMessage?: string;
};

export async function fetchLoanInventory(): Promise<LoanInventoryResult> {
  try {
    const { data } = await api.get("/loans");
    if (Array.isArray(data?.loans) && data.loans.length > 0) {
    return { loans: data.loans as LoanInventoryItem[], usedFallback: false };
    }
    if (Array.isArray(data) && data.length > 0) {
       return { loans: data as LoanInventoryItem[], usedFallback: false };
    }
  } catch (error) {
    console.warn("Falling back to static loan inventory", error);
        return { loans: FALLBACK_LOANS, usedFallback: true, errorMessage: extractErrorMessage(error) };
  }
  return { loans: FALLBACK_LOANS, usedFallback: true, errorMessage: "Live loan inventory unavailable" };
}

export async function createPoolToken(payload: CreatePoolRequest): Promise<CreatePoolResponse> {
  try {
    const { data } = await api.post("/pools", payload);
    const tokenAddress = data?.pool?.tokenAddress ?? data?.tokenAddress;
    const poolId = data?.pool?.id ?? data?.poolId ?? payload.name;
    return {
      poolId,
      tokenAddress,
      pool: data?.pool ? normalizePoolResponse(data.pool) : undefined,
    };
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

export async function fetchPoolAdmin(poolId?: string): Promise<PoolAdminResult> {
  try {
    const path = poolId ? `/pools/${poolId}` : "/pools/latest";
    const { data } = await api.get(path);
    if (data?.pool) {
     return { poolAdmin: normalizePoolResponse(data.pool), usedFallback: false };
    }
    if (data) {
     return { poolAdmin: normalizePoolResponse(data), usedFallback: false };
    }
  } catch (error) {
    console.warn("Falling back to static pool data", error);
        return { poolAdmin: FALLBACK_POOL, usedFallback: true, errorMessage: extractErrorMessage(error) };
  }
   return { poolAdmin: FALLBACK_POOL, usedFallback: true, errorMessage: "Live pool data unavailable" };
}
