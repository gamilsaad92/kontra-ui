import { createContext, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { resetBootstrapSnapshot, updateBootstrapSnapshot } from "./bootstrapState";

export function clearKontraPersistedState() {
  if (typeof window === "undefined") return;
  window.localStorage?.removeItem("sessionToken");
  window.sessionStorage?.removeItem("sessionToken");
}

export const AuthContext = createContext({
  session: null,
  loading: true,
  user: null,
  supabase: null,
  isLoading: true,
  initializing: true,
  isAuthed: false,
  signIn: async () => ({ data: null, error: new Error("Supabase not configured") }),
  signOut: async () => ({ error: null }),
});

async function waitForPersistedSession(maxAttempts = 4, delayMs = 150) {
  if (!supabase?.auth) return null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return null;
    }
    if (data?.session?.access_token) {
      return data.session;
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }
  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
      let fallbackTimer = null;

    if (!isSupabaseConfigured || !supabase?.auth) {
      setSession(null);
      setLoading(false);
           updateBootstrapSnapshot({
        sessionReady: true,
        isAuthenticated: false,
        orgReady: false,
        activeOrganizationId: null,
      });
      return () => {
        mounted = false;
      };
    }

      fallbackTimer = window.setTimeout(() => {
      if (!mounted) return;
      setLoading(false);
       }, 5000);

    const initializeSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;
        if (error) {
          console.warn("Supabase getSession failed:", error.message);
        }

         const nextSession = data?.session || null;
        setSession(nextSession);
        updateBootstrapSnapshot({
          sessionReady: true,
          isAuthenticated: Boolean(nextSession?.access_token),
          orgReady: false,
          activeOrganizationId: null,
        });
      } catch (error) {
        if (!mounted) return;
        console.warn("Supabase getSession threw:", error);
        setSession(null);
               updateBootstrapSnapshot({
          sessionReady: true,
          isAuthenticated: false,
          orgReady: false,
          activeOrganizationId: null,
        });
      } finally {
        if (!mounted) return;
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
        }
        setLoading(false);
      }
    };

    initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
     const nextSession = newSession || null;
      setSession(nextSession);
      updateBootstrapSnapshot({
        sessionReady: true,
        isAuthenticated: Boolean(nextSession?.access_token),
        orgReady: false,
        activeOrganizationId: null,
      });
      setLoading(false);
    });

    return () => {
      mounted = false;
           if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      user: session?.user ?? null,
      supabase: isSupabaseConfigured ? supabase : null,
      isLoading: loading,
      initializing: loading,
      isAuthed: Boolean(session?.access_token),
      signIn: async ({ email, password }) => {
        if (!isSupabaseConfigured || !supabase?.auth) {
          return { data: null, error: new Error("Supabase not configured") };
        }
        setLoading(true);
        try {
          const response = await supabase.auth.signInWithPassword({ email, password });
          if (response.error) return response;

          const immediateSession = response?.data?.session || null;
          const persistedSession = immediateSession || (await waitForPersistedSession());
          if (!persistedSession?.access_token) {
            return {
              ...response,
              error: new Error("Signed in, but session persistence did not complete. Please try again."),
            };
          }

          setSession(persistedSession);
          updateBootstrapSnapshot({
            sessionReady: true,
            isAuthenticated: true,
            orgReady: false,
            activeOrganizationId: null,
          });
          return {
            data: {
              ...response.data,
              session: persistedSession,
            },
            error: null,
          };
        } finally {
          setLoading(false);
        }
      },
      signOut: async () => {
        if (!isSupabaseConfigured || !supabase?.auth) {
          setSession(null);
          clearKontraPersistedState();
                resetBootstrapSnapshot();
          updateBootstrapSnapshot({ sessionReady: true });  
          return { error: null };
        }

        const { error } = await supabase.auth.signOut();
        setSession(null);
        clearKontraPersistedState();
              resetBootstrapSnapshot();
        updateBootstrapSnapshot({ sessionReady: true });
        return { error };
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
