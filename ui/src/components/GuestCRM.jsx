import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

const sampleStays = [
  { date: '2024-01-05', room: '101' },
  { date: '2024-03-18', room: '215' }
];

export default function GuestCRM() {
  const [guests, setGuests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/guests`);
        const { guests } = await res.json();
        setGuests(guests || []);
      } catch {
        setGuests([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadRequests(id) {
    try {
      const res = await fetch(`${API_BASE}/api/service-requests?guest_id=${id}`);
      const { requests } = await res.json();
      setRequests(requests || []);
    } catch {
      setRequests([]);
    }
  }

  if (loading) return <p>Loading guests…</p>;

  if (!selected) {
    if (guests.length === 0) return <p>No guests found.</p>;
    return (
      <table className="w-full text-left bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
          </tr>
        </thead>
        <tbody>
          {guests.map(g => (
            <tr key={g.id} onClick={() => { setSelected(g); loadRequests(g.id); }} className="cursor-pointer hover:bg-gray-50">
              <td className="p-2">{g.name}</td>
              <td className="p-2">{g.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setSelected(null)} className="text-blue-600 underline">
        ← Back to Guests
      </button>
      <h3 className="text-xl font-bold">{selected.name}</h3>
      <p className="text-sm text-gray-600">{selected.email}</p>
      <div>
        <h4 className="font-semibold mb-1">Preferences</h4>
        <pre className="bg-gray-100 p-2 rounded whitespace-pre-wrap">
          {selected.preferences || 'None'}
        </pre>
      </div>
      <div>
        <h4 className="font-semibold mb-1">Stay History</h4>
        <ul className="list-disc ml-5">
          {sampleStays.map((s, i) => (
            <li key={i}>{s.date} – Room {s.room}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold mb-1">Service Requests</h4>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-500">No requests</p>
        ) : (
          <ul className="list-disc ml-5">
            {requests.map(r => (
              <li key={r.id}>{r.request} – {r.status}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
