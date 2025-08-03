import { useState } from 'react'

export default function InspectionReview() {
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    const formData = new FormData()
    if (images) {
      for (let i = 0; i < images.length; i++) {
        formData.append('images', images[i])
      }
    }
    formData.append('notes', notes)

    try {
      const res = await fetch('/api/inspect-review', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ error: 'Failed to analyze inspection.' })
    }

    setLoading(false)
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-3">Inspection Review</h2>

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => setImages(e.target.files)}
        className="mb-3"
      />

      <textarea
        rows="5"
        className="w-full p-3 border rounded mb-3"
        placeholder="Enter inspection notes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'Analyzing...' : 'Run AI Review'}
      </button>

      {result && (
        <div className="mt-5 bg-gray-50 border p-4 rounded">
          <h3 className="font-semibold mb-2">AI Results:</h3>
          {result.visionSummary && (
            <p><strong>Visual Summary:</strong> {result.visionSummary}</p>
          )}
          {result.textSummary && (
            <p className="mt-2"><strong>Text Summary:</strong> {result.textSummary}</p>
          )}
          {result.error && <p className="text-red-600">{result.error}</p>}
        </div>
      )}
    </div>
  )
}
