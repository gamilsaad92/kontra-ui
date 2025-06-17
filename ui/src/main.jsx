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
      // 1) Try to pull session out of a magic-link URL (and store it)
      const {
        data: { session: newSession },
        error: urlError
      } = await supabase.auth.getSessionFromUrl({ storeSession: true });

      if (urlError) {
        console.error('Error getting session from URL:', urlError.message);
      }

      if (newSession) {
        setSession(newSession);
        // 2) Clear the URL hash so tokens aren’t visible
        window.history.replaceState({}, document.title, '/');
      } else {
        // 3) No magic-link? Check if we already have a session stored
        const {
          data: { session: storedSession },
          error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error getting existing session:', sessionError.message);
        } else {
          setSession(storedSession);
        }
      }
    }

    initSession();

    // 4) Subscribe to further auth-state changes (e.g. sign‐out)
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
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
