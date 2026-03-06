import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase as supabaseClient, isSupabaseConfigured } from './supabaseClient';
import { apiRequest } from './apiClient';

const STARTUP_TIMEOUT_MS = 8_000;
const DEFAULT_PROFILE = null;
const DEFAULT_WORKSPACE = { id: 'personal', name: 'Personal Workspace' };
const DEFAULT_ORGANIZATION = { id: 'personal', name: 'Personal Organization' };

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

const withTimeout = async (promise, fallback, ms = STARTUP_TIMEOUT_MS) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

async function safeGetSession() {
  try {
    const fallback = { data: { session: null }, error: null };
    const { data, error } = await withTimeout(supabaseClient.auth.getSession(), fallback);

    if (error) {
      return {
        session: null,
        error: normalizeBootstrapError(error, error.message || 'getSession failed'),
      };
    }

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
  bootstrapWarning: null,
  profile: null,
  workspace: DEFAULT_WORKSPACE,
  organization: DEFAULT_ORGANIZATION,
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
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [workspace, setWorkspace] = useState(DEFAULT_WORKSPACE);
  const [organization, setOrganization] = useState(DEFAULT_ORGANIZATION);
  const [bootstrapWarning, setBootstrapWarning] = useState(null);

  const hasBootstrapped = useRef(false);
  const bootstrapRequestIdRef = useRef(0);

  const resetHydrationState = useCallback(() => {
    setProfile(DEFAULT_PROFILE);
    setWorkspace(DEFAULT_WORKSPACE);
    setOrganization(DEFAULT_ORGANIZATION);
    setBootstrapWarning(null);
  }, []);

  const failUnauthed = useCallback((nextError, shouldRouteToLogin = false) => {
    setSession(null);
    setBootstrapped(false);
    setBootstrapStatus('ready');
    setError(nextError);
    resetHydrationState();
    hasBootstrapped.current = false;

    if (shouldRouteToLogin) routeToLogin();
  }, [resetHydrationState]);

  const runBootstrap = useCallback(async (targetSession) => {
    if (!targetSession?.access_token) {
      setBootstrapped(false);
      setBootstrapStatus('ready');
      setError(null);
      resetHydrationState();
      hasBootstrapped.current = false;
      return false;
    }

    if (hasBootstrapped.current) {
      return true;
    }

    hasBootstrapped.current = true;
    const requestId = Date.now();
    bootstrapRequestIdRef.current = requestId;

    setBootstrapStatus('loading');
    setBootstrapWarning(null);

    try {
      console.info('[bootstrap] session loaded', { userId: targetSession.user?.id ?? null });

      const nextProfile = await withTimeout(
        apiRequest('GET', '/me', undefined, {}, { requireAuth: true }).catch(() => DEFAULT_PROFILE),
        DEFAULT_PROFILE
      );
      console.info('[bootstrap] profile loaded', { hasProfile: Boolean(nextProfile) });

      const nextWorkspace = await withTimeout(
        apiRequest('GET', '/workspace', undefined, {}, { requireAuth: true }).catch(() => DEFAULT_WORKSPACE),
        DEFAULT_WORKSPACE
      );
      console.info('[bootstrap] workspace loaded', {
        workspaceId: nextWorkspace?.id ?? DEFAULT_WORKSPACE.id,
      });

      const nextOrganization = await withTimeout(
        apiRequest('GET', '/organizations/current', undefined, {}, { requireAuth: true }).catch(() => DEFAULT_ORGANIZATION),
        DEFAULT_ORGANIZATION
      );

      if (bootstrapRequestIdRef.current !== requestId) {
        return true;
      }

      const safeProfile = nextProfile ?? DEFAULT_PROFILE;
      const safeWorkspace = nextWorkspace ?? DEFAULT_WORKSPACE;
      const safeOrganization =
        nextOrganization && !Array.isArray(nextOrganization)
          ? nextOrganization
          : DEFAULT_ORGANIZATION;

      setProfile(safeProfile);
      setWorkspace(safeWorkspace);
      setOrganization(safeOrganization);
      setBootstrapped(true);
      setBootstrapStatus('ready');
      setError(null);

      if (
        !nextProfile ||
        !nextWorkspace ||
        !nextOrganization ||
        (Array.isArray(nextOrganization) && nextOrganization.length === 0)
      ) {
        setBootstrapWarning('Workspace data unavailable, retrying');
      }

      console.info('[bootstrap] bootstrap complete');
      return true;
    } catch (bootstrapError) {
      if (bootstrapRequestIdRef.current !== requestId) {
        return false;
      }

      const normalized = normalizeBootstrapError(bootstrapError, 'Unable to hydrate workspace data');
      setBootstrapped(true);
      setBootstrapStatus('ready');
      setError(normalized);
      resetHydrationState();
      setBootstrapWarning('Workspace data unavailable, retrying');
      console.error('[bootstrap] bootstrap failed', normalized);
      return false;
    }
  }, [resetHydrationState]);

  const safeBootstrapAuth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        failUnauthed(
          {
            message: 'Supabase environment variables are missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
            code: 'SUPABASE_NOT_CONFIGURED',
          },
          true
        );
        return;
      }

      const { session: nextSession, error: sessionError } = await safeGetSession();

      if (sessionError) {
        failUnauthed(
          { message: sessionError.message, code: sessionError.code ?? 'GET_SESSION_ERROR' },
          true
        );
        return;
      }

      setSession(nextSession);
      console.info('[bootstrap] session loaded', { hasSession: Boolean(nextSession?.access_token) });

      if (!nextSession?.access_token) {
        setBootstrapped(false);
        setBootstrapStatus('ready');
        setError(null);
        resetHydrationState();
        return;
      }

      void runBootstrap(nextSession);
    } finally {
      setLoading(false);
    }
  }, [failUnauthed, resetHydrationState, runBootstrap]);

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
      hasBootstrapped.current = false;

      try {
        if (!nextSession?.access_token) {
          setBootstrapped(false);
          setBootstrapStatus('ready');
          resetHydrationState();
          return;
        }

        void runBootstrap(nextSession);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      isActive = false;
      subscription?.unsubscribe();
    };
  }, [runBootstrap, safeBootstrapAuth, resetHydrationState]);

  const retryBootstrap = useCallback(async () => {
    if (!session?.access_token) {
      routeToLogin();
      return;
    }

    hasBootstrapped.current = false;
    await runBootstrap(session);
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
    resetHydrationState();
    hasBootstrapped.current = false;

    return { error: null };
  }, [resetHydrationState]);

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
      bootstrapWarning,
      profile,
      workspace,
      organization,
      error,
      signOut,
      retryBootstrap,
    }),
    [
      session,
      loading,
      bootstrapped,
      bootstrapStatus,
      error,
      bootstrapWarning,
      profile,
      workspace,
      organization,
      signOut,
      retryBootstrap,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

let latestAuthToken = null;

export async function getToken({ forceRefresh = false } = {}) {
  if (!isSupabaseConfigured) return null;

  if (!forceRefresh && latestAuthToken) {
    return latestAuthToken;
  }

  const fallback = { data: { session: null }, error: null };
  const { data, error } = await withTimeout(supabaseClient.auth.getSession(), fallback);

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
