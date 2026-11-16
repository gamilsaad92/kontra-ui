import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import SignUpForm from "../components/SignUpForm";
import { AuthContext } from "../lib/authContext";
import { getAppRoleFromToken } from "../lib/usePortalRouter";

/**
 * Reads ?action=watchlist&propertyId=123 from the URL and stores the intent
 * in localStorage so the destination page can complete the action after login.
 */
function saveIntent(action, propertyId) {
  if (!action) return;
  try {
    localStorage.setItem("kontra_pending_action", JSON.stringify({ action, propertyId, savedAt: Date.now() }));
  } catch (_) {}
}

export default function LoginPage() {
  const { session, loading } = useContext(AuthContext);
  const [mode, setMode] = useState("login");
  const [redirecting, setRedirecting] = useState(false);
  const navigate = useNavigate();
  const didRedirect = useRef(false);
  const [searchParams] = useSearchParams();

  // ?redirect=/app/watchlist&action=watchlist&propertyId=harbor-view
  const redirectParam = searchParams.get("redirect");
  const actionParam = searchParams.get("action");
  const propertyIdParam = searchParams.get("propertyId");

  // Show context-aware message if user was redirected here from an action
  const actionMessages = {
    watchlist: "Sign in to save this opportunity to your watchlist.",
    claim: "Sign in to continue with this transaction.",
    inspection: "Sign in to open the transaction workspace.",
    documents: "Sign in to access the transaction documents.",
  };
  const contextMessage = actionParam ? actionMessages[actionParam] : null;

  useEffect(() => {
    const token = session?.access_token;
    if (!token || didRedirect.current) return;
    didRedirect.current = true;
    setRedirecting(true);

    // Save any pending action intent
    if (actionParam) saveIntent(actionParam, propertyIdParam);

    const roleFromJwt = getAppRoleFromToken(token);
    const dest = redirectParam || "/dashboard";

    if (roleFromJwt !== "member") {
      navigate(dest, { replace: true });
      return;
    }
    fetch("/api/onboarding/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(() => {
        navigate(dest, { replace: true });
      })
      .catch(() => navigate(dest, { replace: true }));
  }, [session?.access_token, navigate, redirectParam, actionParam, propertyIdParam]);

  if (loading || redirecting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0c1320] px-6 text-white" aria-busy="true">
        <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/15 border-t-rose-500" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-300">
            {redirecting ? "Opening your workspace…" : "Loading"}
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0c1320] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-48 h-[28rem] w-[28rem] rounded-full bg-rose-950/35 blur-3xl" />
        <div className="absolute -bottom-56 right-1/4 h-[32rem] w-[32rem] rounded-full bg-indigo-950/30 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[minmax(0,1fr)_minmax(25rem,31rem)]">
        <section
          aria-labelledby="login-brand-heading"
          className="flex flex-col px-6 pb-8 pt-7 sm:px-10 lg:justify-between lg:px-14 lg:py-10"
        >
          <header className="flex items-center justify-between">
            <Link
              to="/"
              aria-label="Kontra home"
              className="inline-flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-400"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#800020] text-base font-black shadow-lg shadow-rose-950/40">
                K
              </span>
              <span className="text-lg font-bold tracking-tight">Kontra</span>
            </Link>
            <Link
              to="/"
              className="rounded-md px-2 py-1 text-sm text-slate-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 lg:hidden"
            >
              Home
            </Link>
          </header>

          <div className="my-10 max-w-2xl lg:my-0 lg:py-16">
            <p className="inline-flex items-center gap-2 rounded-full border border-rose-300/15 bg-rose-400/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-rose-200">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" aria-hidden="true" />
              AI-powered transaction workspace
            </p>
            <h2
              id="login-brand-heading"
              className="mt-6 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-5xl"
            >
              Move private-market transactions forward.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Bring deal teams, diligence, documents, and decisions together in one
              shared workspace. Kontra AI helps surface the details that keep
              complex transactions moving.
            </p>

            <div className="mt-9 hidden max-w-xl grid-cols-2 gap-3 sm:grid lg:mt-12">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-sm font-semibold text-slate-100">One connected deal room</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">
                  Keep people, workstreams, and transaction records in context.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-sm font-semibold text-slate-100">AI-assisted diligence</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">
                  Find relevant facts and open questions across deal materials.
                </p>
              </div>
            </div>
          </div>

          <p className="hidden text-xs text-slate-500 lg:block">
            A shared workspace for the people moving transactions forward.
          </p>
        </section>

        <section
          aria-labelledby="login-title"
          className="flex items-center justify-center px-5 pb-10 sm:px-8 lg:py-12"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-300">
                Secure workspace access
              </p>
              <h1
                id="login-title"
                className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
              >
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {mode === "login"
                  ? "Sign in to continue to your transactions."
                  : "Set up your Kontra account to get started."}
              </p>
            </div>

            {contextMessage && (
              <div
                role="status"
                aria-live="polite"
                className="mb-5 rounded-xl border border-rose-300/20 bg-rose-400/5 px-4 py-3 text-sm leading-6 text-rose-100"
              >
                {contextMessage}
              </div>
            )}

            {mode === "login"
              ? <LoginForm onSwitch={() => setMode("signup")} />
              : <SignUpForm onSwitch={() => setMode("login")} />}

            <div className="mt-7 border-t border-white/10 pt-5">
              <p className="text-center text-xs leading-5 text-slate-500">
                Access is limited to authorized members of your transaction workspace.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
