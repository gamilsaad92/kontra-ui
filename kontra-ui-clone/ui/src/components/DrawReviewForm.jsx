import { useState } from 'react'
import { apiFetch } from '../lib/apiClient'

export default function DrawReviewForm() {
  const [formData, setFormData] = useState({
    budget: '',
    invoices: '',
    waiver: '',
    previousDraws: '',
  })
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/validate-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      setResult(data.recommendation)
    } catch (error) {
      setResult('Error validating draw request.')
    }
    setLoading(false)
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-3">Draw Request Validation</h2>

      {['budget', 'invoices', 'waiver', 'previousDraws'].map((field) => (
        <textarea
          key={field}
          name={field}
          rows="3"
          className="w-full p-3 border rounded mb-3"
          placeholder={`Enter ${field}...`}
          value={formData[field]}
          onChange={handleChange}
        />
      ))}

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? 'Validating...' : 'Validate'}
      </button>

      {result && (
        <div className="mt-5 bg-gray-50 border p-4 rounded whitespace-pre-wrap">
          <strong>AI Recommendation:</strong>
          <p className="mt-2">{result}</p>
        </div>
      )}
    </div>
  )
}
