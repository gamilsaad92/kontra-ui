// ui/src/components/SignUpForm.jsx

import React, { useState, useContext } from 'react'
import { AuthContext } from '../main'

export default function SignUpForm({ onSwitch }) {
  const { supabase } = useContext(AuthContext)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleMagicLink = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMessage(
        '✅ Magic link sent! Check your inbox and click the link to sign in.'
      )
    }
  }

  return (
    <form
      onSubmit={handleMagicLink}
      className="max-w-md mx-auto mt-20 p-6 bg-white rounded-lg shadow"
    >
      <h2 className="text-2xl font-bold mb-4">Sign Up / Sign In</h2>

      <input
        type="email"
        placeholder="Your email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full border p-2 rounded mb-3"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
      >
        {loading ? 'Sending link…' : 'Send Magic Link'}
      </button>

      {message && <p className="mt-2 text-green-600">{message}</p>}
      {error   && <p className="mt-2 text-red-500">{error}</p>}

      <p className="mt-4 text-sm">
        Already have a magic link?{' '}
        <button
          type="button"
          onClick={onSwitch}
          className="text-blue-600 underline"
        >
          Go to Login
        </button>
      </p>
    </form>
  )
}
