import React, { useState } from 'react';

export default function LienWaiverForm({ drawId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [contractor, setContractor] = useState('');
  const [type, setType] = useState('conditional');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !contractor) return;
    setMessage('Uploading...');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('draw_id', drawId);
      form.append('contractor_name', contractor);
      form.append('waiver_type', type);

      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/upload-lien-waiver`,
        { method: 'POST', body: form }
      );
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Waiver uploaded successfully');
        onUploaded(data.data);
      } else {
        setMessage(data.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setMessage('⚠️ Error uploading waiver');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2 border-t pt-4">
      <h3 className="font-semibold">Upload Lien Waiver</h3>
      <input
        type="text"
        placeholder="Contractor Name"
        value={contractor}
        onChange={(e) => setContractor(e.target.value)}
        required
        className="w-full border p-1 rounded"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="w-full border p-1 rounded"
      >
        <option value="conditional">Conditional Waiver</option>
        <option value="unconditional">Unconditional Waiver</option>
      </select>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files[0])}
        required
        className="w-full"
      />
      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-4 rounded"
      >
        Upload Waiver
      </button>
      {message && <p className="text-sm mt-1">{message}</p>}
    </form>
  );
}
