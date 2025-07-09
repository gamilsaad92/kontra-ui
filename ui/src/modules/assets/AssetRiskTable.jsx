import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../lib/apiBase';
import AssetDetailDrawer from './AssetDetailDrawer';
import AssetInspectionUpload from './AssetInspectionUpload';

export default function AssetRiskTable() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

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
                <AssetInspectionUpload assetId={a.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AssetDetailDrawer asset={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
