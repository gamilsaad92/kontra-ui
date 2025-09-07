import { api, withOrg } from "../lib/api";
import type { Application, DrawRequest } from "../lib/sdk/types";

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

export const listDrawRequests = async (): Promise<DrawRequest[]> => {
  try {
    return (await api.get("/draw-requests?limit=6", withOrg(1))).data as DrawRequest[];
  } catch (error) {
    console.error("Failed to list draw requests", error);
    return [];
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
