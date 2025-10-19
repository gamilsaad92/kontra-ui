import axios from "axios";
import { api, withOrg } from "../lib/api";

type SparkPoint = number;

type RiskBucket = {
  label: string;
  value: number;
};

type StressScenario = {
  scenario: string;
  buckets: RiskBucket[];
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

type RiskPenalty = {
  id: string;
  defaultInterest: number;
  penalty: number;
};

type RiskFlag = {
  type: string;
  id: string;
  due: string;
};

type PortfolioSnapshot = {
  delinqPct: number;
  points: SparkPoint[];
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

function shouldRedirectToLogin(status?: number): boolean {
  return status === 401 && typeof window !== "undefined";
}

function isRecoverableStatus(status?: number): status is number {
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
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (shouldRedirectToLogin(status)) {
        window.location.href = "/login";
      }

      if (isRecoverableStatus(status)) {
        return FALLBACK_PORTFOLIO;
      }
    }

    console.warn("Failed to load portfolio snapshot", error);
    return FALLBACK_PORTFOLIO;
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
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (isRecoverableStatus(status)) {
        return FALLBACK_RISK_SUMMARY;
      }
    }

    console.warn("Failed to load risk summary", error);
    return FALLBACK_RISK_SUMMARY;
  }
}

export async function getRoiSeries(): Promise<number[]> {
  const { data } = await api.get("/investor-reports?series=roi", withOrg(1));
  return data?.roi ?? [1, 2, 1.5, 2.2, 2.8, 3.1];
}
