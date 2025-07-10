export default function AttachmentsAndReview({ formData, onSubmit }) {
  const handleFinalSubmit = () => {
    // Call backend to persist all parts
    onSubmit()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Attachments & Final Review</h2>

      <div>
        <label>Upload Adjustor Report</label>
        <input type="file" className="input" />
      </div>

      <div>
        <label>Upload Photos</label>
        <input type="file" multiple className="input" />
      </div>

      <div>
        <label>Upload ACORD Form</label>
        <input type="file" className="input" />
      </div>

      <button onClick={handleFinalSubmit} className="btn btn-success">Submit to PRS</button>
    </div>
  )
}
