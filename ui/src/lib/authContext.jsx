import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as supabaseClient, isSupabaseConfigured } from './supabaseClient';
import { getApiBaseUrl } from './apiClient';

const AUTH_BOOTSTRAP_TIMEOUT_MS = 30_000;
const WORKSPACE_BOOTSTRAP_TIMEOUT_MS = 60_000;
const AUTH_BOOTSTRAP_MAX_RETRIES = 2;
const AUTH_TIMEOUT_MESSAGE = 'Authentication check timed out';
const WORKSPACE_TIMEOUT_MESSAGE = 'Workspace bootstrap timed out';

function delay(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

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
  if (!error) return { message: fallbackMessage, code: 'UNKNOWN_ERROR' };

  const message = typeof error.message === 'string' && error.message.trim().length > 0
    ? error.message
    : fallbackMessage;

  const code =
    (typeof error.code === 'string' && error.code) ||
    (typeof error.status === 'number' ? String(error.status) : null) ||
    (typeof error.name === 'string' && error.name) ||
    'UNKNOWN_ERROR';

  return { message, code };
}

function getBootstrapUrl() {
  const base = getApiBaseUrl();
  if (!base) return '/api/auth/bootstrap';
  return `${base}/api/auth/bootstrap`;
}

async function parseResponseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function bootstrapBackendWorkspace(accessToken) {
  for (let attempt = 0; attempt <= AUTH_BOOTSTRAP_MAX_RETRIES; attempt += 1) {
    const abortController = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      abortController.abort();
    }, WORKSPACE_BOOTSTRAP_TIMEOUT_MS);

    try {
      const response = await fetch(getBootstrapUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: abortController.signal,
      });

      if (response.ok) {
        return await parseResponseJsonSafe(response);
      }

      const data = await parseResponseJsonSafe(response);
      const message =
        typeof data?.message === 'string'
          ? data.message
          : typeof data?.error === 'string'
            ? data.error
            : 'Unable to bootstrap workspace';

      const apiError = new Error(message);
      apiError.status = response.status;
      apiError.code = typeof data?.code === 'string' ? data.code : String(response.status);
      throw apiError;
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(WORKSPACE_TIMEOUT_MESSAGE);
        timeoutError.code = 'BOOTSTRAP_TIMEOUT';

        if (attempt === AUTH_BOOTSTRAP_MAX_RETRIES) {
          throw timeoutError;
        }

        await delay(500 * (attempt + 1));
        continue;
      }

      if (error?.code !== 'BOOTSTRAP_TIMEOUT' || attempt === AUTH_BOOTSTRAP_MAX_RETRIES) {
        throw error;
      }

      await delay(500 * (attempt + 1));
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  }

  return null;
}

async function resolveInitialSession() {
  for (let attempt = 0; attempt <= AUTH_BOOTSTRAP_MAX_RETRIES; attempt += 1) {
    try {
      return await withTimeout(
        supabaseClient.auth.getSession(),
        AUTH_BOOTSTRAP_TIMEOUT_MS,
        AUTH_TIMEOUT_MESSAGE
      );
    } catch (error) {
      if (error?.code !== 'BOOTSTRAP_TIMEOUT' || attempt === AUTH_BOOTSTRAP_MAX_RETRIES) {
        throw error;
      }

      await delay(300 * (attempt + 1));
    }
  }

  return { data: { session: null }, error: null };
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
        const { data, error: sessionError } = await resolveInitialSession();

        if (sessionError) {
          throw sessionError;
        }

        const nextSession = data?.session ?? null;
        setSession(nextSession);

        if (nextSession?.access_token) {
          void bootstrapBackendWorkspace(nextSession.access_token).catch((caughtError) => {
            if (!isActive) return;
            console.error('Failed to bootstrap auth workspace', caughtError);
            const normalized = normalizeBootstrapError(caughtError, 'Unable to bootstrap workspace');
            if (normalized.code === '401') {
              setSession(null);
            }
            setError(normalized);
          });
        }
      } catch (caughtError) {
        console.error('Failed to bootstrap auth workspace', caughtError);
        const normalized = normalizeBootstrapError(caughtError, 'Unable to bootstrap workspace');
        if (normalized.code === '401') {
          setSession(null);
        }
        setError(normalized);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void hydrateSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isActive) return;
      setSession(nextSession ?? null);
      setError(null);
      if (nextSession?.access_token) {
        void bootstrapBackendWorkspace(nextSession.access_token).catch((caughtError) => {
          if (!isActive) return;
          const normalized = normalizeBootstrapError(caughtError, 'Unable to bootstrap workspace');
          setError(normalized);
        });
      }
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
