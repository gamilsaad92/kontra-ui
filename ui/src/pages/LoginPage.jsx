import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import SignUpForm from "../components/SignUpForm";
import { AuthContext } from "../lib/authContext";
import { getAppRoleFromToken, getPortalPath } from "../lib/usePortalRouter";

const PORTALS = [
  {
    role: "lender",
    label: "Lender",
    color: "#800020",
    bg: "rgba(128,0,32,0.15)",
    border: "rgba(128,0,32,0.35)",
    desc: "Originate · Underwrite · Portfolio Management",
    badge: "$604.7M AUM",
  },
  {
    role: "servicer",
    label: "Servicer",
    color: "#b45309",
    bg: "rgba(180,83,9,0.15)",
    border: "rgba(180,83,9,0.35)",
    desc: "Payments · Draws · Escrow · AI Validation",
    badge: "6 Active Loans",
  },
  {
    role: "investor",
    label: "Investor",
    color: "#6d28d9",
    bg: "rgba(109,40,217,0.15)",
    border: "rgba(109,40,217,0.35)",
    desc: "Holdings · Distributions · Debt Exchange",
    badge: "10,290 Investors",
  },
  {
    role: "borrower",
    label: "Borrower",
    color: "#065f46",
    bg: "rgba(6,95,70,0.15)",
    border: "rgba(6,95,70,0.35)",
    desc: "Payments · Draw Requests · Covenant Scorecard",
    badge: "LN-2847",
  },
];

const STATS = [
  { label: "Portfolio AUM",     value: "$604.7M" },
  { label: "Tokenized",         value: "$225.4M" },
  { label: "Active Investors",  value: "10,290"  },
  { label: "Compliance",        value: "Reg D/S ✓" },
];

const FEATURES = [
  { icon: "🏦", text: "Full CRE loan servicing lifecycle" },
  { icon: "🔗", text: "ERC-1400 tokenization bridge" },
  { icon: "🌊", text: "On-chain cash flow waterfall" },
  { icon: "⚖️",  text: "Reg D / Reg S compliance layer" },
];

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
    let demoRole = null;
    try { demoRole = localStorage.getItem("kontra_demo_role"); } catch (_) {}
    if (demoRole) {
      try { localStorage.removeItem("kontra_demo_role"); } catch (_) {}
      navigate(getPortalPath(demoRole), { replace: true });
      return;
    }
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

  function enterDemo(role) {
    try {
      localStorage.setItem("kontra_demo_role", role);
      localStorage.setItem("kontra_demo_mode", "true");
    } catch (_) {}
    navigate(getPortalPath(role), { replace: true });
  }

  if (loading || redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0f1623" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-700 border-t-transparent" />
          <span className="text-xs font-medium tracking-widest uppercase" style={{ color: "#64748b" }}>
            {redirecting ? "Opening your workspace…" : "Loading"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen" style={{ background: "#0f1623" }}>

      {/* ── Left panel ─────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[460px] xl:w-[520px] flex-col justify-between p-10 shrink-0"
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
            <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: "rgba(128,0,32,0.2)", color: "#d4687a" }}>Beta</span>
          </div>
        </div>

        {/* Hero copy */}
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#800020" }}>
              Data Infrastructure · CRE Loan Servicing
            </p>
            <h2 className="mb-3 text-3xl font-black leading-tight text-white" style={{ letterSpacing: "-0.03em" }}>
              The operating system<br />for CRE debt markets.
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
              Kontra connects lenders, servicers, investors, and borrowers on a single platform — from loan origination to on-chain tokenization and secondary trading.
            </p>
          </div>

          {/* Platform stats */}
          <div
            className="rounded-xl p-5"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#64748b" }}>
              Platform Demo · Live Data
            </p>
            <div className="grid grid-cols-2 gap-4">
              {STATS.map((s) => (
                <div key={s.label}>
                  <p className="text-lg font-black text-white" style={{ letterSpacing: "-0.02em" }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Feature list */}
          <div className="grid grid-cols-2 gap-2">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-start gap-2">
                <span className="text-sm shrink-0">{f.icon}</span>
                <p className="text-xs leading-snug" style={{ color: "#94a3b8" }}>{f.text}</p>
              </div>
            ))}
          </div>

          {/* Portal quick-enter */}
          <div>
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#64748b" }}>
              Try a Portal — No login required
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PORTALS.map((p) => (
                <button
                  key={p.role}
                  onClick={() => enterDemo(p.role)}
                  className="rounded-lg p-3 text-left transition-all hover:scale-[1.02] group"
                  style={{ background: p.bg, border: `1px solid ${p.border}` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black" style={{ color: p.color }}>{p.label}</span>
                    <span className="text-[10px] font-semibold" style={{ color: p.color, opacity: 0.7 }}>→</span>
                  </div>
                  <p className="text-[10px] leading-snug" style={{ color: "#94a3b8" }}>{p.desc}</p>
                  <p className="mt-1.5 text-[10px] font-bold" style={{ color: p.color }}>{p.badge}</p>
                </button>
              ))}
            </div>
          </div>
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
          {/* Mobile demo shortcuts */}
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {PORTALS.map((p) => (
              <button
                key={p.role}
                onClick={() => enterDemo(p.role)}
                className="rounded-full px-3 py-1.5 text-xs font-bold transition"
                style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}
              >
                {p.label} Demo
              </button>
            ))}
          </div>
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

          {/* Demo divider */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-xs" style={{ color: "#475569" }}>or try a live demo</span>
              <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PORTALS.map((p) => (
                <button
                  key={p.role}
                  onClick={() => enterDemo(p.role)}
                  className="rounded-lg px-3 py-2.5 text-xs font-bold text-left transition-all hover:scale-[1.02]"
                  style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}
                >
                  <div className="font-black mb-0.5">{p.label} Portal</div>
                  <div className="font-medium opacity-70" style={{ fontSize: "10px" }}>{p.badge}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
