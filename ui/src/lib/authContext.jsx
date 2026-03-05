import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as supabaseClient, isSupabaseConfigured } from './supabaseClient';
import { getApiBaseUrl } from './apiClient';

const WORKSPACE_BOOTSTRAP_TIMEOUT_MS = 20_000;

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
      return { ok: true, data: await parseResponseJsonSafe(response), error: null };
    }

    const data = await parseResponseJsonSafe(response);
    const message =
      typeof data?.message === 'string'
        ? data.message
        : typeof data?.error === 'string'
          ? data.error
          : 'Unable to bootstrap workspace';

    return {
      ok: false,
      data: null,
      error: {
        message,
        code: typeof data?.code === 'string' ? data.code : String(response.status),
      },
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        ok: false,
        data: null,
        error: { message: 'Workspace bootstrap timed out', code: 'BOOTSTRAP_TIMEOUT' },
      };
    }

    return {
      ok: false,
      data: null,
      error: normalizeBootstrapError(error, 'Unable to bootstrap workspace'),
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function safeGetSession() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) return { session: null, error: normalizeBootstrapError(error, error.message || 'getSession failed') };
    return { session: data?.session ?? null, error: null };
  } catch (error) {
    return {
      session: null,
      error: normalizeBootstrapError(error, 'getSession failed'),
    };
  }
}

function routeToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

export const AuthContext = createContext({
  session: null,
  user: null,
  supabase: null,
  loading: true,
  initializing: true,
  isLoading: true,
  isAuthed: false,
  bootstrapped: false,
  bootstrapStatus: 'idle',
  bootstrapError: null,
  error: null,
  signOut: async () => ({ error: null }),
  retryBootstrap: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState(null);
  const [bootstrapStatus, setBootstrapStatus] = useState('idle');

  const failUnauthed = useCallback((nextError, shouldRouteToLogin = false) => {
    setSession(null);
    setBootstrapped(false);
    setBootstrapStatus('error');
    setError(nextError);
    if (shouldRouteToLogin) routeToLogin();
  }, []);

  const runBootstrap = useCallback(async (targetSession) => {
    if (!targetSession?.access_token) {
      setBootstrapped(false);
      setBootstrapStatus('ready');
      setError(null);
      return false;
    }

    setBootstrapStatus('loading');
    const result = await bootstrapBackendWorkspace(targetSession.access_token);

    if (result.ok) {
      setBootstrapped(true);
      setBootstrapStatus('ready');
      setError(null);
      return true;
    }

    failUnauthed(result.error ?? { message: 'Unable to bootstrap workspace', code: 'BOOTSTRAP_ERROR' }, true);
    return false;
  }, [failUnauthed]);

  const safeBootstrapAuth = useCallback(async () => {
    setLoading(true);
    setBootstrapStatus('loading');
    setError(null);

    if (!isSupabaseConfigured) {
      failUnauthed({
        message: 'Supabase environment variables are missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        code: 'SUPABASE_NOT_CONFIGURED',
      }, true);
      setLoading(false);
      return;
    }

    const { session: nextSession, error: sessionError } = await safeGetSession();

    if (sessionError) {
      failUnauthed({ message: sessionError.message, code: sessionError.code ?? 'GET_SESSION_ERROR' }, true);
      setLoading(false);
      return;
    }

    setSession(nextSession);

    if (!nextSession?.access_token) {
      setBootstrapped(false);
      setBootstrapStatus('ready');
      setError(null);
      setLoading(false);
      return;
    }

    await runBootstrap(nextSession);
    setLoading(false);
  }, [failUnauthed, runBootstrap]);

  useEffect(() => {
    let isActive = true;

    void safeBootstrapAuth();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isActive) return;

      setSession(nextSession ?? null);
      setLoading(true);
      setError(null);

      if (!nextSession?.access_token) {
        setBootstrapped(false);
        setBootstrapStatus('ready');
        setLoading(false);
        return;
      }

      await runBootstrap(nextSession);
      setLoading(false);
    });

    return () => {
      isActive = false;
      subscription?.unsubscribe();
    };
  }, [runBootstrap, safeBootstrapAuth]);

  const retryBootstrap = useCallback(async () => {
    if (!session?.access_token) {
      routeToLogin();
      return;
    }

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
    setBootstrapStatus('ready');
    return { error: null };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      supabase: isSupabaseConfigured ? supabaseClient : null,
      loading,
      initializing: loading,
      isLoading: loading,
      isAuthed: Boolean(session?.access_token),
      bootstrapped,
      bootstrapStatus,
      bootstrapError: error,
      error,
      signOut,
      retryBootstrap,
    }),
    [session, loading, bootstrapped, bootstrapStatus, error, signOut, retryBootstrap]
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

supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
  latestAuthToken = nextSession?.access_token ?? null;
});
