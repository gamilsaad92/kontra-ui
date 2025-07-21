import React, { useState, useEffect } from 'react';
import { API_BASE } from '../lib/apiBase';
import ErrorBanner from './ErrorBanner.jsx';
import { Button, FormField } from './ui';

export default function InviteAcceptForm({ token }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/invites/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.invite) setEmail(d.invite.email);
        else setError(d.error || 'Invalid invite');
      })
      .catch(() => setError('Failed to load invite'));
  }, [token]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    const resp = await fetch(`${API_BASE}/api/invites/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    const data = await resp.json();
    if (data.error) setError(data.error);
    else setSuccess('Account created. Please log in.');
  };

  if (!email && !error) return <p className="p-4">Loading...</p>;

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Accept Invite</h2>
      {email && <p className="mb-4">Invite for {email}</p>}
      <FormField
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <FormField
        type="password"
        placeholder="Confirm Password"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        required
      />
      <Button type="submit">Sign Up</Button>
      {success && <p className="mt-2 text-green-600">{success}</p>}
      <ErrorBanner message={error} onClose={() => setError('')} />
    </form>
  );
}
