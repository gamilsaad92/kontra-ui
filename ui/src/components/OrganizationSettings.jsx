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
 const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState('basic');
  const [subError, setSubError] = useState('');
  const [subSuccess, setSubSuccess] = useState('');
  
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

    useEffect(() => {
    fetch(`${API_BASE}/api/plans`)
      .then(r => r.json())
      .then(d => setPlans(d.plans || []))
      .catch(() => {});
    if (!orgId) return;
    fetch(`${API_BASE}/api/subscription`, {
      headers: { 'X-Org-Id': orgId }
    })
      .then(r => r.json())
      .then(d => setCurrentPlan(d.plan || 'basic'))
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

   const handlePlanChange = async plan => {
    if (!orgId) return;
    setSubError('');
    setSubSuccess('');
    try {
      const resp = await fetch(`${API_BASE}/api/subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-Id': orgId
        },
        body: JSON.stringify({ plan })
      });
      const data = await resp.json();
      if (resp.ok) {
        setCurrentPlan(data.plan);
        setSubSuccess('Plan updated');
      } else {
        setSubError(data.message || 'Failed to update plan');
      }
    } catch (err) {
      setSubError('Request failed');
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
      
      <hr className="my-4" />
      <h3 className="text-lg font-bold">Subscription Plan</h3>
      <ErrorBanner message={subError} onClose={() => setSubError('')} />
      {subSuccess && <p className="text-green-600">{subSuccess}</p>}
      <div className="space-y-4" role="region" aria-label="Subscription plans">
        {plans.map(p => (
          <div key={p.name} className="border rounded p-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold capitalize">{p.name}</h4>
                <p className="text-sm">${p.price}/mo</p>
              </div>
              {currentPlan === p.name ? (
                <span className="text-green-600 font-semibold">Current</span>
              ) : (
                <Button type="button" onClick={() => handlePlanChange(p.name)}>
                  Choose
                </Button>
              )}
            </div>
            <ul className="list-disc ml-5 mt-2 text-sm">
              {p.features.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>  
    </form>
  );
}
