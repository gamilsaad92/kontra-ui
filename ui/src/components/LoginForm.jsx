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

export default function LoginForm({ onSwitch }) {
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
      const { error: signInError } = await signIn({ email: normalizeEmailForAuth(email), password })
      if (signInError) setError(signInError.message)
    } catch (err) {
      setError(err?.message || 'Unable to sign in right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fieldStyle = {
    borderColor: 'rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {/* Email */}
      <div>
        <label className="block text-xs font-medium" style={{ color: '#9ca3af' }}>Email address</label>
        <div
          className="mt-1.5 flex items-center rounded-lg border px-4 py-3 gap-2.5 transition-colors focus-within:border-red-900"
          style={fieldStyle}
        >
          <svg className="h-4 w-4 shrink-0" style={{ color: '#4b5563' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m2 7 10 7 10-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="email"
            placeholder="you@yourfirm.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium" style={{ color: '#9ca3af' }}>Password</label>
          <span className="text-xs font-medium cursor-pointer" style={{ color: '#b91c1c' }}>Forgot password?</span>
        </div>
        <div
          className="mt-1.5 flex items-center rounded-lg border px-4 py-3 gap-2.5 transition-colors focus-within:border-red-900"
          style={fieldStyle}
        >
          <svg className="h-4 w-4 shrink-0" style={{ color: '#4b5563' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="transition-colors"
            style={{ color: '#4b5563' }}
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
      </div>

      {/* Remember me */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div className="h-4 w-4 rounded border" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
          <span className="text-xs" style={{ color: '#6b7280' }}>Remember me</span>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-2.5 rounded-xl border px-4 py-3"
          style={{ borderColor: 'rgba(185,28,28,0.3)', background: 'rgba(185,28,28,0.1)' }}
        >
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || authLoading}
        className="w-full rounded-lg py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)',
          boxShadow: '0 4px 24px rgba(153,27,27,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
          letterSpacing: '0.02em',
        }}
      >
        {loading || authLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Signing in…
          </span>
        ) : (
          'Sign in to Kontra'
        )}
      </button>

      {/* Sign up link */}
      {onSwitch && (
        <div className="border-t pt-5 text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-sm" style={{ color: '#4b5563' }}>
            New to Kontra?{' '}
            <button
              type="button"
              onClick={onSwitch}
              className="font-semibold transition-colors"
              style={{ color: '#b91c1c' }}
            >
              Create an account
            </button>
          </p>
        </div>
      )}
    </form>
  )
}
