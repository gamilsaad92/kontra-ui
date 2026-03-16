import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function ProgressGallery({ projectId }) {
  const [photos, setPhotos] = useState([]);
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (projectId) fetchPhotos();
  }, [projectId]);

  async function fetchPhotos() {
    const res = await fetch(`${API_BASE}/api/progress-photos?project_id=${projectId}`);
    if (res.ok) {
      const { photos } = await res.json();
      setPhotos(photos || []);
    }
  }

  async function upload() {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('project_id', projectId);
    await fetch(`${API_BASE}/api/progress-photos/upload`, { method: 'POST', body: fd });
    setFile(null);
    fetchPhotos();
  }

  async function update(id, status) {
    await fetch(`${API_BASE}/api/progress-photos/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    setPhotos((p) => p.map((ph) => (ph.id === id ? { ...ph, status } : ph)));
  }

  return (
    <div className="space-y-4">
      <div>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={upload} className="ml-2 px-3 py-1 bg-blue-600 text-white rounded">Upload</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {photos.map((p) => (
          <div key={p.id} className="border p-2 rounded">
            <img src={p.file_url} alt="progress" className="object-cover h-32 w-full mb-2" />
            <p className="text-sm mb-1">Status: {p.status}</p>
            <div className="flex gap-2">
              <button onClick={() => update(p.id, 'approved')} className="px-2 py-1 bg-green-500 text-white rounded text-xs">Approve</button>
              <button onClick={() => update(p.id, 'rejected')} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
