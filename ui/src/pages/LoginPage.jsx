import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import { AuthContext } from "../lib/authContext";

export default function LoginPage() {
  const { session } = useContext(AuthContext);

  if (session?.access_token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoginForm />
      </div>
    </div>
  );
}
