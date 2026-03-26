import React, { useState, useContext } from 'react'
import { AuthContext } from '../lib/authContext'
import { useLocale } from '../lib/i18n'

function normalizeEmailForAuth(rawEmail) {
  const trimmed = (rawEmail || '').trim().toLowerCase()
  if (!trimmed.includes('@')) return trimmed
  const [localPart, domainPart] = trimmed.split('@')
  if (!localPart || !domainPart) return trimmed
  if (!domainPart.includes('.')) return `${localPart}@${domainPart}.com`
  return trimmed
}

export default function LoginForm({ onSwitch, onSuccess }) {
  const { signIn, loading: authLoading } = useContext(AuthContext)
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!email) { setError(t('login.emailRequired')); return }
    if (!password) { setError(t('login.passwordRequired')); return }
    setLoading(true)
    try {
      const { data, error: signInError } = await signIn({ email: normalizeEmailForAuth(email), password })
      if (signInError) {
        setError(signInError.message)
        return
      }
      if (!data?.session?.access_token) {
        setError('Signed in, but the session was not established. Please try again.')
        return
      }
      onSuccess?.()
      if (signInError) setError(signInError.message)
    } catch (err) {
      setError(err?.message || 'Unable to sign in right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const pillField = {
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {/* Email field */}
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={pillField}
      >
        <svg className="h-4 w-4 shrink-0" style={{ color: '#aaa' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m2 7 10 7 10-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="flex-1 bg-transparent text-sm text-white outline-none"
          style={{ caretColor: '#e53e3e' }}
        />
      </div>

      {/* Password field */}
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={pillField}
      >
        <svg className="h-4 w-4 shrink-0" style={{ color: '#aaa' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="flex-1 bg-transparent text-sm text-white outline-none"
          style={{ caretColor: '#e53e3e' }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword(!showPassword)}
          style={{ color: '#777' }}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {/* Forgot password */}
      <div className="flex justify-end">
        <button type="button" className="text-sm font-medium" style={{ color: '#e53e3e' }}>
          Forgot password?
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-2.5 rounded-xl border px-4 py-3"
          style={{ borderColor: 'rgba(229,62,62,0.3)', background: 'rgba(229,62,62,0.1)' }}
        >
          <svg className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#fc8181' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
          </svg>
          <p className="text-sm" style={{ color: '#fc8181' }}>{error}</p>
        </div>
      )}

      {/* Sign in button */}
      <button
        type="submit"
        disabled={loading || authLoading}
        className="w-full py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          borderRadius: '999px',
          background: 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)',
          boxShadow: '0 6px 28px rgba(229,62,62,0.45)',
          letterSpacing: '0.02em',
        }}
      >
        {loading || authLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Signing in…
          </span>
        ) : (
          'Sign In'
        )}
      </button>

      {/* Sign up link */}
      {onSwitch && (
        <div className="pt-1 text-center">
          <p className="text-sm" style={{ color: '#aaa' }}>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitch}
              className="font-medium"
              style={{ color: '#e53e3e' }}
            >
              Sign up
            </button>
          </p>
        </div>
      )}
    </form>
  )
}
