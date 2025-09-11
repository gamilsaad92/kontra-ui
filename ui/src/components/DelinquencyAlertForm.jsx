import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function DelinquencyAlertForm() {
  const [loanId, setLoanId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  const sendAlert = async e => {
    e.preventDefault();
    setStatus('');
    try {
      const res = await fetch(`${API_BASE}/api/loans/${loanId}/alerts/delinquency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, message })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Email: ${data.sent.email ? 'sent' : 'failed'}, SMS: ${data.sent.sms ? 'sent' : 'failed'}`);
      } else {
        setStatus(data.message || 'Failed to send');
      }
    } catch {
      setStatus('Failed to send');
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow space-y-3">
      <h3 className="text-lg font-semibold">Delinquency Alert</h3>
      <form onSubmit={sendAlert} className="space-y-2">
        <input
          className="w-full border p-2 rounded"
          placeholder="Loan ID"
          value={loanId}
          onChange={e => setLoanId(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Phone"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        <textarea
          className="w-full border p-2 rounded"
          placeholder="Message"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <button className="bg-red-600 text-white px-4 py-2 rounded" type="submit" disabled={!loanId || (!email && !phone)}>
          Send Alert
        </button>
      </form>
      {status && <p>{status}</p>}
    </div>
  );
}
