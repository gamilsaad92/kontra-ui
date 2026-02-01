import axios from "axios";
import type { ApiError } from "../lib/apiClient";

type PortfolioSnapshot = {
  delinqPct: number;
  points: number[];
};

type RiskBucket = {
  label: string;
  value: number;
};

type StressScenario = {
  scenario: string;
  buckets: RiskBucket[];
};

type RiskFlag = {
  type: string;
  id: string;
  due: string;
};

type RiskPenalty = {
  id: string;
  defaultInterest: number;
  penalty: number;
};

type OccupancyDerivative = {
  id: string;
  property: string;
  trigger: string;
  coverage: string;
  premium: string;
  venue: string;
  side: "Buy" | "Sell";
};

type MaintenanceSwap = {
  id: string;
  asset: string;
  forecast: string;
  cap: string;
  counterparty: string;
  status: string;
};

type PrepaymentSwap = {
  id: string;
  loan: string;
  penalty: string;
  window: string;
  counterparty: string;
  fee: string;
};

type RiskSummary = {
  buckets: RiskBucket[];
  stress: StressScenario;
  flags: RiskFlag[];
  penalties: RiskPenalty[];
  occupancyDerivatives: OccupancyDerivative[];
  maintenanceSwaps: MaintenanceSwap[];
  prepaymentSwaps: PrepaymentSwap[];
};

const FALLBACK_PORTFOLIO: PortfolioSnapshot = {
  delinqPct: 1.24,
  points: [3, 5, 4, 6, 7, 8],
};

const FALLBACK_RISK_SUMMARY: RiskSummary = {
  buckets: [
    { label: "Low", value: 58 },
    { label: "Med", value: 22 },
    { label: "High", value: 14 },
  ],
  stress: {
    scenario: "rate+200bps",
    buckets: [
      { label: "Low", value: 48 },
      { label: "Med", value: 30 },
      { label: "High", value: 20 },
    ],
  },
  flags: [],
  penalties: [],
  occupancyDerivatives: [
    {
      id: "OCC-001",
      property: "Midtown Office Tower",
      trigger: "Occupancy < 85%",
      coverage: "$2.5M",
      premium: "$35k / quarter",
      venue: "Internal",
      side: "Buy",
    },
    {
      id: "OCC-002",
      property: "Riverside Multifamily",
      trigger: "Occupancy < 90%",
      coverage: "$1.8M",
      premium: "$24k / quarter",
      venue: "DEX",
      side: "Sell",
    },
    {
      id: "OCC-003",
      property: "Sunset Retail Plaza",
      trigger: "Occupancy < 80%",
      coverage: "$1.2M",
      premium: "$16k / quarter",
      venue: "DEX",
      side: "Buy",
    },
  ],
  maintenanceSwaps: [
    {
      id: "RM-114",
      asset: "Harbor Industrial Park",
      forecast: "$420k (next 12m)",
      cap: "$350k",
      counterparty: "Evergreen Facilities",
      status: "Matched",
    },
    {
      id: "RM-208",
      asset: "Oakwood Senior Living",
      forecast: "$310k (next 12m)",
      cap: "$275k",
      counterparty: "In Negotiation",
      status: "Sourcing",
    },
    {
      id: "RM-305",
      asset: "Metro Logistics Hub",
      forecast: "$510k (next 12m)",
      cap: "$400k",
      counterparty: "FacilityShield",
      status: "Pending Docs",
    },
  ],
  prepaymentSwaps: [
    {
      id: "PP-901",
      loan: "Loan #4512",
      penalty: "$180k",
      window: "Months 24-30",
      counterparty: "Atlas Finance",
      fee: "$12k upfront",
    },
    {
      id: "PP-917",
      loan: "Loan #4620",
      penalty: "$240k",
      window: "Months 18-24",
      counterparty: "Westbridge Capital",
      fee: "$15k upfront",
    },
    {
      id: "PP-926",
      loan: "Loan #4705",
      penalty: "$95k",
      window: "Months 12-18",
      counterparty: "Horizon Partners",
      fee: "$7.5k upfront",
    },
  ],
};

const RECOVERABLE_STATUSES = new Set([401, 403, 404, 429]);

export type CollectionsSummary = {
  monthToDateCollected: number;
  outstanding: number;
  delinquentCount: number;
  promisesToPay: number;
  lastPaymentAt: string | null;
};

export type LenderOverview = {
  totals: {
    totalLoans: number;
    delinquencyRate: number;
    avgInterestRate: number;
    outstandingPrincipal: number;
  };
  riskScore: number;
  collections: CollectionsSummary;
};

export type ReportRunSummary = {
  id: string | number;
  name?: string;
  status?: string;
  generated_at?: string;
};

export type ReportSummarySnapshot = {
  summary: {
    scheduled: number;
    saved: number;
    totalRuns: number;
    lastRunAt: string | null;
  };
  collections: CollectionsSummary;
  recentReports: ReportRunSummary[];
};

const FALLBACK_COLLECTIONS_SUMMARY: CollectionsSummary = {
  monthToDateCollected: 1845000,
  outstanding: 675000,
  delinquentCount: 18,
  promisesToPay: 6,
  lastPaymentAt: new Date().toISOString(),
};

const FALLBACK_LENDER_OVERVIEW: LenderOverview = {
  totals: {
    totalLoans: 1280,
    delinquencyRate: 0.038,
    avgInterestRate: 0.052,
    outstandingPrincipal: 52_500_000,
  },
  riskScore: 72,
  collections: FALLBACK_COLLECTIONS_SUMMARY,
};

const FALLBACK_REPORT_SUMMARY: ReportSummarySnapshot = {
  summary: {
    scheduled: 4,
    saved: 11,
    totalRuns: 36,
    lastRunAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  collections: FALLBACK_COLLECTIONS_SUMMARY,
  recentReports: [
    { id: "collections-mtd", name: "Collections MTD", status: "delivered", generated_at: new Date().toISOString() },
    { id: "delinquency-roll", name: "Delinquency Roll", status: "processing" },
    { id: "investor-pack", name: "Investor Pack", status: "scheduled" },
  ],
};

function shouldFallback(error: unknown): boolean {
 const maybeError = error as ApiError;
  const status = maybeError?.status;
  
  return typeof status === "number" && RECOVERABLE_STATUSES.has(status);
}

export async function getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  try {
    const { data } = await api.post(
      "/portfolio-summary",
      { period: "MTD" },
      withOrg(1)
    );

    return {
      delinqPct: data?.delinquency_pct ?? FALLBACK_PORTFOLIO.delinqPct,
      points: data?.spark ?? FALLBACK_PORTFOLIO.points,
    };
  } catch (error) {
    if (shouldFallback(error)) {
      return FALLBACK_PORTFOLIO;
    }
    throw error;
  }
}

export async function getRiskSummary(): Promise<RiskSummary> {
  try {
    const { data } = await api.get("/risk/summary", withOrg(1));

    return {
      buckets: data?.buckets ?? FALLBACK_RISK_SUMMARY.buckets,
      stress: data?.stress ?? FALLBACK_RISK_SUMMARY.stress,
      flags: data?.flags ?? FALLBACK_RISK_SUMMARY.flags,
      penalties: data?.penalties ?? FALLBACK_RISK_SUMMARY.penalties,
      occupancyDerivatives:
        data?.occupancyDerivatives ?? FALLBACK_RISK_SUMMARY.occupancyDerivatives,
      maintenanceSwaps:
        data?.maintenanceSwaps ?? FALLBACK_RISK_SUMMARY.maintenanceSwaps,
      prepaymentSwaps:
        data?.prepaymentSwaps ?? FALLBACK_RISK_SUMMARY.prepaymentSwaps,
    };
  } catch (error) {
    if (shouldFallback(error)) {
      return FALLBACK_RISK_SUMMARY;
    }
    throw error;
  }
}

export async function getRoiSeries(): Promise<number[]> {
  const { data } = await api.get("/investor-reports?series=roi", withOrg(1));
  return data?.roi ?? [1, 2, 1.5, 2.2, 2.8, 3.1];
}

function ensureCollections(value: Partial<CollectionsSummary> | null | undefined): CollectionsSummary {
  if (!value) {
    return { ...FALLBACK_COLLECTIONS_SUMMARY };
  }
  return {
    monthToDateCollected:
      typeof value.monthToDateCollected === "number"
        ? value.monthToDateCollected
        : FALLBACK_COLLECTIONS_SUMMARY.monthToDateCollected,
    outstanding:
      typeof value.outstanding === "number" ? value.outstanding : FALLBACK_COLLECTIONS_SUMMARY.outstanding,
    delinquentCount:
      typeof value.delinquentCount === "number"
        ? value.delinquentCount
        : FALLBACK_COLLECTIONS_SUMMARY.delinquentCount,
    promisesToPay:
      typeof value.promisesToPay === "number"
        ? value.promisesToPay
        : FALLBACK_COLLECTIONS_SUMMARY.promisesToPay,
    lastPaymentAt: value.lastPaymentAt ?? FALLBACK_COLLECTIONS_SUMMARY.lastPaymentAt,
  };
}

export async function getLenderOverview(): Promise<LenderOverview> {
  try {
    const { data } = await api.get("/dashboard-layout/overview", withOrg(1));
    const overview = data?.overview ?? data;
    if (!overview) {
      return FALLBACK_LENDER_OVERVIEW;
    }

    return {
      totals: {
        totalLoans: Number(overview?.totals?.totalLoans ?? FALLBACK_LENDER_OVERVIEW.totals.totalLoans),
        delinquencyRate:
          typeof overview?.totals?.delinquencyRate === "number"
            ? overview.totals.delinquencyRate
            : FALLBACK_LENDER_OVERVIEW.totals.delinquencyRate,
        avgInterestRate:
          typeof overview?.totals?.avgInterestRate === "number"
            ? overview.totals.avgInterestRate
            : FALLBACK_LENDER_OVERVIEW.totals.avgInterestRate,
        outstandingPrincipal:
          typeof overview?.totals?.outstandingPrincipal === "number"
            ? overview.totals.outstandingPrincipal
            : FALLBACK_LENDER_OVERVIEW.totals.outstandingPrincipal,
      },
      riskScore:
        typeof overview?.riskScore === "number" ? overview.riskScore : FALLBACK_LENDER_OVERVIEW.riskScore,
      collections: ensureCollections(overview?.collections),
    };
  } catch (error) {
    if (shouldFallback(error)) {
      return FALLBACK_LENDER_OVERVIEW;
    }
    console.error("Failed to load lender overview", error);
    return FALLBACK_LENDER_OVERVIEW;
  }
}

export async function getReportSummary(): Promise<ReportSummarySnapshot> {
  try {
    const { data } = await api.get("/reports", withOrg(1));
    if (!data) {
      return FALLBACK_REPORT_SUMMARY;
    }
    return {
      summary: {
        scheduled:
          typeof data?.summary?.scheduled === "number"
            ? data.summary.scheduled
            : FALLBACK_REPORT_SUMMARY.summary.scheduled,
        saved:
          typeof data?.summary?.saved === "number"
            ? data.summary.saved
            : FALLBACK_REPORT_SUMMARY.summary.saved,
        totalRuns:
          typeof data?.summary?.totalRuns === "number"
            ? data.summary.totalRuns
            : FALLBACK_REPORT_SUMMARY.summary.totalRuns,
        lastRunAt: data?.summary?.lastRunAt ?? FALLBACK_REPORT_SUMMARY.summary.lastRunAt,
      },
      collections: ensureCollections(data?.collections),
      recentReports: Array.isArray(data?.recentReports)
        ? data.recentReports
        : FALLBACK_REPORT_SUMMARY.recentReports,
    };
  } catch (error) {
    if (shouldFallback(error)) {
      return FALLBACK_REPORT_SUMMARY;
    }
    console.error("Failed to load report summary", error);
    return FALLBACK_REPORT_SUMMARY;
  }
}
