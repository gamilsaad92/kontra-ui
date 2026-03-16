import type { ApiError } from "../lib/apiClient";
import { apiRequest } from "../lib/apiClient";

export interface AssetSummary {
  id: string | number;
  name?: string;
  address?: string;
  status?: string;
  predicted_risk?: string;
  value?: string;
  price_suggestion?: string;
  blurb?: string;
  published?: boolean;
  [key: string]: unknown;
}

type AssetsResponse = { assets?: AssetSummary[] } | undefined;

const FALLBACK_TROUBLED_ASSETS: AssetSummary[] = [
  {
    id: "AST-2104",
    name: "Lakeview Apartments",
    address: "229 Lakeview Dr, Austin, TX",
    status: "troubled",
    predicted_risk: "High",
    value: "$12.5M",
  },
  {
    id: "AST-2081",
    name: "Harbor Logistics Park",
    address: "418 Wharf Rd, Oakland, CA",
    status: "troubled",
    predicted_risk: "Severe",
    value: "$27.8M",
  },
  {
    id: "AST-1999",
    name: "Midtown Creative Offices",
    address: "88 Mercer St, Jersey City, NJ",
    status: "watch",
    predicted_risk: "Elevated",
    value: "$18.4M",
  },
];

const FALLBACK_WATCHLIST_ASSETS: AssetSummary[] = [
  {
    id: "AST-3045",
    address: "1442 West Elm St, Chicago, IL",
    predicted_risk: "Moderate",
    value: "$9.2M",
  },
  {
    id: "AST-2880",
    address: "975 Riverside Ave, Jacksonville, FL",
    predicted_risk: "High",
    value: "$6.8M",
  },
  {
    id: "AST-2722",
    address: "510 Market St, Philadelphia, PA",
    predicted_risk: "Elevated",
    value: "$11.1M",
  },
];

const FALLBACK_REVIVED_ASSETS: AssetSummary[] = [
  {
    id: "AST-4012",
    address: "22 Harborfront Way, Seattle, WA",
    status: "revived",
    price_suggestion: "$7.4M",
    blurb: "Waterfront flex space repositioned for creative tenants.",
    published: true,
  },
  {
    id: "AST-3985",
    address: "840 Juniper Ave, Boulder, CO",
    status: "revived",
    price_suggestion: "$4.9M",
    blurb: "Energy-efficient retrofit complete; ready for market.",
    published: false,
  },
  {
    id: "AST-3894",
    address: "3100 Coastal Hwy, Miami, FL",
    status: "revived",
    price_suggestion: "$15.6M",
    blurb: "Stabilized hospitality asset with refreshed ADR growth.",
    published: true,
  },
];

const RECOVERABLE_STATUSES = new Set([401, 403, 404, 429]);

function isRecoverable(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as ApiError).status === "number" &&
    RECOVERABLE_STATUSES.has((error as ApiError).status)
  );
}

function normalizeAssets(response: AssetsResponse, fallback: AssetSummary[]): AssetSummary[] {
  if (response && Array.isArray(response.assets) && response.assets.length > 0) {
    return response.assets;
  }
  return fallback;
}

export async function fetchTroubledAssets(): Promise<AssetSummary[]> {
  try {
   const data = await apiRequest<AssetsResponse>("GET", "/assets/troubled");
    return normalizeAssets(data, FALLBACK_TROUBLED_ASSETS);
  } catch (error) {
    if (isRecoverable(error)) {
      return FALLBACK_TROUBLED_ASSETS;
    }
    throw error;
  }
}

export async function fetchWatchlistAssets(): Promise<AssetSummary[]> {
  try {
    const data = await apiRequest<AssetsResponse>("GET", "/assets/watchlist");
    return normalizeAssets(data, FALLBACK_WATCHLIST_ASSETS);
  } catch (error) {
    if (isRecoverable(error)) {
      return FALLBACK_WATCHLIST_ASSETS;
    }
    throw error;
  }
}

export async function fetchRevivedAssets(): Promise<AssetSummary[]> {
  try {
   const data = await apiRequest<AssetsResponse>("GET", "/assets/revived");
    const assets = normalizeAssets(data, FALLBACK_REVIVED_ASSETS);
    return assets.map((asset) => ({
      ...asset,
      published: asset.published ?? false,
    }));
  } catch (error) {
    if (isRecoverable(error)) {
      return FALLBACK_REVIVED_ASSETS;
    }
    throw error;
  }
}

export async function reviveAsset(assetId: string | number): Promise<AssetSummary> {
  try {
 const data = await apiRequest<{ asset?: AssetSummary }>("POST", `/assets/${assetId}/revive`);
    return data?.asset ?? { id: assetId, status: "revived" };
  } catch (error) {
    if (isRecoverable(error)) {
      return { id: assetId, status: "revived" };
    }
    throw error;
  }
}

export async function publishAssetListing(
  assetId: string | number,
  publish: boolean
): Promise<AssetSummary> {
  try {
     const data = await apiRequest<{ asset?: AssetSummary }>(
      "POST",
      `/assets/${assetId}/publish`,
      { publish }
    );
    return data?.asset ?? { id: assetId, published: publish };
  } catch (error) {
    if (isRecoverable(error)) {
      return { id: assetId, published: publish };
    }
    throw error;
  }
}
