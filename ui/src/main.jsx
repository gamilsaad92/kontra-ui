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
      // 1) Check for magic-link tokens in the URL and store them
      const {
        data: { session: magicSession },
        error: magicError
      } = await supabase.auth.getSessionFromUrl({ storeSession: true });

      if (magicError) {
        console.error('Error handling magic-link callback:', magicError.message);
      }

      if (magicSession) {
        setSession(magicSession);
        // 2) Remove the tokens from the URL so they’re not visible
        window.history.replaceState({}, document.title, '/');
      } else {
        // 3) No tokens? Try to load an existing session from storage
        const {
          data: { session: storedSession },
          error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error loading stored session:', sessionError.message);
        } else {
          setSession(storedSession);
        }
      }
    }

    initSession();

    // 4) Listen for auth changes (e.g. sign-out in another tab)
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
