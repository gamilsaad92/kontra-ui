import { useState, useEffect, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

const STATUS_STYLES = {
  on_track: { bg: '#f0fdf4', border: '#86efac', color: '#166534', dot: '#22c55e', label: 'On Track' },
  at_risk:  { bg: '#fffbeb', border: '#fcd34d', color: '#92400e', dot: '#f59e0b', label: 'At Risk'  },
  blocked:  { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b', dot: '#ef4444', label: 'Blocked'  },
};

const SUGGESTED_QUESTIONS = [
  "What's blocking closing?",
  'What should happen next?',
  "Who's holding up this deal?",
  'What changed recently?',
];

const STEP_STATUS_STYLES = {
  complete:    { icon: '✓', ring: '#86efac',  fill: '#f0fdf4',  text: '#166534' },
  in_progress: { icon: '⚡', ring: '#fcd34d',  fill: '#fffbeb',  text: '#92400e' },
  blocked:     { icon: '○', ring: '#e5e7eb',  fill: '#f9fafb',  text: '#d1d5db' },
  waiting:     { icon: '○', ring: '#e5e7eb',  fill: '#f9fafb',  text: '#d1d5db' },
  pending:     { icon: '○', ring: '#e5e7eb',  fill: '#f9fafb',  text: '#d1d5db' },
};

function ClosingChain({ chain }) {
  if (!chain || chain.length === 0) return null;
  return (
    <div className="px-6 pb-5">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 mb-4">
        Closing Chain
      </p>
      <div className="flex items-start">
        {chain.map((step, i) => {
          const s = STEP_STATUS_STYLES[step.stepStatus] || STEP_STATUS_STYLES.pending;
          const isActive = step.stepStatus === 'in_progress';
          const isLast = i === chain.length - 1;
          return (
            <div key={step.step} className="flex items-center" style={{ flex: isLast ? '0 0 auto' : 1, minWidth: 0 }}>
              <div className="flex flex-col items-center" style={{ minWidth: isActive ? 76 : 60 }}>
                <div
                  className="flex items-center justify-center rounded-full font-bold mb-1.5"
                  style={{
                    width: isActive ? 30 : 22,
                    height: isActive ? 30 : 22,
                    background: s.fill,
                    border: `2px solid ${s.ring}`,
                    color: s.text,
                    fontSize: isActive ? 13 : 10,
                    boxShadow: isActive ? `0 0 0 4px ${s.ring}33` : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {s.icon}
                </div>
                <span style={{
                  fontSize: isActive ? 10 : 9,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? s.text : '#c4b5c8',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  maxWidth: 76,
                }}>
                  {step.label}
                </span>
                {isActive && step.openCount > 0 && (
                  <span style={{
                    marginTop: 3,
                    fontSize: 8,
                    fontWeight: 700,
                    color: '#92400e',
                    background: '#fef3c7',
                    borderRadius: 999,
                    padding: '1px 6px',
                  }}>
                    {step.openCount} open
                  </span>
                )}
              </div>
              {!isLast && (
                <div style={{
                  flex: 1,
                  height: 1.5,
                  marginLeft: 4,
                  marginRight: 4,
                  marginTop: -16,
                  background: step.stepStatus === 'complete' ? '#86efac' : '#ede8ef',
                  minWidth: 8,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CriticalItem({ item, index }) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '10px 0',
      borderBottom: index > 0 ? '1px solid #fdf2f4' : 'none',
    }}>
      <div style={{
        flexShrink: 0,
        width: 3,
        borderRadius: 2,
        background: '#800020',
        alignSelf: 'stretch',
        minHeight: 32,
        marginTop: 2,
      }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.3, marginBottom: 2 }}>
          {item.item}
        </p>
        {item.note && (
          <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, marginBottom: 2 }}>
            {item.note}
          </p>
        )}
        {item.owner && (
          <p style={{ fontSize: 11, color: '#9ca3af' }}>
            Waiting on: <span style={{ color: '#6b7280', fontWeight: 500 }}>{item.owner}</span>
          </p>
        )}
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
      <div style={{
        marginBottom: 24,
        borderRadius: 20,
        border: '1px solid #f0e4e8',
        background: 'linear-gradient(135deg, #fdf7f9 0%, #fff 100%)',
        padding: '28px 24px',
      }}>
        <div style={{ height: 10, width: 120, background: '#f3e8ec', borderRadius: 6, marginBottom: 20 }} />
        <div style={{ height: 22, width: 200, background: '#f5eef1', borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 10, width: '80%', background: '#faf5f7', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 10, width: '60%', background: '#faf5f7', borderRadius: 6 }} />
      </div>
    );
  }

  const status       = briefing?.status || 'on_track';
  const style        = STATUS_STYLES[status];
  const criticalPath = briefing?.criticalPath || briefing?.blocking || [];
  const nonBlocking  = briefing?.nonBlockingTaskIds || [];
  const reviewedCount = briefing?.reviewedCount ?? briefing?.openTaskCount ?? 0;
  const chain        = briefing?.chain || null;
  const parallelNote = briefing?.parallelNote || null;
  const prepared     = briefing?.prepared || [];
  const firstName    = ownerName ? ownerName.split(' ')[0] : null;

  const attentionCount = criticalPath.length;
  const isOnTrack = attentionCount === 0;

  return (
    <div style={{
      marginBottom: 24,
      borderRadius: 20,
      border: '1px solid #f0e4e8',
      background: 'linear-gradient(160deg, #fdf7f9 0%, #fff 60%)',
      overflow: 'hidden',
    }}>

      {/* ── Morning greeting ─────────────────────────────────────────────── */}
      <div style={{ padding: '28px 24px 20px' }}>

        {/* Greeting line */}
        <h2 style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#111827',
          letterSpacing: '-0.02em',
          marginBottom: 14,
          lineHeight: 1.1,
        }}>
          {firstName ? `Good morning, ${firstName}.` : 'Good morning.'}
        </h2>

        {/* Reviewed count + status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
              I reviewed{' '}
              <span style={{ fontWeight: 600, color: '#374151' }}>
                {reviewedCount} item{reviewedCount !== 1 ? 's' : ''}
              </span>
              .
            </p>
            <p style={{
              fontSize: 15,
              fontWeight: 700,
              color: isOnTrack ? '#166534' : '#800020',
              lineHeight: 1.4,
            }}>
              {isOnTrack
                ? 'Nothing is blocking closing.'
                : attentionCount === 1
                  ? '1 item requires your attention.'
                  : `${attentionCount} items require your attention.`}
            </p>
          </div>
          <span style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 700,
            background: style.bg,
            color: style.color,
            border: `1px solid ${style.border}`,
            marginTop: 2,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: style.dot, display: 'inline-block' }} />
            {briefing?.statusLabel || style.label}
          </span>
        </div>

        {/* Narrative — breathes below the key stat */}
        {briefing?.narrative && (
          <p style={{
            fontSize: 13,
            color: '#4b5563',
            lineHeight: 1.7,
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid #f5ecef',
          }}>
            {briefing.narrative}
          </p>
        )}

        {/* Expected closing — quiet, anchoring */}
        {briefing?.expectedClosing && (
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
            Estimated closing:{' '}
            <span style={{ fontWeight: 600, color: '#6b7280' }}>{briefing.expectedClosing}</span>
          </p>
        )}
      </div>

      {/* ── Closing Chain stepper ────────────────────────────────────────── */}
      {chain && chain.length > 0 && (
        <>
          <div style={{ height: 1, background: '#f5ecef', margin: '0 24px' }} />
          <ClosingChain chain={chain} />
        </>
      )}

      {/* ── Items requiring attention ────────────────────────────────────── */}
      {criticalPath.length > 0 && (
        <>
          <div style={{ height: 1, background: '#f5ecef', margin: '0 24px' }} />
          <div style={{ padding: '16px 24px' }}>
            <p style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#c4b5c8',
              marginBottom: 10,
            }}>
              Requires attention
              {criticalPath[0]?.chainStep && (
                <span style={{
                  marginLeft: 8,
                  background: '#fef2f2',
                  color: '#991b1b',
                  borderRadius: 999,
                  padding: '1px 7px',
                  fontSize: 9,
                }}>
                  Step {criticalPath[0].chainStep} of closing chain
                </span>
              )}
            </p>
            {criticalPath.map((item, i) => (
              <CriticalItem key={item.taskId || i} item={item} index={i} />
            ))}
          </div>
        </>
      )}

      {/* ── I already prepared ───────────────────────────────────────────── */}
      {prepared.length > 0 && (
        <>
          <div style={{ height: 1, background: '#f5ecef', margin: '0 24px' }} />
          <div style={{
            margin: '0 24px 16px',
            padding: '12px 14px',
            background: '#f0fdf4',
            borderRadius: 12,
            border: '1px solid #bbf7d0',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 6 }}>
              I already prepared {prepared.length === 1 ? 'this' : 'these'} — ready when you are.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {prepared.map((p, i) => (
                <li key={i} style={{ fontSize: 12, color: '#15803d', display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: i < prepared.length - 1 ? 4 : 0 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>✔</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* ── Not blocking closing — very quiet ───────────────────────────── */}
      {(parallelNote || nonBlocking.length > 0) && criticalPath.length > 0 && (
        <div style={{ padding: '0 24px 14px' }}>
          <p style={{ fontSize: 11, color: '#c4b5c8', lineHeight: 1.5 }}>
            {parallelNote || (nonBlocking.length === 1
              ? '1 other task is open but not on the critical path.'
              : `${nonBlocking.length} other tasks are open but not blocking closing.`)}
          </p>
        </div>
      )}

      {/* ── Ask anything ─────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid #f5ecef',
        padding: '16px 24px',
        background: 'rgba(255,255,255,0.7)',
      }}>
        {answer && (
          <div style={{
            marginBottom: 12,
            padding: '12px 14px',
            background: '#fdf7f9',
            border: '1px solid #f0e4e8',
            borderRadius: 12,
            fontSize: 13,
            color: '#374151',
            lineHeight: 1.65,
          }}>
            {answer.answer}
          </div>
        )}

        {!answer && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {SUGGESTED_QUESTIONS.map(q => (
              <button key={q} onClick={() => ask(q)} style={{
                fontSize: 11,
                padding: '4px 11px',
                borderRadius: 999,
                border: '1px solid #ede8ef',
                background: '#fff',
                color: '#9ca3af',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask()}
            placeholder="Ask anything about this deal…"
            style={{
              flex: 1,
              fontSize: 13,
              border: '1px solid #ede8ef',
              borderRadius: 12,
              padding: '8px 14px',
              outline: 'none',
              background: '#fff',
              color: '#374151',
            }}
          />
          <button
            onClick={() => ask()}
            disabled={!question.trim() || asking}
            style={{
              padding: '8px 18px',
              borderRadius: 12,
              background: '#800020',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: question.trim() && !asking ? 'pointer' : 'not-allowed',
              opacity: !question.trim() || asking ? 0.45 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {asking ? '…' : 'Ask'}
          </button>
        </div>

        {answer && (
          <button onClick={() => { setAnswer(null); setQuestion(''); }} style={{
            marginTop: 8,
            fontSize: 11,
            color: '#c4b5c8',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}>
            ← Ask another question
          </button>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 11, color: '#ef4444', padding: '0 24px 12px' }}>
          {error} —{' '}
          <button onClick={loadBriefing} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
