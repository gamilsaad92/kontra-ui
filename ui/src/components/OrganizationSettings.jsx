import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, setOrgContext } from '../lib/apiClient';
import ErrorBanner from './ErrorBanner.jsx';
import { Button, FormField } from './ui';

export default function OrganizationSettings() {
  const [organizations, setOrganizations] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [membershipRole, setMembershipRole] = useState('');
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [organizationLoadFailed, setOrganizationLoadFailed] = useState(false);
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [color, setColor] = useState('#1e40af');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
 const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState('basic');
  const [subError, setSubError] = useState('');
  const [subSuccess, setSubSuccess] = useState('');
  const [tab, setTab] = useState('details');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingOrganizations(true);
      setOrganizationLoadFailed(false);
      setError('');
      try {
        const response = await apiFetch('/api/organizations', {}, {
          requireAuth: true,
          throwOnError: false,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || data.error || 'Could not load organizations');
        }
        const memberships = Array.isArray(data.organizations) ? data.organizations : [];
        if (!mounted) return;
        setOrganizations(memberships);
        const selected = memberships.find((organization) => organization.id === orgId)
          || memberships[0];
        if (selected) {
          setOrgId(selected.id);
          setOrgContext({ orgId: selected.id });
          setMembershipRole(selected.membership_role || '');
          setName(selected.name || '');
          setLogo(selected.branding?.logo || '');
          setColor(selected.branding?.color || '#1e40af');
        } else {
          setOrgId('');
          setMembershipRole('');
          setOrgContext({});
        }
      } catch (loadError) {
        if (mounted) {
          setOrganizationLoadFailed(true);
          setError(loadError.message || 'Could not load organizations');
        }
      } finally {
        if (mounted) setLoadingOrganizations(false);
      }
    })();

    apiFetch('/api/plans', {}, { throwOnError: false })
      .then((response) => response.ok ? response.json() : { plans: [] })
      .then((data) => {
        if (mounted) setPlans(Array.isArray(data.plans) ? data.plans : []);
      })
      .catch(() => {});

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!orgId || membershipRole !== 'owner') return;
    apiFetch('/api/subscription', {}, { requireAuth: true, throwOnError: false })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.plan) setCurrentPlan(data.plan);
      })
      .catch(() => {});
  }, [orgId, membershipRole]);

  const handleCreateOrganization = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setCreatingOrganization(true);
    try {
      const response = await apiFetch('/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name, branding: { logo, color } }),
      }, { requireAuth: true, throwOnError: false });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.organization?.id) {
        throw new Error(data.message || data.error || 'Could not create organization');
      }
      const created = { ...data.organization, membership_role: 'owner' };
      setOrganizations((current) => [created, ...current]);
      setOrgId(created.id);
      setOrgContext({ orgId: created.id });
      setMembershipRole('owner');
      setName(created.name || name);
      setSuccess('Organization created');
    } catch (createError) {
      setError(createError.message || 'Could not create organization');
    } finally {
      setCreatingOrganization(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!orgId) return;
    setError('');
    setSuccess('');
    try {
      const response = await apiFetch(`/api/organizations/${encodeURIComponent(orgId)}`, {
        method: 'PUT',
        body: JSON.stringify({ name, branding: { logo, color } }),
      }, { requireAuth: true, throwOnError: false });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Could not save organization');
      setSuccess('Saved');
    } catch (saveError) {
      setError(saveError.message || 'Could not save organization');
    }
  };

  const handleOrganizationChange = (event) => {
    const selected = organizations.find((organization) => organization.id === event.target.value);
    if (!selected) return;
    setOrgId(selected.id);
    setOrgContext({ orgId: selected.id });
    setMembershipRole(selected.membership_role || '');
    setName(selected.name || '');
    setLogo(selected.branding?.logo || '');
    setColor(selected.branding?.color || '#1e40af');
    setError('');
  };

  const handlePlanChange = async (plan) => {
    if (!orgId || membershipRole !== 'owner') return;
    setSubError('');
    setSubSuccess('');
    try {
      const response = await apiFetch('/api/subscription', {
        method: 'POST',
        body: JSON.stringify({ plan })
      }, { requireAuth: true, throwOnError: false });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
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
    <div className="max-w-xl">
      <div className="flex border-b mb-4 space-x-4">
        <button
          type="button"
          className={`pb-2 ${tab === 'details' ? 'border-b-2 border-blue-600 font-semibold' : ''}`}
          onClick={() => setTab('details')}
        >
          Details
        </button>
        <button
          type="button"
          className={`pb-2 ${tab === 'api' ? 'border-b-2 border-blue-600 font-semibold' : ''}`}
          onClick={() => setTab('api')}
        >
          API
        </button>
      </div>

      {tab === 'details' && (
        <div className="space-y-3 bg-white p-4 rounded shadow">
          <h2 className="text-xl font-bold">Organization Settings</h2>
          {organizations.length > 1 && (
            <label className="block space-y-1">
              <span>Organization</span>
              <select value={orgId} onChange={handleOrganizationChange} className="w-full border rounded p-2">
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
                ))}
              </select>
            </label>
          )}
          {loadingOrganizations ? (
            <p role="status">Loading organizations…</p>
          ) : organizationLoadFailed ? (
            <p role="alert">Organization access could not be verified. Refresh this page after signing in again.</p>
          ) : !orgId ? (
            <form onSubmit={handleCreateOrganization} className="space-y-3">
              <p>Create your first organization to begin an institutional pilot.</p>
              <FormField
                label="Organization name"
                aria-label="Organization name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit" disabled={creatingOrganization || !name.trim()}>
                {creatingOrganization ? 'Creating…' : 'Create organization'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSave} className="space-y-3">
              <FormField label="Name" value={name} onChange={(event) => setName(event.target.value)} />
              <FormField label="Logo URL" value={logo} onChange={(event) => setLogo(event.target.value)} />
              <FormField label="Primary Color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
              <Button type="submit" disabled={!['owner', 'admin'].includes(membershipRole)}>Save</Button>
              {['owner', 'admin'].includes(membershipRole) && (
                <Link
                  className="inline-block ml-3 text-blue-700 underline"
                  to={`/create-deal-room?organizationId=${encodeURIComponent(orgId)}`}
                >
                  Create a deal room
                </Link>
              )}
            </form>
          )}
          {success && <p className="text-green-600">{success}</p>}
          <ErrorBanner message={error} onClose={() => setError('')} />

          {orgId && membershipRole === 'owner' && (
            <>
              <hr className="my-4" />
              <h3 className="text-lg font-bold">Subscription Plan</h3>
              <ErrorBanner message={subError} onClose={() => setSubError('')} />
              {subSuccess && <p className="text-green-600">{subSuccess}</p>}
              <div className="space-y-4" role="region" aria-label="Subscription plans">
                {plans.map((plan) => (
                  <div key={plan.name} className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold capitalize">{plan.name}</h4>
                        <p className="text-sm">${plan.price}/mo</p>
                      </div>
                      {currentPlan === plan.name ? (
                        <span className="text-green-600 font-semibold">Current</span>
                      ) : (
                        <Button type="button" onClick={() => handlePlanChange(plan.name)}>
                          Choose
                        </Button>
                      )}
                    </div>
                    <ul className="list-disc ml-5 mt-2 text-sm">
                      {(plan.features || []).map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'api' && (
        <div className="bg-white p-4 rounded shadow space-y-2">
          <h2 className="text-xl font-bold">API</h2>
          <p>Organization ID:</p>
          <code className="block bg-gray-100 p-2 rounded break-all">{orgId || 'N/A'}</code>
        </div>
      )}
    </div>
  );
}
