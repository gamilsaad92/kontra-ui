import { useState } from 'react'

export default function DrawReviewForm() {
  const [formData, setFormData] = useState({ budget: '', invoices: '', waiver: '', previousDraws: '' })
  const [result, setResult] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    const res = await fetch('/api/validate-draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    const data = await res.json()
    setResult(data.recommendation)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Validate Draw Request</h2>
      <textarea name="budget" onChange={handleChange} className="w-full p-2 mb-2 border" rows="2" placeholder="Budget" />
      <textarea name="invoices" onChange={handleChange} className="w-full p-2 mb-2 border" rows="2" placeholder="Invoices" />
      <textarea name="waiver" onChange={handleChange} className="w-full p-2 mb-2 border" rows="2" placeholder="Lien Waiver" />
      <textarea name="previousDraws" onChange={handleChange} className="w-full p-2 mb-2 border" rows="2" placeholder="Previous Draws" />
      <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 mt-2 rounded">Validate</button>
      {result && <div className="mt-4 p-3 bg-gray-50 border rounded">{result}</div>}
    </div>
  )
}
