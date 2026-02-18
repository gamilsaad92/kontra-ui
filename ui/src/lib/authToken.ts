import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

type EnvRecord = Record<string, string | undefined>;

const DEFAULT_DEV_ACCESS_TOKEN = "dev-token-change-me";
const SHOULD_LOG_AUTH_WARNINGS = Boolean(
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV,
);

function resolveDevAccessToken(): string | null {
  const env = (import.meta.env ?? {}) as EnvRecord & {
    VITE_DEV_ACCESS_TOKEN?: string;
    DEV_ACCESS_TOKEN?: string;
    DEV?: boolean;
  };

  const fromEnv = env.VITE_DEV_ACCESS_TOKEN ?? env.DEV_ACCESS_TOKEN;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }

  if (!env.DEV) {
    return null;
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

export async function getAuthToken(): Promise<string | null> {
  if (isSupabaseConfigured && supabase?.auth) {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token ?? null;
    } catch (error) {
    if (SHOULD_LOG_AUTH_WARNINGS) {
        console.warn("Auth session lookup failed.", error);
      }
    }
  }

  const token = resolveDevAccessToken();
  if (!token && SHOULD_LOG_AUTH_WARNINGS && typeof console !== "undefined") {
    console.warn("No auth token found. Requests will continue unauthenticated.");
  }

  return token;
}

type GetAuthTokenOptions = {
  forceRefresh?: boolean;
};

export async function getFreshAuthToken(options: GetAuthTokenOptions = {}): Promise<string | null> {
  if (isSupabaseConfigured && supabase?.auth) {
    try {
      if (options.forceRefresh) {
        await supabase.auth.refreshSession();
      }
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token ?? null;
    } catch (error) {
      if (SHOULD_LOG_AUTH_WARNINGS) {
        console.warn("Auth session lookup failed.", error);
      }
    }
  }

  const token = resolveDevAccessToken();
  if (!token && SHOULD_LOG_AUTH_WARNINGS && typeof console !== "undefined") {
    console.warn("No auth token found. Requests will continue unauthenticated.");
  }

  return token;
}

export function redirectToSignIn(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/sign-in") return;
  window.location.assign("/sign-in");
}
