import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../lib/apiBase';
import AssetDetailDrawer from './AssetDetailDrawer';
import AssetFileUpload from './AssetFileUpload';
import VirtualAssistant from '../../components/VirtualAssistant';

export default function AssetRiskTable() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [revivingId, setRevivingId] = useState(null);
  const [error, setError] = useState('');
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/assets/troubled`);
        const { assets } = await res.json();
        setAssets(assets || []);
      } catch {
        setAssets([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

   async function revive(id) {
    setRevivingId(id);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/assets/${id}/revive`, {
        method: 'POST'
      });
      if (res.ok) {
        const { asset } = await res.json();
        setAssets(assets =>
          assets.map(a => (a.id === id ? { ...a, status: asset.status } : a))
        );
      } else {
        setError('Failed to revive asset');
      }
    } catch {
      setError('Failed to revive asset');
    } finally {
      setRevivingId(null);
    }
  }

  if (loading) return <p>Loading assets…</p>;
  if (assets.length === 0) return <p>No troubled assets.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Risk</th>
            <th className="p-2">Status</th>
            <th className="p-2">Inspect</th>
            <th className="p-2">Revive</th>
          </tr>
        </thead>
        <tbody>
          {assets.map(a => (
             <tr key={a.id} className="hover:bg-gray-50">
              <td
                className="p-2 cursor-pointer"
                onClick={() => setSelected(a)}
              >
                {a.name || a.address}
              </td>
                         <td className="p-2">{a.predicted_risk}</td>
              <td className="p-2">{a.status}</td>
              <td className="p-2">
              <AssetFileUpload assetId={a.id} kind="inspection" />
              </td>
                         <td className="p-2">
                {a.status === 'revived' ? (
                  'Revived'
                ) : (
                  <button
                    onClick={() => revive(a.id)}
                    disabled={revivingId === a.id}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                  >
                    {revivingId === a.id ? '…' : 'Revive'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AssetDetailDrawer asset={selected} onClose={() => setSelected(null)} />
          {error && <p className="text-red-600 p-2">{error}</p>}
      <div className="p-4 border-t mt-4">
        <VirtualAssistant placeholder="Ask about assets…" />
      </div>
    </div>
  );
}
