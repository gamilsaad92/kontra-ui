import { createContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const SESSION_STORAGE_KEY = "kontra_session";

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
    /* ignore storage errors */
  }
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
    // 1. Try to restore session from localStorage
    const stored = readStoredSession();
    if (stored) {
      setSessionState(stored);
      setLoading(false);
      return;
    }

    // 2. Fall back to Supabase JS client session check (for SSO / magic link flows)
    if (!isSupabaseConfigured || !supabase?.auth) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const fallbackTimer = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

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
      .catch((err) => {
        if (mounted) console.warn("Supabase getSession threw:", err.message);
      })
      .finally(() => {
        if (mounted) {
          clearTimeout(fallbackTimer);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  const signIn = useCallback(
    async ({ email, password }) => {
      try {
        const res = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();
        if (!res.ok) {
          return { data: null, error: { message: json.error || "Sign in failed" } };
        }
        const newSession = {
          access_token: json.access_token,
          refresh_token: json.refresh_token,
          expires_at: json.expires_at,
          expires_in: json.expires_in,
          token_type: json.token_type || "bearer",
          user: json.user,
        };
        setSession(newSession);
        return { data: { session: newSession, user: json.user }, error: null };
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
      try {
        await fetch("/api/auth/signout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (_) {
        /* best-effort signout */
      }
    }
    if (isSupabaseConfigured && supabase?.auth) {
      try {
        await supabase.auth.signOut();
      } catch (_) {}
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
