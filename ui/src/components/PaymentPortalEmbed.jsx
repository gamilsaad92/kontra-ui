import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function PaymentPortalEmbed() {
  const [loanId, setLoanId] = useState('');
  const [amount, setAmount] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const createPortal = async e => {
    e.preventDefault();
    setMessage('');
    if (!loanId || !amount) {
      setMessage('Loan ID and amount required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/loans/${loanId}/payment-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setPortalUrl(data.url);
      } else {
        setMessage(data.message || 'Failed to create portal');
      }
    } catch {
      setMessage('Failed to create portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h4 className="text-xl font-semibold mb-4">Payment Portal</h4>
      {portalUrl ? (
        <iframe
          src={portalUrl}
          title="Payment Portal"
          className="w-full h-96 border"
        />
      ) : (
        <form onSubmit={createPortal} className="space-y-4">
          <input
            value={loanId}
            onChange={e => setLoanId(e.target.value)}
            placeholder="Loan ID"
            className="w-full border p-2 rounded"
            required
          />
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full border p-2 rounded"
            required
          />
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded"
          >
            Launch Portal
          </button>
        </form>
      )}
      {loading && <p>Loading…</p>}
      {message && <p className="mt-3 text-red-600">{message}</p>}
    </div>
  );
}
