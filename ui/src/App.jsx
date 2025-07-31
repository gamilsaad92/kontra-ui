// ui/src/App.jsx

import React, { useContext, useState } from 'react';
import LoginForm from './components/LoginForm';
import SignUpForm from './components/SignUpForm';
import InviteAcceptForm from './components/InviteAcceptForm';
import { AuthContext } from './lib/authContext';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import LandAcquisitionPage from './pages/LandAcquisitionPage.jsx';
import MarketAnalysisPage from './pages/MarketAnalysisPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
    const { session } = useContext(AuthContext);
  const [signUp, setSignUp] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite');
  if (!session) {
    if (inviteToken) {
      return <InviteAcceptForm token={inviteToken} />;
    }
    return signUp ? (
      <SignUpForm onSwitch={() => setSignUp(false)} />
    ) : (
      <LoginForm onSwitch={() => setSignUp(true)} />
      );
  }

   return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/land-acquisition" element={<LandAcquisitionPage />} />
      <Route path="/market-analysis" element={<MarketAnalysisPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
