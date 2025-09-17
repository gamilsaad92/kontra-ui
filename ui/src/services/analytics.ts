import axios from "axios";
import { api, withOrg } from "../lib/api";

export async function getPortfolioSnapshot() {
  try {
    const { data } = await api.post(
      "/portfolio-summary",
      { period: "MTD" },
      withOrg(1)
    );
    return {
      delinqPct: data?.delinquency_pct ?? 1.24,
      points: data?.spark ?? [3, 5, 4, 6, 7, 8],
    };
  } catch (err) {
      if (axios.isAxiosError(err)) {
      if (err.response?.status === 404) {
        return { delinqPct: 1.24, points: [3, 5, 4, 6, 7, 8] };
      }
      if (err.response?.status === 401) {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return {
          delinqPct: 1.24,
          points: [3, 5, 4, 6, 7, 8],
          message: "Authentication required",
        };
      }
    }
    throw err;
 }
}

export async function getRiskSummary() {
  try {
    const { data } = await api.get("/risk/summary", withOrg(1));
    return {
      buckets:
        data?.buckets ?? [
          { label: "Low", value: 58 },
          { label: "Med", value: 22 },
          { label: "High", value: 14 },
        ],
      stress:
        data?.stress ?? {
          scenario: "rate+200bps",
          buckets: [
            { label: "Low", value: 48 },
            { label: "Med", value: 30 },
            { label: "High", value: 20 },
          ],
        },
      flags: data?.flags ?? [],
      penalties: data?.penalties ?? [],
          occupancyDerivatives:
        data?.occupancyDerivatives ?? [
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
      maintenanceSwaps:
        data?.maintenanceSwaps ?? [
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
      prepaymentSwaps:
        data?.prepaymentSwaps ?? [
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
  } catch (err) {
    return {
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
  }
}

export async function getRoiSeries() {
  const { data } = await api.get("/investor-reports?series=roi", withOrg(1));
  return data?.roi ?? [1, 2, 1.5, 2.2, 2.8, 3.1];
}
