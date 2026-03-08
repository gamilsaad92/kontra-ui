import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as supabaseClient, isSupabaseConfigured } from './supabaseClient';

const KONTRA_PREFIXES = ['kontra_', 'kontra:'];
const KONTRA_EXPLICIT_KEYS = ['sessionToken'];

export function clearKontraPersistedState() {
  if (typeof window === 'undefined') return;

  const clearStore = (store) => {
    if (!store) return;
    const keysToRemove = [];

    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key) continue;

      if (KONTRA_PREFIXES.some((prefix) => key.startsWith(prefix)) || KONTRA_EXPLICIT_KEYS.includes(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => store.removeItem(key));
  };

  clearStore(window.localStorage);
  clearStore(window.sessionStorage);
}

export const AuthContext = createContext({
  session: null,
  user: null,
  supabase: null,
  loading: true,
  isLoading: true,
  initializing: true,
  isAuthed: false,
  signIn: async () => ({ data: null, error: new Error('Supabase not configured') }),
  signOut: async () => ({ error: null }),
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const initializeSession = async () => {
      if (!isSupabaseConfigured || !supabaseClient?.auth) {
        if (isActive) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      try {
        const { data } = await supabaseClient.auth.getSession();
        if (isActive) {
          setSession(data?.session ?? null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void initializeSession();

    if (!isSupabaseConfigured || !supabaseClient?.auth) {
      return () => {
        isActive = false;
      };
    }

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) return;
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      isActive = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!isSupabaseConfigured || !supabaseClient?.auth) {
      return { data: null, error: new Error('Supabase not configured') };
    }

    return supabaseClient.auth.signInWithPassword({ email, password });
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured || !supabaseClient?.auth) {
      setSession(null);
      clearKontraPersistedState();
      return { error: null };
    }

    const { error } = await supabaseClient.auth.signOut();
    setSession(null);
    clearKontraPersistedState();
    return { error };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      supabase: isSupabaseConfigured ? supabaseClient : null,
      loading,
      isLoading: loading,
      initializing: loading,
      isAuthed: Boolean(session),
      signIn,
      signOut,
    }),
    [loading, session, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
