import React, { useState } from 'react';

const statusColors = {
  draft: 'bg-gray-300 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

const Badge = ({ status }) => (
  <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[status] || 'bg-gray-200 text-black'}`}>
    {status.replace('_', ' ').toUpperCase()}
  </span>
);

const DrawCard = ({ draw, isAdmin, onAction }) => {
  const [inspector, setInspector] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inspectionMessage, setInspectionMessage] = useState('');

  const handleApprove = () => {
    onAction('approve', draw.id);
  };

  const handleReject = () => {
    const reason = prompt("Enter rejection comment:");
    if (reason) {
      onAction('reject', draw.id, reason);
    }
  };

  const handleInspectionSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setInspectionMessage('');
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/add-inspection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draw_id: draw.id,
          inspector,
          notes,
          photos: [] // You can wire up photo upload later
        })
      });
      const data = await res.json();
      if (res.ok) {
        setInspectionMessage('✅ Inspection submitted');
        setInspector('');
        setNotes('');
      } else {
        setInspectionMessage(data.message || 'Submission failed');
      }
    } catch (err) {
      setInspectionMessage('⚠️ Error submitting inspection');
    }
    setSubmitting(false);
  };

  return (
    <div className="border rounded-xl p-4 shadow-md bg-white max-w-xl mx-auto mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Kontra Logo" className="h-8 w-auto" />
          <h2 className="text-lg font-bold">Draw Request #{draw.id}</h2>
        </div>
        <Badge status={draw.status} />
      </div>

      <div className="text-sm text-gray-600">
        <p>Project: {draw.project}</p>
        <p>Amount: ${draw.amount}</p>
        <p>Submitted: {draw.submitted_at || '—'}</p>
        <p>Reviewed: {draw.reviewedAt || '—'}</p>
        <p>Approved: {draw.approvedAt || '—'}</p>
        <p>Rejected: {draw.rejectedAt || '—'}</p>
      </div>

      {draw.reviewComment && (
        <div className="mt-1 text-sm text-red-600 italic">
          Reviewer Comment: "{draw.reviewComment}"
        </div>
      )}

      {typeof draw.risk_score === 'number' && (
        <div className="text-sm font-medium">
          Risk Score:{' '}
          <span className={
            draw.risk_score < 50 ? 'text-red-600' :
            draw.risk_score < 75 ? 'text-yellow-600' :
            'text-green-600'
          }>
            {draw.risk_score}/100
          </span>
        </div>
      )}

      {isAdmin && draw.status === 'submitted' && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            ✅ Approve
          </button>
          <button
            onClick={handleReject}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            ❌ Reject
          </button>
        </div>
      )}

      {isAdmin && (
        <form onSubmit={handleInspectionSubmit} className="pt-4 border-t mt-4 space-y-2 text-sm">
          <p className="font-semibold text-gray-700">Submit Inspection</p>
          <input
            type="text"
            placeholder="Inspector name"
            value={inspector}
            onChange={(e) => setInspector(e.target.value)}
            className="w-full border p-1 rounded"
            required
          />
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border p-1 rounded"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            {submitting ? 'Submitting...' : 'Submit Inspection'}
          </button>
          {inspectionMessage && <p className="text-sm mt-1">{inspectionMessage}</p>}
        </form>
      )}
    </div>
  );
};

export default DrawCard;
