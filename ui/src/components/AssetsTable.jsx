import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import SmartCard from './SmartCard';

export default function AssetsTable({ refresh }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/assets`);
        const { assets } = await res.json();
        setAssets(assets || []);
      } catch {
        setAssets([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  if (loading) return <p>Loading assets…</p>;
  if (assets.length === 0) return <p>No assets found.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Value</th>
            <th className="p-2">Status</th>
            <th className="p-2">Occupancy</th>  
          </tr>
        </thead>
        <tbody>
           {assets.map(a => {
            const lowOcc =
              /hotel/i.test(a.name || '') && a.occupancy !== undefined && a.occupancy < 60;
            return (
              <React.Fragment key={a.id}>
                <tr>
                  <td className="p-2">{a.name}</td>
                  <td className="p-2">{a.value}</td>
                  <td className="p-2">{a.status}</td>
                  <td className="p-2">{a.occupancy ?? '—'}</td>
                </tr>
                {lowOcc && (
                  <tr>
                    <td colSpan="4">
                      <SmartCard message="Low occupancy detected. Consider a flash-sale rate based on competitor pricing." />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
