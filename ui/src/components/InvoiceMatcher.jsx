import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function InvoiceMatcher({ projectId }) {
  const [file, setFile] = useState(null);
  const [matches, setMatches] = useState([]);

  async function upload() {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('project_id', projectId);
    const res = await fetch(`${API_BASE}/api/match-invoice`, { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      setMatches(data.matches || []);
    }
  }

  return (
    <div className="space-y-4">
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={upload} className="ml-2 px-3 py-1 bg-blue-600 text-white rounded">Match</button>
      {matches.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr><th className="p-1">Item</th><th className="p-1">Amount</th><th className="p-1">Match</th></tr>
          </thead>
          <tbody>
            {matches.map(m => (
              <tr key={m.id} className="border-t">
                <td className="p-1">{m.description}</td>
                <td className="p-1">{m.amount}</td>
                <td className="p-1">{m.matched ? '✅' : '❌'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
