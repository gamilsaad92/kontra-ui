import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import Card from './Card';
import SiteAnalysisForm from './SiteAnalysisForm';

// Connects to your Kontra SaaS backend at POST {API_BASE}/site-analysis
export default function MarketAnalysis() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async (formData) => {
    console.log('Submitting formData:', formData);
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/site-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Unexpected response from server: ${text}`);
      }

      if (!response.ok) {
        throw new Error(data.message || `Server error: ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Market Analysis</h1>
      <SiteAnalysisForm onAnalyze={handleAnalyze} />
      {loading && <p>Analyzing…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
      {result && (
        <Card title="Site Suitability Score">
          <div className="space-y-1">
            <div className="text-3xl font-bold">{result.score}/10</div>
            {Object.entries(result.reasons).map(([key, val]) => (
              <p key={key} className="text-sm">
                <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {val}
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
