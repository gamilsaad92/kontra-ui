import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

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
        <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${i <= current ? "" : "bg-gray-100"}`}
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
  const req = REQUIRED_ROLES.filter(r => submitted.has(r)).length;
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
      <span className="text-[10px] text-gray-400">{count} {count === 1 ? "party" : "parties"} in</span>
    </div>
  );
}

function DealCard({ room, email }) {
  const [copied, setCopied] = useState(false);
  const stage = room.deal_stage || "uploading";
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.uploading;
  const isActive = room.status === "active";

  function copyLink() {
    const url = `${window.location.origin}/deal-room/${room.property_id}?role=owner`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{TYPE_ICONS[room.property_type] || "🏢"}</span>
            <h3 className="font-bold text-gray-900 text-base truncate">
              {room.property_name || room.property_id}
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0`}
              style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.icon} {cfg.label}
            </span>
            {!isActive && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                Inactive
              </span>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-1.5">
            {room.property_type && <span>{room.property_type}</span>}
            {room.deal_amount && <span>· {room.deal_amount}</span>}
            {room.deal_type && <span>· {room.deal_type}</span>}
            {room.address && <span className="truncate max-w-[180px]">· {room.address}</span>}
            <span>· Created {timeAgo(room.created_at)}</span>
          </div>

          {/* Stage progress bar */}
          <StageBar stage={stage} />

          {/* Party mini-grid */}
          <PartyMini parties={room.parties} />
        </div>

        {/* Actions */}
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
        </div>
      </div>
    </div>
  );
}

// ── OTP inputs component ──────────────────────────────────────────────────
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
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(""));
      onComplete(text);
    }
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input key={i} ref={el => refs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className="w-11 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none focus:border-[#800020] transition"
          style={{ borderColor: d ? "#800020" : "#e5e7eb", color: "#111" }}
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function MyDealRoomsPage() {
  const [step, setStep] = useState("email"); // email | otp | dashboard
  const [email, setEmail] = useState("");
  const [rooms, setRooms] = useState([]);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [billingState, setBillingState] = useState("idle"); // idle | loading | error | not_configured
  const [analytics, setAnalytics] = useState(null);

  // Restore session
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

  // Analytics fetch — fires once the user reaches the dashboard
  useEffect(() => {
    if (step !== "dashboard" || !email) return;
    fetch(`${API_BASE}/api/public/my-rooms/analytics?email=${encodeURIComponent(email.trim().toLowerCase())}`)
      .then(r => r.json())
      .then(d => setAnalytics(d))
      .catch(() => {});
  }, [step, email]);

  // Resend countdown
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setStep("otp");
      setResendCountdown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(code) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/public/my-rooms/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      const n = data.rooms?.[0]?.owner_name || "";
      setRooms(data.rooms || []);
      setOwnerName(n);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ rooms: data.rooms || [], email: data.email || email, ownerName: n }));
      setStep("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
    setStep("email"); setRooms([]); setEmail(""); setOwnerName(""); setError("");
  }

  async function manageBilling() {
    setBillingState("loading");
    try {
      const res = await fetch(`${API_BASE}/api/public/billing-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } catch (err) {
      setBillingState("error");
      setTimeout(() => setBillingState("idle"), 4000);
    }
  }

  // ── STEP: email ────────────────────────────────────────────────────────
  if (step === "email") return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-5"
            style={{ background: "#fff0f3", color: "#800020" }}>
            🏠 Owner Dashboard
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-3">Access My Deal Rooms</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Enter your email to access deal rooms you created. We'll send a 6-digit code — no password needed.
          </p>
        </div>

        <form onSubmit={requestOtp} className="space-y-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" required autoFocus
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ "--tw-ring-color": "#800020" }} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading || !email.trim()}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#800020" }}>
            {loading ? "Sending code…" : "Send Access Code →"}
          </button>
        </form>

        <div className="mt-8 p-4 rounded-xl bg-gray-50 border border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Don't have a deal room yet?{" "}
            <Link to="/create-deal-room" className="font-semibold underline" style={{ color: "#800020" }}>
              Create one for $499 →
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );

  // ── STEP: otp ─────────────────────────────────────────────────────────
  if (step === "otp") return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-5"
            style={{ background: "#fff0f3", color: "#800020" }}>
            🔑 Enter your code
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 text-sm">
            We sent a 6-digit code to <strong>{email}</strong>.<br />
            Enter it below — it expires in 10 minutes.
          </p>
        </div>

        <div className="mb-6">
          <OtpInput onComplete={verifyOtp} />
          {error && <p className="text-sm text-red-600 text-center mt-4">{error}</p>}
          {loading && <p className="text-sm text-gray-400 text-center mt-4">Verifying…</p>}
        </div>

        <div className="text-center space-y-3">
          {resendCountdown > 0 ? (
            <p className="text-xs text-gray-400">Resend in {resendCountdown}s</p>
          ) : (
            <button onClick={requestOtp} disabled={loading}
              className="text-xs font-semibold underline disabled:opacity-40"
              style={{ color: "#800020" }}>
              Resend code
            </button>
          )}
          <br />
          <button onClick={() => { setStep("email"); setError(""); }}
            className="text-xs text-gray-400 hover:text-gray-600">
            ← Back to email
          </button>
        </div>
      </div>
    </PublicLayout>
  );

  // ── STEP: dashboard ───────────────────────────────────────────────────
  const activeRooms = rooms.filter(r => r.status === "active");
  const otherRooms  = rooms.filter(r => r.status !== "active");

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-14">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3"
              style={{ background: "#fff0f3", color: "#800020" }}>
              🏠 My Deal Rooms
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900">
              {ownerName ? `Welcome back, ${ownerName}` : "Your Deal Rooms"}
            </h1>
            <p className="text-xs text-gray-400 mt-1">{email}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Link to="/create-deal-room"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition whitespace-nowrap"
              style={{ background: "#800020" }}>
              + New Deal Room
            </Link>
            <button onClick={manageBilling} disabled={billingState === "loading"}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 whitespace-nowrap">
              {billingState === "loading" ? "Opening…"
                : billingState === "not_configured" ? "Portal not set up yet"
                : billingState === "error" ? "Try again later"
                : "💳 Manage Billing"}
            </button>
            <button onClick={signOut} className="text-[10px] text-gray-400 hover:text-gray-600 underline">
              Sign out
            </button>
          </div>
        </div>

        {/* ── Analytics strip ──────────────────────────────────────────── */}
        {analytics && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              {
                label: "Total Deals",
                value: analytics.totalDeals,
                icon: "🏢",
                alert: false,
              },
              {
                label: "Waiting on Borrower",
                value: analytics.waitingOnBorrower,
                icon: "⏳",
                alert: analytics.waitingOnBorrower > 0,
                hint: "active rooms missing financial upload",
              },
              {
                label: "Waiting on Inspector",
                value: analytics.waitingOnInspector,
                icon: "🔍",
                alert: analytics.waitingOnInspector > 0,
                hint: "active rooms missing inspection report",
              },
              {
                label: "Avg Days Active",
                value: analytics.avgDaysActive != null ? `${analytics.avgDaysActive}d` : "—",
                icon: "📅",
                alert: false,
                hint: "from activation to today",
              },
              {
                label: "Documents Uploaded",
                value: analytics.documentsUploaded,
                icon: "📄",
                alert: false,
              },
              {
                label: "AI Reviews Completed",
                value: analytics.aiReviewsCompleted,
                icon: "🤖",
                alert: false,
              },
            ].map(({ label, value, icon, alert, hint }) => (
              <div
                key={label}
                className="rounded-2xl border px-4 py-3 flex flex-col gap-0.5 transition"
                style={{
                  background: alert ? "#fff8f8" : "#fafafa",
                  borderColor: alert ? "#fecaca" : "#e5e7eb",
                }}>
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{icon}</span>
                  <span
                    className="text-2xl font-extrabold leading-none"
                    style={{ color: alert ? "#800020" : "#111827" }}>
                    {value}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-gray-500 leading-tight mt-0.5">
                  {label}
                </p>
                {hint && (
                  <p className="text-[10px] text-gray-400 leading-tight">{hint}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {rooms.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-gray-700 font-bold text-lg mb-2">No deal rooms found</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
              We couldn't find any deal rooms for <strong>{email}</strong>.
              Make sure you're using the same email from your Stripe receipt.
            </p>
            <Link to="/create-deal-room"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
              style={{ background: "#800020" }}>
              Create a Deal Room →
            </Link>
          </div>
        ) : (
          <div className="space-y-8">

            {/* Active rooms */}
            {activeRooms.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Active · {activeRooms.length} room{activeRooms.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="space-y-3">
                  {activeRooms.map(r => <DealCard key={r.property_id} room={r} email={email} />)}
                </div>
              </section>
            )}

            {/* Other rooms */}
            {otherRooms.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Inactive · {otherRooms.length} room{otherRooms.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="space-y-3 opacity-70">
                  {otherRooms.map(r => <DealCard key={r.property_id} room={r} email={email} />)}
                </div>
              </section>
            )}

            {/* Legend */}
            <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-gray-400">
              <span>Party squares: <span className="font-bold text-amber-600">L</span>=Lender <span className="font-bold text-amber-600">I</span>=Inspector <span className="font-bold text-amber-600">I</span>=Insurer <span className="font-bold text-amber-600">A</span>=Attorney</span>
              <span className="text-green-600">■ Approved</span>
              <span className="text-amber-600">■ Submitted</span>
              <span className="text-gray-300">■ Awaiting</span>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-xs text-gray-400 leading-relaxed">
                <strong className="text-gray-600">Need another deal room?</strong> Each room is $499 and covers one property.{" "}
                <Link to="/create-deal-room" className="underline text-gray-600">Create another →</Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
