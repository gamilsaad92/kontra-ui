import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function InvestorReportForm({ onCreated }) {
  const [title, setTitle] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title || !fileUrl) return;
    const res = await fetch(`${API_BASE}/api/investor-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, file_url: fileUrl })
    });
    const data = await res.json();
    if (res.ok) {
      setMessage('Report saved');
      setTitle('');
      setFileUrl('');
      onCreated && onCreated();
    } else {
      setMessage(data.message || 'Failed');
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h4 className="text-lg font-semibold mb-4">Add Investor Report</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full border p-2 rounded"
          required
        />
        <input
          value={fileUrl}
          onChange={e => setFileUrl(e.target.value)}
          placeholder="File URL"
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
