import { useState, useEffect } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

const TYPE_LABELS = {
  doc_uploaded:   { label: 'Document uploaded', icon: '📄', color: '#2563eb' },
  party_submitted:{ label: 'Party submitted',   icon: '✅', color: '#16a34a' },
  stage_advance:  { label: 'Stage advanced',    icon: '🚀', color: '#7c3aed' },
  status_change:  { label: 'Status updated',    icon: '🔄', color: '#d97706' },
  lender_doc_ready:{ label: 'Lender notified',  icon: '🏦', color: '#0891b2' },
  vap_ready:      { label: 'VAP ready',         icon: '🔐', color: '#800020' },
};

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return iso; }
}

export default function NotificationsLog({ propertyId }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/notifications`)
      .then(r => r.ok ? r.json() : { notifications: [] })
      .then(d => { setNotifications(d.notifications || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId]);

  if (loading) return null;
  if (notifications.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📬</span>
          <span className="text-sm font-semibold text-gray-800">Notification Log</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
            {notifications.length}
          </span>
        </div>
        <span className="text-gray-400 text-xs">{open ? '▲ hide' : '▼ show'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {notifications.map(n => {
            const t = TYPE_LABELS[n.type] || { label: n.type, icon: '📧', color: '#6b7280' };
            return (
              <div key={n.id} className="flex items-start gap-3 px-5 py-3">
                <span className="text-base mt-0.5">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: t.color }}>{t.label}</span>
                    <span className="text-[10px] text-gray-400">{fmt(n.sent_at)}</span>
                  </div>
                  <p className="text-xs text-gray-700 truncate">{n.subject}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">→ {n.to_email}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
