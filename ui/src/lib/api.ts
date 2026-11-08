import { api, getApiBaseUrl } from "./apiClient";

export function resolveApiBase(): string {
  return getApiBaseUrl();
}

export function withOrg(orgId?: number) {
return { headers: { "x-organization-id": String(orgId ?? 1) } };
}

export { api };
