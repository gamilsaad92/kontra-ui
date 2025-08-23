// ui/src/App.jsx
import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import DashboardLayout from "./components/DashboardLayout"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardLayout />} />
      {/* wildcard -> dashboard */}
      <Route path="*" element={<DashboardLayout />} />
    </Routes>
  )
}
