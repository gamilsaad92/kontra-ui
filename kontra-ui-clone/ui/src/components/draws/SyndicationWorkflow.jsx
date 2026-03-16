import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/apiBase';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value ?? 0));

const mergeDraws = (lists) => {
  const map = new Map();
  lists.forEach((arr) => {
    (arr || []).forEach((draw) => {
      if (!map.has(draw.id)) {
        map.set(draw.id, draw);
      }
    });
  });
  return Array.from(map.values()).sort((a, b) => a.id - b.id);
};

export default function SyndicationWorkflow() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [draws, setDraws] = useState([]);
  const [form, setForm] = useState({ drawId: '', targetAmount: '', minVotes: 3, deadline: '' });
  const [pledgeForms, setPledgeForms] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pledging, setPledging] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [submittedRes, pendingRes, campaignsRes] = await Promise.all([
          fetch(`${API_BASE}/api/draw-requests?status=submitted`),
          fetch(`${API_BASE}/api/draw-requests?status=pending`),
          fetch(`${API_BASE}/api/draws/syndications`)
        ]);
        if (!submittedRes.ok || !pendingRes.ok || !campaignsRes.ok) {
          throw new Error('Failed to load syndication data');
        }
        const submitted = await submittedRes.json();
        const pending = await pendingRes.json();
        const campaignPayload = await campaignsRes.json();
        if (!cancelled) {
          const upcoming = mergeDraws([submitted.draws, pending.draws]);
          setDraws(upcoming);
          setCampaigns(campaignPayload.campaigns || []);
          if (!form.drawId && upcoming.length > 0) {
            setForm((prev) => ({ ...prev, drawId: upcoming[0].id }));
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load syndication workflows');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateCampaign = async (event) => {
    event.preventDefault();
    if (!form.drawId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/draw-requests/${form.drawId}/syndication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAmount: Number(form.targetAmount || 0),
          minVotes: Number(form.minVotes || 0),
          deadline: form.deadline || null
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || 'Unable to start syndication');
      setCampaigns((prev) => {
        const others = prev.filter((c) => c.drawId !== payload.campaign.drawId);
        return [...others, payload.campaign];
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Unable to start syndication');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePledgeChange = (drawId, updates) => {
    setPledgeForms((prev) => ({
      ...prev,
      [drawId]: {
        investor: updates.investor ?? prev[drawId]?.investor ?? '',
        amount: updates.amount ?? prev[drawId]?.amount ?? '',
        vote: updates.vote ?? prev[drawId]?.vote ?? true
      }
    }));
  };

  const handleSubmitPledge = async (drawId, event) => {
    event.preventDefault();
    const pledge = pledgeForms[drawId];
    if (!pledge?.investor || !pledge?.amount) return;
    setPledging(drawId);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/draw-requests/${drawId}/syndication/pledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investor: pledge.investor,
          amount: Number(pledge.amount),
          vote: pledge.vote
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || 'Unable to record pledge');
      setCampaigns((prev) => {
        const others = prev.filter((c) => c.drawId !== payload.campaign.drawId);
        return [...others, payload.campaign];
      });
      setPledgeForms((prev) => ({ ...prev, [drawId]: { investor: '', amount: '', vote: true } }));
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Unable to record pledge');
    } finally {
      setPledging(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Crowdsourced Syndication</h3>
        <p className="text-sm text-gray-500 mt-1">
          Coordinate investor interest for upcoming draws. Pledges and votes automatically transition a campaign into funded
          status once thresholds are satisfied.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading syndication pipeline…</p>
      ) : (
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <form onSubmit={handleCreateCampaign} className="grid gap-3 md:grid-cols-4 md:items-end">
            <label className="text-sm font-medium text-gray-700 md:col-span-2">
              Upcoming Draw
              <select
                value={form.drawId}
                onChange={(e) => handleFormChange('drawId', Number(e.target.value))}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                required
              >
                <option value="" disabled>
                  Select a draw
                </option>
                {draws.map((draw) => (
                  <option key={draw.id} value={draw.id}>
                    #{draw.id} — {draw.project} ({formatCurrency(draw.amount)})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Target Amount
              <input
                type="number"
                min="0"
                value={form.targetAmount}
                onChange={(e) => handleFormChange('targetAmount', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                placeholder="2500000"
                required
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Min. Supporters
              <input
                type="number"
                min="1"
                value={form.minVotes}
                onChange={(e) => handleFormChange('minVotes', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                required
              />
            </label>
            <label className="text-sm font-medium text-gray-700 md:col-span-2">
              Voting Deadline
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => handleFormChange('deadline', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="md:col-span-2 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300"
            >
              {submitting ? 'Publishing…' : 'Publish Syndication'}
            </button>
          </form>

          <div className="space-y-4">
            {campaigns.length === 0 ? (
              <p className="text-sm text-gray-500">No active syndications yet. Launch one to collect investor commitments.</p>
            ) : (
              campaigns
                .sort((a, b) => a.drawId - b.drawId)
                .map((campaign) => {
                  const progress = Math.min(
                    (Number(campaign.pledged || 0) / Number(campaign.targetAmount || 1)) * 100,
                    100
                  );
                  const pledgeForm = pledgeForms[campaign.drawId] || { investor: '', amount: '', vote: true };
                  return (
                    <div key={campaign.id} className="rounded border border-gray-200 p-4 space-y-3">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <h4 className="text-base font-semibold">
                            Draw #{campaign.draw?.id || campaign.drawId} — {campaign.draw?.project}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Goal {formatCurrency(campaign.targetAmount)} · Pledged {formatCurrency(campaign.pledged)} · Status:{' '}
                            <span className="font-semibold text-emerald-600">{campaign.status}</span>
                          </p>
                        </div>
                        {campaign.thresholdMet && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Threshold Met
                          </span>
                        )}
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
                        <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-gray-500">
                        {campaign.votes?.filter((vote) => vote.support).length || 0} supporters · Minimum required{' '}
                        {campaign.minVotes}
                        {campaign.deadline && ` · Voting closes ${new Date(campaign.deadline).toLocaleDateString()}`}
                      </p>
                      {campaign.allocations && (
                        <div className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">
                          <p className="font-semibold mb-2">Automatic Allocations</p>
                          <ul className="space-y-1">
                            {campaign.allocations.map((allocation) => (
                              <li key={`${campaign.id}-${allocation.investor}`} className="flex justify-between">
                                <span>{allocation.investor}</span>
                                <span>{formatCurrency(allocation.allocation)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <form
                        onSubmit={(event) => handleSubmitPledge(campaign.drawId, event)}
                        className="grid gap-3 md:grid-cols-4 md:items-end"
                      >
                        <label className="text-sm font-medium text-gray-700 md:col-span-2">
                          Investor Name
                          <input
                            type="text"
                            value={pledgeForm.investor}
                            onChange={(e) => handlePledgeChange(campaign.drawId, {
                              investor: e.target.value,
                              amount: pledgeForm.amount,
                              vote: pledgeForm.vote
                            })}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                            required
                          />
                        </label>
                        <label className="text-sm font-medium text-gray-700">
                          Pledge Amount
                          <input
                            type="number"
                            min="0"
                            value={pledgeForm.amount}
                            onChange={(e) => handlePledgeChange(campaign.drawId, {
                              investor: pledgeForm.investor,
                              amount: e.target.value,
                              vote: pledgeForm.vote
                            })}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                            required
                          />
                        </label>
                        <label className="text-sm font-medium text-gray-700">
                          Support Vote
                          <select
                            value={pledgeForm.vote ? 'yes' : 'no'}
                            onChange={(e) => handlePledgeChange(campaign.drawId, {
                              investor: pledgeForm.investor,
                              amount: pledgeForm.amount,
                              vote: e.target.value === 'yes'
                            })}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                          >
                            <option value="yes">Approve</option>
                            <option value="no">Withhold</option>
                          </select>
                        </label>
                        <button
                          type="submit"
                          disabled={pledging === campaign.drawId}
                          className="md:col-span-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
                        >
                          {pledging === campaign.drawId ? 'Recording…' : 'Submit Pledge'}
                        </button>
                      </form>
                    </div>
                  );
                })
            )}
          </div>
        </>
      )}
    </div>
  );
}
