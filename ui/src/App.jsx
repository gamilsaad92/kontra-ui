// ui/src/App.jsx

import React, { useContext, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import DashboardShell from './components/DashboardShell'
import LoginForm from './components/LoginForm'
import SignUpForm from './components/SignUpForm'
import InviteAcceptForm from './components/InviteAcceptForm'
import KontraDashboard from './pages/KontraDashboard'
import { AuthContext } from './lib/authContext'

export default function App() {
  const { session } = useContext(AuthContext)
  const [signUp, setSignUp] = useState(false)
  const params = new URLSearchParams(window.location.search)
  const inviteToken = params.get('invite')
  
  if (!session) {
    if (inviteToken) {
      return <InviteAcceptForm token={inviteToken} />
    }
    return signUp ? (
      <SignUpForm onSwitch={() => setSignUp(false)} />
    ) : (
      <LoginForm onSwitch={() => setSignUp(true)} />
    )
  }

    return (
    <Routes>
      <Route element={<DashboardShell />}>
        <Route path="/dashboard/kontra" element={<KontraDashboard />} />
      </Route>
      <Route path="/*" element={<DashboardLayout />} />
    </Routes>
  )
}
