import React, { useState, useContext } from 'react'
import { AuthContext } from '../lib/authContext'
import { useLocale } from '../lib/i18n'

const DEMO_ROLES = [
  { role: 'lender',   label: 'Lender',   color: '#800020', light: 'rgba(128,0,32,0.12)',   email: 'replit@kontraplatform.com' },
  { role: 'servicer', label: 'Servicer', color: '#b45309', light: 'rgba(180,83,9,0.12)',    email: 'replit@kontraplatform.com' },
  { role: 'investor', label: 'Investor', color: '#6d28d9', light: 'rgba(109,40,217,0.12)',  email: 'replit@kontraplatform.com' },
  { role: 'borrower', label: 'Borrower', color: '#065f46', light: 'rgba(6,95,70,0.12)',     email: 'replit@kontraplatform.com' },
]
const DEMO_PASSWORD = '12345678'

function normalizeEmailForAuth(rawEmail) {
  const trimmed = (rawEmail || '').trim().toLowerCase()
  if (!trimmed.includes('@')) return trimmed
  const [localPart, domainPart] = trimmed.split('@')
  if (!localPart || !domainPart) return trimmed
  if (!domainPart.includes('.')) return `${localPart}@${domainPart}.com`
  return trimmed
}

export default function LoginForm({ onSwitch }) {
  const { signIn } = useContext(AuthContext)
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState(null)
  const [demoRole, setDemoRole] = useState(null)

  const fillDemo = (rd) => {
    setDemoRole(rd.role)
    setEmail(rd.email)
    setPassword(DEMO_PASSWORD)
    setError('')
    try { localStorage.setItem('kontra_demo_role', rd.role) } catch (_) {}
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!email) { setError(t('login.emailRequired')); return }
    if (!password) { setError(t('login.passwordRequired')); return }
    setLoading(true)
    try {
      const { error: signInError } = await signIn({ email: normalizeEmailForAuth(email), password })
      if (signInError) setError(signInError.message)
    } catch (err) {
      setError(err?.message || 'Unable to sign in right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (field) => ({
    background: focusedField === field ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${focusedField === field ? 'rgba(128,0,32,0.5)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '8px',
    transition: 'border-color 0.15s, background 0.15s',
  })

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-5">

      {/* Demo role pills */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#555' }}>
          Try a demo account
        </p>
        <div className="grid grid-cols-4 gap-2">
          {DEMO_ROLES.map((rd) => (
            <button
              key={rd.role}
              type="button"
              onClick={() => fillDemo(rd)}
              style={{
                background: demoRole === rd.role ? rd.color : rd.light,
                border: `1px solid ${demoRole === rd.role ? rd.color : 'transparent'}`,
                borderRadius: '8px',
                color: demoRole === rd.role ? '#fff' : rd.color,
                padding: '8px 4px',
                fontSize: '11px',
                fontWeight: 600,
                transition: 'all 0.15s',
                cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              {rd.label}
            </button>
          ))}
        </div>
        {demoRole && (
          <p className="mt-2 text-xs" style={{ color: '#666' }}>
            Demo credentials filled — click <span style={{ color: '#800020' }}>Sign In</span> to continue as {demoRole.charAt(0).toUpperCase() + demoRole.slice(1)}.
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <span className="text-xs" style={{ color: '#444' }}>or enter your credentials</span>
        <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#888' }}>
          Email
        </label>
        <div className="flex items-center px-3.5 py-3" style={inputStyle('email')}>
          <svg className="mr-2.5 h-3.5 w-3.5 shrink-0" style={{ color: focusedField === 'email' ? '#800020' : '#555' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m2 7 10 7 10-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setDemoRole(null) }}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            required
            autoComplete="email"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#444]"
            style={{ caretColor: '#800020' }}
          />
        </div>
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#888' }}>
            Password
          </label>
          <button
            type="button"
            className="text-xs font-medium transition-colors"
            style={{ color: '#800020' }}
            onMouseEnter={e => e.target.style.color = '#b83550'}
            onMouseLeave={e => e.target.style.color = '#800020'}
          >
            Forgot?
          </button>
        </div>
        <div className="flex items-center px-3.5 py-3" style={inputStyle('password')}>
          <svg className="mr-2.5 h-3.5 w-3.5 shrink-0" style={{ color: focusedField === 'password' ? '#800020' : '#555' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            required
            autoComplete="current-password"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#444]"
            style={{ caretColor: '#800020' }}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="ml-2 transition-colors"
            style={{ color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.color = '#999'}
            onMouseLeave={e => e.currentTarget.style.color = '#555'}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3"
          style={{ borderColor: 'rgba(128,0,32,0.25)', background: 'rgba(128,0,32,0.08)' }}
        >
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: '#d45f73' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
          </svg>
          <p className="text-xs leading-relaxed" style={{ color: '#d45f73' }}>{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 transition-opacity"
        style={{
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #800020 0%, #660018 100%)',
          boxShadow: '0 4px 20px rgba(128,0,32,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          letterSpacing: '0.01em',
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Signing in…
          </span>
        ) : (
          'Sign In'
        )}
      </button>

      {/* Sign up */}
      {onSwitch && (
        <p className="text-center text-xs" style={{ color: '#555' }}>
          No account?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="font-semibold transition-colors"
            style={{ color: '#800020' }}
            onMouseEnter={e => e.target.style.color = '#b83550'}
            onMouseLeave={e => e.target.style.color = '#800020'}
          >
            Create one
          </button>
        </p>
      )}
    </form>
  )
}
