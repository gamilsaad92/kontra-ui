import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import SignUpForm from "../components/SignUpForm";
import { AuthContext } from "../lib/authContext";
import { getAppRoleFromToken } from "../lib/usePortalRouter";

const DEMO_PORTALS = [
  { role: "lender",   label: "Lender",   color: "#800020", desc: "Portfolio · Risk · Capital Markets" },
  { role: "servicer", label: "Servicer", color: "#92400E", desc: "Draws · Inspections · Payments" },
  { role: "investor", label: "Investor", color: "#6D28D9", desc: "Holdings · Distributions · Governance" },
  { role: "borrower", label: "Borrower", color: "#065F46", desc: "Loan · Covenants · Documents" },
];

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
  const { session, loading, loginAsDemo } = useContext(AuthContext);
  const [mode, setMode] = useState("login");
  const [redirecting, setRedirecting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(null);
  const navigate = useNavigate();
  const didRedirect = useRef(false);
  const [searchParams] = useSearchParams();

  // ?redirect=/app/watchlist&action=watchlist&propertyId=harbor-view
  const redirectParam = searchParams.get("redirect");
  const actionParam = searchParams.get("action");
  const propertyIdParam = searchParams.get("propertyId");

  // Show context-aware message if user was redirected here from an action
  const actionMessages = {
    watchlist: "Sign in to save this property to your watchlist.",
    claim: "Sign in to claim this property.",
    inspection: "Sign in to request an inspection.",
    documents: "Sign in to access the document workspace.",
  };
  const contextMessage = actionParam ? actionMessages[actionParam] : null;

  const handleDemo = async (portal) => {
    setDemoLoading(portal.role);
    await loginAsDemo(portal.role);
    // Save intent before navigating
    if (actionParam) saveIntent(actionParam, propertyIdParam);
    const dest = redirectParam || "/dashboard";
    navigate(dest, { replace: true });
    setDemoLoading(null);
  };

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
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0f1623" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "#800020", borderTopColor: "transparent" }} />
          <span className="text-xs font-medium tracking-widest uppercase" style={{ color: "#64748b" }}>
            {redirecting ? "Opening your workspace…" : "Loading"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen" style={{ background: "#0f1623" }}>

      {/* ── Left brand panel ───────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[460px] flex-col justify-between p-10 shrink-0"
        style={{
          background: "linear-gradient(160deg, #1a0a0a 0%, #111827 55%, #0f1623 100%)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Logo + back to marketplace link */}
        <div>
          <Link to="/" className="flex items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#800020" }}>
              <span className="text-sm font-black text-white" style={{ letterSpacing: "-0.05em" }}>K</span>
            </div>
            <div>
              <span className="text-base font-bold text-white" style={{ letterSpacing: "-0.02em" }}>Kontra</span>
            </div>
          </Link>
          <Link to="/" className="text-xs font-medium text-gray-500 hover:text-gray-300 transition">
            ← Back to home
          </Link>
        </div>

        {/* Hero copy */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#800020" }}>
            Transaction Workspace Infrastructure
          </p>
          <h2 className="mb-4 text-3xl font-black leading-tight text-white" style={{ letterSpacing: "-0.03em" }}>
            {contextMessage
              ? <>One more step<br />to continue</>
              : <>Your workspace<br />starts here.</>}
          </h2>
          {contextMessage ? (
            <div className="rounded-xl px-4 py-3 mb-4" style={{ background: "rgba(128,0,32,0.12)", border: "1px solid rgba(128,0,32,0.2)" }}>
              <p className="text-sm leading-relaxed" style={{ color: "#fca5a5" }}>
                {contextMessage}
              </p>
            </div>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
              Discover properties, track assets, analyze documents with AI, manage compliance, and connect with service providers — all in one place.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span className="text-[11px]" style={{ color: "#475569" }}>Secure · Encrypted · SOC 2 Ready</span>
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      </div>

      {/* ── Right form panel ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">

        {/* Mobile logo */}
        <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#800020" }}>
              <span className="text-base font-black text-white">K</span>
            </div>
            <span className="text-base font-bold text-white">Kontra</span>
          </Link>
        </div>

        <div className="w-full max-w-[360px]">
          {/* Context banner (mobile only) */}
          {contextMessage && (
            <div className="mb-5 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(128,0,32,0.12)", border: "1px solid rgba(128,0,32,0.2)", color: "#fca5a5" }}>
              {contextMessage}
            </div>
          )}

          {/* Heading */}
          <div className="mb-7">
            <h1 className="mb-1.5 text-2xl font-black text-white" style={{ letterSpacing: "-0.02em" }}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-sm" style={{ color: "#94a3b8" }}>
              {mode === "login"
                ? "Sign in to your workspace"
                : "Set up your Kontra account"}
            </p>
          </div>

          {mode === "login"
            ? <LoginForm onSwitch={() => setMode("signup")} />
            : <SignUpForm onSwitch={() => setMode("login")} />}

          {/* ── Demo access ── */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#475569" }}>
                Or explore the demo
              </span>
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>

            {/* Live deal room demo — primary CTA */}
            <Link
              to="/deal-room/kontra-demo"
              className="flex items-center justify-between w-full rounded-xl px-4 py-3 mb-3 transition-all hover:opacity-90 group"
              style={{ background: "linear-gradient(90deg, #4a0010 0%, #800020 100%)", border: "1px solid rgba(128,0,32,0.4)" }}
            >
              <div>
                <p className="text-xs font-bold text-white mb-0.5">Try a Live Deal Room</p>
                <p className="text-[10px] text-white/60">550 Madison Ave · AI Operations Manager active</p>
              </div>
              <span className="text-white/80 text-sm group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>

            {/* Dashboard portal demos */}
            <div className="grid grid-cols-2 gap-2">
              {DEMO_PORTALS.map((portal) => (
                <button
                  key={portal.role}
                  onClick={() => handleDemo(portal)}
                  disabled={demoLoading !== null}
                  className="flex flex-col items-start gap-1 rounded-xl px-3.5 py-3 text-left transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{
                    background: `${portal.color}12`,
                    border: `1px solid ${portal.color}30`,
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest"
                      style={{ background: `${portal.color}25`, color: portal.color }}
                    >
                      {portal.label}
                    </span>
                    {demoLoading === portal.role && (
                      <span className="ml-auto h-3 w-3 animate-spin rounded-full border border-t-transparent" style={{ borderColor: portal.color, borderTopColor: "transparent" }} />
                    )}
                  </div>
                  <span className="text-[10px] leading-snug" style={{ color: "#64748b" }}>
                    {portal.desc}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-3 text-center text-[10px]" style={{ color: "#334155" }}>
              No login required · No account needed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
