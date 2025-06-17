// ui/src/main.jsx

import React, { createContext, useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { supabase } from './lib/supabaseClient'
import * as Sentry from '@sentry/react'

//
// ── SENTRY INIT ────────────────────────────────────────────────────────────────
//
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
})

//
// ── AUTH CONTEXT & PROVIDER ─────────────────────────────────────────────────────
//
export const AuthContext = createContext(null)

function AuthProvider({ children }) {
  const [session, setSession] = useState(null)

  useEffect(() => {
    async function init() {
      // 1) magic-link callback => store session
      const {
        data: { session: magicSession },
        error: magicError
      } = await supabase.auth.getSessionFromUrl({ storeSession: true })

      if (magicError) {
        console.error('Error handling magic link:', magicError.message)
      }

      if (magicSession) {
        setSession(magicSession)
        // 2) clean URL
        window.history.replaceState({}, document.title, '/')
      } else {
        // 3) no link? load any existing session
        const {
          data: { session: existing },
          error: existingError
        } = await supabase.auth.getSession()

        if (existingError) {
          console.error('Error loading session:', existingError.message)
        } else {
          setSession(existing)
        }
      }
    }

    init()

    // 4) subscribe to future sign-in/out events
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, supabase }}>
      {children}
    </AuthContext.Provider>
  )
}

//
// ── BOOTSTRAP APP ───────────────────────────────────────────────────────────────
//
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)
