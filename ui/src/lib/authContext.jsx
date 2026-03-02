import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as supabaseClient, isSupabaseConfigured } from './supabaseClient';

const AUTH_BOOTSTRAP_TIMEOUT_MS = 10_000;
const WORKSPACE_TIMEOUT_MESSAGE = 'Workspace bootstrap timed out—check Supabase env + RLS';

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      const timeoutError = new Error(timeoutMessage);
      timeoutError.code = 'BOOTSTRAP_TIMEOUT';
      reject(timeoutError);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  });
}

function normalizeBootstrapError(error, fallbackMessage) {
  if (!error) {
    return { message: fallbackMessage, code: 'UNKNOWN_ERROR' };
  }

  const message =
    typeof error.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage;

  const code =
    (typeof error.code === 'string' && error.code) ||
    (typeof error.status === 'number' ? String(error.status) : null) ||
    (typeof error.name === 'string' && error.name) ||
    'UNKNOWN_ERROR';

  return { message, code };
}

function isAuthOrRlsError(error) {
  return error.code === '401' || error.code === '403' || error.code === 'PGRST301';
}

function isMissingRowError(error) {
  return error.code === 'PGRST116';
}

async function upsertProfile(userId, userEmail) {
  const { error } = await withTimeout(
    supabaseClient.from('profiles').upsert(
      {
        id: userId,
        email: userEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    ),
    AUTH_BOOTSTRAP_TIMEOUT_MS,
    WORKSPACE_TIMEOUT_MESSAGE
  );

  if (error) {
    throw error;
  }
}

async function ensureProfileExists(session) {
  const userId = session?.user?.id;
  if (!userId) {
    return;
  }

  const userEmail = session?.user?.email ?? null;

  const { data, error } = await withTimeout(
    supabaseClient.from('profiles').select('id').eq('id', userId).single(),
    AUTH_BOOTSTRAP_TIMEOUT_MS,
    WORKSPACE_TIMEOUT_MESSAGE
  );

  if (error && isMissingRowError(error)) {
    await upsertProfile(userId, userEmail);
    return;
  }

  if (error) {
    throw error;
  }

  if (!data) {
    await upsertProfile(userId, userEmail);
  }
}

export const AuthContext = createContext({
  session: null,
  user: null,
  supabase: null,
  loading: true,
  isLoading: true,
  isAuthed: false,
  error: null,
  signOut: async () => ({ error: null }),
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isActive = true;

    const hydrateSession = async () => {
      if (!isSupabaseConfigured) {
        if (isActive) {
          setSession(null);
          setError({
            message: 'Supabase environment variables are missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
            code: 'SUPABASE_NOT_CONFIGURED',
          });
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: sessionError } = await withTimeout(
          supabaseClient.auth.getSession(),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
          WORKSPACE_TIMEOUT_MESSAGE
        );

        if (sessionError) {
          throw sessionError;
        }

        const nextSession = data?.session ?? null;
        setSession(nextSession);

        if (nextSession) {
          await ensureProfileExists(nextSession);
        }
      } catch (caughtError) {
        console.error('Failed to bootstrap auth workspace', caughtError);

        const normalized = normalizeBootstrapError(caughtError, 'Unable to bootstrap workspace');

        if (normalized.code === 'AuthSessionMissingError') {
          setSession(null);
          setError({ message: normalized.message, code: normalized.code });
          return;
        }

        if (normalized.message.includes('Failed to fetch')) {
          setSession(null);
          setError({
            message: 'Failed to fetch Supabase endpoint. Check VITE_SUPABASE_URL and CORS settings.',
            code: normalized.code,
          });
          return;
        }

        if (isAuthOrRlsError(normalized)) {
          setSession(null);
          setError({
            message: `Auth/RLS problem while loading workspace: ${normalized.message}`,
            code: normalized.code,
          });
          return;
        }

        setError(normalized);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void hydrateSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) {
        return;
      }

      setSession(nextSession ?? null);
      setError(null);
      setLoading(false);
    });

    return () => {
      isActive = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSession(null);
      setError({ message: 'Supabase not configured', code: 'SUPABASE_NOT_CONFIGURED' });
      return { error: new Error('Supabase not configured') };
    }

    const { error: signOutError } = await supabaseClient.auth.signOut();

    if (signOutError) {
      console.error('Failed to sign out', signOutError);
      return { error: signOutError };
    }

    setSession(null);
    setError(null);
    return { error: null };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      supabase: isSupabaseConfigured ? supabaseClient : null,
      loading,
      isLoading: loading,
      isAuthed: Boolean(session?.user),
      error,
      signOut,
    }),
    [session, loading, error, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
