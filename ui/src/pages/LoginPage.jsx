import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import SignUpForm from "../components/SignUpForm";
import { AuthContext } from "../lib/authContext";
import { getAppRoleFromToken, getPortalPath } from "../lib/usePortalRouter";

export default function LoginPage() {
  const { session, loading } = useContext(AuthContext);
  const [mode, setMode] = useState("login");
  const [redirecting, setRedirecting] = useState(false);
  const navigate = useNavigate();
  const didRedirect = useRef(false);

  useEffect(() => {
    const token = session?.access_token;
    if (!token || didRedirect.current) return;

    didRedirect.current = true;
    setRedirecting(true);

    const roleFromJwt = getAppRoleFromToken(token);

    if (roleFromJwt !== "member") {
      // JWT already carries the role (hook registered, or invited via new flow)
      navigate(getPortalPath(roleFromJwt), { replace: true });
      return;
    }

    // Fallback: JWT has no app_role yet — ask the API (reads from organization_members DB)
    fetch("/api/onboarding/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const dbRole = data?.app_role ?? "member";
          // Cache so RequireRole can use it even without a custom JWT hook
          try { localStorage.setItem("kontra_resolved_role", dbRole); } catch (_) {}
        navigate(getPortalPath(dbRole), { replace: true });
      })
      .catch(() => {
        navigate("/select-portal", { replace: true });
      });
  }, [session?.access_token, navigate]);

  if (loading || redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#111" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-700 border-t-transparent" />
          <span className="text-xs font-medium tracking-widest uppercase" style={{ color: "#888" }}>
            {redirecting ? "Opening your workspace…" : "Loading"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen"
      style={{ background: "#111" }}
    >
      {/* Left accent panel — visible on wider screens */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between p-12 shrink-0"
        style={{
          background: "linear-gradient(160deg, #1a0505 0%, #0d0d0d 60%, #111 100%)",
          borderRight: "1px solid rgba(128,0,32,0.12)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#800020" }}>
            <span className="text-sm font-black text-white" style={{ letterSpacing: "-0.05em" }}>K</span>
          </div>
          <span className="text-base font-bold text-white" style={{ letterSpacing: "-0.02em" }}>Kontra</span>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#800020" }}>
            AI-Native Loan Servicing
          </p>
          <h2 className="mb-4 text-3xl font-bold leading-tight text-white" style={{ letterSpacing: "-0.03em" }}>
            Command your<br />entire portfolio.
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
            Multifamily and CRE loan servicing built for the way modern lenders actually work.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1" style={{ background: "rgba(128,0,32,0.2)" }} />
          <span className="text-xs" style={{ color: "#444" }}>Secure · Encrypted · Compliant</span>
          <div className="h-px flex-1" style={{ background: "rgba(128,0,32,0.2)" }} />
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#800020" }}>
            <span className="text-sm font-black text-white" style={{ letterSpacing: "-0.05em" }}>K</span>
          </div>
          <span className="text-base font-bold text-white" style={{ letterSpacing: "-0.02em" }}>Kontra</span>
        </div>

        <div className="w-full max-w-[340px]">
          <div className="mb-8">
            <h1 className="mb-1.5 text-2xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-sm" style={{ color: "#666" }}>
              {mode === "login"
                ? "Sign in to your workspace"
                : "Set up your Kontra account"}
            </p>
          </div>

          {mode === "login"
            ? <LoginForm onSwitch={() => setMode("signup")} />
            : <SignUpForm onSwitch={() => setMode("login")} />}
        </div>
      </div>
    </div>
  );
}
