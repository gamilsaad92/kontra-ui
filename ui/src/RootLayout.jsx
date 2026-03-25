// ui/src/RootLayout.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './lib/authContext'
import { apiRequest, getApiBaseUrl, setOrgContext } from './lib/apiClient'
import { apiRoutes } from './lib/apiRoutes'
import { OrgProvider, useOrg } from './lib/OrgProvider'

// ── Org switcher dropdown ─────────────────────────────────────
function OrgSwitcher() {
  const { orgs, activeOrg, setActiveOrg, loading } = useOrg()
  const [open, setOpen] = useState(false)

  if (loading || orgs.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[120px] truncate">{activeOrg?.name ?? 'Select org'}</span>
        {orgs.length > 1 && (
          <svg className="h-3 w-3 text-slate-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 4l4 4 4-4" />
          </svg>
        )}
      </button>

      {open && orgs.length > 1 && (
        <div className="absolute right-0 z-50 mt-1 w-56 origin-top-right rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          <ul role="listbox" className="py-1">
            {orgs.map((org) => (
              <li key={org.id} role="option" aria-selected={activeOrg?.id === org.id}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    activeOrg?.id === org.id
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                  onClick={() => {
                    setActiveOrg(org)
                    setOpen(false)
                  }}
                >
                  <span className="block truncate">{org.name}</span>
                  <span className="block text-xs text-slate-500 capitalize">{org.role}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Inner layout (has access to OrgProvider context) ──────────
function LayoutInner({ children, branding, orgName, role, apiError, apiToast, onDismissError }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ '--brand-accent': branding?.primaryColor || branding?.primary_color || '#22d3ee' }}>
      {import.meta.env.DEV && apiError && (
        <div className="bg-rose-600/90 text-white text-xs px-4 py-2 flex items-center justify-between">
          <span>
            API Error: {apiError.message || 'Request failed'} {apiError.status ? `(${apiError.status})` : ''}
          </span>
          <button type="button" onClick={onDismissError} className="text-white/80 hover:text-white">
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
            <p className="text-xs uppercase tracking-wide text-slate-400">Workspace</p>
            <p className="text-sm font-semibold text-white">{orgName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <OrgSwitcher />
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold capitalize text-white">
            {role}
          </span>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {apiToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg border border-slate-700">
          {apiToast.message || 'Request failed'} {apiToast.status ? `(${apiToast.status})` : ''}
        </div>
      )}
    </div>
  )
}

// ── Root layout (provides OrgProvider) ───────────────────────
export default function RootLayout({ children }) {
  const { session, signOut } = useContext(AuthContext)
  const [branding, setBranding] = useState(null)
  const [orgName, setOrgName] = useState('Kontra')
  const [role, setRole] = useState('guest')
  const [apiError, setApiError] = useState(null)
  const [apiToast, setApiToast] = useState(null)

  // Global html/body classes
  useEffect(() => {
    document.documentElement.lang = 'en'
    document.documentElement.classList.add('dark')
    document.body.classList.add('bg-slate-950', 'text-slate-100', 'min-h-screen')
    return () => {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('bg-slate-950', 'text-slate-100', 'min-h-screen')
    }
  }, [])

  // Global API event listeners
  useEffect(() => {
    const onUnauthorized = async () => {
      await signOut()
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    const onForbidden = () => setApiToast({ message: 'Insufficient permissions', status: 403 })
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

  // API error toast
  useEffect(() => {
    let timer
    const handler = (event) => {
      setApiError(event.detail)
      setApiToast(event.detail)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setApiToast(null), 4000)
    }
    window.addEventListener('api:error', handler)
    return () => {
      window.removeEventListener('api:error', handler)
      if (timer) clearTimeout(timer)
    }
  }, [])

  // Load branding (only needs to run once per session; org context is managed by OrgProvider)
  useEffect(() => {
    let isMounted = true
    const loadBranding = async () => {
      try {
        const data = await apiRequest('GET', apiRoutes.ssoConfig, undefined, {})
        if (!isMounted) return
        setBranding(data.organization?.branding || null)
        setOrgName(data.organization?.name || 'Kontra')
        setRole(data.role || 'guest')
      } catch {
        if (isMounted) { setBranding(null); setRole('guest') }
      }
    }
    loadBranding()
    return () => { isMounted = false }
  }, [session?.user?.id])

  // Whoami check
  useEffect(() => {
    if (!session?.user) return
    let active = true
    apiRequest('GET', apiRoutes.whoami, undefined, {}, { requireAuth: true })
      .then((data) => { if (active) console.info('[API] whoami', data) })
      .catch((err) => { if (active) console.warn('[API] whoami failed', err) })
    return () => { active = false }
  }, [session?.user?.id])

  const accentColor = useMemo(() => {
    if (!branding) return '#22d3ee'
    return branding.primaryColor || branding.primary_color || '#22d3ee'
  }, [branding])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor)
  }, [accentColor])

  // Determine the API base for OrgProvider's bootstrap call
 const apiBase = getApiBaseUrl()

  return (
    <OrgProvider
      accessToken={session?.access_token ?? null}
      userId={session?.user?.id ?? null}
      apiBase={apiBase}
    >
      <LayoutInner
        branding={branding}
        orgName={orgName}
        role={role}
        apiError={apiError}
        apiToast={apiToast}
        onDismissError={() => setApiError(null)}
      >
        {children}
      </LayoutInner>
    </OrgProvider>
  )
}
