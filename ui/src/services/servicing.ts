import { api, withOrg } from "../lib/api";
export const listPipeline = async () =>
  (await api.get("/applications?limit=6", withOrg(1))).data;

export const listDrawRequests = async () =>
  (await api.get("/draws?limit=6", withOrg(1))).data;

export const sendPayoffQuote = async (loanId: number) =>
  (await api.post(`/loans/${loanId}/payoff-quote`, {}, withOrg(1))).data;
