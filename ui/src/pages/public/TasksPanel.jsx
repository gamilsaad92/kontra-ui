import { useState, useEffect, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

// Task Engine display panel.
// Risk levels come from the Operations Manager briefing (cached server-side,
// so the second fetch is free). "critical" floats to top.
const STATUS_STYLES = {
  pending:    { label: 'Open',       bg: '#fef3c7', color: '#92400e' },
  in_progress:{ label: 'In Progress',bg: '#dbeafe', color: '#1d4ed8' },
  escalated:  { label: 'Escalated',  bg: '#fee2e2', color: '#b91c1c' },
  completed:  { label: 'Done',       bg: '#dcfce7', color: '#166534' },
  dismissed:  { label: 'Dismissed',  bg: '#f3f4f6', color: '#6b7280' },
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
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shrink-0"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function OwnerBadge({ ownerType, ownerRole }) {
  const isAi = ownerType === 'ai';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
      style={{ background: isAi ? '#ede9fe' : '#e5e7eb', color: isAi ? '#6d28d9' : '#374151' }}>
      {isAi ? '🤖 AI' : `👤 ${ownerRole || 'Human'}`}
    </span>
  );
}

export default function TasksPanel({ propertyId, role }) {
  const [tasks, setTasks]         = useState(null);
  const [taskRisks, setTaskRisks] = useState({});
  const [busyId, setBusyId]       = useState(null);
  const [error, setError]         = useState(null);

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

  // Fetch briefing for risk data — server caches it 60s so no extra LLM call
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
    // Delay risk fetch by 600ms — AIOperationsManager already fired at 400ms,
    // so the server cache will be warm by the time we ask.
    const t = setTimeout(loadRisks, 600);
    return () => clearTimeout(t);
  }, [load, refresh, loadRisks]);

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

  const openTasks = tasks
    .filter(t => ['pending', 'in_progress', 'escalated'].includes(t.status))
    .sort((a, b) => {
      // Sort by risk level: critical first
      const rA = RISK_STYLES[taskRisks[a.id]]?.order ?? 4;
      const rB = RISK_STYLES[taskRisks[b.id]]?.order ?? 4;
      return rA - rB;
    });
  const doneTasks = tasks.filter(t => ['completed', 'dismissed'].includes(t.status));

  const criticalCount = openTasks.filter(t => taskRisks[t.id] === 'critical').length;

  return (
    <div className="mb-6 bg-white rounded-2xl border border-gray-200">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-900">Tasks</h3>
          {criticalCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ background: '#fee2e2', color: '#991b1b' }}>
              {criticalCount} critical
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{openTasks.length} open</span>
      </div>

      {error && <p className="text-xs text-red-500 px-5 pb-3">{error}</p>}

      <div className="px-5 pb-5">
        {openTasks.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nothing needs attention right now — the Operations Manager is watching for missing documents, expiring items, and outstanding participants.
          </p>
        ) : (
          <ul className="space-y-3">
            {openTasks.map(task => {
              const style = STATUS_STYLES[task.status] || STATUS_STYLES.pending;
              const risk  = taskRisks[task.id];
              const evidence = Array.isArray(task.evidence) ? task.evidence : [];
              const isCritical = risk === 'critical';
              return (
                <li key={task.id}
                  className="border rounded-xl p-3"
                  style={isCritical ? { borderColor: '#fecaca', background: '#fff9f9' } : { borderColor: '#f3f4f6' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <OwnerBadge ownerType={task.owner_type} ownerRole={task.owner_role} />
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: style.bg, color: style.color }}>
                        {style.label}
                      </span>
                      <RiskBadge risk={risk} />
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
                        <button disabled={busyId === task.id} onClick={() => act(task.id, 'approve')}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                          style={{ background: '#800020' }}>
                          Approve &amp; Send
                        </button>
                      )}
                      <button disabled={busyId === task.id} onClick={() => act(task.id, 'dismiss')}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50">
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
    </div>
  );
}
