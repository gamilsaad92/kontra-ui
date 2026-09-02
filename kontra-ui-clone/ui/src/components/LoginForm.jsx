import React, { useState, useContext } from 'react'
import { AuthContext } from '../lib/authContext'
import { useLocale } from '../lib/i18n'

function normalizeEmail(raw) {
  const trimmed = (raw || '').trim().toLowerCase()
  if (!trimmed.includes('@')) return trimmed
  const [local, domain] = trimmed.split('@')
  if (!local || !domain) return trimmed
  if (!domain.includes('.')) return `${local}@${domain}.com`
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

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!email) { setError(t('login.emailRequired')); return }
    if (!password) { setError(t('login.passwordRequired')); return }
    setLoading(true)
    try {
      const { error: err } = await signIn({ email: normalizeEmail(email), password })
      if (err) setError(err.message)
    } catch (e) {
      setError(e?.message || 'Unable to sign in right now. Please try again.')
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
    <form onSubmit={handleLogin} className="flex flex-col gap-4">

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
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
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
          <button type="button" className="text-xs font-medium" style={{ color: '#800020' }}>
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
            autoComplete="current-password"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#444]"
            style={{ caretColor: '#800020' }}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            style={{ color: '#555' }}
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
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: '#800020' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
          </svg>
          <p className="text-xs leading-relaxed" style={{ color: '#800020' }}>{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 transition-opacity"
        style={{
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #800020 0%, #600018 100%)',
          boxShadow: '0 4px 20px rgba(128,0,32,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Signing in…
          </span>
        ) : 'Sign In'}
      </button>

      {onSwitch && (
        <p className="text-center text-xs" style={{ color: '#555' }}>
          No account?{' '}
          <button type="button" onClick={onSwitch} className="font-semibold" style={{ color: '#800020' }}>
            Create one
          </button>
        </p>
      )}
    </form>
  )
}
