// ui/src/App.jsx
import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import DashboardLayout from "./components/DashboardLayout"

// If you created these pages, keep the routes; otherwise remove the imports + routes.
import Loans from "./pages/Loans"
import Applications from "./pages/Applications"
import NotFound from "./pages/NotFound"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardLayout />} />
      <Route path="/loans" element={<Loans />} />
      <Route path="/applications" element={<Applications />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
