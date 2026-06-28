import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const EVENT_META = {
  document_analyzed: { icon: '🤖', color: '#6d28d9', label: 'AI Analysis' },
  party_submitted:   { icon: '✅', color: '#16a34a', label: 'Submission' },
  stage_advanced:    { icon: '🚀', color: '#800020', label: 'Stage Change' },
  status_changed:    { icon: '🔄', color: '#d97706', label: 'Status Update' },
  comment_added:     { icon: '💬', color: '#0369a1', label: 'Comment' },
};

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupByDay(events) {
  const groups = {};
  events.forEach(ev => {
    const day = new Date(ev.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (!groups[day]) groups[day] = [];
    groups[day].push(ev);
  });
  return Object.entries(groups);
}

export default function ActivityTimeline({ propertyId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/events`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const json = await res.json();
      setEvents(json.events || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  if (loading) return null;
  if (!events.length) return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Activity Timeline</p>
      <p className="text-sm text-gray-400">No activity yet — actions will appear here as the deal progresses.</p>
    </div>
  );

  const groups = groupByDay(events);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Activity Timeline</p>
        <p className="text-[11px] text-gray-400 mt-0.5">Full audit trail for this deal room</p>
      </div>
      <div className="px-5 py-4 space-y-6 max-h-[480px] overflow-y-auto">
        {groups.map(([day, dayEvents]) => (
          <div key={day}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 sticky top-0 bg-white py-1">{day}</p>
            <div className="space-y-3">
              {dayEvents.map(ev => {
                const meta = EVENT_META[ev.event_type] || { icon: '📋', color: '#6b7280', label: 'Event' };
                return (
                  <div key={ev.id} className="flex gap-3">
                    <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm mt-0.5"
                      style={{ background: meta.color + '18' }}>
                      <span className="text-[13px]">{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{meta.label}</p>
                          <p className="text-sm text-gray-800 leading-snug">{ev.description}</p>
                          {ev.actor_name && ev.actor_name !== ev.actor_role && (
                            <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{ev.actor_name}</p>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 shrink-0 mt-0.5">{timeAgo(ev.created_at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
