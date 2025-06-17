// src/App.jsx

import React, { useContext, useState } from 'react';
import DashboardLayout from './components/DashboardLayout';
import LoginForm from './components/LoginForm';
import SignUpForm from './components/SignUpForm';
// ↓ Import the context from your index.jsx file
import { AuthContext } from './index.jsx';

export default function App() {
  const { session } = useContext(AuthContext);
  const [signUp, setSignUp] = useState(false);

  // 1) No active session → show Login or Sign-Up form
  if (!session) {
    return signUp ? (
      <SignUpForm onSwitch={() => setSignUp(false)} />
    ) : (
      <LoginForm onSwitch={() => setSignUp(true)} />
    );
  }

  // 2) Session exists → show the full dashboard
  return <DashboardLayout />;
}
