import React, { useState, useRef } from 'react';
import { API_BASE } from '../../lib/apiBase';

export default function AssetFileUpload({ assetId, kind = 'inspection' }) {
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  
  async function upload() {
    if (!file || loading) return;
        const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setNotes('Invalid file type');
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
   const res = await fetch(`${API_BASE}/api/assets/${assetId}/upload?kind=${kind}`, {
        method: 'POST',
        body: fd
      });
      if (res.ok) {
           const { file: uploaded } = await res.json();
        setNotes(uploaded?.ai_notes || 'Uploaded');
       if (fileInputRef.current) fileInputRef.current.value = null;
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
        <div>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          ref={fileInputRef}
          onChange={e => setFile(e.target.files[0])}
        />
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
