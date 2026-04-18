import { useEffect, useMemo, useState, useCallback } from "react";
import { AuthContext } from "./authContextObj";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { updateBootstrapSnapshot, resetBootstrapSnapshot } from "./bootstrapState";

export { AuthContext };

const SESSION_STORAGE_KEY = "kontra_session";

const DEV_EMAIL = import.meta.env.VITE_DEV_EMAIL || "replit@kontraplatform.com";
const DEV_PASSWORD = import.meta.env.VITE_DEV_PASSWORD || "12345678";
const IS_DEV = import.meta.env.DEV === true;
// Auto-login ONLY when explicitly enabled via VITE_AUTO_LOGIN=true in .env
// Never auto-login by default — always show the login form
const AUTO_LOGIN = import.meta.env.VITE_AUTO_LOGIN === "true";

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
    // Hard-expired: token is past its expiry
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) {
      return null; // don't remove — we'll try to refresh using refresh_token
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

// Sign in directly via Supabase client (preferred — no backend round-trip needed)
async function supabaseSignIn(email, password) {
  if (!isSupabaseConfigured || !supabase?.auth) {
    throw new Error("Supabase not configured");
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const s = data.session;
  return {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at,
    expires_in: s.expires_in,
    token_type: s.token_type || "bearer",
    user: { id: data.user.id, email: data.user.email, created_at: data.user.created_at },
  };
}

// Fallback: sign in via backend API (used only when Supabase client is not configured)
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

// Detect if the anon key is actually a service-role key (sb_secret_...).
// Service-role keys cannot be used for client-side signInWithPassword — only
// real anon/publishable keys work. Fall back to the backend API in that case.
const _anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const isServiceRoleKey = _anonKey.startsWith("sb_secret_") || _anonKey.includes("service_role");

// Primary sign-in: use Supabase client directly when we have a real anon key;
// fall back to backend API when using a service-role key or no key at all.
async function signInWithCredentials(email, password) {
  if (isSupabaseConfigured && supabase?.auth && !isServiceRoleKey) {
    return supabaseSignIn(email, password);
  }
  return apiSignIn(email, password);
}

async function tryRefreshSession(storedSession) {
  if (!storedSession?.refresh_token) return null;
  try {
    // Always use the backend refresh endpoint — the Supabase JS client's
    // refreshSession() acquires a NavigatorLock which can fail or hang in
    // certain browser environments (e.g. multiple tabs, Safari, some Chromium
    // builds). Backend refresh has no such dependency.
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: storedSession.refresh_token }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.access_token) return null;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || storedSession.refresh_token,
      expires_at: data.expires_at,
      expires_in: data.expires_in,
      token_type: data.token_type || "bearer",
      user: data.user || storedSession.user,
    };
  } catch {
    return null;
  }
}

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
      // 1. Try to restore a stored session
      const stored = readStoredSession();

      if (stored) {
        const expiresAt = stored.expires_at ? stored.expires_at * 1000 : Infinity;
        const fiveMinutes = 5 * 60 * 1000;

        if (expiresAt - Date.now() > fiveMinutes) {
          // Session is still good — use it
          await bootstrapOrgIfNeeded(stored.access_token);
          if (mounted) {
            updateBootstrapSnapshot({ sessionReady: true, isAuthenticated: true });
            setSessionState(stored);
            setLoading(false);
          }
          return;
        }

        // Session is near expiry or expired — attempt a refresh before giving up
        const refreshed = await tryRefreshSession(stored);
        if (refreshed) {
          storeSession(refreshed);
          await bootstrapOrgIfNeeded(refreshed.access_token);
          if (mounted) {
            updateBootstrapSnapshot({ sessionReady: true, isAuthenticated: true });
            setSessionState(refreshed);
            setLoading(false);
          }
          return;
        }

        // Refresh failed — clear stale session
        storeSession(null);
      }

      // 2. In development: auto-sign-in only when VITE_AUTO_LOGIN=true is explicitly set
      if (IS_DEV && AUTO_LOGIN) {
        if (!_devSignInPromise) {
          _devSignInPromise = (async () => {
            const s = await signInWithCredentials(DEV_EMAIL, DEV_PASSWORD);
            storeSession(s);
            await bootstrapOrgIfNeeded(s.access_token);
            return s;
          })().catch((err) => {
            console.warn("[Dev auto-login] failed:", err.message);
            _devSignInPromise = null;
            return null;
          });
        }
        const newSession = await _devSignInPromise;
        if (!mounted) return;
        if (newSession) {
          updateBootstrapSnapshot({ sessionReady: true, isAuthenticated: true });
          setSessionState(newSession);
        } else {
          updateBootstrapSnapshot({ sessionReady: true, isAuthenticated: false });
        }
        setLoading(false);
        return;
      }

      // 3. No valid stored session and no dev auto-login — show the login form immediately.
      // We intentionally do NOT call supabase.auth.getSession() here because it acquires a
      // NavigatorLock that can hang or fail in certain browser environments (multiple tabs,
      // Safari, some Chromium builds), keeping the app stuck on the loading screen.
      // Our session lifecycle is fully managed via kontra_session in localStorage so
      // the Supabase client's internal session state is not needed.
      if (mounted) {
        updateBootstrapSnapshot({ sessionReady: true, isAuthenticated: false });
        setLoading(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, []);

  const signIn = useCallback(
    async ({ email, password }) => {
      try {
        const newSession = await signInWithCredentials(email, password);
        updateBootstrapSnapshot({ sessionReady: true, isAuthenticated: true });
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
    resetBootstrapSnapshot();
    setSession(null);
    clearKontraPersistedState();
    // Clear org context and cached role
        try { localStorage.removeItem("kontra_resolved_role"); } catch (_) {}
    try { localStorage.removeItem("kontra_active_org_id"); } catch (_) {}
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
