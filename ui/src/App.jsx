// ui/src/App.tsx
import React from "react";
import { Routes, Route, Navigate, useInRouterContext } from "react-router-dom";
import KontraDashboard from "./pages/KontraDashboard";

function RouterTripwire({ name }: { name: string }) {
  const inside = useInRouterContext();
  if (!inside) console.error(`[RouterTripwire] ${name} is rendering OUTSIDE <Router>`);
  return null;
}

export default function App() {
  return (
    <>
      <RouterTripwire name="App" />
      <Routes>
        {/* Default redirect */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Render KontraDashboard for /dashboard and any subpaths */}
        <Route path="dashboard/*" element={<KontraDashboard />} />

        {/* Hard fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
