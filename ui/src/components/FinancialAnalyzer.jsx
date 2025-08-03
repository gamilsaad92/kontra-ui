import { useState } from 'react'

export default function FinancialAnalyzer() {
  const [statement, setStatement] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/analyze-financials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement }),
      })

      const data = await response.json()
      setAnalysis(data.analysis)
    } catch (error) {
      setAnalysis('Error analyzing statement.')
    }
    setLoading(false)
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-3">Financial Statement Analysis</h2>
      <textarea
        className="w-full p-3 border rounded mb-3"
        rows="8"
        placeholder="Paste the borrower’s financials here..."
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
      />
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>

      {analysis && (
        <div className="mt-5 bg-gray-50 border p-4 rounded whitespace-pre-wrap">
          <strong>AI Analysis:</strong>
          <p className="mt-2">{analysis}</p>
        </div>
      )}
    </div>
  )
}
