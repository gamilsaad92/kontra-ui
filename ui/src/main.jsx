import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'
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

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
})

registerSW({ immediate: true })

// Set background color based on current time
const hour = new Date().getHours()
document.body.style.backgroundColor =
  hour >= 6 && hour < 18 ? '#808080' : '#000000'

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

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <RootLayout>
      <SignedIn>
        <BrowserRouter>
          <LocaleProvider>
            <AuthProvider>
              <BrandingProvider>
                <RoleProvider>
                  <Sentry.ErrorBoundary fallback={<p>Something went wrong loading the app.</p>}>
                    <App />
                  </Sentry.ErrorBoundary>
                </RoleProvider>
              </BrandingProvider>
            </AuthProvider>
          </LocaleProvider>
        </BrowserRouter>
      </SignedIn>
      <SignedOut>
        <SignIn />
      </SignedOut>
    </RootLayout>
  </React.StrictMode>
)
