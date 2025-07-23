// ui/src/App.jsx

import React, { useContext, useState } from 'react'
import DashboardLayout from './components/DashboardLayout'
import LoginForm from './components/LoginForm'
import SignUpForm from './components/SignUpForm'
import InviteAcceptForm from './components/InviteAcceptForm'
import { AuthContext } from './main.jsx'

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
