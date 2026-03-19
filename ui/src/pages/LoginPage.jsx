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
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#1c1c1c" }}>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
          <span className="text-sm" style={{ color: "#888" }}>Loading Kontra…</span>
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
      style={{ background: "#1c1c1c" }}
    >
      {/* Red radial halo — the signature glow behind the card */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(200,30,30,0.28) 0%, rgba(160,20,20,0.12) 40%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-[380px]">
        {/* Card */}
        <div
          className="rounded-3xl px-8 py-10"
          style={{
            background: "rgba(52,52,52,0.85)",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {/* Heading */}
          <div className="mb-8 text-center">
            <h1
              className="text-2xl font-bold text-white"
              style={{ letterSpacing: "-0.01em" }}
            >
              {mode === "login" ? "Sign in to Kontra" : "Create your account"}
            </h1>
            {/* Red underline accent */}
            <div className="mx-auto mt-2 h-0.5 w-10 rounded-full" style={{ background: "#e53e3e" }} />
          </div>

          {/* Form */}
          {mode === "login"
            ? <LoginForm onSwitch={() => setMode("signup")} />
            : <SignUpForm onSwitch={() => setMode("login")} />}
        </div>
      </div>
    </div>
  );
}
