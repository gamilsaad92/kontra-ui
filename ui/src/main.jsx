// ui/src/main.jsx

import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'
import { supabase } from './lib/supabaseClient'
import { AuthContext } from './lib/authContext'
  import * as Sentry from '@sentry/react'
import { LocaleProvider } from './lib/i18n'
import { BrandingProvider } from './lib/branding'
import { RoleProvider } from './lib/roles'

//
// ── SENTRY INIT ───────────────────────────────────────────────────────────────
//
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
})

// register service worker for offline support
registerSW({ immediate: true })

//
// ── AUTH CONTEXT & PROVIDER ───────────────────────────────────────────────────
//

function AuthProvider({ children }) {
  const [session, setSession] = useState(null)

  useEffect(() => {
    async function init() {
      // 1) magic-link callback => store session
      const {
        data: { session: magicSession },
        error: magicError,
      } = await supabase.auth.getSessionFromUrl({ storeSession: true })

      if (magicError) {
        console.error('Error handling magic link:', magicError.message)
      }

      if (magicSession) {
        setSession(magicSession)
      } else {
        // 2) no link? load any existing session
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

      // 3) clean URL hash or query params regardless of outcome
      if (window.location.hash || window.location.search) {
        window.history.replaceState({}, document.title, '/')
      }
    }
    
    init()

    // 4) subscribe to future sign-in/out events
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

//
// ── BOOTSTRAP APP ─────────────────────────────────────────────────────────────
//
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
   <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      frontendApi={import.meta.env.VITE_CLERK_FRONTEND_API}
      navigate={(to) => window.history.pushState(null, '', to)}
    >
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
