import React, { useState } from 'react';
import Card from '../../components/Card';
import { API_BASE } from '../../lib/apiBase';

export default function PortfolioCampaignCard({ to }) {
  const [loanId, setLoanId] = useState('LN-2048');
  const [email, setEmail] = useState('borrower@example.com');
  const [phone, setPhone] = useState('+15550123456');
  const [eventName, setEventName] = useState('escrow.shortfall');
  const [metric, setMetric] = useState('escrow_balance');
  const [delta, setDelta] = useState('-1200');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  const triggerCampaign = async () => {
    setSending(true);
    setStatus('');
    try {
      const res = await fetch(`${API_BASE}/api/send-communication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId,
          borrower: { name: 'Borrower', email, phone },
          event: {
            name: eventName,
            metric,
            delta,
            severity: 'high',
            recommendation: 'Top off escrow or schedule a catch-up call.',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to send');
      setStatus(`Sent via ${data.campaign?.channelsUsed?.join(', ') || 'campaign'}`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card title="Portfolio Campaign" to={to}>
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Loan ID</span>
            <input className="w-full rounded border p-2" value={loanId} onChange={e => setLoanId(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Borrower Email</span>
            <input className="w-full rounded border p-2" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Borrower Phone</span>
            <input className="w-full rounded border p-2" value={phone} onChange={e => setPhone(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Event Name</span>
            <input className="w-full rounded border p-2" value={eventName} onChange={e => setEventName(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Metric</span>
            <input className="w-full rounded border p-2" value={metric} onChange={e => setMetric(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Delta</span>
            <input className="w-full rounded border p-2" value={delta} onChange={e => setDelta(e.target.value)} />
          </label>
        </div>
        <button
          className="mt-2 w-full rounded bg-emerald-600 px-3 py-2 text-white"
          onClick={triggerCampaign}
          disabled={sending}
        >
          {sending ? 'Sending…' : 'Send Campaign'}
        </button>
        {status && <p className="text-xs text-gray-700">{status}</p>}
        <p className="text-xs text-gray-500">Campaigns post to /api/send-communication and mirror entries into the communications log.</p>
      </div>
    </Card>
  );
}
