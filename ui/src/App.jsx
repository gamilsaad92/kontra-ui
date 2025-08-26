// ui/src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import DashboardShell from "./components/DashboardShell";
import KontraDashboard from "./pages/KontraDashboard";

export default function App() {
  return (
    <Routes>
      {/* All app pages live under DashboardLayout */}
      <Route element={<DashboardLayout />}>
        {/* App’s inner shell (top nav/side nav) */}
        <Route element={<DashboardShell />}>
          {/* Default redirect */}
          <Route index element={<Navigate to="/dashboard/kontra" replace />} />
          <Route path="dashboard/kontra" element={<KontraDashboard />} />
        </Route>
      </Route>

      {/* Hard fallback */}
      <Route path="*" element={<Navigate to="/dashboard/kontra" replace />} />
    </Routes>
  );
}
