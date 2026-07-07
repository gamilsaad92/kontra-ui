import { useState, useEffect, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

// Operations Manager — an answer engine grounded strictly in the Task Engine.
// Advisor guidance: sell this as "The Operations Manager", not "AI Operations Manager".
// Critical Path Engine v2: shows the full dependency chain (Due Diligence → Underwriting →
// Loan Committee → Closing) with step-level status, so users see WHICH step is the active
// blocker and which tasks are parallel / not gating closing.
const STATUS_STYLES = {
  on_track: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', dot: '●', label: 'On Track' },
  at_risk:  { bg: '#fffbeb', border: '#fde68a', color: '#92400e', dot: '●', label: 'At Risk'  },
  blocked:  { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', dot: '●', label: 'Blocked'  },
};

const SUGGESTED_QUESTIONS = [
  "What's blocking closing?",
  'What should happen next?',
  "Who's holding up this deal?",
  'What changed recently?',
];

const RISK_STYLES = {
  critical: { label: 'Critical', bg: '#fee2e2', color: '#991b1b' },
  high:     { label: 'High',     bg: '#ffedd5', color: '#9a3412' },
  medium:   { label: 'Medium',   bg: '#fef9c3', color: '#854d0e' },
  low:      { label: 'Low',      bg: '#f3f4f6', color: '#4b5563' },
};

const STEP_STATUS_STYLES = {
  complete:    { icon: '✓', bg: '#f0fdf4', border: '#86efac', color: '#166534', labelColor: '#166534' },
  in_progress: { icon: '⚡', bg: '#fffbeb', border: '#fcd34d', color: '#92400e', labelColor: '#92400e' },
  blocked:     { icon: '○', bg: '#f9fafb', border: '#e5e7eb', color: '#9ca3af', labelColor: '#9ca3af' },
  waiting:     { icon: '○', bg: '#f9fafb', border: '#e5e7eb', color: '#9ca3af', labelColor: '#9ca3af' },
  pending:     { icon: '○', bg: '#f9fafb', border: '#e5e7eb', color: '#9ca3af', labelColor: '#9ca3af' },
};

function ClosingChain({ chain }) {
  if (!chain || chain.length === 0) return null;

  return (
    <div className="px-6 pb-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
        Closing Chain
      </p>
      <div className="flex items-start gap-0">
        {chain.map((step, i) => {
          const s = STEP_STATUS_STYLES[step.stepStatus] || STEP_STATUS_STYLES.pending;
          const isLast = i === chain.length - 1;
          const isActive = step.stepStatus === 'in_progress' || (step.stepStatus === 'pending' && chain.slice(0, i).every(p => p.stepStatus === 'complete'));
          return (
            <div key={step.step} className="flex items-center" style={{ flex: isLast ? '0 0 auto' : 1, minWidth: 0 }}>
              {/* Step node */}
              <div
                className="flex flex-col items-center"
                style={{ minWidth: isActive ? 72 : 64 }}
              >
                <div
                  className="flex items-center justify-center rounded-full text-xs font-bold mb-1 transition-all"
                  style={{
                    width: isActive ? 28 : 24,
                    height: isActive ? 28 : 24,
                    background: s.bg,
                    border: `2px solid ${s.border}`,
                    color: s.color,
                    boxShadow: isActive ? `0 0 0 3px ${s.border}40` : 'none',
                    fontSize: isActive ? 13 : 11,
                  }}
                >
                  {s.icon}
                </div>
                <span
                  className="text-center leading-tight font-medium"
                  style={{
                    fontSize: isActive ? 10 : 9,
                    color: isActive ? s.labelColor : '#9ca3af',
                    maxWidth: 72,
                  }}
                >
                  {step.label}
                </span>
                {isActive && step.openCount > 0 && (
                  <span
                    className="mt-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                    style={{ background: '#fef3c7', color: '#92400e' }}
                  >
                    {step.openCount} open
                  </span>
                )}
              </div>
              {/* Connector line */}
              {!isLast && (
                <div
                  className="flex-1 h-0.5 mx-1 self-start mt-3"
                  style={{
                    background: step.stepStatus === 'complete' ? '#86efac' : '#e5e7eb',
                    minWidth: 8,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AIOperationsManager({ propertyId, ownerName, onBriefingLoaded }) {
  const [briefing, setBriefing]   = useState(null);
  const [error, setError]         = useState(null);
  const [question, setQuestion]   = useState('');
  const [asking, setAsking]       = useState(false);
  const [answer, setAnswer]       = useState(null);

  const loadBriefing = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/brain/briefing`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      setBriefing(data);
      onBriefingLoaded?.(data);
    } catch (e) {
      clearTimeout(timeout);
      setError(e.name === 'AbortError' ? 'Timed out — retrying…' : e.message);
    }
  }, [propertyId, onBriefingLoaded]);

  useEffect(() => {
    const t = setTimeout(loadBriefing, 400);
    return () => clearTimeout(t);
  }, [loadBriefing]);

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setAsking(true);
    setAnswer(null);
    try {
      const r = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/brain/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      if (!r.ok) throw new Error('Failed to get an answer');
      setAnswer(await r.json());
    } catch (e) {
      setAnswer({ answer: `Something went wrong: ${e.message}`, citedTaskIds: [] });
    } finally {
      setAsking(false);
    }
  };

  if (briefing === null && !error) {
    return (
      <div className="mb-6 rounded-2xl border border-gray-100 p-6 animate-pulse"
        style={{ background: 'linear-gradient(135deg, #fdf7f9 0%, #fff 100%)' }}>
        <div className="h-3 w-28 bg-gray-100 rounded mb-4" />
        <div className="h-5 w-48 bg-gray-100 rounded mb-3" />
        <div className="h-3 w-full bg-gray-50 rounded mb-2" />
        <div className="h-3 w-3/4 bg-gray-50 rounded" />
      </div>
    );
  }

  const style        = STATUS_STYLES[briefing?.status] || STATUS_STYLES.on_track;
  const criticalPath = briefing?.criticalPath || briefing?.blocking || [];
  const nonBlocking  = briefing?.nonBlockingTaskIds || [];
  const openCount    = briefing?.openTaskCount ?? 0;
  const reviewedCount = briefing?.reviewedCount ?? openCount;
  const chain        = briefing?.chain || null;
  const parallelNote = briefing?.parallelNote || null;

  return (
    <div className="mb-6 rounded-2xl border overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #fdf7f9 0%, #fff 100%)', borderColor: '#f0e4e8' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
          style={{ color: '#800020', letterSpacing: '0.1em' }}>
          Operations Manager
        </p>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-extrabold text-gray-900 leading-snug">
            {ownerName ? `Good morning, ${ownerName.split(' ')[0]}.` : 'Good morning.'}
          </h2>
          <span className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
            <span style={{ fontSize: 8 }}>{style.dot}</span>
            {briefing?.statusLabel || style.label}
          </span>
        </div>

        {/* Reviewed count line */}
        <p className="text-sm text-gray-500 mt-1">
          I reviewed {reviewedCount} item{reviewedCount !== 1 ? 's' : ''}.{' '}
          {criticalPath.length === 0
            ? <span className="text-gray-700 font-medium">Nothing is blocking closing.</span>
            : criticalPath.length === 1
              ? <span className="font-medium" style={{ color: '#991b1b' }}>1 item requires your attention.</span>
              : <span className="font-medium" style={{ color: '#991b1b' }}>{criticalPath.length} items require your attention.</span>
          }
        </p>

        {/* Narrative */}
        {briefing?.narrative && (
          <p className="text-sm text-gray-700 mt-3 leading-relaxed">{briefing.narrative}</p>
        )}

        {/* Expected closing */}
        {briefing?.expectedClosing && (
          <p className="text-xs text-gray-400 mt-2">
            Expected closing: <span className="font-semibold text-gray-600">{briefing.expectedClosing}</span>
          </p>
        )}
      </div>

      {/* ── Closing Chain stepper ────────────────────────────────────────────── */}
      {chain && chain.length > 0 && (
        <>
          <div className="border-t mx-6" style={{ borderColor: '#f0e4e8' }} />
          <ClosingChain chain={chain} />
        </>
      )}

      {/* ── Critical Path ───────────────────────────────────────────────────── */}
      {criticalPath.length > 0 && (
        <>
          <div className="border-t mx-6" style={{ borderColor: '#f0e4e8' }} />
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: '#991b1b' }}>
                Critical Path — blocking closing
              </span>
              {criticalPath[0]?.chainStep && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: '#fee2e2', color: '#991b1b' }}>
                  Step {criticalPath[0].chainStep}
                </span>
              )}
            </div>
            {criticalPath.map((b, i) => (
              <div key={b.taskId || i}
                className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
                style={{ borderColor: '#fef2f2' }}>
                <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                  style={{ background: '#fee2e2', color: '#991b1b' }}>
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{b.item}</p>
                  {b.note && (
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#b91c1c' }}>
                      {b.note}
                    </p>
                  )}
                  {b.owner && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Owner: <span className="font-medium text-gray-600">{b.owner}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Parallel / non-blocking note ────────────────────────────────────── */}
      {parallelNote && nonBlocking.length > 0 && (
        <>
          <div className="border-t mx-6" style={{ borderColor: '#f0e4e8' }} />
          <div className="px-6 py-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-semibold text-gray-600">Not blocking closing: </span>
              {parallelNote}
            </p>
          </div>
        </>
      )}

      {/* Fallback non-blocking note if no parallelNote from API */}
      {!parallelNote && nonBlocking.length > 0 && criticalPath.length > 0 && (
        <>
          <div className="border-t mx-6" style={{ borderColor: '#f0e4e8' }} />
          <div className="px-6 py-3">
            <p className="text-xs text-gray-500">
              {nonBlocking.length === 1
                ? '1 other task is open but not blocking closing.'
                : `${nonBlocking.length} other tasks are open but not blocking closing.`}
            </p>
          </div>
        </>
      )}

      {/* ── AI-prepared items ───────────────────────────────────────────────── */}
      {briefing?.prepared?.length > 0 && (
        <>
          <div className="border-t mx-6" style={{ borderColor: '#f0e4e8' }} />
          <div className="px-6 pb-4 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">I already prepared</p>
            <ul className="space-y-1">
              {briefing.prepared.map((p, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                  <span className="text-green-500 shrink-0">✔</span> {p}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* ── Answer box ──────────────────────────────────────────────────────── */}
      <div className="border-t px-6 py-4" style={{ borderColor: '#f0e4e8', background: 'rgba(255,255,255,0.6)' }}>
        {answer && (
          <div className="mb-3 rounded-xl p-3 text-sm leading-relaxed text-gray-800"
            style={{ background: '#fdf7f9', border: '1px solid #f0e4e8' }}>
            {answer.answer}
          </div>
        )}

        {/* Suggested questions */}
        {!answer && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SUGGESTED_QUESTIONS.map(q => (
              <button key={q} onClick={() => ask(q)}
                className="text-xs px-2.5 py-1 rounded-full border transition-colors hover:bg-gray-50"
                style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask()}
            placeholder="Ask anything… e.g. What's blocking closing?"
            className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none transition-colors"
            style={{ borderColor: '#e5e7eb', background: '#fff' }}
          />
          <button
            onClick={() => ask()}
            disabled={!question.trim() || asking}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: '#800020' }}
          >
            {asking ? '…' : 'Ask'}
          </button>
        </div>
        {answer && (
          <button onClick={() => { setAnswer(null); setQuestion(''); }}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Ask another question
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 px-6 pb-3">
          {error} — <button onClick={loadBriefing} className="underline">Retry</button>
        </p>
      )}
    </div>
  );
}
