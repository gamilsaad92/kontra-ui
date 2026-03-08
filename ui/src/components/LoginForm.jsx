import React, { useState, useContext } from 'react'
import { AuthContext } from '../lib/authContext'
import ErrorBanner from './ErrorBanner.jsx'
import { Button, FormField } from './ui'
import { useLocale } from '../lib/i18n'

export default function LoginForm({ onSwitch, className = '' }) {
const { signIn, loading: authLoading } = useContext(AuthContext)
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      const { error: signInError } = await signIn({ email, password })
      if (signInError) {
        setError(signInError.message)
      }
      } catch (err) {
      setError(err?.message || 'Unable to sign in right now. Please try again.')
    } finally {
      setLoading(false)     
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
        <FormField
        type="password"
        placeholder={t('login.password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button
        type="submit"
        disabled={loading || authLoading}
        className="w-full mt-4 rounded-lg bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? t('login.loggingIn') : t('login.submit')}
      </button>
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
