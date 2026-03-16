// ui/src/RootLayout.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './lib/authContext'
import { apiRequest } from './lib/apiClient'
import { apiRoutes } from './lib/apiRoutes'

export default function RootLayout({ children }) {
 const { session, signOut } = useContext(AuthContext)
  const [branding, setBranding] = useState(null)
  const [orgName, setOrgName] = useState('Kontra')
  const [role, setRole] = useState('guest')
 const [apiError, setApiError] = useState(null)
  const [apiToast, setApiToast] = useState(null)

  // Apply global html/body classes safely for a Vite SPA
  useEffect(() => {
    document.documentElement.lang = 'en'
    document.documentElement.classList.add('dark')
    document.body.classList.add('bg-slate-950', 'text-slate-100', 'min-h-screen')
    return () => {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('bg-slate-950', 'text-slate-100', 'min-h-screen')
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = async () => {
      await signOut()
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }

    const onForbidden = () => {
      setApiToast({ message: 'Insufficient permissions', status: 403 })
    }

    const onEndpointMissing = (event) => {
      const detail = event?.detail || {}
      setApiToast({ message: `Endpoint missing: ${detail.path || 'unknown'}`, status: detail.status || 404 })
    }

    window.addEventListener('api:unauthorized', onUnauthorized)
    window.addEventListener('api:forbidden', onForbidden)
    window.addEventListener('api:endpoint-missing', onEndpointMissing)

    return () => {
      window.removeEventListener('api:unauthorized', onUnauthorized)
      window.removeEventListener('api:forbidden', onForbidden)
      window.removeEventListener('api:endpoint-missing', onEndpointMissing)
    }
  }, [signOut])

  const accentColor = useMemo(() => {
    if (!branding) return '#22d3ee'
    return branding.primaryColor || branding.primary_color || '#22d3ee'
  }, [branding])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor)
  }, [accentColor])

  useEffect(() => {
    let isMounted = true
    const loadBranding = async () => {
      try {
        const headers = {}
        const orgId = session?.user?.user_metadata?.organization_id
        if (orgId) headers['x-organization-id'] = orgId
        const data = await apiRequest('GET', apiRoutes.ssoConfig, undefined, { headers })
        if (!isMounted) return
        setBranding(data.organization?.branding || null)
        setOrgName(data.organization?.name || 'Kontra')
        setRole(data.role || 'guest')
      } catch (err) {
        console.error('Branding fetch failed', err)
        if (isMounted) {
          setBranding(null)
          setRole('guest')
        }
      }
    }

    loadBranding()
    return () => {
      isMounted = false
    }
  }, [session?.user?.user_metadata?.organization_id])

    useEffect(() => {
    if (!session?.user) {
      return
    }

    let active = true
    const checkWhoami = async () => {
      try {
        const data = await apiRequest('GET', apiRoutes.whoami, undefined, {}, { requireAuth: true })
        if (active) {
          console.info('[API] whoami', data)
        }
      } catch (error) {
        if (active) {
          console.warn('[API] whoami failed', error)
        }
      }
    }

    checkWhoami()
    return () => {
      active = false
    }
  }, [session?.user])

  useEffect(() => {
    let timer
    const handler = (event) => {
      setApiError(event.detail)
      setApiToast(event.detail)
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => setApiToast(null), 4000)
    }

    window.addEventListener('api:error', handler)
    return () => {
      window.removeEventListener('api:error', handler)
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ '--brand-accent': accentColor }}>
      {import.meta.env.DEV && apiError && (
        <div className="bg-rose-600/90 text-white text-xs px-4 py-2 flex items-center justify-between">
          <span>
            API Error: {apiError.message || 'Request failed'} {apiError.status ? `(${apiError.status})` : ''}
          </span>
          <button
            type="button"
            onClick={() => setApiError(null)}
            className="text-white/80 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}
      <header className="flex justify-between items-center p-4 gap-4 h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          {branding?.logo_url && (
            <img src={branding.logo_url} alt="Organization logo" className="h-8 w-8 rounded-full bg-slate-800 object-cover" />
          )}
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-wide text-slate-400">Organization</p>
            <p className="text-sm font-semibold text-white">{orgName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold capitalize text-white">
            {role}
          </span>
          {session?.user?.email && (
            <div className="flex flex-col text-right">
              <span className="text-xs text-slate-400">Signed in</span>
              <span className="text-sm text-white">{session.user.email}</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>
       {apiToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {apiToast.message || 'Request failed'} {apiToast.status ? `(${apiToast.status})` : ''}
        </div>
      )}
    </div>
  )
}
