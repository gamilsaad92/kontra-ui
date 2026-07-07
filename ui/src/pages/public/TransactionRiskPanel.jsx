import { useState, useEffect } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

// Transaction Risk Panel — replaces the numeric "Deal Health 82" score.
// Advisor guidance: humans don't buy a number. They buy clarity.
// "Transaction Risk: Low — Only one critical dependency remains."
// is more useful than any score. Powered by the Operations Manager briefing
// (cached 60s server-side, so no extra LLM call on page load).
const RISK_CONFIG = {
  on_track: {
    level: 'Low',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    bar: '#16a34a',
    barWidth: '15%',
  },
  at_risk: {
    level: 'Moderate',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    bar: '#d97706',
    barWidth: '55%',
  },
  blocked: {
    level: 'High',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    bar: '#dc2626',
    barWidth: '90%',
  },
};

function summaryLine(criticalPath, nonBlockingCount) {
  const critical = criticalPath?.length ?? 0;
  if (critical === 0 && nonBlockingCount === 0) {
    return 'No open dependencies — closing is unobstructed.';
  }
  if (critical === 0) {
    return `${nonBlockingCount} task${nonBlockingCount !== 1 ? 's' : ''} open, none blocking closing.`;
  }
  if (critical === 1) {
    return 'Only one critical dependency remains.';
  }
  return `${critical} critical dependencies are blocking closing.`;
}

export default function TransactionRiskPanel({ propertyId }) {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Delay slightly so AIOperationsManager fires first (warms the 60s cache)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/brain/briefing`);
        if (cancelled || !r.ok) return;
        const data = await r.json();
        if (!cancelled) { setBriefing(data); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }, 700);
    return () => { cancelled = true; clearTimeout(t); };
  }, [propertyId]);

  if (loading) {
    return (
      <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
        <div className="h-3 w-28 bg-gray-100 rounded mb-3" />
        <div className="h-7 w-20 bg-gray-100 rounded mb-2" />
        <div className="h-2 w-full bg-gray-50 rounded-full mb-3" />
        <div className="h-3 w-56 bg-gray-50 rounded" />
      </div>
    );
  }

  if (!briefing) return null;

  const status = briefing.status || 'on_track';
  const cfg    = RISK_CONFIG[status] || RISK_CONFIG.on_track;
  const criticalPath     = briefing.criticalPath || briefing.blocking || [];
  const nonBlockingCount = briefing.nonBlockingTaskIds?.length ?? 0;

  return (
    <div className="mb-6 bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
          Transaction Risk
        </p>

        {/* Risk level — large, confident */}
        <div className="flex items-end gap-3 mb-3">
          <span className="text-3xl font-black leading-none" style={{ color: cfg.color }}>
            {cfg.level}
          </span>
          <span className="text-sm text-gray-500 mb-0.5 leading-tight">
            {summaryLine(criticalPath, nonBlockingCount)}
          </span>
        </div>

        {/* Risk bar — visual indicator without a fake number */}
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: cfg.barWidth, background: cfg.color }}
          />
        </div>
      </div>

      {/* Critical dependencies — the reason for any elevated risk */}
      {criticalPath.length > 0 && (
        <div style={{ borderTop: `1px solid ${cfg.border}`, background: cfg.bg }}>
          <div className="px-5 py-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
              {criticalPath.length === 1 ? 'Critical dependency' : 'Critical dependencies'}
            </p>
          </div>
          <ul className="divide-y divide-white/60 pb-1">
            {criticalPath.map((item, i) => (
              <li key={item.taskId || i} className="px-5 py-2 flex items-start gap-2.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                  style={{ background: cfg.border, color: cfg.color }}>
                  {item.owner}
                </span>
                <span className="text-xs text-gray-700 leading-snug">
                  {item.item}
                  {item.note ? <span className="text-gray-400"> — {item.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* All clear state */}
      {criticalPath.length === 0 && !loading && (
        <div className="px-5 pb-4">
          <p className="text-xs text-green-600 font-semibold flex items-center gap-1.5">
            <span>✓</span> No dependencies blocking closing
          </p>
        </div>
      )}
    </div>
  );
}
