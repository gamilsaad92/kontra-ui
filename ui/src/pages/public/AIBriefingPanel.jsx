/**
 * AIBriefingPanel — unified AI advisor panel.
 * Before noon: morning briefing (what to focus on today).
 * After noon: evening standup (what moved, what's still open, tomorrow's plan).
 *
 * Both endpoints are fetched in parallel on mount so switching is instant.
 */
import { useState, useEffect } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

function greeting(ownerName) {
  const h = new Date().getHours();
  const name = ownerName ? `, ${ownerName.split(' ')[0]}` : '';
  if (h < 12) return `Good morning${name}`;
  if (h < 17) return `Good afternoon${name}`;
  return `Good evening${name}`;
}

function isMorning() {
  return new Date().getHours() < 12;
}

export default function AIBriefingPanel({ propertyId, ownerName, dealName }) {
  const [briefing,  setBriefing]  = useState(null);
  const [standup,   setStandup]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [showEve,   setShowEve]   = useState(!isMorning());
  const [error,     setError]     = useState('');

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    setError('');

    const fetchBriefing = fetch(`${API_BASE}/api/public/deal-room/${propertyId}/brain/briefing`)
      .then(r => r.ok ? r.json() : null).catch(() => null);
    const fetchStandup  = fetch(`${API_BASE}/api/public/deal-room/${propertyId}/brain/standup`)
      .then(r => r.ok ? r.json() : null).catch(() => null);

    Promise.all([fetchBriefing, fetchStandup]).then(([b, s]) => {
      setBriefing(b);
      setStandup(s);
      setLoading(false);
      if (!b && !s) setError('Could not load briefing');
    });
  }, [propertyId]);

  const active = showEve ? standup : briefing;
  const label  = showEve ? 'Evening standup' : 'Morning briefing';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 mb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold text-[#800020] uppercase tracking-wide mb-0.5">
            {label}
          </p>
          <p className="text-sm font-bold text-gray-900">
            {greeting(ownerName)}{dealName ? ` — ${dealName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowEve(false)}
            className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold transition ${
              !showEve ? 'bg-[#800020] text-white' : 'text-gray-400 hover:text-gray-600 border border-gray-200'
            }`}>
            ☀ Morning
          </button>
          <button
            onClick={() => setShowEve(true)}
            className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold transition ${
              showEve ? 'bg-[#800020] text-white' : 'text-gray-400 hover:text-gray-600 border border-gray-200'
            }`}>
            🌙 Evening
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="space-y-2">
          {[80, 65, 90, 55].map(w => (
            <div key={w} className={`h-3 bg-gray-100 rounded animate-pulse`} style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-xs text-gray-400">{error}</p>
      )}

      {!loading && active && (
        <BriefingBody data={active} />
      )}

      {!loading && !active && !error && (
        <p className="text-xs text-gray-400">No briefing available yet — check back once documents are uploaded.</p>
      )}
    </div>
  );
}

function BriefingBody({ data }) {
  // Support both briefing and standup response shapes
  const hook      = data?.hook      || data?.headline   || '';
  const summary   = data?.summary   || data?.body       || data?.text || '';
  const actions   = data?.actions   || data?.next_actions || [];
  const risks     = data?.risks     || data?.open_items  || [];

  return (
    <div className="space-y-3">
      {hook && (
        <p className="text-sm font-semibold text-gray-800 leading-snug">{hook}</p>
      )}
      {summary && (
        <p className="text-xs text-gray-600 leading-relaxed">{summary}</p>
      )}
      {actions?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Today's actions</p>
          <ul className="space-y-1">
            {actions.slice(0, 4).map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="text-[#800020] shrink-0 mt-0.5">→</span>
                <span>{typeof a === 'string' ? a : a.text || a.action || JSON.stringify(a)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {risks?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Open items</p>
          <ul className="space-y-1">
            {risks.slice(0, 3).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                <span>{typeof r === 'string' ? r : r.text || r.risk || JSON.stringify(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
