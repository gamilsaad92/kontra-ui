import React, { useState } from 'react';
import { API_BASE } from '../../lib/apiBase';

export default function AssetInspectionUpload({ assetId }) {
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function upload() {
    if (!file || loading) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/assets/${assetId}/upload`, {
        method: 'POST',
        body: fd
      });
      if (res.ok) {
        const { troubled_asset } = await res.json();
        setNotes(troubled_asset?.ai_notes || 'Uploaded');
      } else {
        setNotes('Upload failed');
      }
    } catch {
      setNotes('Upload failed');
    } finally {
      setFile(null);
      setLoading(false);
    }
  }

  return (
    <div className="text-sm space-y-1">
      <div className="flex items-center gap-2">
        <input type="file" onChange={e => setFile(e.target.files[0])} />
        <button
          onClick={upload}
          disabled={!file || loading}
          className="px-2 py-1 bg-blue-600 text-white rounded"
        >
          Upload
        </button>
      </div>
      {notes && <p className="text-xs italic">{notes}</p>}
    </div>
  );
}
