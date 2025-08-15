// ui/src/App.jsx

import React, { useContext, useState } from 'react'
import KontraDashboard from './components/KontraDashboard'
import LoginForm from './components/LoginForm'
import SignUpForm from './components/SignUpForm'
import InviteAcceptForm from './components/InviteAcceptForm'
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

  return <DashboardLayout />
}
