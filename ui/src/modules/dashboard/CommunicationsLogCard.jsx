import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { API_BASE } from '../../lib/apiBase';

export default function CommunicationsLogCard({ to }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/communications/logs`);
        if (!res.ok) throw new Error('Failed to load logs');
        const data = await res.json();
        if (!cancelled) {
          setEntries(Array.isArray(data.communications) ? data.communications.slice(0, 8) : []);
        }
      } catch (err) {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card title="Comms Log" loading={loading} to={to}>
      {entries.length === 0 && !loading ? (
        <p className="text-sm text-gray-500">No communications have been logged yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {entries.map((entry, idx) => (
            <li key={idx} className="py-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(entry.date).toLocaleString()}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{entry.channel || entry.type}</span>
              </div>
              <div className="mt-1 text-gray-800">{entry.message}</div>
              {entry.loanId && <div className="text-xs text-gray-500">Loan: {entry.loanId}</div>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
