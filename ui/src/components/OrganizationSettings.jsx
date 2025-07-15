import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../main';
import { API_BASE } from '../lib/apiBase';
import ErrorBanner from './ErrorBanner.jsx';
import { Button, FormField } from './ui';

export default function OrganizationSettings() {
  const { session } = useContext(AuthContext);
  const orgId = session?.user?.user_metadata?.organization_id;
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [color, setColor] = useState('#1e40af');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!orgId) return;
    fetch(`${API_BASE}/api/organizations/${orgId}`)
      .then(r => r.json())
      .then(d => {
        const org = d.organization;
        if (org) {
          setName(org.name || '');
          setLogo(org.branding?.logo || '');
          setColor(org.branding?.color || '#1e40af');
        }
      })
      .catch(() => {});
  }, [orgId]);

  const handleSave = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const body = { name, branding: { logo, color } };
    const method = orgId ? 'PUT' : 'POST';
    const url = orgId
      ? `${API_BASE}/api/organizations/${orgId}`
      : `${API_BASE}/api/organizations`;
    try {
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      if (data.error) setError(data.error);
      else setSuccess('Saved');
    } catch (err) {
      setError('Request failed');
    }
  };

  return (
    <form onSubmit={handleSave} className="max-w-xl space-y-3 bg-white p-4 rounded shadow">
      <h2 className="text-xl font-bold">Organization Settings</h2>
      <FormField label="Name" value={name} onChange={e => setName(e.target.value)} />
      <FormField label="Logo URL" value={logo} onChange={e => setLogo(e.target.value)} />
      <FormField label="Primary Color" type="color" value={color} onChange={e => setColor(e.target.value)} />
      <Button type="submit">Save</Button>
      {success && <p className="text-green-600">{success}</p>}
      <ErrorBanner message={error} onClose={() => setError('')} />
    </form>
  );
}
