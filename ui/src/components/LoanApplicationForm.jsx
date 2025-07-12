// src/components/LoanApplicationForm.jsx

import React, { useState } from 'react'
import { API_BASE } from '../lib/apiBase'
import ErrorBanner from './ErrorBanner.jsx'
  
export default function LoanApplicationForm({ onSubmitted }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    ssn: '',
    amount: ''
  })
  const [file, setFile] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

    const handleAutoFill = async () => {
    if (!file) return
    setError('')
    setMessage('Extracting…')
    setLoading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`${API_BASE}/api/auto-fill`, {
        method: 'POST',
        body
      })
      const data = await res.json()
      if (res.ok && data.fields) {
        setFormData({ ...formData, ...data.fields })
        setMessage('Fields populated')
      } else {
        setError(data.message || 'Extraction failed')
      }
    } catch {
      setMessage('Extraction error')
    }
   setLoading(false)
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFile = (e) => {
    setFile(e.target.files[0])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('Submitting…')
        setLoading(true)

    const emailRegex = /.+@.+\..+/
    if (!emailRegex.test(formData.email)) {
      setError('Enter a valid email address')
      setLoading(false)
      return
    }
    if (!/^\d{9}$/.test(formData.ssn)) {
      setError('SSN must be 9 digits')
      setLoading(false)
      return
    }
    if (Number(formData.amount) <= 0) {
      setError('Amount must be positive')
      setLoading(false)
      return
    }
    try {
      const body = new FormData()
      Object.entries(formData).forEach(([k, v]) => body.append(k, v))
      if (file) body.append('document', file)
      const res = await fetch(`${API_BASE}/api/loan-applications`, {
        method: 'POST',
        body
      })
      const data = await res.json()
      if (res.ok) {
        setMessage('Application submitted!')
        onSubmitted && onSubmitted()
        setFormData({ name: '', email: '', ssn: '', amount: '' })
        setFile(null)
      } else {
     setError(data.message || 'Submission failed')
      }
    } catch { 
     setError('Submission error')
    }
        setLoading(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-xl font-semibold mb-4">Apply for a Loan</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          placeholder="Full Name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input
          name="ssn"
          placeholder="SSN"
          value={formData.ssn}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input
          name="amount"
          type="number"
          placeholder="Amount"
          value={formData.amount}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input type="file" onChange={handleFile} className="w-full" />
              <button
          type="button"
          onClick={handleAutoFill}
          disabled={loading}
          className="w-full bg-gray-200 text-gray-800 py-2 rounded"
        >
        {loading ? 'Extracting…' : 'Auto Fill'}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
        >
        {loading ? 'Submitting…' : 'Submit'}
        </button>
      </form>
      {message && <p className="mt-3 text-green-600">{message}</p>}
      <ErrorBanner message={error} onClose={() => setError('')} />
    </div>
  )
}
