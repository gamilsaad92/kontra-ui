import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import { DetailDrawer } from './ui';
import { calculateRiskScore } from '../lib/riskScore';

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
        if (res.ok) {
          const proj = data.project || {};
          proj.risk = calculateRiskScore(proj);
          setProject(proj);
        }
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
            <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">{project.name}</h3>
            <p>Number: {project.number}</p>
            <p>Status: {project.status}</p>
            <p>Address: {project.address}</p>
            <p>Risk: {project.risk}</p>
          </div>

          {/* Budget vs Actual */}
          <div>
            <h4 className="font-semibold">Budget vs Actual</h4>
            <div className="w-full bg-gray-200 rounded h-4 overflow-hidden">
              <div
                className="bg-blue-600 h-4"
                style={{ width: `${Math.min(100, ((project.actual_cost || 0) / (project.budget || 1)) * 100)}%` }}
              />
            </div>
            <p className="text-sm mt-1">
              ${project.actual_cost || 0} of ${project.budget || 0}
            </p>
          </div>

          {/* Phase progress */}
          {Array.isArray(project.phase_progress) && project.phase_progress.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Phase Progress</h4>
              {project.phase_progress.map(ph => (
                <div key={ph.name}>
                  <p className="text-sm">{ph.name}</p>
                  <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                    <div
                      className="bg-green-600 h-2"
                      style={{ width: `${ph.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Linked resources */}
          <div className="space-y-1 text-sm">
            <p>Inspections: {project.inspections ? project.inspections.length : 0}</p>
            <p>Draws: {project.draws ? project.draws.length : 0}</p>
            <p>Loans: {project.loans ? project.loans.length : 0}</p>
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}
