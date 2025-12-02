// ui/src/RootLayout.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './lib/authContext'
import { resolveApiBase } from './lib/api'
import { getSessionToken } from './lib/http'

export default function RootLayout({ children }) {
  const { session } = useContext(AuthContext)
  const [branding, setBranding] = useState(null)
  const [orgName, setOrgName] = useState('Kontra')
  const [role, setRole] = useState('guest')
  
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
        const apiBase = resolveApiBase()
        const headers = {}
        const orgId = session?.user?.user_metadata?.organization_id
        if (orgId) headers['X-Org-Id'] = orgId
        const token = await getSessionToken()
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch(`${apiBase}/sso/config`, { headers })
        if (!res.ok) throw new Error('Failed to load organization theme')
        const data = await res.json()
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

  return (
    <div className="min-h-screen flex flex-col" style={{ '--brand-accent': accentColor }}>
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
    </div>
  )
}
