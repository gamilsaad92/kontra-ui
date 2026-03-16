import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function LoanPayoffCalculator({ loanId }) {
  const [date, setDate] = useState('');
  const [payoff, setPayoff] = useState(null);

  const calculate = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/loans/${loanId}/payoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoff_date: date })
      });
      const data = await res.json();
      if (res.ok) setPayoff(data.payoff);
    } catch {
      setPayoff(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-2">
      <h4 className="text-lg font-medium">Payoff Calculator</h4>
      <input
        type="date"
        className="border p-1"
        value={date}
        onChange={e => setDate(e.target.value)}
      />
      <button onClick={calculate} className="px-2 py-1 bg-blue-600 text-white rounded">
        Calculate
      </button>
      {payoff !== null && <p>Estimated Payoff: {payoff.toFixed(2)}</p>}
    </div>
  );
}
