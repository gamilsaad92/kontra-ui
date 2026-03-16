// src/components/PaymentForm.jsx

import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import ErrorBanner from './ErrorBanner.jsx';

export default function PaymentForm({ loanId, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!amount || !paymentDate) {
    setError('Both fields are required');
      return;
    }
       if (Number(amount) <= 0) {
      setError('Amount must be positive');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
         `${API_BASE}/api/loans/${loanId}/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, date: paymentDate })
        }
      );
      const data = await res.json();
      if (res.ok) {
        setMessage('Payment recorded');
        onSubmit && onSubmit();
        setAmount('');
        setPaymentDate('');
      } else {
        setError(data.message || 'Failed to record payment');
      }
    } catch {
         setError('Error recording payment'); 
    }
   setLoading(false);
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
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded"
        >
       {loading ? 'Recording…' : 'Record Payment'}
        </button>
      </form>
      {message && <p className="mt-3 text-green-600">{message}</p>}
          <ErrorBanner message={error} onClose={() => setError('')} />
    </div>
  );
}
