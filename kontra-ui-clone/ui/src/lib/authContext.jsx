import { useEffect, useMemo, useState, useCallback } from "react";
import { AuthContext } from "./authContextObj";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { updateBootstrapSnapshot, resetBootstrapSnapshot } from "./bootstrapState";

export { AuthContext };

const SESSION_STORAGE_KEY = "kontra_session";

const DEV_EMAIL = import.meta.env.VITE_DEV_EMAIL || "replit@kontraplatform.com";
const DEV_PASSWORD = import.meta.env.VITE_DEV_PASSWORD || "12345678";
const IS_DEV = import.meta.env.DEV === true;
const AUTO_LOGIN = import.meta.env.VITE_AUTO_LOGIN === "true";

let _devSignInPromise = null;

// Detect service-role keys — they can't be used for client-side signInWithPassword
const _anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const isServiceRoleKey = _anonKey.startsWith("sb_secret_") || _anonKey.includes("service_role");

// ── Demo role config ─────────────────────────────────────────────────────────
const DEMO_CONFIG = {
  lender:   { jwtRole: "lender_admin", email: "replit@kontraplatform.com",   name: "Alex Rivera",    id: "demo-lender-001" },
  servicer: { jwtRole: "servicer",     email: "servicer@kontraplatform.com", name: "Jordan Chen",    id: "demo-servicer-001" },
  investor: { jwtRole: "investor",     email: "investor@kontraplatform.com", name: "Morgan Blake",   id: "demo-investor-001" },
  borrower: { jwtRole: "borrower",     email: "borrower@kontraplatform.com", name: "Taylor Reeves",  id: "demo-borrower-001" },
};

/** Build a locally-decodable demo JWT (not cryptographically verified — demo only). */
function buildDemoJwt(cfg) {
  const toB64 = (obj) => {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    } catch {
      return btoa(JSON.stringify(obj))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }
  };
  const now = Math.floor(Date.now() / 1000);
  const header  = toB64({ alg: "none", typ: "JWT" });
  const payload = toB64({
    sub:           cfg.id,
    email:         cfg.email,
    aud:           "authenticated",
    role:          "authenticated",
    app_metadata:  { app_role: cfg.jwtRole },
    user_metadata: { full_name: cfg.name, app_role: cfg.jwtRole },
    exp: now + 86400 * 30,
    iat: now,
  });
  return `${header}.${payload}.demo-sig`;
}

/** Called by apiClient to get the current Bearer token. */
export async function getToken({ forceRefresh = false } = {}) {
  try {
    const raw = window.localStorage?.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token) return null;
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
      } catch (_) {}
    }
    return parsed.access_token;
  } catch {
    return null;
  }
}

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
  } catch {}
}

async function supabaseSignIn(email, password) {
  if (!isSupabaseConfigured || !supabase?.auth) {
    throw new Error("Supabase not configured");
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const s = data.session;
  return {
    access_token:  s.access_token,
    refresh_token: s.refresh_token,
    expires_at:    s.expires_at,
    expires_in:    s.expires_in,
    token_type:    s.token_type || "bearer",
    user: { id: data.user.id, email: data.user.email, created_at: data.user.created_at },
  };
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
    access_token:  json.access_token,
    refresh_token: json.refresh_token,
    expires_at:    json.expires_at,
    expires_in:    json.expires_in,
    token_type:    json.token_type || "bearer",
    user:          json.user,
  };
}

async function signInWithCredentials(email, password) {
  if (isSupabaseConfigured && supabase?.auth && !isServiceRoleKey) {
    return supabaseSignIn(email, password);
  }
  return apiSignIn(email, password);
}

async function tryRefreshSession(storedSession) {
  if (!storedSession?.refresh_token) return null;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: storedSession.refresh_token }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.access_token) return null;
    return {
      access_token:  data.access_token,
      refresh_token: data.refresh_token || storedSession.refresh_token,
      expires_at:    data.expires_at,
      expires_in:    data.expires_in,
      token_type:    data.token_type || "bearer",
      user:          data.user || storedSession.user,
    };
  } catch {
    return null;
  }
}

function readStoredSessionSync() {
  try {
    const raw = window.localStorage?.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token) return null;
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(null);
  // Start loading=false if no stored session — avoids black flash on login page
  const [loading, setLoading] = useState(() => {
    try {
      return Boolean(readStoredSessionSync());
    } catch {
      return false;
    }
  });

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
      const stored = readStoredSession();

      if (stored) {
        const expiresAt = stored.expires_at ? stored.expires_at * 1000 : Infinity;
        const fiveMinutes = 5 * 60 * 1000;

        if (expiresAt - Date.now() > fiveMinutes) {
          await bootstrapOrgIfNeeded(stored.access_token);
          if (mounted) {
            updateBootstrapSnapshot({ sessionReady: true, isAuthenticated: true });
            setSessionState(stored);
            setLoading(false);
          }
          return;
        }

        // Skip refresh for demo sessions (no real refresh token)
        if (!stored.is_demo) {
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
        }

        storeSession(null);
      }

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

      if (mounted) {
        updateBootstrapSnapshot({ sessionReady: true, isAuthenticated: false });
        setLoading(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, []);

  // ── signIn (email + password) ────────────────────────────────────────────
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

  // ── loginAsDemo ──────────────────────────────────────────────────────────
  // One-click demo login. Tries real Supabase first; falls back to a locally-
  // valid session so the demo always works regardless of Supabase setup.
  const loginAsDemo = useCallback(
    async (role) => {
      const cfg = DEMO_CONFIG[role];
      if (!cfg) return { error: { message: `Unknown demo role: ${role}` } };

      // Try real Supabase sign-in first
      if (isSupabaseConfigured && supabase?.auth && !isServiceRoleKey) {
        try {
          const result = await supabaseSignIn(cfg.email, "12345678");
          updateBootstrapSnapshot({ sessionReady: true, isAuthenticated: true });
          setSession(result);
          return { data: { session: result }, error: null };
        } catch (_) {
          // Fall through to local demo session
        }
      }

      // Build a locally-valid demo session with a decodable JWT
      const now = Math.floor(Date.now() / 1000);
      const demoToken = buildDemoJwt(cfg);
      const demoSession = {
        access_token:  demoToken,
        refresh_token: null,
        expires_at:    now + 86400 * 30,
        expires_in:    86400 * 30,
        token_type:    "bearer",
        is_demo:       true,
        user: {
          id:            cfg.id,
          email:         cfg.email,
          app_metadata:  { app_role: cfg.jwtRole },
          user_metadata: { full_name: cfg.name, app_role: cfg.jwtRole },
        },
      };

      updateBootstrapSnapshot({ sessionReady: true, isAuthenticated: true });
      setSession(demoSession);
      return { data: { session: demoSession }, error: null };
    },
    [setSession],
  );

  // ── signOut ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    const token = session?.access_token;
    const isDemo = session?.is_demo;
    resetBootstrapSnapshot();
    setSession(null);
    clearKontraPersistedState();
    try { localStorage.removeItem("kontra_active_org_id"); } catch (_) {}
    try { localStorage.removeItem("kontra_resolved_role"); } catch (_) {}
    try { localStorage.removeItem("kontra_demo_role"); } catch (_) {}
    if (!isDemo && token) {
      fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    if (!isDemo && isSupabaseConfigured && supabase?.auth) {
      supabase.auth.signOut().catch(() => {});
    }
    return { error: null };
  }, [session, setSession]);

  const value = useMemo(
    () => ({
      session,
      loading,
      user:         session?.user ?? null,
      supabase:     isSupabaseConfigured ? supabase : null,
      isLoading:    loading,
      initializing: loading,
      isAuthed:     Boolean(session?.access_token),
      isDemo:       Boolean(session?.is_demo),
      signIn,
      loginAsDemo,
      signOut,
    }),
    [loading, session, signIn, loginAsDemo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
