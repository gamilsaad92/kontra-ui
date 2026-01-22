import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import InsightsCard from '../components/InsightsCard';

export default function Inspections() {
  const [projectId, setProjectId] = useState('');
  const [inspectionDate, setInspectionDate] = useState('');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [inspections, setInspections] = useState([]);
  const [message, setMessage] = useState('');
  const [loanId, setLoanId] = useState('');

  const loadInspections = async (pid) => {
    if (!pid) return setInspections([]);
    try {
      const res = await fetch(`${API_BASE}/api/inspections?project_id=${pid}`);
      const data = await res.json();
      setInspections(data.inspections || []);
    } catch {
      setInspections([]);
    }
  };

  useEffect(() => {
    loadInspections(projectId);
  }, [projectId]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/inspections/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          inspection_date: inspectionDate,
          contact,
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Inspection scheduled');
        setInspectionDate('');
        setContact('');
        setNotes('');
        loadInspections(projectId);
      } else {
        setMessage(data.message || 'Failed to schedule inspection');
      }
    } catch {
      setMessage('Failed to schedule inspection');
    }
  };

  const handleUpload = async (id, files) => {
    if (!files?.length) return;
    const form = new FormData();
    for (let i = 0; i < files.length; i++) form.append('photos', files[i]);
    await fetch(`${API_BASE}/api/inspections/${id}/photos`, {
      method: 'POST',
      body: form,
    });
  };

  const handleDecision = async (id, status) => {
    await fetch(`${API_BASE}/api/inspections/${id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadInspections(projectId);
  };

  const handleReport = async (id) => {
    const res = await fetch(`${API_BASE}/api/inspections/${id}/report`);
    const data = await res.json();
    alert(JSON.stringify(data.report, null, 2));
  };

  return (
    <div className="space-y-6">
           <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Inspection Insights</h2>
        <p className="text-xs text-slate-500">
          Connect a loan to highlight servicing insights for inspections.
        </p>
        <input
          className="mt-3 w-full rounded border border-slate-200 p-2 text-sm"
          placeholder="Loan ID"
          value={loanId}
          onChange={(event) => setLoanId(event.target.value)}
        />
        <div className="mt-4">
          <InsightsCard loanId={loanId} title="Inspection Insights" />
        </div>
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Schedule Inspection</h2>
        <form onSubmit={handleSchedule} className="grid gap-2 sm:grid-cols-2">
          <input
            className="border p-2 rounded"
            placeholder="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
          />
          <input
            type="date"
            className="border p-2 rounded"
            value={inspectionDate}
            onChange={(e) => setInspectionDate(e.target.value)}
            required
          />
          <input
            className="border p-2 rounded"
            placeholder="Contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            required
          />
          <input
            className="border p-2 rounded col-span-full"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded col-span-full"
          >
            Schedule
          </button>
        </form>
        {message && <p className="mt-2 text-green-600">{message}</p>}
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Inspections</h2>
        {inspections.length === 0 ? (
          <p>No inspections found.</p>
        ) : (
          <ul className="space-y-4">
            {inspections.map((ins) => (
              <li key={ins.id} className="border p-3 rounded">
                <div className="flex justify-between mb-2">
                  <span>{new Date(ins.inspection_date).toLocaleDateString()}</span>
                  <span className="text-sm">{ins.status || 'scheduled'}</span>
                </div>
                <div className="mb-2">{ins.notes}</div>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleUpload(ins.id, e.target.files)}
                  className="mb-2"
                />
                <div className="space-x-2">
                  <button
                    onClick={() => handleDecision(ins.id, 'approved')}
                    className="bg-green-600 text-white px-2 py-1 rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecision(ins.id, 'rejected')}
                    className="bg-red-600 text-white px-2 py-1 rounded"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleReport(ins.id)}
                    className="bg-slate-600 text-white px-2 py-1 rounded"
                  >
                    Report
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
