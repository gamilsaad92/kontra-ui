import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../lib/authContext';
import { API_BASE } from '../lib/apiBase';

export default function NotificationsList() {
  const { session } = useContext(AuthContext);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/notifications?user_id=${session.user.id}`);
        const { notifications } = await res.json();
        setRows(notifications || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  if (!session) return <p>Please log in.</p>;
  if (loading) return <p>Loading alerts…</p>;
  if (rows.length === 0) return <p>No alerts.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Message</th>
            <th className="p-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(n => (
            <tr key={n.id}>
              <td className="p-2">
                {n.link ? (
                  <a href={n.link} className="text-blue-600 underline">{n.message}</a>
                ) : (
                  n.message
                )}
              </td>
              <td className="p-2">{new Date(n.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
