import React, { useState, useContext, useEffect } from 'react'
import { AuthContext } from '../lib/authContext'
import ErrorBanner from './ErrorBanner.jsx'
import { Button, FormField } from './ui'
import { useLocale } from '../lib/i18n'

export default function LoginForm({ onSwitch, className = '' }) {
  const { supabase, isLoading } = useContext(AuthContext)
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [method, setMethod] = useState('password') // 'password' or 'magic'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // clear state when switching methods
    setError('')
    setSuccess('')
    if (method === 'magic') setPassword('')
  }, [method])
  
  const authUnavailableMessage = 'Authentication is currently unavailable. Please try again later.'

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!supabase) {
      setError(authUnavailableMessage)
      return
    }

    if (!email) {
      setError(t('login.emailRequired'))
      return
    }

    if (method === 'password') {
      if (!password) {
        setError(t('login.passwordRequired'))
        return
      }

      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) {
        setError(error.message)
      }
    } else {
      // magic link sign-in
      setLoading(true)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      })
      setLoading(false)
      if (error) {
        setError(error.message)
      } else {
        setSuccess(t('login.magicSent'))
        setEmail('')
      }
    }
  }

 const rootClass = ['space-y-4', 'text-slate-900', className].filter(Boolean).join(' ')

  return (
    <form onSubmit={handleLogin} className={rootClass}>
      <div className="space-y-2 text-slate-900">
        <h2 className="text-2xl font-bold">{t('login.title')}</h2>
        <p className="text-sm text-slate-600">{t('login.subtitle')}</p>
      </div>
      <FormField
        type="email"
     placeholder={t('login.email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      
    <div className="flex space-x-4 text-sm text-slate-700">
        <label className="flex items-center space-x-1">
          <input
            type="radio"
            value="password"
            checked={method === 'password'}
            onChange={() => setMethod('password')}
          />
          <span>{t('login.password')}</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="radio"
            value="magic"
            checked={method === 'magic'}
            onChange={() => setMethod('magic')}
          />
          <span>{t('login.magicLabel')}</span>
        </label>
      </div>

      {method === 'password' && (
        <FormField
          type="password"
          placeholder={t('login.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      )}
       <Button type="submit" disabled={loading || isLoading || !supabase} className="w-full mt-sm">
        {loading
          ? t('login.loggingIn')
          : method === 'password'
          ? t('login.submit')
          : t('login.sendMagic')}
      </Button>
      {!isLoading && !supabase && (
        <p className="text-sm text-red-600">{authUnavailableMessage}</p>
      )}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <ErrorBanner message={error} onClose={() => setError('')} />
      {onSwitch && (
       <p className="text-sm text-slate-600">
          {t('login.noAccount')}{' '}
          <Button type="button" variant="ghost" onClick={onSwitch} className="px-0 underline">
            {t('login.signUp')}
          </Button>
        </p>
      )}
    </form>
  )
}
