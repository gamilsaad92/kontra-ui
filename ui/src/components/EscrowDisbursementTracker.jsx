import React, { useState, useEffect } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function EscrowDisbursementTracker() {
  const [loanId, setLoanId] = useState('');
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [disbursements, setDisbursements] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loanId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/loans/${loanId}/escrow/disbursements`);
        const data = await res.json();
        setDisbursements(data.disbursements || []);
      } catch {
        setDisbursements([]);
      }
    })();
  }, [loanId]);

  const addDisbursement = async e => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/loans/${loanId}/escrow/disbursements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), payee })
      });
      const data = await res.json();
      if (res.ok && data.disbursement) {
        setDisbursements(d => [...d, data.disbursement]);
        setAmount('');
        setPayee('');
      } else {
        setError(data.message || 'Failed to add');
      }
    } catch {
      setError('Failed to add');
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow space-y-3">
      <h3 className="text-lg font-semibold">Escrow Disbursements</h3>
      <form onSubmit={addDisbursement} className="space-y-2">
        <input
          className="w-full border p-2 rounded"
          placeholder="Loan ID"
          value={loanId}
          onChange={e => setLoanId(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Payee"
          value={payee}
          onChange={e => setPayee(e.target.value)}
        />
        <button className="bg-green-600 text-white px-4 py-2 rounded" type="submit" disabled={!loanId || !amount || !payee}>
          Record
        </button>
      </form>
      {error && <p className="text-red-600">{error}</p>}
      {disbursements.length > 0 && (
        <table className="w-full text-left mt-4">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Payee</th>
              <th className="p-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {disbursements.map((d, i) => (
              <tr key={i}>
                <td className="p-2">{d.date}</td>
                <td className="p-2">{d.payee}</td>
                <td className="p-2">{d.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
