import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function LoanDeferralForm({ loanId, onUpdated }) {
  const [months, setMonths] = useState('');
  const [message, setMessage] = useState(null);

  const submit = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/loans/${loanId}/defer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months })
      });
      if (res.ok) {
        setMessage('Deferral submitted');
        onUpdated && onUpdated();
      } else {
        setMessage('Failed to defer');
      }
    } catch {
      setMessage('Failed to defer');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-2">
      <h4 className="text-lg font-medium">Maturity Deferral</h4>
      <input
        type="number"
        className="border p-1"
        placeholder="Months"
        value={months}
        onChange={e => setMonths(e.target.value)}
      />
      <button onClick={submit} className="px-2 py-1 bg-blue-600 text-white rounded">
        Submit
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
