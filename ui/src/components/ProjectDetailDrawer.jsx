import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import { DetailDrawer } from './ui';

export default function ProjectDetailDrawer({ projectId, onClose }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`);
        const data = await res.json();
        if (res.ok) setProject(data.project);
      } catch {
        setProject(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  return (
    <DetailDrawer open={!!projectId} onClose={onClose}>
      {loading && <p>Loading…</p>}
      {!loading && !project && <p>Not found.</p>}
      {!loading && project && (
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">{project.name}</h3>
          <p>Number: {project.number}</p>
          <p>Status: {project.status}</p>
          <p>Address: {project.address}</p>
        </div>
      )}
    </DetailDrawer>
  );
}
