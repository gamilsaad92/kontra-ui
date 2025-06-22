import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function InvestorReportsList({ refresh }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/investor-reports`);
        const { reports } = await res.json();
        setReports(reports || []);
      } catch {
        setReports([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  if (loading) return <p>Loading reports…</p>;
  if (reports.length === 0) return <p>No reports found.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Title</th>
            <th className="p-2">Date</th>
            <th className="p-2">Link</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id}>
              <td className="p-2">{r.title}</td>
              <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
              <td className="p-2">
                <a className="text-blue-600 underline" href={r.file_url} target="_blank" rel="noopener noreferrer">
                  view
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
