import React, { useEffect, useState } from 'react';
import {
  fetchRevivedAssets,
  publishAssetListing,
} from '../../services/assets';

export default function RevivedAssetsTable() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchRevivedAssets();
        setAssets(data);
        setError('');
       } catch (err) {
        console.error('Failed to load revived assets', err);
        setError('Failed to load revived assets');
        setAssets([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Loading revived assets…</p>;
  if (error && assets.length === 0) return <p className="text-red-600">{error}</p>;
  if (assets.length === 0) return <p>No revived assets.</p>;
  const togglePublish = async (id, publish) => {
    try {
         const asset = await publishAssetListing(id, publish);
      setAssets((prev) =>
        prev.map((a) => (a.id === id ? { ...a, published: asset.published ?? publish } : a))
      );
      setError('');
    } catch (err) {
      console.error('Failed to update publish status', err);
      setError('Failed to update publish status');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      {error && assets.length > 0 && <p className="text-red-600 p-2">{error}</p>}
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
                  checked={!!asset.published}
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
