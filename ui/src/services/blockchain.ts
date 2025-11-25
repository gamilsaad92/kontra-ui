import { api } from "../lib/api";

export type OnchainPosition = {
  loanId: string;
  borrower: string;
  property: string;
  notional: number;
  ownership: number;
  coupon: number;
  status: string;
  nextPayout?: string | null;
};

export type OnchainTransaction = {
  id: string;
  wallet: string;
  txHash: string;
  chainId: number;
  action: string;
  notional: number;
  loanId?: string | null;
  status: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type OnchainCashflow = {
  id: string;
  loanId: string;
  amount: number;
  distributedAt: string;
  txHash?: string | null;
};

export type ContractsResponse = {
  network: { name: string; chainId: number; rpcUrl?: string; explorer?: string };
  loanToken: { address: string; description: string };
  participationToken: { address: string; description: string };
  cashFlowSplitter: { address: string; description: string };
  deploymentNotes?: string;
};

export type OnchainOverview = {
  wallet?: string | null;
  totals: { exposure: number; averageYield: number; nextPayout?: string | null };
  positions: OnchainPosition[];
  transactions: OnchainTransaction[];
  cashflows: OnchainCashflow[];
  contracts: ContractsResponse;
};

const FALLBACK_OVERVIEW: OnchainOverview = {
  wallet: null,
  totals: { exposure: 7900000, averageYield: 0.071, nextPayout: "2024-08-15" },
  positions: [
    {
      loanId: "LN-4219",
      borrower: "Seaport Ventures",
      property: "Pier 9 Offices",
      notional: 3500000,
      ownership: 0.22,
      coupon: 0.073,
      status: "current",
      nextPayout: "2024-08-15",
    },
    {
      loanId: "LN-4177",
      borrower: "Sunbelt Capital",
      property: "Sunbelt Multifamily",
      notional: 2800000,
      ownership: 0.16,
      coupon: 0.071,
      status: "watchlist",
      nextPayout: "2024-08-20",
    },
    {
      loanId: "LN-4255",
      borrower: "Frontier Development",
      property: "Frontier Industrial",
      notional: 1600000,
      ownership: 0.11,
      coupon: 0.066,
      status: "current",
      nextPayout: "2024-08-30",
    },
  ],
  transactions: [
    {
      id: "tx-fallback-1",
      wallet: "0xa5c4...1d9b",
      txHash: "0xabc001",
      chainId: 84532,
      action: "mintParticipation",
      notional: 250000,
      loanId: "LN-4219",
      status: "confirmed",
      timestamp: "2024-07-01T12:00:00Z",
    },
  ],
  cashflows: [
    {
      id: "cf-fallback-1",
      loanId: "LN-4219",
      amount: 18500,
      distributedAt: "2024-07-15T12:00:00Z",
      txHash: "0xabc002",
    },
  ],
  contracts: {
    network: { name: "Base Sepolia", chainId: 84532, rpcUrl: "https://sepolia.base.org" },
    loanToken: { address: "0x8a91384f2b0Ffd2aA1a4D6f46E1A1eF5C4F1C0Aa", description: "ERC-721 whole loan claims" },
    participationToken: {
      address: "0x7D9dC23a580c2c5Bc9945848fc5B2aB3b8E312D6",
      description: "ERC-20 fractional participations",
    },
    cashFlowSplitter: {
      address: "0x3C3b87A1f5d03d3f3a3D8C1C54B6B1436cAa8e4b",
      description: "Distributes borrower payments pro-rata to token holders",
    },
  },
};

function normalizeOverview(payload: any): OnchainOverview {
  if (!payload) return FALLBACK_OVERVIEW;
  return {
    wallet: payload.wallet ?? null,
    totals: {
      exposure: Number(payload.totals?.exposure ?? FALLBACK_OVERVIEW.totals.exposure),
      averageYield: Number(payload.totals?.averageYield ?? FALLBACK_OVERVIEW.totals.averageYield),
      nextPayout: payload.totals?.nextPayout ?? FALLBACK_OVERVIEW.totals.nextPayout,
    },
    positions: Array.isArray(payload.positions) ? payload.positions : FALLBACK_OVERVIEW.positions,
    transactions: Array.isArray(payload.transactions) ? payload.transactions : FALLBACK_OVERVIEW.transactions,
    cashflows: Array.isArray(payload.cashflows) ? payload.cashflows : FALLBACK_OVERVIEW.cashflows,
    contracts: payload.contracts ?? FALLBACK_OVERVIEW.contracts,
  };
}

export async function fetchOnchainOverview(wallet?: string | null): Promise<OnchainOverview> {
  try {
    const { data } = await api.get("/blockchain/overview", { params: { wallet } });
    return normalizeOverview(data);
  } catch (error) {
    console.warn("Falling back to sample on-chain overview", error);
    return FALLBACK_OVERVIEW;
  }
}

export async function recordOnchainTransaction(payload: Partial<OnchainTransaction>) {
  const { data } = await api.post("/blockchain/transactions", payload);
  return data?.transaction as OnchainTransaction;
}

export async function fetchContracts(): Promise<ContractsResponse> {
  try {
    const { data } = await api.get("/blockchain/contracts");
    return data as ContractsResponse;
  } catch (error) {
    console.warn("Unable to load contracts from API", error);
    return FALLBACK_OVERVIEW.contracts;
  }
}
