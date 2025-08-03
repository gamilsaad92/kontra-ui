import { useState } from 'react'

export default function PropertyChangeReviewForm() {
  const [requestDetails, setRequestDetails] = useState('')
  const [loanTerms, setLoanTerms] = useState('')
  const [review, setReview] = useState('')

  const handleSubmit = async () => {
    const res = await fetch('/api/review-property-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestDetails, loanTerms }),
    })
    const data = await res.json()
    setReview(data.review)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Review Property Manager Change</h2>
      <textarea onChange={(e) => setRequestDetails(e.target.value)} className="w-full p-2 mb-2 border" rows="3" placeholder="Request Details" />
      <textarea onChange={(e) => setLoanTerms(e.target.value)} className="w-full p-2 mb-2 border" rows="3" placeholder="Loan Terms" />
      <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded">Submit for Review</button>
      {review && <div className="mt-4 p-3 bg-gray-50 border rounded">{review}</div>}
    </div>
  )
}
