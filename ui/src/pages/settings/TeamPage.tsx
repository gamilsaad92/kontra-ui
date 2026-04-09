import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiClient";

const ROLES = [
  { value: "platform_admin",  label: "Platform Admin",  color: "bg-rose-900/40 text-rose-300 border-rose-700" },
  { value: "lender_admin",    label: "Lender Admin",    color: "bg-red-900/40 text-red-300 border-red-700" },
  { value: "servicer",        label: "Servicer",        color: "bg-amber-900/40 text-amber-300 border-amber-700" },
  { value: "asset_manager",   label: "Asset Manager",   color: "bg-yellow-900/40 text-yellow-300 border-yellow-700" },
  { value: "investor",        label: "Investor",        color: "bg-violet-900/40 text-violet-300 border-violet-700" },
  { value: "borrower",        label: "Borrower",        color: "bg-emerald-900/40 text-emerald-300 border-emerald-700" },
] as const;

type AppRole = (typeof ROLES)[number]["value"];

interface Profile { id: string; email: string; full_name: string | null; avatar_url: string | null; }
interface Member {
  id: string;
  user_id: string;
  app_role: AppRole;
  status: string;
  created_at: string;
  profiles: Profile | null;
}

function RoleBadge({ role }: { role: string }) {
  const found = ROLES.find((r) => r.value === role);
  if (!found) return <span className="text-slate-400 text-xs">{role}</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${found.color}`}>
      {found.label}
    </span>
  );
}

function Initials({ name, email }: { name: string | null; email: string }) {
  const src = name ?? email ?? "?";
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 text-slate-200 text-xs font-semibold shrink-0">
      {src.slice(0, 2).toUpperCase()}
    </span>
  );
}

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("servicer");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/onboarding/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: name || undefined, app_role: role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-white mb-5">Invite Team Member</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-600"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              {role === "investor" && "Access: Investor portal — capital stack, holdings, distributions."}
              {role === "borrower" && "Access: Borrower portal — loan status, draws, documents."}
              {role === "servicer" && "Access: Lender dashboard — servicing, payments, inspections."}
              {role === "asset_manager" && "Access: Lender dashboard — portfolio, analytics, risk."}
              {role === "lender_admin" && "Access: All three portals + admin controls."}
              {role === "platform_admin" && "Access: Full platform — all portals, billing, user management."}
            </p>
          </div>
          {err && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">{err}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg text-sm text-slate-300 border border-slate-600 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
            >
              {saving ? "Sending…" : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/onboarding/members");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : data.members ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setChangingRole(userId);
    setRoleError(null);
    try {
      const res = await apiFetch("/api/onboarding/assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, app_role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, app_role: newRole } : m));
    } catch (e: unknown) {
      setRoleError(e instanceof Error ? e.message : "Role update failed");
    } finally {
      setChangingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8">
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={loadMembers}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Team & Roles</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage who has access and what they can see.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Invite Member
        </button>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ROLES.map((r) => (
          <span key={r.value} className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border ${r.color}`}>
            {r.label}
          </span>
        ))}
      </div>

      {/* Error banner */}
      {(error || roleError) && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800 text-sm text-red-300">
          {error ?? roleError}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading members…</div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm">No team members yet.</p>
            <button
              onClick={() => setShowInvite(true)}
              className="mt-3 text-red-400 hover:text-red-300 text-sm underline"
            >
              Invite your first member
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Member</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Current Role</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Change Role</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {members.map((m) => {
                const profile = m.profiles;
                const email = profile?.email ?? "—";
                const name = profile?.full_name ?? null;
                const isChanging = changingRole === m.user_id;
                return (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Member */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Initials name={name} email={email} />
                        <div>
                          <p className="text-white font-medium">{name ?? email}</p>
                          {name && <p className="text-slate-400 text-xs">{email}</p>}
                        </div>
                      </div>
                    </td>

                    {/* Current role */}
                    <td className="px-5 py-4">
                      <RoleBadge role={m.app_role} />
                    </td>

                    {/* Change role */}
                    <td className="px-5 py-4">
                      <select
                        value={m.app_role}
                        disabled={isChanging}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value as AppRole)}
                        className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-600 disabled:opacity-50 disabled:cursor-wait"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      {isChanging && (
                        <span className="ml-2 text-xs text-slate-500">Saving…</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${
                        m.status === "active" ? "text-emerald-400" : "text-slate-500"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.status === "active" ? "bg-emerald-400" : "bg-slate-600"}`} />
                        {m.status ?? "pending"}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-4 text-slate-400 text-xs">
                      {m.created_at
                        ? new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* How roles map to portals */}
      <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Role → Portal Mapping</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-3">
            <p className="text-xs font-semibold text-red-300 mb-1.5">Lender Dashboard</p>
            <div className="flex flex-wrap gap-1">
              <RoleBadge role="lender_admin" />
              <RoleBadge role="servicer" />
              <RoleBadge role="asset_manager" />
              <RoleBadge role="platform_admin" />
            </div>
          </div>
          <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-3">
            <p className="text-xs font-semibold text-violet-300 mb-1.5">Investor Portal</p>
            <div className="flex flex-wrap gap-1">
              <RoleBadge role="investor" />
            </div>
          </div>
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
            <p className="text-xs font-semibold text-emerald-300 mb-1.5">Borrower Portal</p>
            <div className="flex flex-wrap gap-1">
              <RoleBadge role="borrower" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
