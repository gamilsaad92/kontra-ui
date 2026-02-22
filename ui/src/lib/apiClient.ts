import { getToken, redirectToSignIn } from "./authContext";
import { getOrgId, setOrgId } from "./orgContext";

type OrgContext = {
  orgId?: string;
  userId?: string;
};

let orgContext: OrgContext = {};

export function setOrgContext(ctx: OrgContext) {
 const normalizedOrgId = ctx?.orgId ? String(ctx.orgId) : undefined;
  orgContext = {
    ...ctx,
    orgId: normalizedOrgId,
  };
  setOrgId(normalizedOrgId ?? null);
}

type EnvRecord = Record<string, string | undefined>;

export type ApiRequestLogEntry = {
  id: string;
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  ok?: boolean;
  error?: string;
  timestamp: string;
};

export type ApiError = Error & {
  status?: number;
   code?: string;
  path?: string;
  requestId?: string | null;
  details?: unknown;
};

type ApiFetchOptions = {
  requireAuth?: boolean;
  throwOnError?: boolean;
};

const requestLog: ApiRequestLogEntry[] = [];
const listeners = new Set<(entry: ApiRequestLogEntry) => void>();

const logLimit = 50;
let baseFetch: typeof fetch | null = null;

const normalizeBaseUrl = (value?: string): string => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "").replace(/\/api$/, "");
};

const API_BASE_URL = normalizeBaseUrl((import.meta.env ?? ({} as EnvRecord)).VITE_API_BASE_URL);
const FORCE_RELATIVE_API = ((import.meta.env ?? ({} as EnvRecord)).VITE_FORCE_RELATIVE_API ?? "").toLowerCase() === "true";

const shouldUseRelativeApiPath = (): boolean => FORCE_RELATIVE_API;

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

const isDev = Boolean((import.meta.env ?? ({} as EnvRecord)).DEV);

const isAbsoluteUrl = (value: string) => /^([a-z][a-z\d+\-.]*:)?\/\//i.test(value);

const normalizePath = (path: string): string => {
  const trimmed = path.trim();
  if (!trimmed) return "/api";
  if (!trimmed.startsWith("/")) {
    return `/api/${trimmed}`;
  }
  if (!trimmed.startsWith("/api")) {
    return `/api${trimmed}`;
  }
  return trimmed;
};

const buildRequestUrl = (path: string): string => {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  const normalizedPath = normalizePath(path);
   if (shouldUseRelativeApiPath()) {
    return normalizedPath;
  }

  if (!API_BASE_URL) {
    return normalizedPath;
  }
  return `${API_BASE_URL}${normalizedPath}`;
};

const normalizeHeaders = (headers?: HeadersInit): Headers => {
  if (headers instanceof Headers) {
    return new Headers(headers);
  }
  return new Headers(headers ?? {});
};

const pushLogEntry = (entry: ApiRequestLogEntry) => {
  requestLog.push(entry);
  if (requestLog.length > logLimit) {
    requestLog.splice(0, requestLog.length - logLimit);
  }
  listeners.forEach((listener) => listener(entry));
};

export const subscribeApiLog = (listener: (entry: ApiRequestLogEntry) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getRequestLog = () => [...requestLog];

const ORGLESS_API_PREFIXES = ["/api/health", "/api/dev/", "/api/orgs", "/api/me"];

const requiresOrgForPath = (requestUrl: string): boolean => {
  try {
    const parsed = new URL(requestUrl, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    const path = parsed.pathname;
    if (!path.startsWith("/api")) return false;
    if (ORGLESS_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return false;
    return true;
  } catch {
    if (!requestUrl.startsWith("/api")) return false;
    return !ORGLESS_API_PREFIXES.some((prefix) => requestUrl === prefix || requestUrl.startsWith(`${prefix}/`));
  }
};

const emitBrowserEvent = (name: string, detail: unknown) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

const parseJsonSafe = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const buildError = (
  message: string,
  status: number | undefined,
  path: string,
  requestId: string | null,
 details?: unknown,
  code?: string
): ApiError => {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.path = path;
  error.requestId = requestId;
  error.details = details;
   error.code = code;
  return error;
};

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<Response> {
  const start = performance.now();
  const method = init.method?.toUpperCase() ?? (input instanceof Request ? input.method : "GET");
  const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const requestUrl = buildRequestUrl(rawUrl);
  const headers = normalizeHeaders(init.headers);

  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const orgId = orgContext.orgId ?? getOrgId();
  if (orgId) {
    const normalizedOrgId = String(orgId);
    headers.set("X-Org-Id", normalizedOrgId);
    headers.set("x-organization-id", normalizedOrgId);
  } else if (requiresOrgForPath(requestUrl)) {
    const orgError = buildError(`Organization context missing for request: ${requestUrl}`, 400, requestUrl, null, null, "ORG_CONTEXT_MISSING");
    emitBrowserEvent("api:error", orgError);
    throw orgError;
  }
  
  if (orgContext.userId) {
    headers.set("x-user-id", orgContext.userId);
  }

 const resolveToken = async (forceRefresh = false) => getToken({ forceRefresh });

    const clearOrgSelectionAndReauth = (apiError: ApiError) => {
    setOrgId(null);
    orgContext = { userId: orgContext.userId };
    emitBrowserEvent("api:unauthorized", { path: requestUrl, status: 401, reauthRequired: true });
    emitBrowserEvent("api:error", apiError);
    redirectToSignIn();
  };

  const performFetch = async (forceRefreshToken: boolean): Promise<Response> => {
    const requestHeaders = normalizeHeaders(headers);
    const token = await resolveToken(forceRefreshToken);

    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    } else {
      requestHeaders.delete("Authorization");
      if (options.requireAuth) {
        throw buildError("Not authenticated", 401, requestUrl, null, null, "AUTH_REQUIRED");
      }
    }

    const finalInit: RequestInit = {
      ...init,
      headers: requestHeaders,
      credentials: init.credentials ?? "omit",
    };

    const doFetch = baseFetch ?? fetch;
    return doFetch(requestUrl, finalInit);
  };

  const logEntry: ApiRequestLogEntry = {
    id: crypto.randomUUID(),
    method,
    url: requestUrl,
    timestamp: new Date().toISOString(),
  };
  pushLogEntry(logEntry);
  emitBrowserEvent("api:request", logEntry);

  if (isDev) {
    console.info(`[API] → ${method} ${requestUrl}`);
  }

  let response: Response;
  try {
   response = await performFetch(false);
    if (response.status === 401) {
      response = await performFetch(true);
      if (response.status === 401) {
        const data = await parseJsonSafe(response.clone());
        const record = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
        const message = typeof record?.message === "string"
          ? record.message
          : typeof record?.error === "string"
            ? record.error
            : "Session expired. Please sign in again.";
        const requestId = response.headers.get("x-request-id");
        const apiError = buildError(message, 401, requestUrl, requestId, data, "AUTH_INVALID");
        clearOrgSelectionAndReauth(apiError);
        if (options.throwOnError !== false) {
          throw apiError;
        }
      }
    }
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const message = error instanceof Error ? error.message : "Network error";
    const apiError = error instanceof Error && "status" in error
      ? (error as ApiError)
      : buildError(message, undefined, requestUrl, null, error);

    logEntry.durationMs = durationMs;
    logEntry.ok = false;
    logEntry.error = message;
 
    if ((apiError.status === 401 || apiError.code === "AUTH_REQUIRED") && options.requireAuth) {
      clearOrgSelectionAndReauth(apiError);
    } else {
      emitBrowserEvent("api:error", apiError);
    }

    if (isDev) {
      console.error(`[API] ✕ ${method} ${requestUrl} (${durationMs}ms)`, error);
    }
    if (options.throwOnError !== false || apiError.status === undefined) {
      throw apiError;
    }
    return new Response(JSON.stringify({ error: apiError.message }), { status: apiError.status ?? 500 });
  }

  const durationMs = Math.round(performance.now() - start);
  logEntry.status = response.status;
  logEntry.durationMs = durationMs;
  logEntry.ok = response.ok;

  if (isDev) {
    console.info(`[API] ← ${method} ${requestUrl} ${response.status} (${durationMs}ms)`);
  }

  if (!response.ok) {
    const data = await parseJsonSafe(response.clone());
   const record = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
    const message =
      typeof record?.message === "string"
        ? record.message
        : typeof record?.error === "string"
          ? record.error
          : response.statusText || "Request failed";
    const code = typeof record?.code === "string" ? record.code : undefined;
    const requestId = response.headers.get("x-request-id");
    const apiError = buildError(message, response.status, requestUrl, requestId, data, code);
    logEntry.error = message;
    emitBrowserEvent("api:error", apiError);

    if (response.status === 401) {
      emitBrowserEvent("api:unauthorized", { path: requestUrl, status: response.status });
    }

    if (response.status === 403) {
      emitBrowserEvent("api:forbidden", { path: requestUrl, status: response.status, message: "Insufficient permissions" });
    }

    if (response.status === 404 || response.status === 501) {
      console.warn(`[API] Endpoint missing: ${requestUrl} (${response.status})`);
      emitBrowserEvent("api:endpoint-missing", { path: requestUrl, status: response.status });
    }

    if (options.throwOnError !== false) {
      throw apiError;
    }
  }

  return response;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<T> {
  const requestInit: RequestInit = { ...init, method };
  if (body !== undefined) {
    if (body instanceof FormData) {
      requestInit.body = body;
      if (requestInit.headers) {
        const headers = normalizeHeaders(requestInit.headers);
        headers.delete("Content-Type");
        requestInit.headers = headers;
      }
    } else {
      requestInit.body = JSON.stringify(body);
    }
  }

  const response = await apiFetch(path, requestInit, options);
    if (response.status === 204) {
    return undefined as T;
  }
  return (await parseJsonSafe(response)) as T;
}

type ApiRequestConfig = RequestInit & {
  params?: Record<string, string | number | boolean | undefined | null>;
  requireAuth?: boolean;
  baseURL?: string;
};

const withBaseUrl = (path: string, baseURL?: string) => {
  if (!baseURL) return path;
  const trimmedBase = baseURL.trim().replace(/\/+$/, "");
  if (!trimmedBase) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseHasApi = trimmedBase.endsWith("/api");
  if (baseHasApi && normalizedPath.startsWith("/api")) {
    return `${trimmedBase}${normalizedPath.replace(/^\/api/, "")}`;
  }
  if (!baseHasApi && !normalizedPath.startsWith("/api")) {
    return `${trimmedBase}/api${normalizedPath}`;
  }
  return `${trimmedBase}${normalizedPath}`;
};

const withParams = (path: string, params?: ApiRequestConfig["params"]) => {
  if (!params) return path;
  const requestUrl = buildRequestUrl(path);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const url = isAbsoluteUrl(requestUrl)
    ? new URL(requestUrl)
    : new URL(requestUrl, origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

export const api = {
  get: async <T = unknown>(path: string, config: ApiRequestConfig = {}) => {
    const { params, requireAuth, baseURL, ...init } = config;
    const basePath = withBaseUrl(path, baseURL);
    const url = params ? withParams(basePath, params) : basePath;
    const data = await apiRequest<T>("GET", url, undefined, init, { requireAuth });
    return { data };
  },
  post: async <T = unknown>(
    path: string,
    body?: unknown,
    config: ApiRequestConfig = {}
  ) => {
    const { params, requireAuth, baseURL, ...init } = config;
    const basePath = withBaseUrl(path, baseURL);
    const url = params ? withParams(basePath, params) : basePath;
    const data = await apiRequest<T>("POST", url, body, init, { requireAuth });
    return { data };
  },
  put: async <T = unknown>(
    path: string,
    body?: unknown,
    config: ApiRequestConfig = {}
  ) => {
    const { params, requireAuth, baseURL, ...init } = config;
    const basePath = withBaseUrl(path, baseURL);
    const url = params ? withParams(basePath, params) : basePath;
    const data = await apiRequest<T>("PUT", url, body, init, { requireAuth });
    return { data };
  },
  patch: async <T = unknown>(
    path: string,
    body?: unknown,
    config: ApiRequestConfig = {}
  ) => {
    const { params, requireAuth, baseURL, ...init } = config;
    const basePath = withBaseUrl(path, baseURL);
    const url = params ? withParams(basePath, params) : basePath;
    const data = await apiRequest<T>("PATCH", url, body, init, { requireAuth });
    return { data };
  },
  delete: async <T = unknown>(path: string, config: ApiRequestConfig = {}) => {
    const { params, requireAuth, baseURL, ...init } = config;
    const basePath = withBaseUrl(path, baseURL);
    const url = params ? withParams(basePath, params) : basePath;
    const data = await apiRequest<T>("DELETE", url, undefined, init, { requireAuth });
    return { data };
  },
};

let apiFetchInstalled = false;

export function installApiFetchInterceptor(): void {
  if (apiFetchInstalled) return;
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;

  const originalFetch = window.fetch.bind(window);
  baseFetch = originalFetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      return await apiFetch(input, init ?? {}, { throwOnError: false });
    } catch (error) {
      if (isDev) {
        console.error("[API] Fetch failed", error);
      }
      throw error;
    }
  };

  apiFetchInstalled = true;

  if (isDev) {
    console.info("[API] Global fetch interceptor installed.", { baseUrl: API_BASE_URL });
  }
}
