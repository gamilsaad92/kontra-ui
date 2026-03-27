import { createContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const SESSION_STORAGE_KEY = "kontra_session";

const DEV_EMAIL = import.meta.env.VITE_DEV_EMAIL || "replit@kontraplatform.com";
const DEV_PASSWORD = import.meta.env.VITE_DEV_PASSWORD || "12345678";
const IS_DEV = import.meta.env.DEV === true;

// Module-level singleton — prevents React StrictMode from firing two simultaneous sign-in
// requests (which would burn through Supabase's rate limit of 5 sign-ins/minute).
let _devSignInPromise = null;

/** Called by apiClient to get the current Bearer token. */
export async function getToken({ forceRefresh = false } = {}) {
  try {
    const raw = window.localStorage?.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token) return null;
    // If expired and forceRefresh requested, try refreshing via the backend
    if (forceRefresh && parsed.refresh_token) {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: parsed.refresh_token }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.access_token) {
            const refreshed = { ...parsed, ...data };
            window.localStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(refreshed));
            return data.access_token;
          }
        }
      } catch (_) { /* fall through to existing token */ }
    }
    return parsed.access_token;
  } catch {
    return null;
  }
}

/** Called by apiClient when the user needs to re-authenticate. */
export function redirectToSignIn() {
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

export function clearKontraPersistedState() {
  if (typeof window === "undefined") return;
  window.localStorage?.removeItem(SESSION_STORAGE_KEY);
  window.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
  window.localStorage?.removeItem("sessionToken");
  window.sessionStorage?.removeItem("sessionToken");
}

function readStoredSession() {
  try {
    const raw = window.localStorage?.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token) return null;
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) {
      window.localStorage?.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeSession(session) {
  try {
    if (session) {
      window.localStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage?.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

async function apiSignIn(email, password) {
  const res = await fetch("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Sign in failed");
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: json.expires_at,
    expires_in: json.expires_in,
    token_type: json.token_type || "bearer",
    user: json.user,
  };
}

export const AuthContext = createContext({
  session: null,
  loading: true,
  user: null,
  supabase: null,
  isLoading: true,
  initializing: true,
  isAuthed: false,
  signIn: async () => ({ data: null, error: new Error("Not configured") }),
  signOut: async () => ({ error: null }),
});

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((newSession) => {
    storeSession(newSession);
    setSessionState(newSession);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrapOrgIfNeeded(token) {
      // Only run if the org isn't already stored — avoids redundant requests
      const existingOrgId = (() => { try { return localStorage.getItem("kontra_active_org_id"); } catch(_) { return null; } })();
      if (existingOrgId) return;
      try {
        const bRes = await fetch("/api/me/bootstrap", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          const orgId = bData?.activeOrgId || bData?.active_org_id ||
            (Array.isArray(bData?.orgs) && bData.orgs[0]?.id) || null;
          if (orgId) {
            try { localStorage.setItem("kontra_active_org_id", String(orgId)); } catch (_) {}
          }
        }
      } catch (_) {}
    }

    async function init() {
      // 1. Try to restore a still-valid stored session (5-minute expiry buffer)
      const stored = readStoredSession();
      if (stored) {
        // Accept if it won't expire within the next 5 minutes
        const expiresAt = stored.expires_at ? stored.expires_at * 1000 : Infinity;
        const fiveMinutes = 5 * 60 * 1000;
        if (expiresAt - Date.now() > fiveMinutes) {
          // Ensure org context is in localStorage before rendering the dashboard
          await bootstrapOrgIfNeeded(stored.access_token);
          if (mounted) { setSessionState(stored); setLoading(false); }
          return;
        }
        // Session is about to expire — clear it and fall through to fresh sign-in
        storeSession(null);
      }

      // 2. In development: auto-sign-in so you skip the login screen.
      //    Use a module-level singleton so React StrictMode's double-invoke doesn't
      //    fire two simultaneous Supabase sign-in requests and hit the rate limit.
      if (IS_DEV) {
        if (!_devSignInPromise) {
          _devSignInPromise = (async () => {
            const s = await apiSignIn(DEV_EMAIL, DEV_PASSWORD);
            storeSession(s);
            await bootstrapOrgIfNeeded(s.access_token);
            return s;
          })().catch((err) => {
            console.warn("[Dev auto-login] failed:", err.message);
            _devSignInPromise = null; // allow retry on next page load
            return null;
          });
        }
        const newSession = await _devSignInPromise;
        if (!mounted) return;
        if (newSession) setSessionState(newSession);
        setLoading(false);
        return;
      }

      // 3. Production: try Supabase JS client
      if (!isSupabaseConfigured || !supabase?.auth) {
        if (mounted) setLoading(false);
        return;
      }

      const timer = window.setTimeout(() => { if (mounted) setLoading(false); }, 5000);
      supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (!mounted) return;
          if (error) console.warn("Supabase getSession failed:", error.message);
          if (data?.session) {
            const s = {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: data.session.expires_at,
              token_type: data.session.token_type,
              user: data.session.user,
            };
            storeSession(s);
            setSessionState(s);
          }
        })
        .catch((err) => { if (mounted) console.warn("Supabase getSession threw:", err.message); })
        .finally(() => { if (mounted) { clearTimeout(timer); setLoading(false); } });
    }

    init();
    return () => { mounted = false; };
  }, []);

  const signIn = useCallback(
    async ({ email, password }) => {
      try {
        const newSession = await apiSignIn(email, password);
        setSession(newSession);
        return { data: { session: newSession, user: newSession.user }, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message || "Network error during sign in" } };
      }
    },
    [setSession],
  );

  const signOut = useCallback(async () => {
    const token = session?.access_token;
    setSession(null);
    clearKontraPersistedState();
    if (token) {
      fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    if (isSupabaseConfigured && supabase?.auth) {
      supabase.auth.signOut().catch(() => {});
    }
    return { error: null };
  }, [session, setSession]);

  const value = useMemo(
    () => ({
      session,
      loading,
      user: session?.user ?? null,
      supabase: isSupabaseConfigured ? supabase : null,
      isLoading: loading,
      initializing: loading,
      isAuthed: Boolean(session?.access_token),
      signIn,
      signOut,
    }),
    [loading, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
