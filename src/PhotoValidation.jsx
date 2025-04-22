import React, { useState } from 'react';

export default function PhotoValidation() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setFile(selected);
    setResult(null);
    if (selected) {
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
  
    const formData = new FormData();
    formData.append('image', file);
  
    const apiURL = "https://kontra-api.onrender.com/api/validate-photo";
console.log("🔗 Hardcoded call to:", apiURL);

  
    try {
      const res = await fetch(apiURL, {
        method: 'POST',
        body: formData,
      });
  
      const data = await res.json();
      setResult(data.result || 'Unknown');
    } catch (err) {
      console.error("❌ Upload error:", err);
      setResult('Error validating image');
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <div className="bg-white mt-8 rounded-xl shadow-md p-6 w-full max-w-xl">
      <h2 className="text-lg font-semibold mb-4">AI Photo Validation</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {preview && (
        <img
          src={preview}
          alt="Preview"
          className="mt-4 max-h-64 w-full object-contain rounded border"
        />
      )}
      <button
        onClick={handleUpload}
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded w-full"
        disabled={loading}
      >
        {loading ? 'Validating...' : 'Run AI Validation'}
      </button>
      {result && (
        <p className="mt-4 font-medium text-center text-green-700">{result}</p>
      )}
    </div>
  );
}
