import { api, withOrg } from "../lib/api";
export const listPipeline = async () =>
  (await api.get("/applications?limit=6", withOrg(1))).data;

export const listDrawRequests = async () => {
  if (!import.meta.env.VITE_API_URL) {
    return [
      { id: 1, amount: 250000, status: "pending" },
      { id: 2, amount: 500000, status: "approved" },
    ];
  }
  return (await api.get("/draws?limit=6", withOrg(1))).data;
};

export const sendPayoffQuote = async (loanId: number) =>
  (await api.post(`/loans/${loanId}/payoff-quote`, {}, withOrg(1))).data;
