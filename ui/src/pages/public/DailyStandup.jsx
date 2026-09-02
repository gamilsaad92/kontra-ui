import { useState, useEffect, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

export default function DailyStandup({ propertyId, ownerName }) {
  const [standup, setStandup] = useState(null);
  const [error, setError] = useState(null);

  const loadStandup = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/brain/standup`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setStandup(await r.json());
      setError(null);
    } catch (e) {
      clearTimeout(timeout);
      setError(e.name === 'AbortError' ? 'Timed out — retrying…' : e.message);
    }
  }, [propertyId]);

  useEffect(() => {
    const t = setTimeout(loadStandup, 500);
    return () => clearTimeout(t);
  }, [loadStandup]);

  useEffect(() => {
    const handler = (e) => {
      if (!e.detail?.propertyId || e.detail.propertyId === propertyId) {
        loadStandup();
      }
    };
    window.addEventListener('kontra:task-resolved', handler);
    return () => window.removeEventListener('kontra:task-resolved', handler);
  }, [propertyId, loadStandup]);

  if (standup === null && !error) {
    return (
      <div style={{
        marginBottom: 24,
        borderRadius: 20,
        border: '1px solid #e5e7eb',
        background: 'linear-gradient(135deg, #f9fafb 0%, #fff 100%)',
        padding: '28px 24px',
      }}>
        <div style={{ height: 10, width: 120, background: '#f0f0f0', borderRadius: 6, marginBottom: 20 }} />
        <div style={{ height: 22, width: 200, background: '#f2f2f2', borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 10, width: '80%', background: '#f7f7f7', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 10, width: '60%', background: '#f7f7f7', borderRadius: 6 }} />
      </div>
    );
  }

  const firstName = ownerName ? ownerName.split(' ')[0] : null;
  const completedToday = standup?.completedToday || [];
  const stillBlocked = standup?.stillBlocked || [];
  const tomorrowPlan = standup?.tomorrowPlan || [];
  const risks = standup?.risks || [];

  return (
    <div style={{
      marginBottom: 24,
      borderRadius: 20,
      border: '1px solid #e5e7eb',
      background: 'linear-gradient(160deg, #f9fafb 0%, #fff 55%)',
      overflow: 'hidden',
    }}>
      {/* ── Evening wrap-up header ────────────────────────────────────────── */}
      <div style={{ padding: '28px 24px 20px' }}>
        <p style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#9ca3af',
          marginBottom: 10,
        }}>
          Daily Standup
        </p>
        <h2 style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#111827',
          letterSpacing: '-0.02em',
          marginBottom: 12,
          lineHeight: 1.1,
        }}>
          {firstName ? `Good evening, ${firstName}.` : 'Good evening.'}
        </h2>

        {standup?.narrative && (
          <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7 }}>
            {standup.narrative}
          </p>
        )}
      </div>

      {/* ── Completed today ───────────────────────────────────────────────── */}
      {completedToday.length > 0 && (
        <>
          <div style={{ height: 1, background: '#f0f0f0', margin: '0 24px' }} />
          <div style={{ padding: '16px 24px' }}>
            <p style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#9ca3af', marginBottom: 10,
            }}>
              Completed today ({completedToday.length})
            </p>
            {completedToday.map((t, i) => (
              <div key={t.id || i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0',
                borderBottom: i < completedToday.length - 1 ? '1px solid #f6f6f6' : 'none',
              }}>
                <span style={{
                  flexShrink: 0, width: 16, height: 16, borderRadius: '50%',
                  background: '#f0fdf4', border: '1px solid #86efac', color: '#166534',
                  fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                }}>✓</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: '#374151', textDecoration: 'line-through', textDecorationColor: '#d1d5db' }}>
                    {t.title}
                  </p>
                  <p style={{ fontSize: 11, color: '#9ca3af' }}>{t.ownedBy}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Still open / blocked ─────────────────────────────────────────── */}
      {stillBlocked.length > 0 && (
        <>
          <div style={{ height: 1, background: '#f0f0f0', margin: '0 24px' }} />
          <div style={{ padding: '16px 24px' }}>
            <p style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#c4b5c8', marginBottom: 10,
            }}>
              Still open ({stillBlocked.length})
            </p>
            {stillBlocked.map((t, i) => (
              <div key={t.id || i} style={{ display: 'flex', gap: 10, padding: '6px 0' }}>
                <span style={{ flexShrink: 0, width: 3, borderRadius: 2, background: '#800020', alignSelf: 'stretch', minHeight: 20 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{t.title}</p>
                  <p style={{ fontSize: 11, color: '#9ca3af' }}>Waiting on: <span style={{ color: '#6b7280', fontWeight: 500 }}>{t.ownedBy}</span></p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Tomorrow's plan ──────────────────────────────────────────────── */}
      {tomorrowPlan.length > 0 && (
        <>
          <div style={{ height: 1, background: '#f0f0f0', margin: '0 24px' }} />
          <div style={{ padding: '16px 24px' }}>
            <p style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#9ca3af', marginBottom: 10,
            }}>
              Tomorrow's plan
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tomorrowPlan.map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151', marginBottom: i < tomorrowPlan.length - 1 ? 6 : 0 }}>
                  <span style={{ flexShrink: 0, color: '#800020', fontWeight: 700 }}>→</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* ── Risks ────────────────────────────────────────────────────────── */}
      {risks.length > 0 && (
        <>
          <div style={{ height: 1, background: '#f0f0f0', margin: '0 24px' }} />
          <div style={{
            margin: '16px 24px', padding: '12px 14px',
            background: '#fffbeb', borderRadius: 12, border: '1px solid #fcd34d',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
              At risk
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {risks.map((r, i) => (
                <li key={i} style={{ fontSize: 12, color: '#92400e', display: 'flex', gap: 6, marginBottom: i < risks.length - 1 ? 4 : 0 }}>
                  <span style={{ flexShrink: 0 }}>⚠</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {completedToday.length === 0 && stillBlocked.length === 0 && tomorrowPlan.length === 0 && risks.length === 0 && (
        <div style={{ padding: '0 24px 20px' }}>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>Nothing to report today.</p>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 11, color: '#ef4444', padding: '0 24px 20px' }}>
          {error} —{' '}
          <button onClick={loadStandup} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
