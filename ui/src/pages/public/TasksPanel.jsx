import { useState, useEffect, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

const STATUS_STYLES = {
  pending:    { label: 'Open',        bg: '#fef3c7', color: '#92400e' },
  in_progress:{ label: 'In Progress', bg: '#dbeafe', color: '#1d4ed8' },
  escalated:  { label: 'Escalated',   bg: '#fee2e2', color: '#b91c1c' },
  completed:  { label: 'Done',        bg: '#dcfce7', color: '#166534' },
  dismissed:  { label: 'Dismissed',   bg: '#f3f4f6', color: '#6b7280' },
};

const RISK_STYLES = {
  critical: { label: 'Critical', bg: '#fee2e2', color: '#991b1b', order: 0 },
  high:     { label: 'High',     bg: '#ffedd5', color: '#9a3412', order: 1 },
  medium:   { label: 'Medium',   bg: '#fef9c3', color: '#854d0e', order: 2 },
  low:      { label: 'Low',      bg: '#f3f4f6', color: '#6b7280', order: 3 },
};

function RiskBadge({ risk }) {
  if (!risk || !RISK_STYLES[risk]) return null;
  const s = RISK_STYLES[risk];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 6px', borderRadius: 4,
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
      background: s.bg, color: s.color, flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

function OwnerBadge({ ownerType, ownerRole }) {
  const isAi = ownerType === 'ai';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, flexShrink: 0,
      background: isAi ? '#ede9fe' : '#e5e7eb',
      color: isAi ? '#6d28d9' : '#374151',
    }}>
      {isAi ? '🤖 AI' : `👤 ${ownerRole || 'Human'}`}
    </span>
  );
}

function Toast({ message, type = 'success', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  const colors = type === 'success'
    ? { bg: '#f0fdf4', border: '#86efac', color: '#166534' }
    : { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b' };

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      padding: '12px 18px',
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      background: colors.bg,
      color: colors.color,
      fontSize: 13, fontWeight: 600,
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      maxWidth: 320,
      animation: 'fadeInUp 0.2s ease',
    }}>
      {message}
    </div>
  );
}

export default function TasksPanel({ propertyId, role }) {
  const [tasks, setTasks]         = useState(null);
  const [taskRisks, setTaskRisks] = useState({});
  const [busyId, setBusyId]       = useState(null);
  const [error, setError]         = useState(null);
  const [toast, setToast]         = useState(null); // { message, type }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/tasks`);
      if (!r.ok) throw new Error('Failed to load tasks');
      const data = await r.json();
      setTasks(data.tasks || []);
    } catch (e) {
      setError(e.message);
    }
  }, [propertyId]);

  const refresh = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/tasks/refresh`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }, [propertyId, load]);

  const loadRisks = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/brain/briefing`);
      if (!r.ok) return;
      const data = await r.json();
      if (data.taskRisks && typeof data.taskRisks === 'object') {
        setTaskRisks(data.taskRisks);
      }
    } catch {
      // risk badges are optional — silently skip
    }
  }, [propertyId]);

  useEffect(() => {
    load().then(refresh);
    const t = setTimeout(loadRisks, 600);
    return () => clearTimeout(t);
  }, [load, refresh, loadRisks]);

  const act = async (taskId, action, task) => {
    setBusyId(taskId);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/public/tasks/${taskId}/${action}`, { method: 'POST' });
      if (!r.ok) throw new Error(`Failed to ${action} task`);
      const result = await r.json();

      // Toast feedback
      if (action === 'approve') {
        if (result.emailSent) {
          showToast(`✔ Email sent to ${result.emailTo}`);
        } else {
          showToast('✔ Task marked complete');
        }
      } else if (action === 'dismiss') {
        showToast('Task dismissed', 'neutral');
      }

      // Signal siblings to refresh the Morning Brief (server cache was just busted)
      window.dispatchEvent(new CustomEvent('kontra:task-resolved', { detail: { propertyId } }));

      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (tasks === null) {
    return (
      <div style={{
        marginBottom: 24, background: '#fff',
        borderRadius: 16, border: '1px solid #f3f4f6', padding: 20,
      }}>
        <div style={{ height: 14, width: 100, background: '#f3f4f6', borderRadius: 6, marginBottom: 12 }} />
        <div style={{ height: 40, background: '#fafafa', borderRadius: 10 }} />
      </div>
    );
  }

  const openTasks = tasks
    .filter(t => ['pending', 'in_progress', 'escalated'].includes(t.status))
    .sort((a, b) => {
      const rA = RISK_STYLES[taskRisks[a.id]]?.order ?? 4;
      const rB = RISK_STYLES[taskRisks[b.id]]?.order ?? 4;
      return rA - rB;
    });
  const doneTasks = tasks.filter(t => ['completed', 'dismissed'].includes(t.status));
  const criticalCount = openTasks.filter(t => taskRisks[t.id] === 'critical').length;

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      <div style={{
        marginBottom: 24, background: '#fff',
        borderRadius: 16, border: '1px solid #f3f4f6',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Tasks</h3>
            {criticalCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                background: '#fee2e2', color: '#991b1b',
              }}>
                {criticalCount} critical
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{openTasks.length} open</span>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#ef4444', padding: '0 20px 12px' }}>{error}</p>
        )}

        <div style={{ padding: '0 20px 20px' }}>
          {openTasks.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
              Nothing needs attention — the Operations Manager is watching for missing documents,
              expiring items, and outstanding participants.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {openTasks.map(task => {
                const style    = STATUS_STYLES[task.status] || STATUS_STYLES.pending;
                const risk     = taskRisks[task.id];
                const evidence = Array.isArray(task.evidence) ? task.evidence : [];
                const isCritical = risk === 'critical';
                const hasDraftEmail = task.draft_action?.type === 'email';
                const isAiOwned = task.owner_type === 'ai';
                const isBusy = busyId === task.id;

                return (
                  <li key={task.id} style={{
                    border: `1px solid ${isCritical ? '#fecaca' : '#f3f4f6'}`,
                    background: isCritical ? '#fff9f9' : '#fff',
                    borderRadius: 12,
                    padding: 12,
                  }}>
                    {/* Badges row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <OwnerBadge ownerType={task.owner_type} ownerRole={task.owner_role} />
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: style.bg, color: style.color,
                      }}>
                        {style.label}
                      </span>
                      <RiskBadge risk={risk} />
                    </div>

                    {/* Title */}
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '8px 0 0', lineHeight: 1.35 }}>
                      {task.title}
                    </p>

                    {/* Evidence */}
                    {evidence.length > 0 && (
                      <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {evidence.map((e, i) => (
                          <li key={i} style={{
                            fontSize: 11, color: '#6b7280',
                            background: '#f9fafb', borderRadius: 8, padding: '5px 10px',
                          }}>
                            {e}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Drafted email preview */}
                    {hasDraftEmail && (
                      <div style={{
                        marginTop: 8,
                        background: '#f5f3ff', border: '1px solid #e9d5ff',
                        borderRadius: 8, padding: '8px 10px',
                      }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 2 }}>
                          Drafted email to {task.draft_action.to}
                        </p>
                        <p style={{ fontSize: 11, color: '#8b5cf6' }}>{task.draft_action.subject}</p>
                        {task.draft_action.body && (
                          <p style={{ fontSize: 11, color: '#a78bfa', marginTop: 4, fontStyle: 'italic' }}>
                            "{task.draft_action.body}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action buttons — only for AI-owned tasks */}
                    {isAiOwned && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        {hasDraftEmail ? (
                          <button
                            disabled={isBusy}
                            onClick={() => act(task.id, 'approve', task)}
                            style={{
                              fontSize: 12, fontWeight: 600, padding: '6px 14px',
                              borderRadius: 8, border: 'none', cursor: isBusy ? 'not-allowed' : 'pointer',
                              background: '#800020', color: '#fff', opacity: isBusy ? 0.5 : 1,
                              transition: 'opacity 0.15s',
                            }}
                          >
                            {isBusy ? '…' : 'Approve & Send'}
                          </button>
                        ) : (
                          <button
                            disabled={isBusy}
                            onClick={() => act(task.id, 'approve', task)}
                            style={{
                              fontSize: 12, fontWeight: 600, padding: '6px 14px',
                              borderRadius: 8, border: '1px solid #d1d5db',
                              cursor: isBusy ? 'not-allowed' : 'pointer',
                              background: '#fff', color: '#374151', opacity: isBusy ? 0.5 : 1,
                              transition: 'opacity 0.15s',
                            }}
                          >
                            {isBusy ? '…' : 'Mark Done'}
                          </button>
                        )}
                        <button
                          disabled={isBusy}
                          onClick={() => act(task.id, 'dismiss', task)}
                          style={{
                            fontSize: 12, fontWeight: 600, padding: '6px 14px',
                            borderRadius: 8, border: '1px solid #e5e7eb',
                            cursor: isBusy ? 'not-allowed' : 'pointer',
                            background: '#fff', color: '#9ca3af', opacity: isBusy ? 0.5 : 1,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {doneTasks.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 12, color: '#9ca3af', cursor: 'pointer', userSelect: 'none' }}>
                {doneTasks.length} resolved
              </summary>
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {doneTasks.map(task => (
                  <li key={task.id} style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <OwnerBadge ownerType={task.owner_type} ownerRole={task.owner_role} />
                    <span style={{ textDecoration: 'line-through' }}>{task.title}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
