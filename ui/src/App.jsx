import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import KontraDashboard from "./pages/KontraDashboard";

// (Optionally add real sub-pages later)
function Placeholder({ title }) { return <div className="p-6">{title}</div>; }

export default function App() {
  return (
    <Routes>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<KontraDashboard />} />
      {/* if/when you add subroutes, define them here too */}
      <Route path="dashboard/loans" element={<Placeholder title="Loans" />} />
      <Route path="dashboard/servicing" element={<Placeholder title="Servicing" />} />
      <Route path="dashboard/draws" element={<Placeholder title="Draws" />} />
      <Route path="dashboard/reports" element={<Placeholder title="Reports" />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
