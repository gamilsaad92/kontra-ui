// ui/src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import KontraDashboard from "./pages/KontraDashboard";

export default function App() {
  return (
    <Routes>
      {/* Default redirect */}
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<KontraDashboard />} />
      {/* Hard fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
