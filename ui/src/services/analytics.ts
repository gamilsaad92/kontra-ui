import { api, withOrg } from "../lib/api";

export async function getPortfolioSnapshot() {
  const { data } = await api.post(
    "/portfolio-summary",
    { period: "MTD" },
    withOrg(1)
  );
  return {
    delinqPct: data?.delinquency_pct ?? 1.24,
    points: data?.spark ?? [3, 5, 4, 6, 7, 8],
  };
}

export async function getRiskSummary() {
  const { data } = await api.get("/risk/run", withOrg(1)); // or a cached /risk/summary you expose
  return {
    buckets:
      data?.buckets ?? [
        { label: "Low", value: 58 },
        { label: "Med", value: 22 },
        { label: "High", value: 14 },
        { label: "Severe", value: 6 },
      ],
  };
}

export async function getRoiSeries() {
  const { data } = await api.get("/investor-reports?series=roi", withOrg(1));
  return data?.roi ?? [1, 2, 1.5, 2.2, 2.8, 3.1];
}
