import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../lib/authContext';
import { API_BASE } from '../lib/apiBase';
import SelfServeDrawRequestForm from './SelfServeDrawRequestForm';

export default function CustomerPortal() {
  const { session } = useContext(AuthContext);
  const [loans, setLoans] = useState([]);
  const [applications, setApplications] = useState([]);
  const userId = session?.user?.id;
  const email = session?.user?.email;

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE}/api/my-loans?user_id=${userId}`)
      .then(r => r.json())
      .then(d => setLoans(d.loans || []))
      .catch(() => setLoans([]));
  }, [userId]);

  useEffect(() => {
    if (!email) return;
    const params = new URLSearchParams({ email });
    fetch(`${API_BASE}/api/my-applications?${params.toString()}`)
      .then(r => r.json())
      .then(d => setApplications(d.applications || []))
      .catch(() => setApplications([]));
  }, [email]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">My Loans</h3>
        {loans.length ? (
          <table className="w-full text-left bg-white rounded shadow">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Status</th>
                <th className="p-2">Start Date</th>
              </tr>
            </thead>
            <tbody>
              {loans.map(l => (
                <tr key={l.id}>
                  <td className="p-2">{l.id}</td>
                  <td className="p-2">{l.amount}</td>
                  <td className="p-2">{l.status || '—'}</td>
                  <td className="p-2">{new Date(l.start_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No loans found.</p>
        )}
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-2">My Applications</h3>
        {applications.length ? (
          <table className="w-full text-left bg-white rounded shadow">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Credit</th>
                <th className="p-2">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {applications.map(a => (
                <tr key={a.id}>
                  <td className="p-2">{a.id}</td>
                  <td className="p-2">{a.amount}</td>
                  <td className="p-2">{a.credit_score}</td>
                  <td className="p-2">{new Date(a.submitted_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No applications found.</p>
        )}
      </div>
      <SelfServeDrawRequestForm />
    </div>
  );
}
