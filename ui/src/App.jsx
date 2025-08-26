import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import KontraDashboard from "./pages/KontraDashboard";

export default function App() {
  return (
    <Routes>
      {/* Default redirect */}
      <Route index element={<Navigate to="/dashboard" replace />} />

      {/* Render KontraDashboard for /dashboard and any subpaths */}
      <Route path="dashboard/*" element={<KontraDashboard />} />

      {/* Hard fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
