import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function PayoffInstructions() {
  const [loanId, setLoanId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');

  const fetchInstructions = async e => {
    e.preventDefault();
    setInstructions('');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/loans/${loanId}/payoff-instructions`);
      const data = await res.json();
      if (res.ok && data.instructions) {
        setInstructions(data.instructions);
      } else {
        setError(data.message || 'No instructions available');
      }
    } catch {
      setError('Failed to fetch instructions');
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow space-y-3">
      <h3 className="text-lg font-semibold">Payoff Instructions</h3>
      <form onSubmit={fetchInstructions} className="space-y-2">
        <input
          className="w-full border p-2 rounded"
          placeholder="Loan ID"
          value={loanId}
          onChange={e => setLoanId(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">
          Fetch
        </button>
      </form>
      {instructions && <pre className="whitespace-pre-wrap">{instructions}</pre>}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
