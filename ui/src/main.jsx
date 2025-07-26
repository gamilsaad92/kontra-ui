// ui/src/main.jsx

import React, { createContext, useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'
import { supabase } from './lib/supabaseClient'
import * as Sentry from '@sentry/react'
import { LocaleProvider } from './lib/i18n'
import { BrandingProvider } from './lib/branding'
import { RoleProvider } from './lib/roles'

//
// ── SENTRY INIT ────────────────────────────────────────────────────────────────
//
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
})

// register service worker for offline support
registerSW({ immediate: true })

//
// ── AUTH CONTEXT & PROVIDER ─────────────────────────────────────────────────────
//
export const AuthContext = createContext(null)

function AuthProvider({ children }) {
@@ -68,45 +67,38 @@ function AuthProvider({ children }) {
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
            <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <SignedIn>
        <BrowserRouter>
          <LocaleProvider>
            <AuthProvider>
              <BrandingProvider>
                <RoleProvider>
                  <App />
                </RoleProvider>
              </BrandingProvider>
            </AuthProvider>
          </LocaleProvider>
        </BrowserRouter>
      </SignedIn>
      <SignedOut>
        <SignIn />
      </SignedOut>
    </ClerkProvider>
  </React.StrictMode>
)
