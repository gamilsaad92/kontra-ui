import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as supabaseClient, isSupabaseConfigured } from './supabaseClient';

export const AuthContext = createContext({
  session: null,
  supabase: null,
  isLoading: true,
  signOut: async () => ({ error: null }),
});

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
        let didTimeout = false;
      const timeoutId = setTimeout(() => {
        if (!isMounted) return;
        didTimeout = true;
        console.warn('Supabase session request timed out. Falling back to unauthenticated state.');
        setSession(null);
           setIsLoading(false);
      }, 8000);

      try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (!isMounted) return;
        if (error) {
          console.error('Failed to fetch Supabase session', error);
          setSession(null);
        } else {
          setSession(data?.session ?? null);
        }
        if (!didTimeout) {
          setIsLoading(false);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    loadSession();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession ?? null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

    const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSession(null);
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('Failed to sign out', error);
      return { error };
    }
    setSession(null);
    return { error: null };
  }, []);

  const value = useMemo(
    () => ({
      session,
      supabase: isSupabaseConfigured ? supabaseClient : null,
      isLoading,
      signOut,
    }),
  [session, isLoading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
