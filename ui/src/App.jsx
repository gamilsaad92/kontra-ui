// ui/src/App.jsx

import React from 'react'
import DashboardLayout from './components/DashboardLayout'
import KontraDashboard from '@/components/dashboard/KontraDashboard'

export default function App() {
  return import.meta.env.NEXT_PUBLIC_NEW_DASH ? (
    <KontraDashboard role="lender" orgName="Kontra" userName="Jamil" />
  ) : (
    <DashboardLayout role="lender" orgName="Kontra" userName="Jamil" />
  )
}
