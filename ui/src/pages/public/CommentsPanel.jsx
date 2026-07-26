import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_PACK_ID, getWorkflowPack } from '../../lib/workflowPacks';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CommentsPanel({ propertyId, section, role, authorName, packId }) {
  const pack = getWorkflowPack(packId || DEFAULT_PACK_ID);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/comments?section=${encodeURIComponent(section)}`);
      if (!res.ok) return;
      const json = await res.json();
      setComments(json.comments || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [propertyId, section]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function postComment(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, role, author_name: authorName || role, content: content.trim() }),
      });
      if (res.ok) {
        setContent('');
        await fetchComments();
      }
    } catch { /* silent */ } finally {
      setPosting(false);
    }
  }

  async function resolveComment(id) {
    try {
      await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/comments/${id}/resolve`, { method: 'PATCH' });
      await fetchComments();
    } catch { /* silent */ }
  }

  const active = comments.filter(c => !c.resolved);
  const resolved = comments.filter(c => c.resolved);

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition"
      >
        <span>💬</span>
        <span>Comments</span>
        {active.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[#800020]/10 text-[#800020] font-bold text-[10px]">{active.length}</span>
        )}
        <span className="ml-1 text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading && <p className="text-xs text-gray-400">Loading…</p>}

          {!loading && active.length === 0 && resolved.length === 0 && (
            <p className="text-xs text-gray-400">No comments yet on this section.</p>
          )}

          {active.map(c => (
            <div key={c.id} className="flex gap-2.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                style={{ background: pack.getRole(c.role)?.color || '#6b7280' }}>
                {(c.author_name || c.role).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[10px] font-bold text-gray-700 capitalize">{c.author_name || c.role}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</p>
                    {(role === 'owner' || role === 'lender') && (
                      <button onClick={() => resolveComment(c.id)}
                        className="text-[9px] text-green-600 hover:text-green-700 font-semibold">
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">{c.content}</p>
              </div>
            </div>
          ))}

          {resolved.length > 0 && (
            <p className="text-[10px] text-gray-400 pl-8">{resolved.length} resolved comment{resolved.length !== 1 ? 's' : ''}</p>
          )}

          <form onSubmit={postComment} className="flex gap-2 pt-1">
            <input
              type="text"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`Add a comment on this ${section}…`}
              className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20"
            />
            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40"
            >
              {posting ? '…' : 'Post'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
