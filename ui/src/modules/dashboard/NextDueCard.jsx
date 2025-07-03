import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/apiBase';

export default function NextDueCard() {
  const [next, setNext] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/next-due`);
        const { next_due } = await res.json();
        setNext(next_due);
      } catch {
        setNext(null);
      }
    })();
  }, []);

  return (
    <div className="bg-white rounded shadow p-4 h-full">
      <h3 className="font-bold mb-2">Your Next Due Date</h3>
      {next ? <p className="text-lg">{next.due_date}</p> : <p>No upcoming dues.</p>}
    </div>
  );
}
