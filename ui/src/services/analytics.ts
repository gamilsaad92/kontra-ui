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
    };
  }
}

export async function getRoiSeries() {
  const { data } = await api.get("/investor-reports?series=roi", withOrg(1));
  return data?.roi ?? [1, 2, 1.5, 2.2, 2.8, 3.1];
}
