import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

function LoadingScreen() {
  return <div style={{ padding: 24 }}>Loading Kontra...</div>;
}

function LoginPage() {
  return <div style={{ padding: 24 }}>Login page</div>;
}

function DashboardPage() {
  return <div style={{ padding: 24 }}>Dashboard</div>;
}

export default function App() {
    const loading = false;
  const isAuthenticated = true;

  if (loading) return <LoadingScreen />;

  return (
     <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
