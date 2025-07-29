import React, { useState, useEffect } from 'react';

function mockSummarize(notes) {
  const text = notes.map(n => n.text).join(' ');
  const words = text.trim().split(/\s+/);
  if (words.length <= 20) return text;
  return words.slice(0, 20).join(' ') + '...';
}

export default function LoanNotes() {
    const [activityNotes, setActivityNotes] = useState([]);
  const [staffNotes, setStaffNotes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [noteType, setNoteType] = useState('activity');
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setActivityNotes([
        { date: '2024-07-01', text: 'Borrower requested payoff statement.' },
        { date: '2024-07-10', text: 'Left voicemail about late fee.' }
      ]);
      setStaffNotes([
        { date: '2024-07-02', text: 'Discussed extension fees internally.' },
        { date: '2024-07-12', text: 'Approved short-term extension pending docs.' }
      ]);
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const handleAdd = () => {
    const note = { date: new Date().toLocaleDateString(), text: noteText };
    if (noteType === 'activity') {
      setActivityNotes([...activityNotes, note]);
    } else {
      setStaffNotes([...staffNotes, note]);
    }
    setNoteText('');
    setShowModal(false);
  };

  const activitySummary = mockSummarize(activityNotes);
  const staffSummary = mockSummarize(staffNotes);

  return (
    <div className="space-y-4">
      <button
        className="bg-blue-600 text-white px-3 py-1 rounded"
        onClick={() => setShowModal(true)}
      >
        Add Note
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white text-black p-4 rounded shadow space-y-2">
          <h3 className="font-semibold">Borrower Activity</h3>
          {activityNotes.map((n, i) => (
            <div key={i} className="border-t pt-1 text-sm">
              <div className="text-xs text-gray-500">{n.date}</div>
              <p>{n.text}</p>
            </div>
          ))}
          {activityNotes.length === 0 && (
            <p className="text-sm text-gray-500">No notes yet.</p>
          )}
          {activityNotes.length > 0 && (
            <div className="text-sm mt-2">
              <strong>Summary:</strong> {activitySummary}
            </div>
          )}
        </div>

        <div className="bg-white text-black p-4 rounded shadow space-y-2">
          <h3 className="font-semibold">Staff/Internal Notes</h3>
          {staffNotes.map((n, i) => (
            <div key={i} className="border-t pt-1 text-sm">
              <div className="text-xs text-gray-500">{n.date}</div>
              <p>{n.text}</p>
            </div>
          ))}
          {staffNotes.length === 0 && (
            <p className="text-sm text-gray-500">No notes yet.</p>
          )}
          {staffNotes.length > 0 && (
            <div className="text-sm mt-2">
              <strong>Summary:</strong> {staffSummary}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white text-black p-4 rounded shadow w-80 space-y-2">
            <h3 className="font-semibold">Add Note</h3>
            <select
              value={noteType}
              onChange={e => setNoteType(e.target.value)}
              className="border p-1 w-full"
            >
              <option value="activity">Borrower Activity</option>
              <option value="staff">Staff/Internal</option>
            </select>
            <textarea
              className="border p-1 w-full h-24"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button className="px-2 py-1" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                className="bg-blue-600 text-white px-3 py-1 rounded"
                onClick={handleAdd}
                disabled={!noteText.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
