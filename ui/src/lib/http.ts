import { supabase } from "./supabaseClient.js";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

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
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token ?? null;
    } catch {
      token = null;
    }
  }

    return token;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined)
  };

  const token = await getSessionToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

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
