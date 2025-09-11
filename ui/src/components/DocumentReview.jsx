import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

/**
 * DocumentReview.jsx
 * Simple document upload form that calls the document review API and displays
 * extracted fields, AI summary, version info and any flags returned.
 */
export default function DocumentReview() {
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file || !docType) {
      setError('File and document type required');
      return;
    }
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);
    try {
      const res = await fetch(`${API_BASE}/api/document-review/process`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Upload failed');
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4">Document Review</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full"
        />
        <input
          type="text"
          placeholder="Document type"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded"
        >
          Upload
        </button>
      </form>
      {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
      {result && (
        <div className="mt-4 text-sm space-y-2">
          <div>Version: {result.version}</div>
          {result.missingSignature && (
            <div className="text-red-600">Missing signature detected</div>
          )}
          {result.complianceIssues && (
            <div className="text-red-600">Compliance issues detected</div>
          )}
          {result.summary && (
            <div>
              <h4 className="font-medium">Summary</h4>
              <p>{result.summary}</p>
            </div>
          )}
          {result.extracted && (
            <div>
              <h4 className="font-medium">Extracted Fields</h4>
              <pre className="bg-slate-100 p-2 rounded overflow-auto">
                {JSON.stringify(result.extracted, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
