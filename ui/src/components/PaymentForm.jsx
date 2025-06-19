// src/components/PaymentForm.jsx

import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function PaymentForm({ loanId, onPaid }) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!amount || !paymentDate) {
      setMessage('Both fields are required');
      return;
    }
    try {
      const res = await fetch(
        ${API_BASE}/api/loans/${loanId}/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, payment_date: paymentDate })
        }
      );
      const data = await res.json();
      if (res.ok) {
        setMessage('Payment recorded');
        onPaid();
        setAmount('');
        setPaymentDate('');
      } else {
        setMessage(data.message || 'Failed to record payment');
      }
    } catch {
      setMessage('Error recording payment');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h4 className="text-xl font-semibold mb-4">Record Payment (Loan #{loanId})</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="number"
          placeholder="Payment Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />
        <input
          type="date"
          placeholder="Payment Date"
          value={paymentDate}
          onChange={e => setPaymentDate(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />
        <button
          type="submit"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded"
        >
          Record Payment
        </button>
      </form>
      {message && <p className="mt-3 text-green-600">{message}</p>}
    </div>
  );
}
