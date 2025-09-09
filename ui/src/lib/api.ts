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
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any)["Authorization"] = `Bearer ${token}`;
  }
  return config;
});
export function withOrg(orgId?: number) {
  return { headers: { "X-Org-Id": String(orgId ?? 1) } };
}
