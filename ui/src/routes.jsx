// ui/src/routes.jsx
import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import DashboardShell from "./components/DashboardShell"
import PortfolioOverview from "./pages/lender/PortfolioOverview"

// NOTE: DashboardShell should render <Outlet /> where child pages should appear.
export default function AppRoutes() {
  return (
    <Routes>
      {/* Shell layout with nested pages */}
      <Route path="/" element={<DashboardShell />}>
        {/* default page */}
        <Route index element={<PortfolioOverview />} />
        {/* explicit path from your snippet */}
        <Route path="lender/portfolio" element={<PortfolioOverview />} />
        {/* add more nested pages here... */}
      </Route>

      {/* catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
