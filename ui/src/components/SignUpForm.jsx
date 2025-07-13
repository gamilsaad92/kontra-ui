// ui/src/components/SignUpForm.jsx

import React, { useState, useContext, useEffect } from 'react'
import { AuthContext } from '../main.jsx'
import ErrorBanner from './ErrorBanner.jsx'
import { useLocale } from '../lib/i18n'

export default function SignUpForm({ onSwitch }) {
  const { supabase } = useContext(AuthContext)
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

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

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

      setLoading(true)
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      })
      setLoading(false)
      if (signUpError) {
        setError(signUpError.message)
      } else {
        setSuccess(t('signup.success'))
        setEmail('')
        setPassword('')
        setConfirmPassword('')
      }
    } else {
      // magic link sign-up/login
      setLoading(true)
      const { error: magicError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      })
      setLoading(false)
      if (magicError) {
        setError(magicError.message)
      } else {
        setSuccess(t('signup.magicSent'))
        setEmail('')
      }
    }
  }

  return (
    <form
      onSubmit={handleSignUp}
      className="max-w-md mx-auto mt-20 p-6 bg-white rounded-lg shadow"
    >
      <h2 className="text-2xl font-bold mb-4">{t('signup.title')}</h2>

      <input
        type="email"
        placeholder={t('signup.email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full border p-2 rounded mb-3"
      />

      <div className="flex space-x-4 mb-3 text-sm">
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
          <input
            type="password"
            placeholder={t('signup.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full border p-2 rounded mb-3"
          />

          <input
            type="password"
            placeholder={t('signup.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="w-full border p-2 rounded mb-3"
          />
        </>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
      >
        {loading ? t('signup.submit') + '…' : t('signup.submit')}
      </button>

      {success && <p className="mt-2 text-green-600">{success}</p>}
      <ErrorBanner message={error} onClose={() => setError('')} />

      {onSwitch && (
        <p className="mt-4 text-sm">
         {t('signup.signInPrompt')}{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="text-blue-600 underline"
          >
             {t('signup.login')}
          </button>
        </p>
      )}
    </form>
  )
}
