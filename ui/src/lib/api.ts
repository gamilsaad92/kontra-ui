import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: { "Content-Type": "application/json" }
});
export function withOrg(orgId?: number){ return { headers: { "X-Org-Id": String(orgId ?? 1) } }; }
