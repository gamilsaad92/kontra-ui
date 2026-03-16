import React, { useState, useEffect } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function SelfServicePayment() {
  const [loanId, setLoanId] = useState('');
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [payoffDate, setPayoffDate] = useState('');
  const [payoff, setPayoff] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loanId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/loans/${loanId}/balance`);
        const data = await res.json();
        if (res.ok) setBalance(parseFloat(data.balance));
        else setBalance(null);
      } catch {
        setBalance(null);
      }
    })();
  }, [loanId]);

  useEffect(() => {
    if (!payoffDate || !loanId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/loans/${loanId}/payoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payoff_date: payoffDate })
        });
        const data = await res.json();
        if (res.ok) setPayoff(parseFloat(data.payoff));
        else setPayoff(null);
      } catch {
        setPayoff(null);
      }
    })();
  }, [payoffDate, loanId]);

  const valid = balance !== null && amount && parseFloat(amount) <= balance;

 const handleSubmit = async e => {
    e.preventDefault();
    if (!valid) {
      setMessage('Amount exceeds balance');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/payments/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          method: method === 'bank' ? 'ach' : 'card',
          order_id: loanId,
          metadata: { loanId }
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(
          data.client_secret
            ? `Payment intent created: ${data.client_secret}`
            : 'Payment processed'
        );
      } else {
        setMessage(data.message || 'Payment failed');
      }
    } catch {
      setMessage('Payment failed');
    }
  };

  return (
    <div className="bg-white rounded shadow p-4 space-y-4">
      <h3 className="text-xl font-semibold">Make a Payment</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full border p-2 rounded"
          placeholder="Loan ID"
          value={loanId}
          onChange={e => setLoanId(e.target.value)}
        />
        {balance !== null && (
          <p className="text-sm text-gray-600">Balance: ${balance.toFixed(2)}</p>
        )}
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
          <option value="bank">Bank Transfer</option>
          <option value="card">Credit Card</option>
        </select>
        <input
          className="w-full border p-2 rounded"
          type="date"
          value={payoffDate}
          onChange={e => setPayoffDate(e.target.value)}
          placeholder="Payoff Date"
        />
        {payoff !== null && (
          <p className="text-sm text-gray-600">Estimated Payoff: ${payoff.toFixed(2)}</p>
        )}
        <button
          className="w-full bg-green-600 text-white py-2 rounded"
          type="submit"
          disabled={!valid}
        >
          Pay Now
        </button>
      </form>
      {message && <p className="text-green-600">{message}</p>}
    </div>
  );
}
