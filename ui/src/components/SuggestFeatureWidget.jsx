import React, { useState } from 'react';
import { apiFetch } from '../lib/apiClient'

export default function SuggestFeatureWidget() {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'feature', message })
      });
      setSent(true);
    } catch (err) {
      console.error('Failed to send feedback', err);
    }
  }

  if (sent) return <p className="p-2 bg-green-100">Thanks for the suggestion!</p>;

  return (
    <form onSubmit={submit} className="space-y-2" aria-label="Suggest a Feature">
      <label htmlFor="feature-message" className="block font-bold">
        Suggest a Feature
      </label>
      <textarea
        id="feature-message"
        className="w-full border rounded p-2"
        value={message}
        onChange={e => setMessage(e.target.value)}
      />
      <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded">
        Send
      </button>
    </form>
  );
}
