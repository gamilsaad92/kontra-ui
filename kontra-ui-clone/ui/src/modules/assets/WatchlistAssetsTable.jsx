import React, { useState, useEffect } from 'react';
import { fetchWatchlistAssets } from '../../services/assets';
import AssetDetailDrawer from './AssetDetailDrawer';

export default function WatchlistAssetsTable() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchWatchlistAssets();
        setAssets(data);
      } catch (err) {
        console.error('Failed to load watchlist assets', err);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Loading watchlist assets…</p>;
  if (assets.length === 0) return <p>No watchlist assets.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Address</th>
            <th className="p-2">Value</th>
            <th className="p-2">Risk</th>
          </tr>
        </thead>
        <tbody>
          {assets.map(a => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="p-2 cursor-pointer" onClick={() => setSelected(a)}>{a.address}</td>
              <td className="p-2">{a.value ?? '—'}</td>
              <td className="p-2">{a.predicted_risk ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <AssetDetailDrawer asset={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
