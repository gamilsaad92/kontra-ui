import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function BorrowerCommunicationsLog() {
  const [loanId, setLoanId] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('note');
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!loanId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/loans/${loanId}/communications`);
        const data = await res.json();
        setLog(Array.isArray(data.communications) ? data.communications : []);
      } catch {
        setLog([]);
      }
    })();
  }, [loanId]);

  const addEntry = async e => {
    e.preventDefault();
    if (!loanId || !message) return;
    try {
      const res = await fetch(`${API_BASE}/api/loans/${loanId}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, type })
      });
      const data = await res.json();
      if (res.ok && data.entry) {
        setLog(l => [...l, data.entry]);
        setMessage('');
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow space-y-3">
      <h3 className="text-lg font-semibold">Borrower Communications</h3>
      <form onSubmit={addEntry} className="space-y-2">
        <input
          className="w-full border p-2 rounded"
          placeholder="Loan ID"
          value={loanId}
          onChange={e => setLoanId(e.target.value)}
        />
        <select
          className="w-full border p-2 rounded"
          value={type}
          onChange={e => setType(e.target.value)}
        >
          <option value="note">Note</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <textarea
          className="w-full border p-2 rounded"
          placeholder="Message"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          type="submit"
          disabled={!loanId || !message}
        >
          Add Entry
        </button>
      </form>
      {log.length > 0 && (
        <ul className="space-y-1 text-sm">
          {log.map((e, i) => (
            <li key={i} className="border-b pb-1">
              <div className="text-xs text-gray-500">{e.date} – {e.type}</div>
              <div>{e.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
