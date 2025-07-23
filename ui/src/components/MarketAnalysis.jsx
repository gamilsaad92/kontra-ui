import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import Card from './Card';
import SiteAnalysisForm from './SiteAnalysisForm';

export default function MarketAnalysis() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAnalyze(form) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/site-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.message || 'Analysis failed');
      }
    } catch {
      setError('Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Market Analysis</h1>
      <SiteAnalysisForm onAnalyze={handleAnalyze} />
      {loading && <p>Analyzing…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {result && (
        <Card title="Site Suitability Score">
          <div className="space-y-1">
            <div className="text-3xl font-bold">{result.score}/10</div>
            <p className="text-sm"><strong>Walkability:</strong> {result.reasons.walkability}</p>
            <p className="text-sm"><strong>Transit:</strong> {result.reasons.transit}</p>
            <p className="text-sm"><strong>Regulations:</strong> {result.reasons.regulations}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
