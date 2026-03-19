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
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1e]">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-sm text-slate-400">Loading Kontra…</span>
        </div>
      </div>
    );
  }

  if (session?.access_token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1529 50%, #0a0f1e 100%)" }}
    >
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(#4f8ef7 1px, transparent 1px), linear-gradient(90deg, #4f8ef7 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Glow orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-indigo-600/8 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/40">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M4 20 L12 4 L20 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 14 L16 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-[1.6rem] font-bold tracking-tight text-white" style={{ letterSpacing: "-0.02em" }}>
            Kontra
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-8 shadow-2xl"
          style={{
            background: "rgba(15, 23, 42, 0.85)",
            borderColor: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {/* Heading */}
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-white">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {mode === "login"
                ? "Sign in to your Kontra workspace"
                : "Get started with Kontra today"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="mb-6 flex rounded-xl bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
                mode === "login"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
                mode === "signup"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Create account
            </button>
          </div>

          {/* Form */}
          {mode === "login"
            ? <LoginForm onSwitch={() => setMode("signup")} />
            : <SignUpForm onSwitch={() => setMode("login")} />}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Kontra · Institutional Loan Servicing Platform
        </p>
      </div>
    </div>
  );
}
