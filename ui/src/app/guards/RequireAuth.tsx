import { useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
      <img src="/logo-dark.png" alt="Kontra" className="h-8 w-auto" />
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-slate-200" />
      <p className="text-sm font-medium tracking-wide text-slate-200">Loading your Kontra workspace…</p>
    </div>
  );
}

export default function RequireAuth() {
  const location = useLocation();
  const { loading, isAuthed } = useContext(AuthContext);

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthed) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
