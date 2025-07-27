import React, { useState } from 'react';
import PaymentHistory from './PaymentHistory';
import { API_BASE } from '../lib/apiBase';
import VirtualAssistant from './VirtualAssistant';
import LoanRecommendations from './LoanRecommendations';

export default function PaymentPortal() {
  const [loanId, setLoanId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('card');
  const [message, setMessage] = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    if (!loanId || !amount) {
      setMessage('Loan and amount required');
      return;
    }
    setMessage(`Processed $${amount} via ${method}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h4 className="text-xl font-semibold">Payment Portal</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
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
        <select
          className="w-full border p-2 rounded"
          value={method}
          onChange={e => setMethod(e.target.value)}
        >
          <option value="card">Credit Card</option>
          <option value="ach">ACH Transfer</option>
        </select>
        {method === 'card' ? (
          <div className="space-y-2">
            <input className="w-full border p-2 rounded" placeholder="Card Number" />
            <input className="w-full border p-2 rounded" placeholder="Expiration" />
            <input className="w-full border p-2 rounded" placeholder="CVV" />
          </div>
        ) : (
          <div className="space-y-2">
            <input className="w-full border p-2 rounded" placeholder="Routing Number" />
            <input className="w-full border p-2 rounded" placeholder="Account Number" />
          </div>
        )}
        <button
          className="w-full bg-blue-600 text-white py-2 rounded"
          type="submit"
        >
          Pay
        </button>
      </form>
      {message && <p className="text-green-600">{message}</p>}
      {loanId && <PaymentHistory loanId={loanId} />}
          {loanId && <LoanRecommendations loanId={loanId} />}
      <div className="border-t pt-4">
        <VirtualAssistant placeholder="Ask about payments…" />
      </div>
    </div>
  );
}
