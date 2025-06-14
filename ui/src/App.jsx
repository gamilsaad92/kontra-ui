// src/App.jsx

import React, { useContext, useState } from 'react';
import DashboardLayout from './components/DashboardLayout';
import LoginForm from './components/LoginForm';
import SignUpForm from './components/SignUpForm';
import { AuthContext } from './main';

export default function App() {
  const { session } = useContext(AuthContext);
  const [signUp, setSignUp] = useState(false);

  if (!session) {
    return signUp ? (
      <SignUpForm onSwitch={() => setSignUp(false)} />
    ) : (
      <LoginForm onSwitch={() => setSignUp(true)} />
    );
  }
  return <DashboardLayout />;
}
