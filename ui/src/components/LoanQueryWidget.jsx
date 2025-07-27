import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function LoanQueryWidget() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const runQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/query-loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      setResults(data.loans || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex">
        <input
          className="flex-1 border p-2 rounded-l"
          value={query}
          onChange={e => setQuery(e.target.value)}
                 placeholder="Search loans…"
          onKeyDown={e => e.key === 'Enter' && runQuery()}
          disabled={loading}
        />
        <button
          className="bg-blue-600 text-white px-4 rounded-r"
          onClick={runQuery}
          disabled={loading}
        >
          {loading ? '…' : 'Search'}
        </button>
      </div>
      {results.length > 0 && (
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Borrower</th>
              <th className="p-2">Amount</th>
              <th className="p-2">Rate</th>
              <th className="p-2">Maturity</th>
              <th className="p-2">Risk</th>
              <th className="p-2">Start</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => (
              <tr key={r.id}>
                <td className="p-2">{r.borrower_name}</td>
                <td className="p-2">{r.amount}</td>
                <td className="p-2">{r.interest_rate}</td>
               <td className="p-2">{r.maturity_date || '-'}</td>
                <td className="p-2">{r.risk_score ?? '-'}</td>
                <td className="p-2">{r.start_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
