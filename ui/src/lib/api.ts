import axios from "axios";
import { getSessionToken } from "./http";

const base = import.meta.env.VITE_API_URL ?? "";
const baseURL = base.endsWith("/api") ? base : `${base}/api`;
export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use(async (config) => {
  const token = await getSessionToken();
    config.headers = config.headers ?? {};

  if (!(config.headers as any)["X-Org-Id"]) {
    (config.headers as any)["X-Org-Id"] = "1";
  }

  if (token) {
    (config.headers as any)["Authorization"] = `Bearer ${token}`;
  }
  return config;
});
export function withOrg(orgId?: number) {
  return { headers: { "X-Org-Id": String(orgId ?? 1) } };
}
