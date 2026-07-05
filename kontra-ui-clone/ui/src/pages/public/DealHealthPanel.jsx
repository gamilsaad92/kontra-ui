import { useState, useEffect } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Health scoring rules (required roles, thresholds, action text) live on the
// active workflow template — see ui/src/lib/workflowPacks/. This panel
// just renders whatever score + action list the template computes.
export default function DealHealthPanel({ propertyId, packId = DEFAULT_PACK_ID }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const workflowPack = getWorkflowPack(packId);
    Promise.all([
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`).then(r => r.ok ? r.json() : { analyses: [] }),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination?t=${Date.now()}`).then(r => r.ok ? r.json() : {}),
    ]).then(([a, c]) => {
      const analyses = a.analyses || [];
      const submissions = c.submissions || [];
      setState(workflowPack.computeHealth(analyses, submissions));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [propertyId, packId]);

  if (loading) return (
    <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-full bg-gray-100 shrink-0" />
        <div className="flex-1">
          <div className="h-3 w-24 bg-gray-100 rounded mb-2" />
          <div className="h-5 w-32 bg-gray-100 rounded mb-3" />
          <div className="h-3 w-40 bg-gray-50 rounded" />
        </div>
      </div>
    </div>
  );

  if (!state) return null;

  const { score, actions } = state;
  const color = score >= 85 ? '#16a34a' : score >= 65 ? '#d97706' : '#dc2626';
  const emoji = score >= 85 ? '🟢' : score >= 65 ? '🟡' : '🔴';
  const label = score >= 85 ? 'Low Risk' : score >= 65 ? 'Moderate Risk' : 'High Risk';
  const circumference = 2 * Math.PI * 15.9;
  const dash = (score / 100) * circumference;

  const errorCount = actions.filter(a => a.sev === 'error').length;
  const warnCount = actions.filter(a => a.sev === 'warn').length;

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Score header */}
      <div className="px-6 pt-5 pb-4 flex items-center gap-5">
        {/* SVG ring */}
        <div className="shrink-0 relative w-20 h-20">
          <svg viewBox="0 0 36 36" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.2" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3.2"
              strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black leading-none" style={{ color }}>{score}</span>
            <span className="text-[9px] font-semibold text-gray-400 leading-none mt-0.5">/ 100</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Deal Health Score</p>
          <p className="text-lg font-bold text-gray-900 leading-tight">{emoji} {label}</p>
          {actions.length === 0 ? (
            <p className="text-xs text-green-600 font-semibold mt-1">✓ No action items — deal on track</p>
          ) : (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  ● {errorCount} critical
                </span>
              )}
              {warnCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  ● {warnCount} review
                </span>
              )}
              {actions.filter(a => a.sev === 'info').length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  ● {actions.filter(a => a.sev === 'info').length} pending
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action items */}
      {actions.length > 0 && (
        <div className="border-t border-gray-100">
          <div className="px-5 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Action Items</p>
            <p className="text-[10px] text-gray-300">{actions.length} total</p>
          </div>
          <div className="divide-y divide-gray-50">
            {actions.map((a, i) => (
              <div key={i} className={`flex items-center gap-3 px-5 py-2.5
                ${a.sev === 'error' ? 'bg-red-50/50' : a.sev === 'warn' ? 'bg-amber-50/30' : 'bg-blue-50/20'}`}>
                <span className="text-sm shrink-0">{a.icon}</span>
                <p className={`text-xs font-medium flex-1 leading-snug
                  ${a.sev === 'error' ? 'text-red-700' : a.sev === 'warn' ? 'text-amber-700' : 'text-blue-700'}`}>
                  {a.text}
                </p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0
                  ${a.sev === 'error' ? 'bg-red-100 text-red-600' : a.sev === 'warn' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                  {a.sev === 'error' ? 'Action' : a.sev === 'warn' ? 'Review' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
