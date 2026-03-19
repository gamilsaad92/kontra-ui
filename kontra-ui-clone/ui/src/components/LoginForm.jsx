import React, { useState, useContext } from 'react'
import { AuthContext } from '../lib/authContext'
import { useLocale } from '../lib/i18n'

function normalizeEmailForAuth(rawEmail) {
  const trimmed = (rawEmail || '').trim().toLowerCase()
  if (!trimmed.includes('@')) return trimmed

  const [localPart, domainPart] = trimmed.split('@')
  if (!localPart || !domainPart) return trimmed

  if (!domainPart.includes('.')) {
    return `${localPart}@${domainPart}.com`
  }

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

    if (!email) {
      setError(t('login.emailRequired'))
      return
    }

    if (!password) {
      setError(t('login.passwordRequired'))
      return
    }

    setLoading(true)
    try {
      const authEmail = normalizeEmailForAuth(email)
      const { error: signInError } = await signIn({ email: authEmail, password })
      if (signInError) {
        setError(signInError.message)
      }
    } catch (err) {
      setError(err?.message || 'Unable to sign in right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {/* Email */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
          Email
        </label>
        <input
          type="email"
          placeholder="you@yourfirm.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={inputClass}
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={inputClass + ' pr-11'}
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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
                <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || authLoading}
        className="relative w-full overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          boxShadow: loading || authLoading ? 'none' : '0 4px 24px rgba(37,99,235,0.35)',
        }}
      >
        {loading || authLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Signing in…
          </span>
        ) : (
          'Sign in'
        )}
      </button>

      {/* Sign up link */}
      {onSwitch && (
        <p className="text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Create one
          </button>
        </p>
      )}
    </form>
  )
}
