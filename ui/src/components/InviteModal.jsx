import React, { useState } from "react";
import {
  generatePinForRole,
  requestOwnerOtp,
  verifyOwnerOtp,
  getOwnerSession,
} from "../lib/pinUtils";

const PARTY_ROLES = [
  { role: "lender",   icon: "🏦", label: "Lender / Underwriter",  color: "#800020",
    desc: "Sees financials, risk score, DSCR, compliance status, and AI-analyzed documents." },
  { role: "inspector",icon: "🔍", label: "Inspector / Engineer",   color: "#d97706",
    desc: "Submits inspection reports directly. Findings auto-structured by AI." },
  { role: "insurer",  icon: "🛡️", label: "Insurance Broker",       color: "#065f46",
    desc: "Reviews AI-flagged coverage gaps and auto-tracked certificates." },
  { role: "investor", icon: "📊", label: "Investor",               color: "#6d28d9",
    desc: "Views Investment Readiness Report, financials, occupancy, and tokenization status." },
  { role: "servicer", icon: "⚙️", label: "Servicer",               color: "#92400e",
    desc: "Accesses draw management, borrower financials, escrow tracking." },
  { role: "attorney", icon: "📜", label: "Attorney / Title",       color: "#374151",
    desc: "Reviews legal structure documentation and compliance checklist." },
];

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://kontraplatform.com";

export default function InviteModal({ property, onClose }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [step, setStep]   = useState("select"); // select | link | auth-email | auth-otp
  const [copied, setCopied] = useState(false);
  const [customNote, setCustomNote] = useState("");

  // Owner auth state
  const [authEmail, setAuthEmail]   = useState("");
  const [authOtp, setAuthOtp]       = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authErr, setAuthErr]       = useState("");
  const [ownerAuthed, setOwnerAuthed] = useState(false);

  // PIN state
  const [pinState, setPinState] = useState(null);

  const propertyId = property?.id;

  const inviteLink = selectedRole
    ? `${BASE_URL}/deal-room/${propertyId}?role=${selectedRole.role}&from=${encodeURIComponent(property.name || "")}`
    : null;

  async function handleSelectRole(r) {
    setSelectedRole(r);
    setPinState(null);
    setStep("link");
    // Kick off PIN generation if already authenticated
    const session = await getOwnerSession();
    if (session) { setOwnerAuthed(true); generatePin(r.role); }
    else generatePin(r.role); // will prompt auth inline
  }

  async function generatePin(role) {
    setPinState({ status: "loading" });
    const session = await getOwnerSession();
    if (!session && !ownerAuthed) {
      // Need auth first
      setPinState(null);
      setStep("auth-email");
      return;
    }
    try {
      const pin = await generatePinForRole(propertyId, role);
      setPinState({ status: "ready", pin });
    } catch (ex) {
      setPinState({ status: "error", error: ex.message });
    }
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    if (!authEmail.trim()) return;
    setAuthLoading(true); setAuthErr("");
    try {
      await requestOwnerOtp(authEmail);
      setStep("auth-otp");
    } catch (ex) { setAuthErr(ex.message || "Failed to send code"); }
    finally { setAuthLoading(false); }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setAuthLoading(true); setAuthErr("");
    try {
      await verifyOwnerOtp(authEmail, authOtp);
      setOwnerAuthed(true);
      setStep("link");
      // Retry PIN generation now that we're authed
      generatePin(selectedRole.role);
    } catch (ex) { setAuthErr(ex.message || "Incorrect code"); }
    finally { setAuthLoading(false); }
  }

  function handleBack() { setStep("select"); setSelectedRole(null); setPinState(null); }
  function handleCopy() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Invite to Deal Room</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
              {property?.name} · {property?.market || property?.address}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Role selection ── */}
        {step === "select" && (
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">Who are you inviting? Each party gets a role-scoped view.</p>
            <div className="space-y-2">
              {PARTY_ROLES.map(r => (
                <button key={r.role} onClick={() => handleSelectRole(r)}
                  className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition text-left group">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: r.color + "12" }}>{r.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                    <p className="text-xs text-gray-400 leading-relaxed mt-0.5">{r.desc}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition mt-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Link + PIN ── */}
        {step === "link" && selectedRole && (
          <div className="p-6">
            <button onClick={handleBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition mb-5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Change party type
            </button>
            <div className="flex items-center gap-3 p-3.5 rounded-xl mb-5"
              style={{ background: selectedRole.color + "08", border: `1px solid ${selectedRole.color}25` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: selectedRole.color + "15" }}>{selectedRole.icon}</div>
              <div>
                <p className="text-sm font-bold text-gray-900">{selectedRole.label}</p>
                <p className="text-xs text-gray-500">Role-scoped access</p>
              </div>
            </div>
            <div className="mb-5">
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Add a note <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea value={customNote} onChange={e => setCustomNote(e.target.value)} rows={2}
                placeholder={`e.g. "Please review the inspection report and submit by Friday."`}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition resize-none"
              />
            </div>
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Invite link</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <code className="text-xs text-gray-600 flex-1 truncate">{inviteLink}</code>
                <button onClick={handleCopy} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${copied ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>

            {/* PIN states */}
            {pinState?.status === "loading" && (
              <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin shrink-0" />
                <p className="text-xs text-amber-700">Generating access PIN…</p>
              </div>
            )}
            {pinState?.status === "ready" && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Access PIN — share separately</p>
                    <p className="text-[10px] text-amber-700 mt-0.5">Send the link by email, text the PIN. Never put both in the same message.</p>
                  </div>
                  <button onClick={() => generatePin(selectedRole.role)} className="text-[10px] text-amber-600 hover:text-amber-800 underline shrink-0 transition mt-0.5">Regenerate</button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white border border-amber-200 rounded-lg px-4 py-2.5 text-center">
                    <span className="text-2xl font-black tracking-[0.3em] text-amber-900">{pinState.pin}</span>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(pinState.pin)} className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border border-amber-200 text-amber-700 hover:bg-amber-100 transition">Copy PIN</button>
                </div>
                <p className="text-[10px] text-amber-600 mt-2">⚠ This PIN appears once. Save it before closing.</p>
              </div>
            )}
            {pinState?.status === "error" && (
              <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500">PIN generation unavailable. <button onClick={() => generatePin(selectedRole.role)} className="underline text-gray-700">Retry</button></p>
              </div>
            )}
            {!pinState && !ownerAuthed && (
              <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-xs text-amber-700">
                  <button onClick={() => setStep("auth-email")} className="font-semibold underline">Verify ownership</button> to add PIN protection to this link.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleCopy} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90" style={{ background: selectedRole.color }}>
                {copied ? "Link Copied ✓" : `Copy ${selectedRole.label} Link`}
              </button>
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">What they'll see</p>
              <p className="text-xs text-gray-500 leading-relaxed">{selectedRole.desc}</p>
            </div>
          </div>
        )}

        {/* ── Owner auth: email step ── */}
        {step === "auth-email" && (
          <div className="p-6">
            <button onClick={() => setStep(selectedRole ? "link" : "select")} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition mb-5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-2xl mb-4">🔑</div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Verify room ownership</h3>
            <p className="text-sm text-gray-500 mb-5">Enter the email you used when creating this deal room. We'll send a one-time code to confirm you're the owner.</p>
            <form onSubmit={handleSendOtp} className="space-y-3">
              <input type="email" autoFocus required placeholder="owner@yourdomain.com"
                value={authEmail} onChange={e => { setAuthEmail(e.target.value); setAuthErr(""); }}
                className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
              />
              {authErr && <p className="text-xs text-red-500">{authErr}</p>}
              <button type="submit" disabled={authLoading || !authEmail.trim()} className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
                {authLoading ? "Sending…" : "Send verification code →"}
              </button>
            </form>
          </div>
        )}

        {/* ── Owner auth: OTP step ── */}
        {step === "auth-otp" && (
          <div className="p-6">
            <button onClick={() => { setStep("auth-email"); setAuthOtp(""); setAuthErr(""); }} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition mb-5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Use a different email
            </button>
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-2xl mb-4">📬</div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Check your inbox</h3>
            <p className="text-sm text-gray-500 mb-5">We sent a 6-digit code to <strong>{authEmail}</strong>. Enter it below.</p>
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus required
                placeholder="000000" value={authOtp}
                onChange={e => { setAuthOtp(e.target.value.replace(/\D/g, "")); setAuthErr(""); }}
                className="w-full text-center text-2xl font-bold tracking-[0.4em] px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder:tracking-widest placeholder:text-gray-300 placeholder:text-xl"
              />
              {authErr && <p className="text-xs text-red-500 text-center">{authErr}</p>}
              <button type="submit" disabled={authLoading || authOtp.length < 6} className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
                {authLoading ? "Verifying…" : "Confirm →"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
