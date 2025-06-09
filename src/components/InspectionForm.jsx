import React, { useState } from 'react';

export default function InspectionForm({ drawId, onUploaded }) {
  const [inspector, setInspector] = useState('');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = e => {
    setFile(e.target.files[0]);
    setMessage('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!inspector || !file) {
      setMessage('All fields are required');
      return;
    }
    setLoading(true);

    const formData = new FormData();
    formData.append('draw_id', drawId);
    formData.append('inspector_name', inspector);
    formData.append('file', file);

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/upload-inspection`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Inspection uploaded successfully');
        onUploaded && onUploaded(data.data);
        setInspector('');
        setFile(null);
      } else {
        setMessage(data.message || 'Upload failed');
      }
    } catch {
      setMessage('Error uploading inspection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-xl font-semibold mb-4">Upload Inspection (Draw #{drawId})</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Inspector Name"
          value={inspector}
          onChange={e => setInspector(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="w-full"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
        >
          {loading ? 'Uploading…' : 'Upload Inspection'}
        </button>
      </form>
      {message && <p className="mt-3 text-gray-700">{message}</p>}
    </div>
  );
}
