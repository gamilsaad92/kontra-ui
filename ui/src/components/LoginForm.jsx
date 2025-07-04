import React, { useState, useContext, useEffect } from 'react'
import { AuthContext } from '../main'

export default function LoginForm({ onSwitch }) {
  const { supabase } = useContext(AuthContext)
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
  
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email) {
      setError('Email is required.')
      return
    }

    if (method === 'password') {
      if (!password) {
        setError('Password is required.')
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
        setSuccess('✅ Magic link sent! Check your email to continue.')
        setEmail('')
      }
    }
  }

  return (
    <form onSubmit={handleLogin} className="max-w-md mx-auto mt-20 p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Log In</h2>
      <input
        type="email"
        placeholder="Email"
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
          <span>Password</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="radio"
            value="magic"
            checked={method === 'magic'}
            onChange={() => setMethod('magic')}
          />
          <span>Email Magic Link</span>
        </label>
      </div>

      {method === 'password' && (
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border p-2 rounded mb-3"
        />
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
      {loading ? 'Logging in…' : method === 'password' ? 'Log In' : 'Send Magic Link'}
      </button>
      {success && <p className="mt-2 text-green-600">{success}</p>}
      {error   && <p className="mt-2 text-red-500">{error}</p>}   
      {onSwitch && (
        <p className="mt-4 text-sm">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitch}
            className="text-blue-600 underline"
          >
            Sign Up
          </button>
        </p>
      )}
    </form>
  )
}
