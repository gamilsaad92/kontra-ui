import { useContext, useMemo } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";

type AuthBootstrapError = {
  message: string;
  code?: string;
} | null;

function AuthLoadingScreen({
  error,
  showLogin,
  onRetry,
}: {
  error: AuthBootstrapError;
  showLogin: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-slate-100">
      <img src="/logo-dark.png" alt="Kontra" className="h-8 w-auto" />
      {!error ? (
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-slate-200" />
      ) : null}

      <p className="text-center text-sm font-medium tracking-wide text-slate-200">
        Loading your Kontra workspace…
      </p>

      {error ? (
        <>
          <div
            className="w-full max-w-xl rounded-lg border border-rose-400/40 bg-rose-950/40 p-4 text-left"
            role="alert"
          >
            <p className="text-sm font-semibold text-rose-100">Workspace bootstrap failed</p>
            <p className="mt-2 text-sm text-rose-100">{error.message}</p>
            <p className="mt-1 text-xs text-rose-200">code: {error.code ?? "unknown"}</p>
            <p className="mt-2 text-xs text-rose-200">
              If this persists, check Supabase auth env vars and backend auth/bootstrap endpoints.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
              >
                Retry
              </button>
            ) : null}

            {showLogin ? (
              <a
                href="/login"
                className="rounded-md border border-slate-500/50 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900"
              >
                Go to Login
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function RequireAuth() {
  const ctx = useContext(AuthContext);
  const location = useLocation();

  // ---- IMPORTANT ----
  // AuthContext MUST expose a clear separation between:
  // 1) auth readiness (initializing)
  // 2) authenticated identity (user/session)
  // 3) optional workspace bootstrap (org/workspace provisioning)
  //
  // This guard should ONLY enforce "must be logged in".
  // Do NOT block on org/workspace bootstrap here.

  const {
    // required (or adapt these names to your context):
    session,
    initializing,

    // optional (keep if your context has them):
    bootstrapStatus, // "idle" | "loading" | "ready" | "error"
    bootstrapError,
    retryBootstrap,
  } = useMemo(() => {
    // Make it resilient if some keys don't exist yet
    return {
      session: (ctx as any)?.session ?? null,
      initializing: Boolean((ctx as any)?.initializing),

      bootstrapStatus: (ctx as any)?.bootstrapStatus ?? "idle",
      bootstrapError: (ctx as any)?.bootstrapError ?? null,
      retryBootstrap: (ctx as any)?.retryBootstrap,
    };
  }, [ctx]);

  // 1) While auth is initializing, show a short loading UI
  if (initializing) {
    return <AuthLoadingScreen error={null} showLogin={false} />;
  }

  // 2) If NOT logged in: ALWAYS redirect to /login (this fixes the 2nd domain + reopen case)
  // Use user OR session as your truth; use whichever your app relies on.
 if (!session?.access_token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (bootstrapStatus === "error" && bootstrapError && typeof retryBootstrap === "function") {
    console.warn("[bootstrap] background bootstrap warning", bootstrapError);
  }

  // 3) Auth OK: render protected routes immediately after auth confirmation
  return <Outlet />;
}
