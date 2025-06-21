// src/components/LoanApplicationForm.jsx

import React, { useState } from 'react'
import { API_BASE } from '../lib/apiBase'

export default function LoanApplicationForm({ onSubmitted }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    ssn: '',
    amount: ''
  })
  const [file, setFile] = useState(null)
  const [message, setMessage] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFile = (e) => {
    setFile(e.target.files[0])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('Submitting…')
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
        setMessage(data.message || 'Submission failed')
      }
    } catch {
      setMessage('Submission error')
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
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
        >
          Submit
        </button>
      </form>
      {message && <p className="mt-3 text-green-600">{message}</p>}
    </div>
  )
}
