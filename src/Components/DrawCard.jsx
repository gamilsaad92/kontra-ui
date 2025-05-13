import React from 'react';

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
  const handleApprove = () => {
    onAction('approve', draw.id);
  };

  const handleReject = () => {
    const reason = prompt("Enter rejection comment:");
    if (reason) {
      onAction('reject', draw.id, reason);
    }
  };

  return (
    <div className="border rounded-xl p-4 shadow-md bg-white max-w-xl mx-auto mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* 🔄 Replaced image logo with text brand */}
          <span className="text-lg font-bold text-red-700">Kontra</span>
          <h2 className="text-lg font-bold">Draw Request #{draw.id}</h2>
        </div>
        <Badge status={draw.status} />
      </div>

      <div className="text-sm text-gray-600">
        <p>Submitted: {draw.submittedAt || '—'}</p>
        <p>Reviewed: {draw.reviewedAt || '—'}</p>
        <p>Approved: {draw.approvedAt || '—'}</p>
        <p>Rejected: {draw.rejectedAt || '—'}</p>
      </div>

      {draw.reviewComment && (
        <div className="mt-2 text-sm text-red-600 italic">
          Reviewer Comment: "{draw.reviewComment}"
        </div>
      )}

      {isAdmin && draw.status === 'submitted' && (
        <div className="flex gap-2 mt-4">
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
    </div>
  );
};
import LienWaiverForm from './LienWaiverForm';

{isAdmin && draw.status === 'submitted' && (
  <LienWaiverForm drawId={draw.id} onUploaded={(waiver)=>console.log('Waiver saved:', waiver)} />
)}
export default DrawCard;
