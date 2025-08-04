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
  const [submitLoading, setSubmitLoading] = useState(false)
  const [autoFillLoading, setAutoFillLoading] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [autoFillMessage, setAutoFillMessage] = useState('')
  const [error, setError] = useState('')

  // Auto-fill using document upload
  const handleAutoFill = async () => {
    if (!file) {
      setError('Please upload a document for auto-fill')
      return
    }
    setError('')
    setAutoFillMessage('Extracting…')
    setAutoFillLoading(true)
    try {
      const body = new FormData()
      body.append('document', file) // match backend multer field

      const res = await fetch(`${API_BASE}/api/loan-applications/auto-fill`, {
        method: 'POST',
        body,
      })
      const data = await res.json()
      if (res.ok && data.fields) {
        setFormData(prev => ({ ...prev, ...data.fields }))
        setAutoFillMessage('Fields populated')
      } else {
        throw new Error(data.message || 'Extraction failed')
      }
    } catch (err) {
      console.error('Auto-fill error:', err)
      setError(err.message || 'Extraction error')
    } finally {
      setAutoFillLoading(false)
    }
  }

  // Handle form field changes
  const handleChange = e => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Handle file selection
  const handleFile = e => {
    const selected = e.target.files && e.target.files[0]
    setFile(selected || null)
    setAutoFillMessage('')
    setError('')
  }

  // Submit the loan application
  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setSubmitMessage('')
    setSubmitLoading(true)

    // Client-side validation
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Enter a valid email address')
      setSubmitLoading(false)
      return
    }
    if (!/^\d{9}$/.test(formData.ssn)) {
      setError('SSN must be 9 digits')
      setSubmitLoading(false)
      return
    }
    if (!(Number(formData.amount) > 0)) {
      setError('Amount must be positive')
      setSubmitLoading(false)
      return
    }

    try {
      const body = new FormData()
      body.append('name', formData.name)
      body.append('email', formData.email)
      body.append('ssn', formData.ssn)
      body.append('amount', formData.amount)
      if (file) body.append('document', file)

      const res = await fetch(`${API_BASE}/api/loan-applications`, {
        method: 'POST',
        body,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Submission failed')
      }
      setSubmitMessage('Application submitted!')
      onSubmitted && onSubmitted(data.application)
      setFormData({ name: '', email: '', ssn: '', amount: '' })
      setFile(null)
      setAutoFillMessage('')
    } catch (err) {
      console.error('Submission error:', err)
      setError(err.message || 'Submission error')
    } finally {
      setSubmitLoading(false)
    }
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

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={autoFillLoading}
            className="w-full bg-gray-200 text-gray-800 py-2 rounded"
          >
            {autoFillLoading ? 'Extracting…' : 'Auto Fill'}
          </button>
          {autoFillMessage && <p className="text-gray-600">{autoFillMessage}</p>}
        </div>

        <div className="space-y-2">
          <button
            type="submit"
            disabled={submitLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
          >
            {submitLoading ? 'Submitting…' : 'Submit'}
          </button>
          {submitMessage && <p className="text-green-600">{submitMessage}</p>}
        </div>
      </form>
      <ErrorBanner message={error} onClose={() => setError('')} />
    </div>
  )
}
