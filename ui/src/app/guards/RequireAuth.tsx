import { useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";

type AuthBootstrapError = {
  message: string;
  code?: string;
} | null;

function AuthLoadingScreen({ error, showLogin }: { error: AuthBootstrapError; showLogin: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-slate-100">
      <img src="/logo-dark.png" alt="Kontra" className="h-8 w-auto" />
      {!error ? <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-slate-200" /> : null}
      <p className="text-center text-sm font-medium tracking-wide text-slate-200">Loading your Kontra workspace…</p>
      {error ? (
        <>
        <div className="w-full max-w-xl rounded-lg border border-rose-400/40 bg-rose-950/40 p-4 text-left" role="alert">
          <p className="text-sm font-semibold text-rose-100">Workspace bootstrap failed</p>
          <p className="mt-2 text-sm text-rose-100">{error.message}</p>
          <p className="mt-1 text-xs text-rose-200">code: {error.code ?? "unknown"}</p>
          <p className="mt-2 text-xs text-rose-200">If this persists, check Supabase env vars and RLS policies for profiles/organizations.</p>
        </div>
          {showLogin ? <a href="/login" className="text-xs text-sky-200 underline">Go to login</a> : null}
        </>
      ) : null}
    </div>
  );
}

export default function RequireAuth() {
  const location = useLocation();
const { loading, isAuthed, error } = useContext(AuthContext);

 if (loading || error) {
    return <AuthLoadingScreen error={error} showLogin={!loading && !isAuthed} />;
  }

  if (!isAuthed) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
