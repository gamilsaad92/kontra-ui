import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function StandardReports() {
  const [type, setType] = useState('investor-distribution');
  const [period, setPeriod] = useState('monthly');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runReport = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `${API_BASE}/api/reports/${type}`;
      if (type === 'asset-performance') url += `?period=${period}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch report');
      const data = await res.json();
      setRows(data.rows || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch report');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const download = async (format) => {
    let url = `${API_BASE}/api/reports/${type}?format=${format}`;
    if (type === 'asset-performance') url += `&period=${period}`;
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = format === 'excel' ? 'csv' : 'pdf';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${type}.${ext}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Standard Reports</h3>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <select className="border p-2 rounded" value={type} onChange={e => setType(e.target.value)}>
          <option value="investor-distribution">Investor Distribution</option>
          <option value="asset-performance">Asset Performance</option>
          <option value="loan-risk">Loan Delinquency & Risk</option>
        </select>
        {type === 'asset-performance' && (
          <select className="border p-2 rounded" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        )}
        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={runReport}>Run</button>
        <button className="bg-gray-600 text-white px-3 py-1 rounded" onClick={() => download('pdf')}>PDF</button>
        <button className="bg-gray-600 text-white px-3 py-1 rounded" onClick={() => download('excel')}>Excel</button>
      </div>
      {loading && <p>Loading report…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {rows.length > 0 && (
        <div className="overflow-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                {headers.map(h => (
                  <th key={h} className="p-2 border-b text-left capitalize">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  {headers.map(h => (
                    <td key={h} className="p-2 border-b">{r[h]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
