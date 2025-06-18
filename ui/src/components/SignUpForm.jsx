// ui/src/components/SignUpForm.jsx

import React, { useState, useContext } from 'react'
import { AuthContext } from '../main.jsx'

export default function SignUpForm({ onSwitch }) {
  const { supabase } = useContext(AuthContext)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // 1) Validate inputs
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    // 2) Call Supabase signUp; this sends the confirmation email
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // After confirming, user will be redirected back here
        emailRedirectTo: window.location.origin
      }
    })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
    } else {
      setSuccess(
        '✅ Signup successful! Check your email for the confirmation link.'
      )
      // Clear form (optional)
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <form
      onSubmit={handleSignUp}
      className="max-w-md mx-auto mt-20 p-6 bg-white rounded-lg shadow"
    >
      <h2 className="text-2xl font-bold mb-4">Sign Up</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full border p-2 rounded mb-3"
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        className="w-full border p-2 rounded mb-3"
      />

      <input
        type="password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={6}
        className="w-full border p-2 rounded mb-3"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
      >
        {loading ? 'Signing up…' : 'Sign Up'}
      </button>

      {success && <p className="mt-2 text-green-600">{success}</p>}
      {error   && <p className="mt-2 text-red-500">{error}</p>}

      {onSwitch && (
        <p className="mt-4 text-sm">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="text-blue-600 underline"
          >
            Log In
          </button>
        </p>
      )}
    </form>
  )
}
