// ui/src/components/SignUpForm.jsx

import React, { useState, useContext, useEffect } from 'react'
import { AuthContext } from '../lib/authContext'
import ErrorBanner from './ErrorBanner.jsx'
import { Button, FormField, Input } from './ui'
import { useLocale } from '../lib/i18n'

const SIGNUP_ROLES = [
  {
    value: 'borrower',
    label: 'Borrower',
    description: 'I have a loan and need to track draws, payments, and documents.',
    icon: '🏗️',
  },
  {
    value: 'investor',
    label: 'Investor',
    description: 'I have capital invested and need to view holdings and distributions.',
    icon: '📈',
  },
]

export default function SignUpForm({ onSwitch, className = '' }) {
  const { supabase, isLoading } = useContext(AuthContext)
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedRole, setSelectedRole] = useState('borrower')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setError('')
    setSuccess('')
  }, [selectedRole])

  const authUnavailableMessage = 'Authentication is currently unavailable. Please try again later.'
  const redirectTo = `${window.location.origin}/auth/callback`

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!supabase) {
      setError(authUnavailableMessage)
      return
    }

    if (!email) {
      setError('Email is required.')
      return
    }

    if (!password) {
      setError('Password is required.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName || undefined,
            app_role: selectedRole,
          },
        },
      })

      if (signUpError) throw signUpError

      setSuccess('Account created! Check your email to confirm, then sign in.')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setFullName('')
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSignUp} className={['space-y-5', className].filter(Boolean).join(' ')}>

      {/* Role selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          I'm joining as…
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SIGNUP_ROLES.map((role) => (
            <button
              key={role.value}
              type="button"
              onClick={() => setSelectedRole(role.value)}
              className={[
                'relative flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-all',
                selectedRole === role.value
                  ? 'border-red-700 bg-red-950/30 ring-1 ring-red-700'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-500',
              ].join(' ')}
            >
              <span className="text-base">{role.icon}</span>
              <span className="text-sm font-semibold text-white">{role.label}</span>
              <span className="text-xs text-slate-400 leading-snug">{role.description}</span>
              {selectedRole === role.value && (
                <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-700 text-white text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600 pt-0.5">
          Lenders and servicers are invited by your organization admin.
        </p>
      </div>

      {/* Full name */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
        <input
          type="text"
          placeholder="Jane Smith"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-600"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Email *</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-600"
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Password *</label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-600"
        />
      </div>

      {/* Confirm password */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password *</label>
        <input
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-600"
        />
      </div>

      {success && (
        <p className="text-sm text-emerald-400 bg-emerald-900/20 border border-emerald-800 rounded-lg px-3 py-2">
          {success}
        </p>
      )}
      <ErrorBanner message={error} onClose={() => setError('')} />

      <button
        type="submit"
        disabled={loading || isLoading || !supabase}
        className="w-full py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating account…' : `Create ${SIGNUP_ROLES.find(r => r.value === selectedRole)?.label} Account`}
      </button>

      {!isLoading && !supabase && (
        <p className="text-sm text-red-400">{authUnavailableMessage}</p>
      )}

      {onSwitch && (
        <p className="text-sm text-slate-500 text-center">
          Already have an account?{' '}
          <button type="button" onClick={onSwitch} className="text-red-400 hover:text-red-300 underline">
            Sign in
          </button>
        </p>
      )}
    </form>
  )
}
