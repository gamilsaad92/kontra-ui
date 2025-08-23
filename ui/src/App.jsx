// ui/src/App.jsx
import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import DashboardLayout from "./components/DashboardLayout"
import Loans from "./pages/Loans"
import Applications from "./pages/Applications"
import NotFound from "./pages/NotFound"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* default to /dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardLayout />} />

        {/* example sections you can wire later */}
        <Route path="/loans" element={<Loans />} />
        <Route path="/applications" element={<Applications />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
