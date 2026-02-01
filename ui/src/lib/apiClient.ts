import { getAuthToken } from "./authToken";

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
  details?: unknown
): ApiError => {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.path = path;
  error.requestId = requestId;
  error.details = details;
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

  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = await getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (options.requireAuth) {
    const error = buildError("Not authenticated", 401, requestUrl, null);
    emitBrowserEvent("api:error", error);
    throw error;
  }

  const finalInit: RequestInit = {
    ...init,
    headers,
    credentials: init.credentials ?? "omit",
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
    const doFetch = baseFetch ?? fetch;
    response = await doFetch(requestUrl, finalInit);
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const message = error instanceof Error ? error.message : "Network error";
    const apiError = buildError(message, undefined, requestUrl, null, error);
    logEntry.durationMs = durationMs;
    logEntry.ok = false;
    logEntry.error = message;
    emitBrowserEvent("api:error", apiError);
    if (isDev) {
      console.error(`[API] ✕ ${method} ${requestUrl} (${durationMs}ms)`, error);
    }
    throw apiError;
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
    const message =
      typeof data === "object" && data !== null && "error" in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).error)
        : response.statusText;
    const requestId = response.headers.get("x-request-id");
    const apiError = buildError(message, response.status, requestUrl, requestId, data);
    logEntry.error = message;
    emitBrowserEvent("api:error", apiError);
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
