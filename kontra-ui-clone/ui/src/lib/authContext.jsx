import { createContext, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
      let fallbackTimer = null;

    if (!isSupabaseConfigured || !supabase?.auth) {
      setSession(null);
      setLoading(false);
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

        setSession(data?.session || null);
      } catch (error) {
        if (!mounted) return;
        console.warn("Supabase getSession threw:", error);
        setSession(null);
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
      setSession(newSession || null);
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

        return supabase.auth.signInWithPassword({ email, password });
      },
      signOut: async () => {
        if (!isSupabaseConfigured || !supabase?.auth) {
          setSession(null);
          clearKontraPersistedState();
          return { error: null };
        }

        const { error } = await supabase.auth.signOut();
        setSession(null);
        clearKontraPersistedState();
        return { error };
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
