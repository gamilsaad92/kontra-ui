// ui/src/main.jsx
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
} from '@clerk/clerk-react'
import RootLayout from './RootLayout.jsx'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'
import { supabase } from './lib/supabaseClient'
import { AuthContext } from './lib/authContext'
import * as Sentry from '@sentry/react'
import { LocaleProvider } from './lib/i18n'
import { BrandingProvider } from './lib/branding'
import { RoleProvider } from './lib/roles'

// ── SENTRY INIT ───────────────────────────────────────────────
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
})

// register service worker for offline support
registerSW({ immediate: true })

// ── AUTH CONTEXT & PROVIDER ───────────────────────────────────
function AuthProvider({ children }) {
  const [session, setSession] = useState(null)

  useEffect(() => {
    async function init() {
      const {
        data: { session: magicSession },
        error: magicError,
      } = await supabase.auth.getSessionFromUrl({ storeSession: true })

    if (magicError) console.error('Error handling magic link:', magicError.message)

      if (magicSession) {
        setSession(magicSession)
      } else {
        const {
          data: { session: existing },
          error: existingError,
        } = await supabase.auth.getSession()
        if (existingError) {
          console.error('Error loading session:', existingError.message)
        } else {
          setSession(existing)
        }
      }

      if (window.location.hash || window.location.search) {
        window.history.replaceState({}, document.title, '/')
      }
    }
    init()

    const {
      data: { subscription },
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

// ── BOOTSTRAP APP ─────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Put Clerk first; Router wraps the whole UI (SignedIn + SignedOut) */}
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      frontendApi={import.meta.env.VITE_CLERK_FRONTEND_API}
      // (optional) You can remove this since we now use BrowserRouter
      navigate={(to) => window.history.pushState(null, '', to)}
    >
      <BrowserRouter>
        <RootLayout>
          <SignedIn>
            <LocaleProvider>
              <AuthProvider>
                <BrandingProvider>
                  <RoleProvider>
                    <App />
                  </RoleProvider>
                </BrandingProvider>
              </AuthProvider>
            </LocaleProvider>
          </SignedIn>

          <SignedOut>
            <SignIn />
          </SignedOut>
        </RootLayout>
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
)
