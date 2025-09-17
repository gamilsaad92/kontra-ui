import React, { useEffect, useMemo, useState } from 'react';
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

export default function TokenizedDrawNotes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draws, setDraws] = useState([]);
  const [notes, setNotes] = useState([]);
  const [deploying, setDeploying] = useState(null);
  const [mintForms, setMintForms] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [approvedRes, fundedRes, notesRes] = await Promise.all([
          fetch(`${API_BASE}/api/draw-requests?status=approved`),
          fetch(`${API_BASE}/api/draw-requests?status=funded`),
          fetch(`${API_BASE}/api/draw-requests/tokenizations`)
        ]);
        if (!approvedRes.ok || !fundedRes.ok || !notesRes.ok) {
          throw new Error('Failed to load draw tokenization data');
        }
        const approved = await approvedRes.json();
        const funded = await fundedRes.json();
        const notePayload = await notesRes.json();
        if (!cancelled) {
          setDraws(mergeDraws([approved.draws, funded.draws]));
          setNotes(notePayload.notes || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load tokenized draws');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const notesByDrawId = useMemo(() => {
    const map = new Map();
    (notes || []).forEach((note) => map.set(note.drawId, note));
    return map;
  }, [notes]);

  const updateMintForm = (drawId, updates) => {
    setMintForms((prev) => ({
      ...prev,
      [drawId]: {
        fractions: updates.fractions ?? prev[drawId]?.fractions ?? 100,
        price: updates.price ?? prev[drawId]?.price ?? 0
      }
    }));
  };

  const handleDeploy = async (drawId) => {
    setDeploying(drawId);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/draw-requests/${drawId}/tokenize`, {
        method: 'POST'
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || 'Failed to deploy smart contract');
      setNotes((prev) => {
        const others = prev.filter((note) => note.drawId !== payload.note.drawId);
        return [...others, payload.note];
      });
      if (!mintForms[drawId]) {
        const draw = draws.find((d) => d.id === drawId);
        if (draw) {
          const defaultPrice = Number(draw.amount || 0) / 100;
          updateMintForm(drawId, {
            fractions: 100,
            price: Number.isFinite(defaultPrice) && defaultPrice > 0 ? defaultPrice : 100
          });
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to deploy smart contract');
    } finally {
      setDeploying(null);
    }
  };

  const handleMint = async (drawId, event) => {
    event.preventDefault();
    const formState = mintForms[drawId];
    if (!formState) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/draw-requests/${drawId}/tokenizations/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fractions: Number(formState.fractions),
          pricePerFraction: Number(formState.price)
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || 'Failed to mint note fractions');
      setNotes((prev) => {
        const others = prev.filter((note) => note.drawId !== payload.note.drawId);
        return [...others, payload.note];
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message || 'Failed to mint note fractions');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold">Tokenized Construction Draw Notes</h3>
        <p className="text-sm text-gray-500 mt-2">Loading tokenization data…</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Tokenized Construction Draw Notes</h3>
        <p className="text-sm text-gray-500 mt-1">
          Each approved draw can be launched as a Web3 note. Deploy a smart contract and fractionalize it for investor access in
          just a few clicks.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {draws.length === 0 ? (
        <p className="text-sm text-gray-600">No approved draws are ready for tokenization yet.</p>
      ) : (
        <div className="space-y-4">
          {draws.map((draw) => {
            const note = notesByDrawId.get(draw.id);
            const formState = mintForms[draw.id] || {
              fractions: 100,
              price: Number(draw.amount || 0) / 100 || 100
            };
            return (
              <div key={draw.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-base font-semibold">Draw #{draw.id} — {draw.project}</h4>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(draw.amount)} · Status: {draw.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeploy(draw.id)}
                    disabled={!!note || deploying === draw.id}
                    className={`px-4 py-2 rounded text-sm font-medium transition ${
                      note
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300'
                    }`}
                  >
                    {note ? 'Contract Deployed' : deploying === draw.id ? 'Deploying…' : 'Deploy Smart Contract'}
                  </button>
                </div>
                {note && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
                    <p>
                      <span className="font-medium">Contract:</span> {note.contractAddress}
                    </p>
                    <p className="flex flex-wrap gap-x-4">
                      <span>
                        <span className="font-medium">Supply:</span> {note.fractionsMinted || 0} fractions
                      </span>
                      <span>
                        <span className="font-medium">Price/Fraction:</span>{' '}
                        {note.fractionPrice ? formatCurrency(note.fractionPrice) : '—'}
                      </span>
                      <span>
                        <span className="font-medium">Status:</span> {note.status}
                      </span>
                    </p>
                  </div>
                )}
                {note && (
                  <form
                    onSubmit={(event) => handleMint(draw.id, event)}
                    className="grid gap-3 md:grid-cols-3 md:items-end"
                  >
                    <label className="text-sm font-medium text-gray-700">
                      Fractions
                      <input
                        type="number"
                        min="1"
                        value={formState.fractions}
                        onChange={(e) =>
                          updateMintForm(draw.id, { fractions: Number(e.target.value), price: formState.price })
                        }
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                        required
                      />
                    </label>
                    <label className="text-sm font-medium text-gray-700">
                      Price per Fraction
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formState.price}
                        onChange={(e) =>
                          updateMintForm(draw.id, { fractions: formState.fractions, price: Number(e.target.value) })
                        }
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      className="mt-2 md:mt-0 px-4 py-2 rounded bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
                    >
                      Mint Fractions
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
