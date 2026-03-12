import React, { useContext, useState } from "react";
import { Navigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import SignUpForm from "../components/SignUpForm";
import { AuthContext } from "../lib/authContext";

export default function LoginPage() {
 const { session, loading } = useContext(AuthContext);
  const [mode, setMode] = useState("login");

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading Kontra...</div>;
  }

  if (session?.access_token) {
   return <Navigate to="/dashboard" replace />;
  }

  return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-4 py-12 text-slate-100">
      <div className="w-full max-w-xl space-y-6 rounded-3xl border border-slate-800/80 bg-slate-950/50 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div className="flex justify-start">
          <img src="/logo-dark.png" alt="Kontra" className="h-8 w-auto" />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">{mode === "login" ? "Welcome back to Kontra" : "Create your Kontra account"}</h1>
          <p className="text-sm text-slate-300">Sign in with Supabase authentication to continue.</p>
        </div>
        <div className="flex justify-center gap-2 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-full px-4 py-1 transition ${
              mode === "login" ? "bg-white text-slate-900 shadow" : "bg-slate-900 text-slate-200 hover:bg-slate-800"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-full px-4 py-1 transition ${
              mode === "signup" ? "bg-white text-slate-900 shadow" : "bg-slate-900 text-slate-200 hover:bg-slate-800"
            }`}
          >
            Create account
          </button>
        </div>
        <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
          {mode === "login" ? <LoginForm className="w-full" onSwitch={() => setMode("signup")} /> : <SignUpForm className="w-full" onSwitch={() => setMode("login")} />}
        </div>
      </div>
    </div>
  );
}
