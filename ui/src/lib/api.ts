import axios from "axios";
import { getSessionToken, shouldAttachOrgHeader } from "./http";

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

function isAbsoluteUrl(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

function combineUrls(base: string, relative?: string): string {
  if (!relative) {
    return base;
  }

  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedRelative = relative.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedRelative}`;
}

function resolveRequestUrl(url?: string, base?: string): string | undefined {
  if (url && isAbsoluteUrl(url)) {
    return url;
  }

  if (!base) {
    return url;
  }

  return combineUrls(base, url ?? "");
}

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use(async (config) => {
  const token = await getSessionToken();
  config.headers = config.headers ?? {};

  const targetUrl = resolveRequestUrl(config.url, config.baseURL ?? baseURL);
  if (shouldAttachOrgHeader(targetUrl) && !(config.headers as any)["X-Org-Id"]) {
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
