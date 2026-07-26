import { useState, useEffect, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

// Task Engine + AI Ownership Layer (Observe Mode).
// Every task has an explicit owner — a human role or "ai" — and, if AI drafted
// an action (e.g. a reminder email), it is never sent automatically. A human
// must click Approve, which is the only path that actually executes it
// (see api/lib/taskEngine.js approveTask). This panel is intentionally plain:
// it shows the evidence behind every AI-created task instead of a fabricated
// confidence score, since LLMs can't produce a calibrated percentage.
const STATUS_STYLES = {
  pending: { label: 'Open', bg: '#fef3c7', color: '#92400e' },
  in_progress: { label: 'In Progress', bg: '#dbeafe', color: '#1d4ed8' },
  escalated: { label: 'Escalated', bg: '#fee2e2', color: '#b91c1c' },
  completed: { label: 'Done', bg: '#dcfce7', color: '#166534' },
  dismissed: { label: 'Dismissed', bg: '#f3f4f6', color: '#6b7280' },
};

function OwnerBadge({ ownerType, ownerRole }) {
  const isAi = ownerType === 'ai';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
      style={{ background: isAi ? '#ede9fe' : '#e5e7eb', color: isAi ? '#6d28d9' : '#374151' }}
    >
      {isAi ? '🤖 AI' : `👤 ${ownerRole || 'Human'}`}
    </span>
  );
}

export default function TasksPanel({ propertyId, role }) {
  const [tasks, setTasks] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    load().then(refresh);
  }, [load, refresh]);

  const act = async (taskId, action) => {
    setBusyId(taskId);
    try {
      const r = await fetch(`${API_BASE}/api/public/tasks/${taskId}/${action}`, { method: 'POST' });
      if (!r.ok) throw new Error(`Failed to ${action} task`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (tasks === null) {
    return (
      <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
        <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
        <div className="h-10 bg-gray-50 rounded" />
      </div>
    );
  }

  const openTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'escalated');
  const doneTasks = tasks.filter(t => t.status === 'completed' || t.status === 'dismissed');

  return (
    <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">Tasks</h3>
        <span className="text-xs text-gray-400">{openTasks.length} open</span>
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {openTasks.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing needs attention right now — AI is watching for missing documents, expiring items, and outstanding participants.</p>
      ) : (
        <ul className="space-y-3">
          {openTasks.map(task => {
            const style = STATUS_STYLES[task.status] || STATUS_STYLES.pending;
            const evidence = Array.isArray(task.evidence) ? task.evidence : [];
            return (
              <li key={task.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <OwnerBadge ownerType={task.owner_type} ownerRole={task.owner_role} />
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {style.label}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-2">{task.title}</p>
                {evidence.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {evidence.map((e, i) => (
                      <li key={i} className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">{e}</li>
                    ))}
                  </ul>
                )}
                {task.draft_action?.type === 'email' && (
                  <div className="mt-2 text-xs bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2">
                    <p className="font-semibold text-violet-700 mb-0.5">Drafted email to {task.draft_action.to}</p>
                    <p className="text-violet-600">{task.draft_action.subject}</p>
                  </div>
                )}
                {task.owner_type === 'ai' && (
                  <div className="flex gap-2 mt-2.5">
                    {task.draft_action && (
                      <button
                        disabled={busyId === task.id}
                        onClick={() => act(task.id, 'approve')}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                        style={{ background: '#800020' }}
                      >
                        Approve &amp; Send
                      </button>
                    )}
                    <button
                      disabled={busyId === task.id}
                      onClick={() => act(task.id, 'dismiss')}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50"
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
        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer select-none">{doneTasks.length} resolved</summary>
          <ul className="mt-2 space-y-1">
            {doneTasks.map(task => (
              <li key={task.id} className="text-xs text-gray-400 flex items-center gap-2">
                <OwnerBadge ownerType={task.owner_type} ownerRole={task.owner_role} />
                <span className="line-through">{task.title}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
