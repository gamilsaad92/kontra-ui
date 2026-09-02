import React, { useState } from 'react';

export default function InspectionForm({ drawId }) {
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    setMessage('Inspection recorded');
    setDate('');
    setNotes('');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h4 className="text-xl font-semibold mb-4">
        Record Inspection{drawId ? ` (Draw #${drawId})` : ''}
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <textarea
          placeholder="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border p-2 rounded h-24"
        />
        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded"
        >
          Save
        </button>
      </form>
      {message && <p className="mt-3 text-green-600">{message}</p>}
    </div>
  );
}
