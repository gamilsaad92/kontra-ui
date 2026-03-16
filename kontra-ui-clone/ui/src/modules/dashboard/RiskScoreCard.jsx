import React, { useEffect, useState } from 'react';
import RiskGauge from '../../components/RiskGauge';
import Card from '../../components/Card';

export default function RiskScoreCard({ value = 72, to, scorecard }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const adjustedScore = scorecard?.adjustedScore ?? value;
  const baseScore = scorecard?.baseScore ?? value;
  const adjustment = scorecard?.adjustment ?? 0;
  const adjustmentLabel = adjustment >= 0 ? `+${adjustment}` : `${adjustment}`;
  const adjustmentTone = adjustment >= 0 ? 'text-emerald-600' : 'text-rose-600';
  const fundingReadiness = scorecard?.fundingReadiness;
  const forecast = scorecard?.forecast;
  const narrative = scorecard?.narrative ?? 'AI-generated adjustments pending review.';
  const topRecommendations = scorecard?.recommendations?.slice(0, 2) ?? [];

  return (
    <Card title="Risk Score" loading={loading} to={to}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-center">
          <RiskGauge value={adjustedScore} />
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
            <span>Base</span>
            <span className="text-sm font-semibold text-slate-900">{baseScore}</span>
          </div>
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
            <span>AI Adjustment</span>
            <span className={`text-sm font-semibold ${adjustmentTone}`}>{adjustmentLabel}</span>
          </div>
          {typeof fundingReadiness === 'number' && (
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
              <span>Funding readiness</span>
              <span className="text-sm font-semibold text-slate-900">{fundingReadiness}%</span>
            </div>
          )}
        </div>
        {forecast && (
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <div className="flex items-center justify-between font-medium text-slate-700">
              <span>12M expected loss</span>
              <span>{forecast.expectedLossRate}%</span>
            </div>
            {forecast.projectedLossExposure !== null && (
              <div className="mt-1 flex items-center justify-between">
                <span>Projected exposure</span>
                <span className="font-medium text-slate-700">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  }).format(forecast.projectedLossExposure || 0)}
                </span>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500">{narrative}</p>
        {topRecommendations.length > 0 && (
          <ul className="space-y-1 text-xs text-slate-500">
            {topRecommendations.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-[3px] h-1.5 w-1.5 flex-none rounded-full bg-slate-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
