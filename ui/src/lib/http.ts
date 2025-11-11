import { supabase } from "./supabaseClient.js";

type EnvRecord = Record<string, string | undefined>;

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

function resolveBaseUrl(): string {
  const env = (import.meta.env ?? {}) as EnvRecord;
  const configured =
    normalizeApiBase(env.VITE_API_BASE) ?? normalizeApiBase(env.VITE_API_URL);

  if (configured) {
    return configured;
  }

  return "/api";
}

const BASE_URL = resolveBaseUrl();

function resolveDefaultOrgId(): string {
  const env = (import.meta.env ?? {}) as EnvRecord & {
    VITE_DEV_ORG_ID?: string;
    DEV_ORG_ID?: string;
  };

  const fromEnv = env.VITE_DEV_ORG_ID ?? env.DEV_ORG_ID;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }

  if (
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    (process.env.VITE_DEV_ORG_ID || process.env.DEV_ORG_ID)
  ) {
    const raw = (process.env.VITE_DEV_ORG_ID || process.env.DEV_ORG_ID || "").trim();
    if (raw) {
      return raw;
    }
  }

  const globalValue =
    (typeof globalThis !== "undefined" &&
      typeof (globalThis as Record<string, unknown>).__DEV_ORG_ID__ === "string"
      ? ((globalThis as Record<string, unknown>).__DEV_ORG_ID__ as string)
      : null) ?? null;

  if (globalValue && globalValue.trim()) {
    return globalValue.trim();
  }

  return "1";
}

const DEFAULT_ORG_ID = resolveDefaultOrgId();

const DEFAULT_DEV_ACCESS_TOKEN = "dev-token-change-me";

function resolveDevAccessToken(): string | null {
  const env = (import.meta.env ?? {}) as EnvRecord & {
    VITE_DEV_ACCESS_TOKEN?: string;
    DEV_ACCESS_TOKEN?: string;
  };

  const fromEnv = env.VITE_DEV_ACCESS_TOKEN ?? env.DEV_ACCESS_TOKEN;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }

  if (
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    (process.env.VITE_DEV_ACCESS_TOKEN || process.env.DEV_ACCESS_TOKEN)
  ) {
    const raw = (process.env.VITE_DEV_ACCESS_TOKEN || process.env.DEV_ACCESS_TOKEN || "").trim();
    if (raw) {
      return raw;
    }
  }

  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as Record<string, unknown>).__DEV_ACCESS_TOKEN__ === "string"
  ) {
    const token = (globalThis as Record<string, unknown>).__DEV_ACCESS_TOKEN__ as string;
    if (token.trim()) {
      return token.trim();
    }
  }

    if (DEFAULT_DEV_ACCESS_TOKEN.trim()) {
    return DEFAULT_DEV_ACCESS_TOKEN.trim();
  }

  return null;
}

let retrievingSessionToken = false;
let hasLoggedMissingDevTokenWarning = false;

function isRetrievingSessionToken(): boolean {
  return retrievingSessionToken;
}

function resolveApiBaseOrigin(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return new URL(BASE_URL, window.location.origin).origin;
  } catch {
    return undefined;
  }
}

export function shouldAttachOrgHeader(targetUrl?: string): boolean {
  if (!targetUrl) {
    return true;
  }

  if (typeof window === "undefined") {
    return true;
  }

  const trustedOrigins = new Set<string>([window.location.origin]);
  const apiBaseOrigin = resolveApiBaseOrigin();
  if (apiBaseOrigin) {
    trustedOrigins.add(apiBaseOrigin);
  }

  try {
    const absolute = targetUrl.startsWith("http://") || targetUrl.startsWith("https://")
      ? new URL(targetUrl)
      : new URL(targetUrl, window.location.origin);
    return trustedOrigins.has(absolute.origin);
  } catch {
    return true;
  }
}

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export async function getSessionToken(): Promise<string | null> {
  let token: string | null = null;
  try {
    token = typeof localStorage !== "undefined" ? localStorage.getItem("sessionToken") : null;
  } catch {
    token = null;
  }

  if (!token && supabase?.auth) {
    try {
      retrievingSessionToken = true;
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token ?? null;
    } catch {
      token = null;
    } finally {
      retrievingSessionToken = false;
    }
  }

  if (!token) {
    const fallbackToken = resolveDevAccessToken();
    if (fallbackToken) {
      return fallbackToken;
    }
    
    if (!hasLoggedMissingDevTokenWarning && typeof console !== "undefined") {
      hasLoggedMissingDevTokenWarning = true;
      console.warn(
        "No session token found. Configure matching VITE_DEV_ACCESS_TOKEN and DEV_ACCESS_TOKEN values for local development."
      );
    }
  }

  return token;
}

function isFetchDebugEnabled(): boolean {
  if (typeof window !== "undefined" && "__FETCH_DEBUG__" in window) {
    return Boolean((window as Record<string, unknown>).__FETCH_DEBUG__);
  }

  const env = (import.meta.env ?? {}) as EnvRecord & { DEV?: boolean };
  return Boolean(env.DEV);
}

function logFetchDebug(message: string): void {
  if (!isFetchDebugEnabled() || typeof console === "undefined") {
    return;
  }

  console.debug(`[fetch-debug] ${message}`);
}

function sanitizeRequestInit(init: RequestInit = {}): RequestInit {
  const sanitized: RequestInit = { ...init };
  if (sanitized.mode === "no-cors") {
    if (isFetchDebugEnabled() && typeof console !== "undefined") {
      console.warn("[fetch-debug] Removed unsupported fetch mode \"no-cors\" to avoid opaque responses.");
    }
    delete (sanitized as Record<string, unknown>).mode;
  }
  return sanitized;
}

function normalizeHeaders(headers?: HeadersInit): Headers {
  if (headers instanceof Headers) return new Headers(headers);
  return new Headers(headers ?? {});
}

function extractRequestUrl(input: RequestInfo | URL): string | undefined {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.url;
  }

  return undefined;
}

function resolveRequestMethodFromInit(init?: RequestInit): string {
  if (init?.method) {
    return String(init.method).toUpperCase();
  }
  return "GET";
}

function resolveRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return String(init.method).toUpperCase();
  }

  if (typeof Request !== "undefined" && input instanceof Request && input.method) {
    return input.method.toUpperCase();
  }

  return "GET";
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const sanitizedInit = sanitizeRequestInit(init);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const requestUrl = `${BASE_URL}${normalizedPath}`;

  const headers = normalizeHeaders(sanitizedInit.headers);

  if (!headers.has("Content-Type") && sanitizedInit.body !== undefined && !(sanitizedInit.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("X-Org-Id") && shouldAttachOrgHeader(requestUrl)) {
   headers.set("X-Org-Id", DEFAULT_ORG_ID);
  }

  const token = await getSessionToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

 const finalInit: RequestInit = {
    ...sanitizedInit,
    headers,
    credentials: sanitizedInit.credentials ?? "same-origin"
 };

  const method = resolveRequestMethodFromInit(finalInit);
  logFetchDebug(`→ ${method} ${requestUrl}`);

  const res = await fetch(requestUrl, finalInit);

  logFetchDebug(`← ${method} ${requestUrl} ${res.status}${res.ok ? "" : " (error)"}`);

  const text = await res.text();
  let data: any = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      message: data?.message || res.statusText,
      details: data?.details || data
    };
    throw err;
  }

  return data as T;
}

export function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: any,
  init: RequestInit = {}
): Promise<T> {
  const opts: RequestInit = { ...init, method };

  if (body !== undefined) {
    if (body instanceof FormData) {
      opts.body = body;
      const h = { ...(opts.headers as Record<string, string> | undefined) };
      delete h["Content-Type"];
      opts.headers = h;
    } else {
      opts.body = JSON.stringify(body);
    }
  }

  return apiFetch<T>(path, opts);
}

export { apiFetch };

let authFetchInstalled = false;

export function installAuthFetchInterceptor(): void {
  if (authFetchInstalled) return;
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const sanitizedInit = sanitizeRequestInit(init);

    if (isRetrievingSessionToken()) {
    return originalFetch(input as any, sanitizedInit);
    }

    const headers = normalizeHeaders(sanitizedInit.headers);

    const targetUrl = extractRequestUrl(input);
    if (!headers.has("X-Org-Id") && shouldAttachOrgHeader(targetUrl)) {
     headers.set("X-Org-Id", DEFAULT_ORG_ID);
    }

    if (!headers.has("Authorization")) {
      const token = await getSessionToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }

     const finalInit: RequestInit = {
      ...sanitizedInit,
      headers,
     credentials: sanitizedInit.credentials ?? "same-origin"
    };

    const method = resolveRequestMethod(input, finalInit);
    logFetchDebug(`→ ${method} ${targetUrl ?? "[unknown-url]"}`);

    const response = await originalFetch(input as any, finalInit);

    logFetchDebug(`← ${method} ${targetUrl ?? "[unknown-url]"} ${response.status}${response.ok ? "" : " (error)"}`);

    return response;
  };

  authFetchInstalled = true;
}
