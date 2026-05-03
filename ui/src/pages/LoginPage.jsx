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
      navigate(getPortalPath(roleFromJwt), { replace: true });
      return;
    }
    fetch("/api/onboarding/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const dbRole = data?.app_role ?? "member";
        try { localStorage.setItem("kontra_resolved_role", dbRole); } catch (_) {}
        navigate(getPortalPath(dbRole), { replace: true });
      })
      .catch(() => navigate("/select-portal", { replace: true }));
  }, [session?.access_token, navigate]);

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
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#800020" }}>
            <span className="text-sm font-black text-white" style={{ letterSpacing: "-0.05em" }}>K</span>
          </div>
          <div>
            <span className="text-base font-bold text-white" style={{ letterSpacing: "-0.02em" }}>Kontra</span>
            <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: "rgba(128,0,32,0.15)", color: "#800020" }}>Beta</span>
          </div>
        </div>

        {/* Hero copy */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#800020" }}>
            Data Infrastructure · CRE Loan Servicing
          </p>
          <h2 className="mb-4 text-3xl font-black leading-tight text-white" style={{ letterSpacing: "-0.03em" }}>
            The operating system<br />for CRE debt markets.
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
            Kontra connects lenders, servicers, investors, and borrowers on a single platform — from loan origination to on-chain tokenization and secondary trading.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span className="text-[11px]" style={{ color: "#475569" }}>Secure · Encrypted · Reg D/S Compliant</span>
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      </div>

      {/* ── Right form panel ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">

        {/* Mobile logo */}
        <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#800020" }}>
            <span className="text-base font-black text-white">K</span>
          </div>
          <span className="text-base font-bold text-white">Kontra</span>
        </div>

        <div className="w-full max-w-[360px]">
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
        </div>
      </div>
    </div>
  );
}
