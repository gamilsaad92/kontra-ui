import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

type EnvRecord = Record<string, string | undefined>;

const SHOULD_LOG_AUTH_WARNINGS = Boolean(
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV,
);

function resolveDevAccessToken(): string | null {
  if (typeof import.meta === "undefined" || !import.meta.env?.DEV) {
    return null;
  }

  const env = (import.meta.env ?? {}) as EnvRecord & {
    VITE_DEV_ACCESS_TOKEN?: string;
  };

  const fromEnv = env.VITE_DEV_ACCESS_TOKEN;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
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
 if (window.location.pathname === "/login") return;
  window.location.assign("/login");
}
