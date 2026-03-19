import React, { useContext, useState } from "react";
import { Navigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import SignUpForm from "../components/SignUpForm";
import { AuthContext } from "../lib/authContext";

export default function LoginPage() {
  const { session, loading } = useContext(AuthContext);
  const [mode, setMode] = useState("login");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(160deg, #1a0505 0%, #0f0f0f 60%, #0a0a0a 100%)" }}>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-800 border-t-transparent" />
          <span className="text-sm" style={{ color: "#6b7280" }}>Loading Kontra…</span>
        </div>
      </div>
    );
  }

  if (session?.access_token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"
      style={{ background: "linear-gradient(160deg, #1a0505 0%, #0f0f0f 60%, #0a0a0a 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(139,26,26,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-[400px]">
        {/* Wordmark */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "#8b1a1a", boxShadow: "0 0 24px rgba(139,26,26,0.5)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M4 20 L12 4 L20 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 14 L16 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-white" style={{ letterSpacing: "-0.03em" }}>Kontra</span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-8"
          style={{
            background: "rgba(18,18,18,0.9)",
            borderColor: "rgba(139,26,26,0.25)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 0 0 1px rgba(139,26,26,0.1), 0 40px 80px rgba(0,0,0,0.5)",
          }}
        >
          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>
              {mode === "login" ? "Sign in" : "Create account"}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#6b7280" }}>
              {mode === "login" ? "Access your Kontra workspace" : "Get started with Kontra"}
            </p>
          </div>

          {/* Form */}
          {mode === "login"
            ? <LoginForm onSwitch={() => setMode("signup")} />
            : <SignUpForm onSwitch={() => setMode("login")} />}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "#374151" }}>
          © 2026 Kontra — Institutional Loan Servicing
        </p>
      </div>
    </div>
  );
}
