import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function RevivedAssetsTable() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/assets/revived`);
        const { assets } = await res.json();
        setAssets(assets || []);
        setError('');
      } catch {
        setError('Failed to load revived assets');
        setAssets([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Loading revived assets…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (assets.length === 0) return <p>No revived assets.</p>;

  const togglePublish = (id, publish) => {
    console.log('Publish listing', id, publish);
    // In a real app this would POST to a webhook or integration
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Address</th>
            <th className="p-2">Suggested Price</th>
            <th className="p-2">Blurb</th>
            <th className="p-2">Status</th>
            <th className="p-2">Publish Listing</th>
          </tr>
        </thead>
        <tbody>
          {assets.map(asset => (
            <tr key={asset.id} className="hover:bg-gray-50">
              <td className="p-2">{asset.address || '—'}</td>         
              <td className="p-2">{asset.price_suggestion ?? '—'}</td>
              <td className="p-2 text-sm">{asset.blurb || '—'}</td>
              <td className="p-2">
                <span className="inline-block px-2 py-1 text-xs rounded bg-green-200 text-green-800">
                  {asset.status}
                </span>
              </td>
              <td className="p-2">
                <input
                  type="checkbox"
                  onChange={e => togglePublish(asset.id, e.target.checked)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
