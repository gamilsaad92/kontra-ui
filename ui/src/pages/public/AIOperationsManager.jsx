import { useState, useEffect, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

// Operations Manager — an answer engine grounded strictly in the Task Engine.
// Advisor guidance: sell this as "The Operations Manager", not "AI Operations Manager".
// The morning brief leads with what matters most — the critical path — and explicitly
// tells the user which tasks DON'T matter so they can ignore them.
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

export default function AIOperationsManager({ propertyId, ownerName, onBriefingLoaded }) {
  const [briefing, setBriefing] = useState(null);
  const [error, setError]       = useState(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking]     = useState(false);
  const [answer, setAnswer]     = useState(null);

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

  const style = STATUS_STYLES[briefing?.status] || STATUS_STYLES.on_track;
  const criticalPath = briefing?.criticalPath || briefing?.blocking || [];
  const nonBlocking  = briefing?.nonBlockingTaskIds || [];
  const openCount    = briefing?.openTaskCount ?? 0;
  const reviewedCount = briefing?.reviewedCount ?? openCount;

  return (
    <div className="mb-6 rounded-2xl border overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #fdf7f9 0%, #fff 100%)', borderColor: '#f0e4e8' }}>

      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#800020' }}>
          Operations Manager
        </p>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h3 className="text-xl font-bold text-gray-900 leading-snug">
            Good {timeOfDay()}{ownerName ? `, ${ownerName}` : ''}.
          </h3>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0"
            style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
            <span style={{ fontSize: 8 }}>{style.dot}</span>
            {briefing?.statusLabel || style.label}
          </span>
        </div>

        {/* Review summary line */}
        {reviewedCount > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            {reviewedCount === 1
              ? 'I reviewed 1 item.'
              : `I reviewed ${reviewedCount} items.`}
            {' '}
            {criticalPath.length === 0
              ? <span className="text-gray-700 font-medium">Nothing is blocking closing.</span>
              : criticalPath.length === 1
                ? <span className="font-medium" style={{ color: '#991b1b' }}>One item requires your attention.</span>
                : <span className="font-medium" style={{ color: '#991b1b' }}>{criticalPath.length} items require your attention.</span>
            }
          </p>
        )}

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

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

      {/* Critical path — the only thing that matters */}
      {criticalPath.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl border border-red-100 overflow-hidden">
          <div className="px-4 py-2 flex items-center gap-2" style={{ background: '#fff5f5' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#991b1b' }}>
              Critical Path — blocking closing
            </span>
          </div>
          <ul className="divide-y divide-red-50 bg-white">
            {criticalPath.map((b, i) => (
              <li key={b.taskId || i} className="px-4 py-3 flex items-start gap-3">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                  style={{ background: '#fee2e2', color: '#991b1b' }}>
                  {b.owner}
                </span>
                <span className="text-sm text-gray-800">
                  {b.item}
                  {b.note ? <span className="text-gray-400"> — {b.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Non-blocking summary — tell the user what NOT to worry about */}
      {nonBlocking.length > 0 && criticalPath.length > 0 && (
        <p className="px-6 pb-3 text-xs text-gray-400">
          {nonBlocking.length === 1
            ? '1 other task is open but not blocking closing.'
            : `${nonBlocking.length} other tasks are open but not on the critical path.`}
        </p>
      )}

      {/* AI prepared actions */}
      {briefing?.prepared?.length > 0 && (
        <div className="px-6 pb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">I already prepared</p>
          <ul className="space-y-1">
            {briefing.prepared.map((p, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                <span className="text-green-500 shrink-0">✔</span> {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Answer engine */}
      <div className="px-6 pb-5 pt-3 border-t border-gray-100">
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything… e.g. What's blocking closing?"
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#80002033' }}
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="text-sm font-semibold px-4 py-2 rounded-xl text-white disabled:opacity-40 shrink-0"
            style={{ background: '#800020' }}
          >
            {asking ? '…' : 'Ask'}
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button key={q} type="button"
              onClick={() => { setQuestion(q); ask(q); }}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              {q}
            </button>
          ))}
        </div>

        {answer && (
          <div className="mt-3 text-sm rounded-xl px-4 py-3 leading-relaxed whitespace-pre-line"
            style={{ background: '#fdf7f9', border: '1px solid #f0e4e8', color: '#1f2937' }}>
            {answer.answer}
          </div>
        )}
      </div>
    </div>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
