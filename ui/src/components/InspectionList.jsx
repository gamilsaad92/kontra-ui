import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function InspectionList({ drawId, projectId }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = drawId ? `draw_id=${drawId}` : `project_id=${projectId}`;
        const res = await fetch(
          `${API_BASE}/api/list-inspections?${params}`
        );
        const { inspections } = await res.json();
        setInspections(inspections || []);
      } catch {
        setInspections([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [drawId, projectId]);

  if (loading) return <p>Loading inspections…</p>;
  if (inspections.length === 0) return <p>No inspections found.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h4 className="text-lg font-medium mb-2">Inspections</h4>
      <ul className="space-y-2">
        {inspections.map(ins => (
          <li key={ins.id} className="flex justify-between">
            <span>{new Date(ins.inspection_date).toLocaleDateString()}</span>
            <span>{ins.notes}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
