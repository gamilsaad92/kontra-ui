// ui/src/App.jsx

import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { SignedIn } from '@clerk/clerk-react'
import DashboardLayout from './components/DashboardLayout'
import DashboardShell from './components/DashboardShell'
import KontraDashboard from './pages/KontraDashboard'

export default function App() {
    return (
    <SignedIn>
      <Routes>
        <Route element={<DashboardShell />}>
          <Route path="/dashboard/kontra" element={<KontraDashboard />} />
        </Route>
        <Route path="/*" element={<DashboardLayout />} />
      </Routes>
    </SignedIn>
  )
}
