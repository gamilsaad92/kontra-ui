import { createContext, useEffect, useMemo, useState } from 'react';
import { supabase as supabaseClient, isSupabaseConfigured } from './supabaseClient';

export const AuthContext = createContext({ session: null, supabase: null, isLoading: true });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!isSupabaseConfigured) {
      setSession(null);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const loadSession = async () => {
      setIsLoading(true);
      const { data, error } = await supabaseClient.auth.getSession();
      if (!isMounted) return;
      if (error) {
        console.error('Failed to fetch Supabase session', error);
        setSession(null);
      } else {
        setSession(data?.session ?? null);
      }
      setIsLoading(false);
    };

    loadSession();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession ?? null);
      }
    });

    return () => {
      isMounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      supabase: isSupabaseConfigured ? supabaseClient : null,
      isLoading,
    }),
    [session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}export const AuthContext = createContext({ session: null, supabase: null, isLoading: true });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!isSupabaseConfigured) {
      setSession(null);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const loadSession = async () => {
      setIsLoading(true);
      const { data, error } = await supabaseClient.auth.getSession();
      if (!isMounted) return;
      if (error) {
        console.error('Failed to fetch Supabase session', error);
        setSession(null);
      } else {
        setSession(data?.session ?? null);
      }
      setIsLoading(false);
    };

    loadSession();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession ?? null);
      }
    });

    return () => {
      isMounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      supabase: isSupabaseConfigured ? supabaseClient : null,
      isLoading,
    }),
    [session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
