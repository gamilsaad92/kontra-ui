import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/apiBase';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value ?? 0));

export default function EscrowCommercialPaperPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paperState, setPaperState] = useState({
    balance: 0,
    lockedCollateral: 0,
    ratio: 1.25,
    availableCapacity: 0,
    notes: []
  });
  const [form, setForm] = useState({ amount: '', rate: '8.0', maturityDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/draws/escrow-notes`);
        if (!res.ok) throw new Error('Failed to load escrow balance');
        const payload = await res.json();
        if (!cancelled) setPaperState({
          balance: Number(payload.balance ?? 0),
          lockedCollateral: Number(payload.lockedCollateral ?? 0),
          ratio: Number(payload.ratio ?? 1.25),
          availableCapacity: Number(payload.availableCapacity ?? 0),
          notes: payload.notes || []
        });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to fetch escrow notes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/draws/escrow-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(form.amount),
          rate: Number(form.rate) / 100,
          maturityDate: form.maturityDate || null
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || 'Unable to issue note');
      setPaperState((prev) => ({
        balance: Number(payload.balance ?? prev.balance),
        lockedCollateral: Number(payload.lockedCollateral ?? prev.lockedCollateral),
        ratio: prev.ratio,
        availableCapacity: Number(payload.availableCapacity ?? prev.availableCapacity),
        notes: payload.note ? [...prev.notes, payload.note] : prev.notes
      }));
      setForm({ amount: '', rate: form.rate, maturityDate: '' });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Unable to issue note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Escrow-Backed Commercial Paper</h3>
        <p className="text-sm text-gray-500 mt-1">
          Monitor available escrow capacity and issue short-term notes that stay within the mandated
          over-collateralization ratio.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading escrow balances…</p>
      ) : (
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Escrow Balance</p>
              <p className="text-xl font-semibold">{formatCurrency(paperState.balance)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Locked Collateral</p>
              <p className="text-xl font-semibold text-amber-600">{formatCurrency(paperState.lockedCollateral)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Available Capacity</p>
              <p className="text-xl font-semibold text-green-600">{formatCurrency(paperState.availableCapacity)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Over-Collateralization</p>
              <p className="text-xl font-semibold">{Math.round(paperState.ratio * 100)}%</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-3 md:items-end">
            <label className="text-sm font-medium text-gray-700">
              Note Amount
              <input
                type="number"
                min="0"
                step="1000"
                value={form.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                placeholder="500000"
                required
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Coupon Rate (% APR)
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.rate}
                onChange={(e) => handleChange('rate', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Maturity Date
              <input
                type="date"
                value={form.maturityDate}
                onChange={(e) => handleChange('maturityDate', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="md:col-span-3 mt-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              {submitting ? 'Issuing…' : 'Issue Note'}
            </button>
          </form>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Outstanding Notes</h4>
            {paperState.notes.length === 0 ? (
              <p className="text-sm text-gray-500">No active escrow-backed notes yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {paperState.notes.map((note) => (
                  <li key={note.id} className="rounded border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{formatCurrency(note.amount)}</span>
                      <span className="text-gray-500">Collateral: {formatCurrency(note.collateral)}</span>
                      <span className="text-gray-500">Rate: {(Number(note.rate ?? 0) * 100).toFixed(2)}%</span>
                      {note.maturityDate && (
                        <span className="text-gray-500">Maturity: {new Date(note.maturityDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
