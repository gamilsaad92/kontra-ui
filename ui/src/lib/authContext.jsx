import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as supabaseClient, isSupabaseConfigured } from './supabaseClient';
import { getApiBaseUrl } from './apiClient';

const AUTH_BOOTSTRAP_TIMEOUT_MS = 30_000;
const WORKSPACE_BOOTSTRAP_TIMEOUT_MS = 20_000;
const AUTH_BOOTSTRAP_MAX_RETRIES = 0;
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

function getHealthUrl() {
  const base = getApiBaseUrl();
  if (!base) return '/api/health';
  return `${base}/api/health`;
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

async function warmupBackend() {
 await fetch(getHealthUrl(), { cache: 'no-store' }).catch(() => null);
}

async function bootstrapBackendWorkspace(accessToken) {
    await warmupBackend();

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
  bootstrapped: false,
  error: null,
  signOut: async () => ({ error: null }),
  retryBootstrap: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
   const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState(null);

    const runBootstrap = useCallback(async (targetSession) => {
    if (!targetSession?.access_token) {
      setError(null);
       setBootstrapped(false);
      return false;
    }

    try {
      await bootstrapBackendWorkspace(targetSession.access_token);
      setError(null);
      setBootstrapped(true);
      return true;
    } catch (caughtError) {
      console.error('Failed to bootstrap auth workspace', caughtError);
      const normalized = normalizeBootstrapError(caughtError, 'Unable to bootstrap workspace');
      if (normalized.code === '401') {
        setSession(null);
      }
      setError(normalized);
      setBootstrapped(false);
      return false;
    }
  }, []);

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
        
        if (!isActive) return;
        setSession(nextSession);
        setBootstrapped(false);
        
        if (nextSession?.access_token) {
          await runBootstrap(nextSession);
                } else {
          setError(null);
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
      setBootstrapped(false);
      if (nextSession?.access_token) {
         await runBootstrap(nextSession);
      }
      setLoading(false);
    });

    return () => {
      isActive = false;
      subscription?.unsubscribe();
    };
  }, [runBootstrap]);

  const retryBootstrap = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    await runBootstrap(session);
    setLoading(false);
  }, [runBootstrap, session]);

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
    setBootstrapped(false);
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
      bootstrapped,
      error,
      signOut,
      retryBootstrap,
    }),
  [session, loading, bootstrapped, error, signOut, retryBootstrap]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

let latestAuthToken = null;

export async function getToken({ forceRefresh = false } = {}) {
  if (!isSupabaseConfigured) return null;

  if (!forceRefresh && latestAuthToken) {
    return latestAuthToken;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    throw error;
  }

  latestAuthToken = data?.session?.access_token ?? null;
  return latestAuthToken;
}

export function redirectToSignIn() {
  if (typeof window === 'undefined') return;
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  latestAuthToken = session?.access_token ?? null;
});
