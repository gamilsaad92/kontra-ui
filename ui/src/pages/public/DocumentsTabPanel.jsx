import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';
import DocumentChecklistPanel from './DocumentChecklistPanel';
import VerificationPanel from './VerificationPanel';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

function useDealAnalyses(propertyId, refreshKey) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) { setLoading(false); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`)
      .then(r => r.ok ? r.json() : { analyses: [] })
      .then(d => { setAnalyses(d.analyses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId, refreshKey]);

  return { analyses, loading };
}

function IntelligenceTab({ analyses, loading, packId, propertyId, onSwitchToChecklist }) {
  const pack = getWorkflowPack(packId);
  const SECTIONS = pack.intelligenceSections || [];
  const getBadge = pack.getIntelligenceBadge || (() => null);
  const getHighlight = pack.getIntelligenceHighlight || (() => null);

  const bySection = {};
  for (const a of analyses) {
    if (!bySection[a.section]) bySection[a.section] = a;
  }
  const bySectionAnalysis = {};
  for (const a of analyses) {
    if (!bySectionAnalysis[a.section]) bySectionAnalysis[a.section] = a.analysis;
  }

  const stats = pack.getSnapshotStats ? pack.getSnapshotStats(bySectionAnalysis) : [];
  const covenantFlag = pack.getSnapshotFlag ? pack.getSnapshotFlag(bySectionAnalysis) : null;

  const doneCount = SECTIONS.filter(s => bySection[s.key]).length;

  if (loading) {
    return (
      <div className="px-5 pt-4 pb-5 animate-pulse space-y-3">
        <div className="h-4 w-40 bg-gray-100 rounded" />
        <div className="h-16 bg-gray-50 rounded-xl" />
        <div className="h-16 bg-gray-50 rounded-xl" />
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <div className="text-4xl mb-4">🤖</div>
        <p className="text-sm font-semibold text-gray-700 mb-2">AI analysis will appear here</p>
        <p className="text-xs text-gray-400 max-w-xs mx-auto mb-5">
          Upload a document with AI analysis enabled to unlock deal insights, risk flags, and a financial summary for this deal room.
        </p>
        {onSwitchToChecklist && (
          <button
            onClick={onSwitchToChecklist}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all"
            style={{ background: '#800020', color: '#fff' }}
          >
            ← Go to Checklist to upload
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-5 space-y-5">
      {/* ── Deal Intelligence section ─────────────────────────────── */}
      {SECTIONS.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Deal Intelligence</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {doneCount === 0
                  ? 'Awaiting AI analysis'
                  : `${doneCount}/${SECTIONS.length} sections analyzed`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {doneCount > 0 && (
                <a
                  href={`/deal-room/${propertyId}/summary`}
                  target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">
                  🖨 Print Summary
                </a>
              )}
              <div
                className="text-xl font-black"
                style={{ color: doneCount === SECTIONS.length ? '#16a34a' : doneCount >= 1 ? '#d97706' : '#9ca3af' }}>
                {Math.round(doneCount / SECTIONS.length * 100)}%
              </div>
            </div>
          </div>

          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.round(doneCount / SECTIONS.length * 100)}%`,
                background: doneCount === SECTIONS.length ? '#16a34a' : '#d97706',
              }}
            />
          </div>

          <div className="space-y-2">
            {SECTIONS.map(({ key, icon, label, color }) => {
              const a = bySection[key];
              if (!a) return (
                <div key={key} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-lg">{icon}</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-400">{label}</p>
                    <p className="text-[10px] text-gray-300">Awaiting upload</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Pending</span>
                </div>
              );
              const badge = getBadge(key, a.analysis);
              const highlight = getHighlight(key, a.analysis);
              return (
                <div key={key} className="px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{icon}</span>
                      <p className="text-xs font-bold text-gray-800">{label}</p>
                      <span className="text-[10px] text-gray-400 truncate hidden sm:block">{a.filename}</span>
                      {a.storage_path && (
                        <a
                          href={`${API_BASE}/api/public/document-url?path=${encodeURIComponent(a.storage_path)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1 hover:bg-gray-100 transition shrink-0"
                          style={{ color: '#800020', borderColor: '#80002030' }}>
                          ↓ Original
                        </a>
                      )}
                    </div>
                    {badge && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2"
                        style={{ background: badge.color + '18', color: badge.color }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {a.analysis.summary && (
                    <p className="text-xs text-gray-600 leading-relaxed mt-1">
                      {a.analysis.summary.slice(0, 200)}{a.analysis.summary.length > 200 ? '…' : ''}
                    </p>
                  )}
                  {highlight && (
                    <p className="text-xs font-semibold mt-1" style={{ color }}>{highlight}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Uploaded by {a.uploaded_by_role} · {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>

          {doneCount === SECTIONS.length && SECTIONS.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-green-50 border border-green-100">
              <p className="text-xs font-semibold text-green-800">✓ Deal room fully populated — ready to share with your lender</p>
              <p className="text-[10px] text-green-600 mt-0.5">All key sections have been analyzed. Use the invite links below to send the lender their view.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Financial Summary section ─────────────────────────────── */}
      {stats.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Financial Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {stats.map(s => (
              <div key={s.label} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-center">
                <div className="text-sm font-bold text-gray-800">{s.value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          {covenantFlag && (
            <div className={`mt-3 px-3 py-2 rounded-xl text-xs font-medium ${covenantFlag.sev === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
              ⚠ {covenantFlag.text}
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-3">
            Pulled automatically from documents already uploaded — no need to re-enter these numbers.
          </p>
        </div>
      )}

      {SECTIONS.length === 0 && stats.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-gray-400">No intelligence configured for this workflow pack.</p>
        </div>
      )}
    </div>
  );
}

const hintKey = (propertyId) => `kontra_intelligence_hint_shown_${propertyId}`;

export default function DocumentsTabPanel({
  propertyId,
  propertyType,
  role,
  isDemo,
  packId = DEFAULT_PACK_ID,
  onAnalysisSaved,
  refreshKey,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ['checklist', 'intelligence'];
  const rawTab = searchParams.get('tab');
  const activeTab = VALID_TABS.includes(rawTab) ? rawTab : 'checklist';

  const [showHint, setShowHint] = useState(false);
  const [hintOpaque, setHintOpaque] = useState(false);
  const hintTimerRef = useRef(null);
  const hintRafRef = useRef(null);
  const { analyses, loading } = useDealAnalyses(propertyId, refreshKey);

  const hasAnalyses = analyses.length > 0;

  const dismissHint = () => {
    clearTimeout(hintTimerRef.current);
    cancelAnimationFrame(hintRafRef.current);
    setHintOpaque(false);
    hintTimerRef.current = setTimeout(() => setShowHint(false), 310);
  };

  useEffect(() => {
    if (showHint) {
      hintRafRef.current = requestAnimationFrame(() => setHintOpaque(true));
      hintTimerRef.current = setTimeout(() => dismissHint(), 30000);
    }
    return () => {
      clearTimeout(hintTimerRef.current);
      cancelAnimationFrame(hintRafRef.current);
    };
  }, [showHint]);

  const handleAnalysisSaved = (...args) => {
    if (!localStorage.getItem(hintKey(propertyId))) {
      setHintOpaque(false);
      setShowHint(true);
      localStorage.setItem(hintKey(propertyId), '1');
    }
    if (onAnalysisSaved) onAnalysisSaved(...args);
  };

  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__kontraTestTriggerHint__ = handleAnalysisSaved;
      return () => { delete window.__kontraTestTriggerHint__; };
    }
  });

  const handleTabClick = (key) => {
    if (key === 'intelligence') dismissHint();
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', key);
      return next;
    }, { replace: true });
  };

  const tabs = [
    { key: 'checklist', label: 'Checklist' },
    { key: 'intelligence', label: 'Intelligence' },
  ];

  return (
    <div className="mb-6">
      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-nowrap items-center gap-1 pt-1 mb-2 px-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            className="relative overflow-visible shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: activeTab === tab.key ? '#800020' : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#9ca3af',
              border: activeTab === tab.key ? '1px solid #800020' : '1px solid #e5e7eb',
            }}
          >
            {tab.label}
            {tab.key === 'intelligence' && hasAnalyses && (
              <span style={{
                marginLeft: 6,
                background: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
                color: activeTab === tab.key ? '#fff' : '#6b7280',
                borderRadius: 999,
                padding: '0 5px',
                fontSize: 9,
                fontWeight: 700,
              }}>
                {analyses.length}
              </span>
            )}
            {tab.key === 'intelligence' && showHint && activeTab !== 'intelligence' && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center"
                style={{
                  width: 10,
                  height: 10,
                  opacity: hintOpaque ? 1 : 0,
                  transition: hintOpaque ? 'opacity 200ms ease-in' : 'opacity 300ms ease-out',
                }}
                aria-label="New analysis available"
              >
                <span
                  className="animate-ping absolute inline-flex rounded-full opacity-75"
                  style={{ width: 10, height: 10, background: '#800020', animation: hintOpaque ? undefined : 'none' }}
                />
                <span
                  className="relative inline-flex rounded-full"
                  style={{ width: 6, height: 6, background: '#800020' }}
                />
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-gray-300 pr-1">Documents</span>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      {activeTab === 'checklist' ? (
        <>
          <DocumentChecklistPanel
            propertyId={propertyId}
            propertyType={propertyType}
            role={role}
            isDemo={isDemo}
            packId={packId}
            onAnalysisSaved={handleAnalysisSaved}
          />
          <VerificationPanel propertyId={propertyId} />
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <IntelligenceTab
            analyses={analyses}
            loading={loading}
            packId={packId}
            propertyId={propertyId}
            onSwitchToChecklist={() => handleTabClick('checklist')}
          />
        </div>
      )}
    </div>
  );
}
