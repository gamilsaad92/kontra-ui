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

const SESSION_LOOKUP_TIMEOUT_MS = 4000;
const SIGN_IN_TIMEOUT_MS = 15000;

async function getSessionWithTimeout() {
  if (!supabaseClient?.auth) {
    return { data: { session: null } };
  }

  let timeoutId;
  try {
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        resolve({ data: { session: null }, timeout: true });
      }, SESSION_LOOKUP_TIMEOUT_MS);
    });

    const result = await Promise.race([supabaseClient.auth.getSession(), timeoutPromise]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function signInWithTimeout({ email, password }) {
  let timeoutId;
  try {
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        resolve({ data: null, error: new Error('Login timed out. Please try again.') });
      }, SIGN_IN_TIMEOUT_MS);
    });

    const result = await Promise.race([supabaseClient.auth.signInWithPassword({ email, password }), timeoutPromise]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

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
        const result = await getSessionWithTimeout();
        if (!isActive) return;

        if (result?.timeout && typeof console !== 'undefined') {
          console.warn('Supabase session lookup timed out. Continuing without an active session.');
          setSession(null);
          return;
        }

        setSession(result?.data?.session ?? null);
      } catch {
        if (isActive) {
          setSession(null);
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

    return signInWithTimeout({ email, password });
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
