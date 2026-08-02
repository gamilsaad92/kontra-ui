import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const PACK_OPTIONS = [
  { id: "business_acquisition", label: "Business Acquisition", icon: "💼", desc: "M&A, company purchase, management buyout" },
  { id: "cre_acquisition",      label: "CRE Acquisition",      icon: "🏢", desc: "Property, hotel, real estate purchase" },
  { id: "fundraising",          label: "Fundraising Round",    icon: "📈", desc: "Seed, Series A/B, equity raise" },
];

function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function PasswordGate({ onAuth }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function check(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/pilot-workspaces`, {
        headers: { "x-pilot-password": pwd },
      });
      if (r.status === 401) { setErr("Wrong password."); return; }
      if (r.status === 503) { setErr("PILOT_ADMIN_PASSWORD not set on the server. Add it to your environment variables."); return; }
      if (!r.ok) { setErr("Server error. Check API logs."); return; }
      sessionStorage.setItem("pilot_admin_pwd", pwd);
      onAuth(pwd);
    } catch {
      setErr("Cannot reach the API. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mx-auto mb-3 text-xl">🔑</div>
          <h1 className="text-lg font-bold text-gray-900">Pilot Admin</h1>
          <p className="text-xs text-gray-400 mt-1">Kontra internal — not publicly linked</p>
        </div>
        <form onSubmit={check} className="space-y-4">
          <input
            type="password"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            placeholder="Admin password"
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <button type="submit" disabled={!pwd || loading}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 transition">
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Create workspace form ─────────────────────────────────────────────────────
function CreateForm({ password, onCreated }) {
  const [form, setForm] = useState({
    workspaceName: "",
    packId: "business_acquisition",
    pilotName: "",
    pilotEmail: "",
    closingDate: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/create-pilot-workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pilot-password": password },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Creation failed");
      onCreated(data);
      setForm({ workspaceName: "", packId: "business_acquisition", pilotName: "", pilotEmail: "", closingDate: "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = form.workspaceName.trim() && form.pilotName.trim() && form.pilotEmail.trim();

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-0.5">Create pilot workspace</h2>
        <p className="text-xs text-gray-400">Creates an active workspace and generates a one-click access link. No payment required.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Workspace name */}
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Workspace name</label>
          <input type="text" required
            value={form.workspaceName}
            onChange={e => set("workspaceName", e.target.value)}
            placeholder="e.g. Acme Corp Acquisition"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
        </div>

        {/* Transaction type */}
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Transaction type</label>
          <div className="grid sm:grid-cols-3 gap-2">
            {PACK_OPTIONS.map(p => (
              <button key={p.id} type="button" onClick={() => set("packId", p.id)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${form.packId === p.id ? "border-gray-900 bg-gray-50" : "border-gray-100 hover:border-gray-200"}`}>
                <span className="text-lg block mb-1">{p.icon}</span>
                <p className="text-xs font-bold text-gray-900">{p.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Pilot user */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Pilot user name</label>
          <input type="text" required
            value={form.pilotName}
            onChange={e => set("pilotName", e.target.value)}
            placeholder="Jane Smith"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Pilot user email</label>
          <input type="email" required
            value={form.pilotEmail}
            onChange={e => set("pilotEmail", e.target.value)}
            placeholder="jane@example.com"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
        </div>

        {/* Closing date (optional) */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">
            Target closing date <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input type="date"
            value={form.closingDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={e => set("closingDate", e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

      <button type="submit" disabled={!canSubmit || loading}
        className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 transition">
        {loading ? "Creating workspace…" : "Create & generate link →"}
      </button>
    </form>
  );
}

// ── Access link card ──────────────────────────────────────────────────────────
function AccessLinkCard({ result, password, onDismiss }) {
  const [copied,    setCopied]    = useState(false);
  const [resending, setResending] = useState(false);
  const [resendOk,  setResendOk]  = useState(false);
  const [resendErr, setResendErr] = useState("");
  // Seed from creation-time response; toggles to true when resent manually
  const [emailSent, setEmailSent] = useState(!!result.emailSent);

  function copy() {
    navigator.clipboard.writeText(result.accessUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleResend() {
    setResending(true); setResendErr(""); setResendOk(false);
    try {
      const r = await fetch(`${API_BASE}/api/admin/send-pilot-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pilot-password": password },
        body: JSON.stringify({
          pilotEmail:    result.pilotEmail,
          pilotName:     result.pilotName,
          workspaceName: result.workspaceName,
          accessUrl:     result.accessUrl,
          packLabel:     result.packLabel,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Send failed");
      setResendOk(true);
      setEmailSent(true);
      setTimeout(() => setResendOk(false), 3000);
    } catch (e) {
      setResendErr(e.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">✅</span>
            <p className="text-sm font-bold text-green-900">Workspace created</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-green-700">
              <strong>{result.workspaceName}</strong> · {result.packLabel} · pilot
            </p>
            {/* Email status badge */}
            {emailSent ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-200 text-green-800">
                📧 Sent to {result.pilotEmail}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                📧 Email not sent (RESEND_API_KEY not set)
              </span>
            )}
          </div>
        </div>
        <button onClick={onDismiss} className="text-green-400 hover:text-green-600 transition text-lg leading-none">×</button>
      </div>

      <div className="bg-white rounded-xl border border-green-200 p-3 mb-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">One-click access link</p>
        <p className="text-xs text-gray-700 break-all font-mono leading-relaxed">{result.accessUrl}</p>
      </div>

      <div className="flex gap-2 mb-2">
        <button onClick={copy}
          className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-green-700 hover:bg-green-800 transition">
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button onClick={handleResend} disabled={resending}
          className="px-4 py-2 rounded-xl text-xs font-bold text-green-700 border border-green-300 hover:bg-green-100 disabled:opacity-40 transition">
          {resending ? "Sending…" : resendOk ? "Sent ✓" : "Resend email"}
        </button>
        <a href={result.accessUrl} target="_blank" rel="noreferrer"
          className="px-4 py-2 rounded-xl text-xs font-bold text-green-700 border border-green-300 hover:bg-green-100 transition">
          Preview →
        </a>
      </div>

      {resendErr && <p className="text-xs text-red-500 mb-2">{resendErr}</p>}

      <p className="text-[10px] text-green-600">
        When {result.pilotName} clicks this link, they land directly in the active workspace as coordinator — no payment or setup required.
      </p>
    </div>
  );
}

// ── Pilot workspaces list ─────────────────────────────────────────────────────
function PilotList({ password, refreshKey }) {
  const [pilots, setPilots] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/pilot-workspaces`, {
        headers: { "x-pilot-password": password },
      });
      if (!r.ok) throw new Error("Failed to load");
      const data = await r.json();
      setPilots(data.workspaces || []);
    } catch (e) {
      setError(e.message);
    }
  }, [password]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (pilots === null && !error) {
    return <div className="h-16 bg-gray-50 rounded-2xl border border-gray-100 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Pilot workspaces</h2>
          <p className="text-xs text-gray-400 mt-0.5">{pilots?.length ?? 0} total</p>
        </div>
        <button onClick={load} className="text-xs text-gray-400 hover:text-gray-700 transition px-2 py-1 rounded-lg hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {error && <p className="text-xs text-red-500 p-4">{error}</p>}

      {pilots && pilots.length === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-gray-400">No pilot workspaces yet.</p>
          <p className="text-xs text-gray-300 mt-1">Create your first one above.</p>
        </div>
      )}

      {pilots && pilots.length > 0 && (
        <div className="divide-y divide-gray-100">
          {/* Header */}
          <div className="hidden sm:grid px-5 py-2 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400"
            style={{ gridTemplateColumns: "1fr 120px 80px 80px 80px" }}>
            <span>Workspace</span>
            <span>Pack</span>
            <span>Docs</span>
            <span>Created</span>
            <span>Last active</span>
          </div>

          {pilots.map(w => (
            <div key={w.property_id}
              className="grid px-5 py-3 items-center gap-2 text-sm"
              style={{ gridTemplateColumns: "1fr 120px 80px 80px 80px" }}>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{w.property_name}</p>
                {w.customer_email && <p className="text-[11px] text-gray-400 truncate">{w.customer_email}</p>}
              </div>
              <p className="text-xs text-gray-500 truncate hidden sm:block">{w.pack_label || w.workflow_pack_id || "—"}</p>
              <p className="text-xs font-semibold text-gray-700 hidden sm:block">{w.doc_count ?? 0}</p>
              <p className="text-[11px] text-gray-400 hidden sm:block">{timeAgo(w.activated_at || w.created_at)}</p>
              <div className="hidden sm:flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${w.last_activity ? "bg-green-400" : "bg-gray-200"}`} />
                <p className="text-[11px] text-gray-400">{timeAgo(w.last_activity)}</p>
              </div>
              {/* Mobile fallback */}
              <div className="sm:hidden col-span-full text-xs text-gray-400 -mt-1">
                {w.doc_count ?? 0} docs · Created {timeAgo(w.activated_at || w.created_at)} · Active {timeAgo(w.last_activity)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PilotAdminPage() {
  const [password, setPassword] = useState(() => sessionStorage.getItem("pilot_admin_pwd") || "");
  const [latestResult, setLatestResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleCreated(result) {
    setLatestResult(result);
    setRefreshKey(k => k + 1);
  }

  if (!password) {
    return <PasswordGate onAuth={setPassword} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-400 hover:text-gray-700 transition text-sm">← Kontra</Link>
            <span className="text-gray-200">|</span>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Pilot Admin</h1>
              <p className="text-[10px] text-gray-400">Internal — create workspaces for real users without payment</p>
            </div>
          </div>
          <button onClick={() => { sessionStorage.removeItem("pilot_admin_pwd"); setPassword(""); }}
            className="text-xs text-gray-400 hover:text-gray-700 transition">
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {latestResult && (
          <AccessLinkCard result={latestResult} password={password} onDismiss={() => setLatestResult(null)} />
        )}

        <CreateForm password={password} onCreated={handleCreated} />

        <PilotList password={password} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
