// src/index.jsx

import React, { createContext, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { supabase } from './lib/supabaseClient';
import * as Sentry from '@sentry/react';

//
// ── SENTRY INIT ────────────────────────────────────────────────────────────────
//
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
});

//
// ── AUTH CONTEXT & PROVIDER ─────────────────────────────────────────────────────
//
export const AuthContext = createContext();

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // Cleanup subscription on unmount
    return () => {
      if (listener?.subscription) {
        listener.subscription.unsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}

//
// ── RENDER APP ──────────────────────────────────────────────────────────────────
//
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
