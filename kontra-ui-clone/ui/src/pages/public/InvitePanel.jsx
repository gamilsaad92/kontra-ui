import { useState } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Which roles can be invited (and their icon/label/action copy) comes from
// the active workflow template — see ui/src/lib/workflowPacks/.
function getInvitableRoles(packId) {
  return getWorkflowPack(packId).roles
    .filter(r => r.invitable)
    .map(r => ({ role: r.key, icon: r.icon, label: r.shortLabel || r.label, action: r.inviteAction }));
}

function RoleCard({ r, propertyId, senderName }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | sent | error
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
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
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
            {status === 'loading' ? 'Sending…' : `Send Invite →`}
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

export default function InvitePanel({ propertyId, senderName, packId = DEFAULT_PACK_ID }) {
  const roles = getInvitableRoles(packId);
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 px-6 py-5">
      <div className="mb-4">
        <p className="text-sm font-bold text-gray-900">Request documents from each party</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Enter their email — they'll get a direct upload link for their role. No account required.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {roles.map(r => (
          <RoleCard key={r.role} r={r} propertyId={propertyId} senderName={senderName} />
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-3 text-center">
        Each party sees only what's relevant to their role · 🔗 button copies the link instead
      </p>
    </div>
  );
}
