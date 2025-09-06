import axios from "axios";

const base = import.meta.env.VITE_API_URL ?? "";
const baseURL = base.endsWith("/api") ? base : `${base}/api`;
export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" }
});
export function withOrg(orgId?: number) {
  return { headers: { "X-Org-Id": String(orgId ?? 1) } };
}
