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
  const env = import.meta.env as { VITE_API_BASE_URL?: string; VITE_API_URL?: string } | undefined;
  return (
    normalizeApiBase(env?.VITE_API_BASE_URL ?? env?.VITE_API_URL) ??
    getApiBaseUrl() ??
    ""
  );
}

export function withOrg(orgId?: number) {
return { headers: { "x-organization-id": String(orgId ?? 1) } };
}

export { api };
