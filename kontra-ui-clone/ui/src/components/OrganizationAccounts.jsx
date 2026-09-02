import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../lib/authContext';
import { API_BASE } from '../lib/apiBase';
import { Button, FormField } from './ui';
import ErrorBanner from './ErrorBanner.jsx';

export default function OrganizationAccounts() {
  const { session } = useContext(AuthContext);
  const orgId = session?.user?.user_metadata?.organization_id;
  const token = session?.access_token;
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ userId: '', role: 'borrower', accountType: 'borrower' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgId || !token) return;
    fetch(`${API_BASE}/api/organizations/${orgId}/accounts`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setAccounts(d.accounts || []))
      .catch(() => {});
  }, [orgId, token]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/organizations/${orgId}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: form.userId,
          role: form.role,
          account_type: form.accountType
        })
      });
      const data = await resp.json();
      if (data.error) {
        setError(data.error);
      } else {
        setAccounts(a => {
          const others = a.filter(acc => acc.user_id !== data.account.user_id);
          return [...others, data.account];
        });
        setForm({ userId: '', role: 'borrower', accountType: 'borrower' });
      }
    } catch {
      setError('Request failed');
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-xl font-bold">Organization Accounts</h2>
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow space-y-3">
        <FormField label="User ID" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} />
        <FormField label="Role">
          <select
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
            className="border rounded px-2 py-1 w-full"
          >
            <option value="admin">admin</option>
            <option value="reviewer">reviewer</option>
            <option value="borrower">borrower</option>
          </select>
        </FormField>
        <FormField label="Account Type">
          <select
            value={form.accountType}
            onChange={e => setForm({ ...form, accountType: e.target.value })}
            className="border rounded px-2 py-1 w-full"
          >
            <option value="lender">lender</option>
            <option value="borrower">borrower</option>
            <option value="investor">investor</option>
          </select>
        </FormField>
        <Button type="submit">Save</Button>
        <ErrorBanner message={error} onClose={() => setError('')} />
      </form>
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">Members</h3>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">User</th>
              <th className="text-left">Role</th>
              <th className="text-left">Account Type</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.user_id}>
                <td>{a.user_id}</td>
                <td>{a.role}</td>
                <td>{a.account_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
