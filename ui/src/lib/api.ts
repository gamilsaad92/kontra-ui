import axios from "axios";
import { getSessionToken } from "./http";

function normalizeApiBase(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  return withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
}

export function resolveApiBase(): string {
  return (
    normalizeApiBase(import.meta.env?.VITE_API_BASE as string | undefined) ??
    normalizeApiBase(import.meta.env?.VITE_API_URL as string | undefined) ??
    "/api"
  );
}

const baseURL = resolveApiBase();

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
