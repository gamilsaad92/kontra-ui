// ui/src/components/SignUpForm.jsx

import React, { useState, useContext, useEffect } from 'react'
import { AuthContext } from '../lib/authContext'
import ErrorBanner from './ErrorBanner.jsx'
import { Button, FormField, Input } from './ui'
import { useLocale } from '../lib/i18n'

export default function SignUpForm({ onSwitch, className = '' }) {
  const { supabase, isLoading } = useContext(AuthContext)
  const { t } = useLocale()  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [method, setMethod] = useState('password') // 'password' or 'magic'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

useEffect(() => {
    // reset messages when toggling sign-up method
    setError('')
    setSuccess('')
    if (method === 'magic') {
      setPassword('')
      setConfirmPassword('')
    }
  }, [method])

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
    setError(t('signup.emailRequired'))
      return
    }

    if (method === 'password') {
      if (!password) {
          setError(t('signup.passwordRequired'))
        return
      }
      if (password !== confirmPassword) {
      setError(t('signup.passwordsNoMatch'))
        return
      }
  }
    
    setLoading(true)
    try {
      if (method === 'password') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
          },
        })

        if (signUpError) {
          throw signUpError
        }
   
        setSuccess(t('signup.success'))
        setEmail('')
        setPassword('')
        setConfirmPassword('')
      } else {
         const { error: magicError } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        })

        if (magicError) {
          throw magicError
        }

        setSuccess(t('signup.magicSent'))
        setEmail('')
      }
        } catch (err) {
      setError(err?.message || t('common.genericError'))
    } finally {
      setLoading(false)
    }
  }

 const rootClass = ['space-y-4', 'text-slate-900', className].filter(Boolean).join(' ')

  return (
  <form onSubmit={handleSignUp} className={rootClass}>
      <div className="space-y-2 text-slate-900">
        <h2 className="text-2xl font-bold">{t('signup.title')}</h2>
        <p className="text-sm text-slate-600">{t('signup.subtitle')}</p>
      </div>

     <FormField
        type="email"
        placeholder={t('signup.email')}
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
        <span>{t('signup.createPasswordLabel')}</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="radio"
            value="magic"
            checked={method === 'magic'}
            onChange={() => setMethod('magic')}
          />
       <span>{t('signup.magicLabel')}</span>
        </label>
      </div>

      {method === 'password' && (
        <>
       <FormField
            type="password"
            placeholder={t('signup.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

            <Input
            type="password"
            placeholder={t('signup.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </>
      )}

      <Button
        type="submit"
      disabled={loading || isLoading || !supabase}
        className="w-full mt-sm"
      >
        {loading ? `${t('signup.submit')}…` : t('signup.submit')}
      </Button>

      {!isLoading && !supabase && (
        <p className="text-sm text-red-600">{authUnavailableMessage}</p>
      )}

    {success && <p className="text-sm text-emerald-600">{success}</p>}
      <ErrorBanner message={error} onClose={() => setError('')} />

      {onSwitch && (
       <p className="text-sm text-slate-600">
          {t('signup.signInPrompt')}{' '}
          <Button type="button" variant="ghost" onClick={onSwitch} className="px-0 underline">
            {t('signup.login')}
          </Button>
        </p>
      )}
    </form>
  )
}
