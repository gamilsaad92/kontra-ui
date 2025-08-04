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
   const [status, setStatus] = useState({ type: '', text: '' })

  const MAX_SIZE = 5 * 1024 * 1024 // 5MB
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

  // Auto-fill using document upload
  const handleAutoFill = async () => {
    if (!file) {
      setStatus({ type: 'error', text: 'Please upload a document for auto-fill' })
      return
    }
    setStatus({ type: '', text: '' })
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
      setStatus({ type: 'success', text: 'Fields populated' })
      } else {
       throw new Error(data.message || 'Failed to extract fields')
      }
    } catch (err) {
      console.error('Auto-fill error:', err)
     setStatus({ type: 'error', text: err.message || 'Extraction error' })
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
      setStatus({ type: '', text: '' })
    if (!selected) {
      setFile(null)
      return
    }
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setStatus({ type: 'error', text: 'Only PDF or image files are allowed' })
      e.target.value = ''
      setFile(null)
      return
    }
    if (selected.size > MAX_SIZE) {
      setStatus({ type: 'error', text: 'File must be 5MB or smaller' })
      e.target.value = ''
      setFile(null)
      return
    }
    setFile(selected)
  }

  // Submit the loan application
  const handleSubmit = async e => {
    e.preventDefault()
    setStatus({ type: '', text: '' })
    setSubmitLoading(true)

    // Client-side validation
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setStatus({ type: 'error', text: 'Enter a valid email address' })
      setSubmitLoading(false)
      return
    }
    if (!/^\d{9}$/.test(formData.ssn)) {
     setStatus({ type: 'error', text: 'SSN must be 9 digits' })
      setSubmitLoading(false)
      return
    }
    if (!(Number(formData.amount) > 0)) {
      setStatus({ type: 'error', text: 'Amount must be positive' })
      setSubmitLoading(false)
      return
    }
    if (file && (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_SIZE)) {
      setStatus({ type: 'error', text: 'Invalid document selected' })
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
      setStatus({ type: 'success', text: 'Application submitted!' })
      onSubmitted && onSubmitted(data.application)
      setFormData({ name: '', email: '', ssn: '', amount: '' })
      setFile(null)
    } catch (err) {
      console.error('Submission error:', err)
      setStatus({ type: 'error', text: err.message || 'Submission error' })
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
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={handleFile}
          className="w-full"
        />

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={autoFillLoading}
            className="w-full bg-gray-200 text-gray-800 py-2 rounded"
          >
            {autoFillLoading ? 'Extracting…' : 'Auto Fill'}
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="submit"
            disabled={submitLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
          >
            {submitLoading ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
            {status.type === 'success' && (
        <p className="text-green-600 mt-2">{status.text}</p>
      )}
      <ErrorBanner
        message={status.type === 'error' ? status.text : ''}
        onClose={() => setStatus({ type: '', text: '' })}
      />
    </div>
  )
}
