import React, { useState, useEffect } from 'react';
import { API_BASE } from '../lib/apiBase';
import Card from './Card';
import SiteAnalysisForm from './SiteAnalysisForm';

// Connects to your Kontra SaaS backend at POST {API_BASE}/api/site-analysis
// Reads organizationId from prop or from REACT_APP_ORGANIZATION_ID env var
export default function MarketAnalysis({ organizationId }) {
  // Determine effective orgId
  const envOrgId = process.env.REACT_APP_ORGANIZATION_ID;
  const orgId = organizationId || envOrgId;

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgId) {
      setError(
        'Missing organization id. Please pass organizationId prop or set REACT_APP_ORGANIZATION_ID.'
      );
    }
  }, [orgId]);

  const handleAnalyze = async (formData) => {
    if (!orgId) {
      setError(
        'Cannot analyze: organizationId is not configured.'
      );
      return;
    }

    console.log('Submitting formData:', formData, 'organizationId:', orgId);
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const payload = { organizationId: orgId, ...formData };
      const response = await fetch(
        `${API_BASE}/api/site-analysis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
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
      {error && (
        <p className="text-red-600">
          Error: {error}
        </p>
      )}
      <SiteAnalysisForm onAnalyze={handleAnalyze} organizationId={orgId} />
      {loading && <p>Analyzing…</p>}
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
