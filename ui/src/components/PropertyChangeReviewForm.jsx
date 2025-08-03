import { useState } from 'react'

export default function PropertyChangeReviewForm() {
  const [requestDetails, setRequestDetails] = useState('')
  const [loanTerms, setLoanTerms] = useState('')
  const [review, setReview] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/review-property-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestDetails, loanTerms }),
      })

      const data = await res.json()
      setReview(data.review)
    } catch (error) {
      setReview('Error reviewing property management change.')
    }
    setLoading(false)
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-3">Property Manager Change Review</h2>

      <textarea
        className="w-full p-3 border rounded mb-3"
        rows="4"
        placeholder="Enter request details from borrower..."
        value={requestDetails}
        onChange={(e) => setRequestDetails(e.target.value)}
      />

      <textarea
        className="w-full p-3 border rounded mb-3"
        rows="4"
        placeholder="Enter original loan terms..."
        value={loanTerms}
        onChange={(e) => setLoanTerms(e.target.value)}
      />

      <button
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'Reviewing...' : 'Submit for AI Review'}
      </button>

      {review && (
        <div className="mt-5 bg-gray-50 border p-4 rounded whitespace-pre-wrap">
          <strong>AI Review:</strong>
          <p className="mt-2">{review}</p>
        </div>
      )}
    </div>
  )
}
