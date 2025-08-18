// ui/src/App.jsx

import React from 'react'
import DashboardLayout from './components/DashboardLayout'
import KontraDashboard from '@/components/KontraDashboard'

export default function App() {
  return import.meta.env.NEXT_PUBLIC_NEW_DASH ? (
<KontraDashboard apiBase={import.meta.env.VITE_API_BASE} initialRole="lender" />
  ) : (
    <DashboardLayout role="lender" orgName="Kontra" userName="Jamil" />
  )
}
