import { useState, useEffect, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

// AI Operations Manager — an answer engine, not a reporting dashboard.
// It's grounded strictly in the Task Engine (deal_room_tasks) via
// api/lib/operationsManager.js. The success criterion (per advisor guidance,
// see .agents/memory/kontra-task-architecture.md): a user can ask any
// operational question ("What's blocking us?", "What should happen next?",
// "Who's holding this up?") and get a grounded answer, not a task list.
const STATUS_STYLES = {
  on_track: { label: 'On Track', bg: '#dcfce7', color: '#166534', dot: '🟢' },
  at_risk: { label: 'At Risk', bg: '#fef3c7', color: '#92400e', dot: '🟡' },
  blocked: { label: 'Blocked', bg: '#fee2e2', color: '#b91c1c', dot: '🔴' },
};

const SUGGESTED_QUESTIONS = [
  "What's blocking closing?",
  'What should happen next?',
  "Who's holding up this deal?",
  'What changed recently?',
];

export default function AIOperationsManager({ propertyId, ownerName }) {
  const [briefing, setBriefing] = useState(null);
  const [error, setError] = useState(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);

  const loadBriefing = useCallback(async () => {
    const url = `${API_BASE}/api/public/deal-room/${propertyId}/brain/briefing`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setBriefing(await r.json());
    } catch (e) {
      clearTimeout(timeout);
      if (e.name !== 'AbortError') setError(e.message);
      else setError('Timed out — retrying…');
    }
  }, [propertyId]);

  useEffect(() => {
    const t = setTimeout(() => loadBriefing(), 400);
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
      <div className="mb-6 rounded-2xl border border-gray-200 p-5 animate-pulse" style={{ background: 'linear-gradient(135deg, #fdf7f9, #ffffff)' }}>
        <div className="h-4 w-56 bg-gray-100 rounded mb-3" />
        <div className="h-16 bg-gray-50 rounded" />
      </div>
    );
  }

  const style = STATUS_STYLES[briefing?.status] || STATUS_STYLES.on_track;

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 overflow-hidden" style={{ background: 'linear-gradient(135deg, #fdf7f9, #ffffff)' }}>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#800020' }}>AI Operations Manager</p>
            <h3 className="text-lg font-bold text-gray-900 mt-0.5">
              Good {timeOfDay()}{ownerName ? `, ${ownerName}` : ''}.
            </h3>
          </div>
          {briefing && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0"
              style={{ background: style.bg, color: style.color }}
            >
              {style.dot} {briefing.statusLabel || style.label}
            </span>
          )}
        </div>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        {briefing && (
          <>
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">{briefing.narrative}</p>

            {briefing.expectedClosing && (
              <p className="text-xs text-gray-500 mt-2">Expected closing: <span className="font-semibold text-gray-700">{briefing.expectedClosing}</span></p>
            )}

            {briefing.blocking?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Currently blocking closing</p>
                <ul className="space-y-1.5">
                  {briefing.blocking.map((b, i) => (
                    <li key={b.taskId || i} className="text-sm bg-white border border-gray-100 rounded-lg px-3 py-2 flex items-start gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: '#f3f4f6', color: '#374151' }}>{b.owner}</span>
                      <span className="text-gray-800">{b.item}{b.note ? ` — ${b.note}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {briefing.prepared?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">I already prepared</p>
                <ul className="space-y-1">
                  {briefing.prepared.map((p, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                      <span className="text-green-600">✔</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Answer engine */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <form
            onSubmit={(e) => { e.preventDefault(); ask(); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about this workspace… e.g. What's blocking closing?"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': '#80002033' }}
            />
            <button
              type="submit"
              disabled={asking || !question.trim()}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-50 shrink-0"
              style={{ background: '#800020' }}
            >
              {asking ? 'Thinking…' : 'Ask'}
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => { setQuestion(q); ask(q); }}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                {q}
              </button>
            ))}
          </div>

          {answer && (
            <div className="mt-3 text-sm bg-white border border-gray-100 rounded-xl px-3.5 py-3 whitespace-pre-line text-gray-800">
              {answer.answer}
            </div>
          )}
        </div>
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
