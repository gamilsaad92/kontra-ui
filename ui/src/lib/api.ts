import { api, getApiBaseUrl } from "./apiClient";

function normalizeApiBase(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\/+$/, "").replace(/\/api$/, "");
}

export function resolveApiBase(): string {
return normalizeApiBase(import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? getApiBaseUrl() ?? "";
}

export function withOrg(orgId?: number) {
  return { headers: { "X-Org-Id": String(orgId ?? 1) } };
}

export { api };
