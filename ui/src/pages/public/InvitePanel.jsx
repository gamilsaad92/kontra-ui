import { useState } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function getInvitableRoles(packId) {
  return getWorkflowPack(packId).roles
    .filter(r => r.invitable)
    .map(r => ({ role: r.key, icon: r.icon, label: r.shortLabel || r.label, action: r.inviteAction }));
}

function RoleCard({ r, propertyId, senderName, onRemove }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [errMsg, setErrMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/deal-room/${propertyId}?role=${r.role}`;

  async function handleSend(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setErrMsg('Enter a valid email'); return; }
    setStatus('loading');
    setErrMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: r.role, email: email.trim(), senderName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setStatus('sent');
    } catch (err) {
      setErrMsg(err.message);
      setStatus('error');
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
        <span className="text-base mt-0.5">{r.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-green-800">{r.label}</p>
          <p className="text-[10px] text-green-600 mt-0.5">✓ Invite sent to <span className="font-semibold">{email}</span></p>
          <button onClick={() => { setStatus('idle'); setEmail(''); }}
            className="text-[9px] text-green-500 underline mt-1">Send another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 group/card relative">
      {/* Remove button — hover reveal */}
      {onRemove && (
        <button
          onClick={onRemove}
          title="Hide this role"
          className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 text-gray-200 hover:text-red-400 transition text-xs leading-none">
          ✕
        </button>
      )}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">{r.icon}</span>
        <p className="text-xs font-semibold text-gray-800">{r.label}</p>
      </div>
      <form onSubmit={handleSend} className="space-y-1.5">
        <input
          type="email"
          placeholder={`${r.label.toLowerCase()}@firm.com`}
          value={email}
          onChange={e => { setEmail(e.target.value); setErrMsg(''); setStatus('idle'); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        {errMsg && <p className="text-[9px] text-red-500">{errMsg}</p>}
        <div className="flex items-center gap-1.5">
          <button type="submit" disabled={status === 'loading' || !email.trim()}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {status === 'loading' ? 'Sending…' : 'Send Invite →'}
          </button>
          <button type="button" onClick={handleCopy} title="Copy link instead"
            className="px-2 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition shrink-0">
            {copied ? '✓' : '🔗'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Custom / free-form party card ────────────────────────────────────────────
function CustomPartyCard({ propertyId, senderName }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [errMsg, setErrMsg] = useState('');
  const [copied, setCopied] = useState(false);

  function reset() { setOpen(false); setLabel(''); setEmail(''); setStatus('idle'); setErrMsg(''); }

  function getRoleKey() {
    return label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'guest';
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!label.trim()) { setErrMsg('Enter a role name'); return; }
    if (!email.trim() || !email.includes('@')) { setErrMsg('Enter a valid email'); return; }
    setStatus('loading');
    setErrMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: getRoleKey(), email: email.trim(), senderName, customLabel: label.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setStatus('sent');
    } catch (err) {
      setErrMsg(err.message);
      setStatus('error');
    }
  }

  function handleCopy() {
    const url = `${window.location.origin}/deal-room/${propertyId}?role=${getRoleKey()}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
        <span className="text-base mt-0.5">👤</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-green-800">{label}</p>
          <p className="text-[10px] text-green-600 mt-0.5">✓ Invite sent to <span className="font-semibold">{email}</span></p>
          <button onClick={reset} className="text-[9px] text-green-500 underline mt-1">Send another</button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 flex flex-col items-center justify-center gap-1 w-full hover:border-gray-300 hover:bg-gray-50 transition group"
        style={{ minHeight: 90 }}>
        <span className="text-lg text-gray-300 group-hover:text-gray-400 transition">+</span>
        <p className="text-[11px] font-medium text-gray-400 group-hover:text-gray-500">Invite someone else</p>
        <p className="text-[10px] text-gray-300 group-hover:text-gray-400">Custom role</p>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">👤</span>
        <p className="text-xs font-semibold text-gray-700">Custom party</p>
        <button onClick={() => { setOpen(false); setLabel(''); setEmail(''); setErrMsg(''); }}
          className="ml-auto text-gray-300 hover:text-gray-500 text-xs transition">✕</button>
      </div>
      <form onSubmit={handleSend} className="space-y-1.5">
        <input autoFocus type="text" placeholder="Their role (e.g. IP Counsel)"
          value={label} onChange={e => { setLabel(e.target.value); setErrMsg(''); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        <input type="email" placeholder="email@firm.com"
          value={email} onChange={e => { setEmail(e.target.value); setErrMsg(''); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        {errMsg && <p className="text-[9px] text-red-500">{errMsg}</p>}
        <div className="flex items-center gap-1.5">
          <button type="submit" disabled={status === 'loading' || !label.trim() || !email.trim()}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {status === 'loading' ? 'Sending…' : 'Send Invite →'}
          </button>
          <button type="button" onClick={handleCopy} title="Copy link instead"
            className="px-2 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition shrink-0">
            {copied ? '✓' : '🔗'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────
export default function InvitePanel({ propertyId, senderName, packId = DEFAULT_PACK_ID }) {
  const allRoles = getInvitableRoles(packId);

  const REMOVED_KEY = propertyId ? `kontra_removed_roles_${propertyId}` : null;
  const [removedRoles, setRemovedRoles] = useState(() => {
    if (!REMOVED_KEY) return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(REMOVED_KEY) || '[]')); } catch { return new Set(); }
  });

  function handleRemoveRole(roleKey) {
    const next = new Set([...removedRoles, roleKey]);
    setRemovedRoles(next);
    if (REMOVED_KEY) localStorage.setItem(REMOVED_KEY, JSON.stringify([...next]));
  }

  function handleRestoreRoles() {
    setRemovedRoles(new Set());
    if (REMOVED_KEY) localStorage.removeItem(REMOVED_KEY);
  }

  const visibleRoles = allRoles.filter(r => !removedRoles.has(r.role));

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 px-6 py-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-900">Request documents from each party</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Enter their email — they'll get a direct upload link for their role. No account required.
          </p>
        </div>
        {removedRoles.size > 0 && (
          <button onClick={handleRestoreRoles}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline transition shrink-0 mt-0.5">
            Restore {removedRoles.size} hidden
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {visibleRoles.map(r => (
          <RoleCard
            key={r.role}
            r={r}
            propertyId={propertyId}
            senderName={senderName}
            onRemove={() => handleRemoveRole(r.role)}
          />
        ))}
        <CustomPartyCard propertyId={propertyId} senderName={senderName} />
      </div>
      <p className="text-[10px] text-gray-400 mt-3 text-center">
        Each party sees only what's relevant to their role · 🔗 button copies the link instead
      </p>
    </div>
  );
}
