import React, { useState } from 'react';
export default function PaymentForm({ loanId, onPaid }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const handleSubmit = async e => {
    e.preventDefault();
    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/loans/${loanId}/payments`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount, payment_date: date })
    });
    setAmount(''); setDate(''); onPaid();
  };
  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6 space-y-2">
      <h3 className="font-semibold">Record Payment</h3>
      <input type="number" step="0.01" placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)} required className="w-full border p-2 rounded" />
      <input type="date" value={date} onChange={e=>setDate(e.target.value)} required className="w-full border p-2 rounded" />
      <button type="submit" className="bg-green-600 text-white py-2 px-4 rounded">Submit Payment</button>
    </form>
  );
}