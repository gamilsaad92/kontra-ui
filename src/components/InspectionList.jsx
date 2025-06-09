import React, { useEffect, useState } from 'react';

export default function InspectionList({ drawId }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/list-inspections?draw_id=${drawId}`
      );
      const { inspections } = await res.json();
      setInspections(inspections || []);
      setLoading(false);
    })();
  }, [drawId]);

  if (loading) return <p>Loading inspections…</p>;
  if (inspections.length === 0) return <p>No inspections uploaded yet.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h4 className="text-lg font-medium mb-2">Uploaded Inspections</h4>
      <ul className="space-y-2">
        {inspections.map(i => (
          <li key={i.id} className="flex justify-between items-center">
            <a
              href={i.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {i.inspector_name || `Inspection ${i.id}`}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
