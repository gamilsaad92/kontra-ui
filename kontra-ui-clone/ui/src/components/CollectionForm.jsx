import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function CollectionForm({ onCreated }) {
  const [loanId, setLoanId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!loanId || !amount || !dueDate) return;
    const res = await fetch(`${API_BASE}/api/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loan_id: loanId, amount, due_date: dueDate })
    });
    const data = await res.json();
    if (res.ok) {
      setMessage('Collection entry created');
      setLoanId('');
      setAmount('');
      setDueDate('');
      onCreated && onCreated();
    } else {
      setMessage(data.message || 'Failed');
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h4 className="text-lg font-semibold mb-4">Add Collection</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          value={loanId}
          onChange={e => setLoanId(e.target.value)}
          placeholder="Loan ID"
          className="w-full border p-2 rounded"
          required
        />
        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount"
          type="number"
          className="w-full border p-2 rounded"
          required
        />
        <input
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          type="date"
          className="w-full border p-2 rounded"
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
        >
          Save
        </button>
      </form>
      {message && <p className="mt-3 text-green-600">{message}</p>}
    </div>
  );
}
