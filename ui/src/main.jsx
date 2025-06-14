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
    async function initSession() {
      // Handle magic link and other redirects
      const { data, error } = await supabase.auth.getSessionFromUrl();
      if (error) console.error('Error getting session from URL', error);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
    }
    initSession();

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
