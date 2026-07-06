import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const SESSION_KEY = "kontra_my_rooms_session";

const TYPE_ICONS = {
  "Multifamily": "🏢", "Office": "🏛️", "Industrial": "🏭",
  "Retail": "🏪", "Mixed-Use": "🏙️", "Hotel / Hospitality": "🏨",
  "Self-Storage": "🗄️", "Land / Development": "🌍",
};

const STAGE_CONFIG = {
  uploading:    { label: "Uploading",    color: "#6b7280", bg: "#f3f4f6", icon: "📁", step: 0 },
  under_review: { label: "Under Review", color: "#b45309", bg: "#fffbeb", icon: "🔍", step: 1 },
  approved:     { label: "Approved",     color: "#15803d", bg: "#f0fdf4", icon: "✅", step: 2 },
  closing:      { label: "Closing",      color: "#1d4ed8", bg: "#eff6ff", icon: "📝", step: 3 },
  funded:       { label: "Funded",       color: "#7c3aed", bg: "#f5f3ff", icon: "🎉", step: 4 },
};

const REQUIRED_ROLES = ["lender", "inspector", "insurer", "attorney"];

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 mo ago" : `${months} mo ago`;
}

function StageBar({ stage }) {
  const stages = ["uploading", "under_review", "approved", "closing", "funded"];
  const current = STAGE_CONFIG[stage]?.step ?? 0;
  return (
    <div className="flex items-center gap-0.5 mt-2">
      {stages.map((s, i) => (
        <div key={s} className={`h-1 flex-1 rounded-full transition-all ${i <= current ? "" : "bg-gray-100"}`}
          style={i <= current ? { background: STAGE_CONFIG[s]?.color || "#800020" } : {}} />
      ))}
    </div>
  );
}

function PartyMini({ parties }) {
  const roles = ["lender", "inspector", "insurer", "attorney", "investor", "servicer"];
  const submitted = new Set((parties || []).filter(p => p.status === "submitted" || p.role).map(p => p.role));
  const approved  = new Set((parties || []).filter(p => p.status === "approved").map(p => p.role));
  const count = submitted.size;
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex gap-0.5">
        {roles.map(r => {
          const isSub = submitted.has(r);
          const isApproved = approved.has(r);
          const isReq = REQUIRED_ROLES.includes(r);
          return (
            <div key={r} title={r}
              className={`w-4 h-4 rounded-sm text-[7px] flex items-center justify-center font-bold
                ${isApproved ? "bg-green-100 text-green-700" : isSub ? "bg-amber-100 text-amber-700" : isReq ? "bg-gray-100 text-gray-300" : "bg-gray-50 text-gray-200"}`}>
              {r[0].toUpperCase()}
            </div>
          );
        })}
      </div>
      <span className="text-[10px] text-gray-400">{count} {count === 1 ? "party" : "parties"} active</span>
    </div>
  );
}

function DealCard({ room, email, onDeleted }) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const stage = room.deal_stage || "uploading";
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.uploading;
  const isActive = room.status === "active";

  function copyLink() {
    const url = `${window.location.origin}/deal-room/${room.property_id}?role=owner`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/my-rooms/${room.property_id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) onDeleted(room.property_id);
      else alert(data.error || "Failed to delete");
    } catch {
      alert("Failed to delete room");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{TYPE_ICONS[room.property_type] || "🏢"}</span>
            <h3 className="font-bold text-gray-900 text-sm truncate">
              {room.property_name || room.property_id}
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.icon} {cfg.label}
            </span>
            {!isActive && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                Inactive
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400 mt-1">
            {room.property_type && <span>{room.property_type}</span>}
            {room.deal_amount && <span>· {room.deal_amount}</span>}
            {room.address && <span className="truncate max-w-[160px]">· {room.address}</span>}
            <span>· {timeAgo(room.created_at)}</span>
          </div>
          <StageBar stage={stage} />
          <PartyMini parties={room.parties} />
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <Link to={`/deal-room/${room.property_id}?role=owner`}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white text-center hover:opacity-90 transition whitespace-nowrap"
            style={{ background: "#800020" }}>
            Open Room →
          </Link>
          <button onClick={copyLink}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition text-center">
            {copied ? "✓ Copied" : "Copy Link"}
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-red-400 border border-red-100 hover:bg-red-50 transition text-center">
              Delete
            </button>
          ) : (
            <div className="flex gap-1">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-2 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition text-center disabled:opacity-50">
                {deleting ? "…" : "Yes, delete"}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 px-2 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition text-center">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OtpInput({ onComplete }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef([]);

  function handleChange(i, val) {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) onComplete(next.join(""));
  }

  function handleKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) { setDigits(text.split("")); onComplete(text); }
  }

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input key={i} ref={el => refs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none transition"
          style={{ borderColor: d ? "#800020" : "#e5e7eb", color: "#111827",
            boxShadow: d ? "0 0 0 3px rgba(128,0,32,0.08)" : "none" }}
        />
      ))}
    </div>
  );
}

function AccessLayout({ children }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
            style={{ background: "#800020" }}>K</div>
          <span className="font-semibold text-gray-900">Kontra</span>
        </Link>
        <Link to="/create-deal-room"
          className="text-xs font-semibold px-3.5 py-2 rounded-lg text-white hover:opacity-90 transition"
          style={{ background: "#800020" }}>
          Create Deal Room →
        </Link>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — brand */}
        <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-12"
          style={{ background: "#0f172a" }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-8" style={{ color: "#800020" }}>
              CRE Deal Room Infrastructure
            </p>
            <h2 className="text-3xl font-bold text-white leading-snug mb-6">
              One deal room.<br />Every party.<br />No email chains.
            </h2>
            <div className="space-y-3">
              {[
                "AI reviews every document as it's uploaded",
                "Lenders, inspectors, insurers — one room, zero email chains",
                "Every party accesses via secure link — no accounts needed",
                "See every deal, every party, every status in one place",
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "#800020" }}>
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-300 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-600">Encrypted · No password required · $499 per deal room</p>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function MyDealRoomsPage() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [rooms, setRooms] = useState([]);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [billingState, setBillingState] = useState("idle");
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const { rooms: r, email: e, ownerName: n } = JSON.parse(saved);
        setRooms(r); setEmail(e); setOwnerName(n || "");
        setStep("dashboard");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step !== "dashboard" || !email) return;
    fetch(`${API_BASE}/api/public/my-rooms/analytics?email=${encodeURIComponent(email.trim().toLowerCase())}`)
      .then(r => r.json()).then(d => setAnalytics(d)).catch(() => {});
  }, [step, email]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  async function requestOtp(e) {
    e?.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/public/my-rooms/request-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setStep("otp"); setResendCountdown(60);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function verifyOtp(code) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/public/my-rooms/verify-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code — please try again");
      const n = data.rooms?.[0]?.owner_name || "";
      setRooms(data.rooms || []); setOwnerName(n);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ rooms: data.rooms || [], email: data.email || email, ownerName: n }));
      setStep("dashboard");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
    setStep("email"); setRooms([]); setEmail(""); setOwnerName(""); setError("");
  }

  async function manageBilling() {
    setBillingState("loading");
    try {
      const res = await fetch(`${API_BASE}/api/public/billing-portal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.error === "billing_portal_not_configured") {
        setBillingState("not_configured");
        setTimeout(() => setBillingState("idle"), 5000);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed");
      window.location.href = data.url;
    } catch {
      setBillingState("error");
      setTimeout(() => setBillingState("idle"), 4000);
    }
  }

  // ── Email step ─────────────────────────────────────────────────────────
  if (step === "email") return (
    <AccessLayout>
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Access Your Deal Rooms</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Enter your email address — we'll send a 6-digit code to verify it's you.
            No password. No account creation.
          </p>
        </div>

        <form onSubmit={requestOtp} className="space-y-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com" required autoFocus
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent transition"
            style={{ "--tw-ring-color": "#800020" }} />
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <button type="submit" disabled={loading || !email.trim()}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#800020" }}>
            {loading ? "Sending code…" : "Send Access Code →"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-xs text-center text-gray-400">
            Don't have a deal room yet?{" "}
            <Link to="/create-deal-room" className="font-semibold" style={{ color: "#800020" }}>
              Create one for $499 →
            </Link>
          </p>
        </div>
      </div>
    </AccessLayout>
  );

  // ── OTP step ───────────────────────────────────────────────────────────
  if (step === "otp") return (
    <AccessLayout>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center text-xl"
            style={{ background: "#fff0f3" }}>
            📬
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Check your email</h1>
          <p className="text-sm text-gray-500">
            We sent a 6-digit code to <strong className="text-gray-700">{email}</strong>.<br />
            Enter it below — expires in 10 minutes.
          </p>
        </div>

        <div className="mb-6">
          <OtpInput onComplete={verifyOtp} />
          {error && <p className="text-sm text-red-600 text-center mt-4 font-medium">{error}</p>}
          {loading && (
            <p className="text-sm text-gray-400 text-center mt-4 flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin inline-block" />
              Verifying…
            </p>
          )}
        </div>

        <div className="text-center space-y-3">
          {resendCountdown > 0 ? (
            <p className="text-xs text-gray-400">Resend code in {resendCountdown}s</p>
          ) : (
            <button onClick={requestOtp} disabled={loading}
              className="text-xs font-semibold disabled:opacity-40"
              style={{ color: "#800020" }}>
              Resend code
            </button>
          )}
          <br />
          <button onClick={() => { setStep("email"); setError(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 transition">
            ← Use a different email
          </button>
        </div>
      </div>
    </AccessLayout>
  );

  // ── Dashboard ──────────────────────────────────────────────────────────
  const activeRooms = rooms.filter(r => r.status === "active");
  const otherRooms  = rooms.filter(r => r.status !== "active");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Dashboard top bar */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ background: "#800020" }}>K</div>
              <span className="font-semibold text-gray-900 text-sm">Kontra</span>
            </Link>
            <span className="text-gray-200 select-none">/</span>
            <span className="text-sm font-medium text-gray-500">Deal Rooms</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">{email}</span>
            <Link to="/create-deal-room"
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition"
              style={{ background: "#800020" }}>
              + New Room
            </Link>
            <button onClick={signOut}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 w-full flex-1">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-extrabold text-gray-900">
            {ownerName ? `Welcome back, ${ownerName.split(" ")[0]}` : "Your Deal Rooms"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Owner dashboard · {activeRooms.length} active {activeRooms.length === 1 ? "room" : "rooms"}
          </p>
        </div>

        {/* Analytics strip */}
        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[
              { label: "Deal Rooms", value: analytics.totalDeals, icon: "🏢", alert: false },
              { label: "Waiting on Borrower", value: analytics.waitingOnBorrower, icon: "⏳", alert: analytics.waitingOnBorrower > 0 },
              { label: "Waiting on Inspector", value: analytics.waitingOnInspector, icon: "🔍", alert: analytics.waitingOnInspector > 0 },
              { label: "Avg Days Active", value: analytics.avgDaysActive != null ? `${analytics.avgDaysActive}d` : "—", icon: "📅", alert: false },
              { label: "Documents", value: analytics.documentsUploaded, icon: "📄", alert: false },
              { label: "AI Reviews", value: analytics.aiReviewsCompleted, icon: "🤖", alert: false },
            ].map(({ label, value, icon, alert }) => (
              <div key={label} className="rounded-xl border px-4 py-3 bg-white transition"
                style={{ borderColor: alert ? "#fecaca" : "#e5e7eb", background: alert ? "#fff8f8" : "white" }}>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-base leading-none">{icon}</span>
                  <span className="text-xl font-extrabold leading-none"
                    style={{ color: alert ? "#800020" : "#111827" }}>{value}</span>
                </div>
                <p className="text-[11px] font-medium text-gray-500 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Rooms */}
        {rooms.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl bg-white">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-gray-700 font-bold text-lg mb-2">No deal rooms found</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
              We couldn't find any deal rooms for <strong>{email}</strong>.
              Make sure you're using the same email from your Stripe receipt.
            </p>
            <Link to="/create-deal-room"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
              style={{ background: "#800020" }}>
              Create Your First Deal Room →
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {activeRooms.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Active · {activeRooms.length} {activeRooms.length === 1 ? "room" : "rooms"}
                  </p>
                </div>
                <div className="space-y-3">
                  {activeRooms.map(r => <DealCard key={r.property_id} room={r} email={email} onDeleted={id => setRooms(prev => prev.filter(x => x.property_id !== id))} />)}
                </div>
              </section>
            )}
            {otherRooms.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Inactive · {otherRooms.length} {otherRooms.length === 1 ? "room" : "rooms"}
                  </p>
                </div>
                <div className="space-y-3 opacity-70">
                  {otherRooms.map(r => <DealCard key={r.property_id} room={r} email={email} onDeleted={id => setRooms(prev => prev.filter(x => x.property_id !== id))} />)}
                </div>
              </section>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 pt-1">
              <span>Party squares: <span className="font-bold text-amber-600">L</span>=Lender <span className="font-bold text-amber-600">I</span>=Inspector <span className="font-bold text-amber-600">I</span>=Insurer <span className="font-bold text-amber-600">A</span>=Attorney</span>
              <span className="text-green-600">■ Approved</span>
              <span className="text-amber-600">■ Submitted</span>
              <span className="text-gray-300">■ Awaiting</span>
            </div>
          </div>
        )}

        {/* Footer strip */}
        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button onClick={manageBilling} disabled={billingState === "loading"}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 transition disabled:opacity-40">
              {billingState === "loading" ? "Opening billing…"
                : billingState === "not_configured" ? "Billing not configured yet"
                : billingState === "error" ? "Try again later"
                : "💳 Manage Billing"}
            </button>
            <Link to="/create-deal-room"
              className="text-xs font-medium text-gray-500 hover:text-gray-700 transition">
              + New Deal Room
            </Link>
          </div>
          <p className="text-[10px] text-gray-400">
            Signed in as {email} · <button onClick={signOut} className="underline hover:text-gray-600">Sign out</button>
          </p>
        </div>
      </div>
    </div>
  );
}
