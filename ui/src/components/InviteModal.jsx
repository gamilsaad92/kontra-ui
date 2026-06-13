import React, { useState } from "react";

const PARTY_ROLES = [
  {
    role: "lender",
    icon: "🏦",
    label: "Lender / Underwriter",
    color: "#800020",
    desc: "Sees financials, risk score, DSCR, compliance status, and AI-analyzed documents.",
  },
  {
    role: "inspector",
    icon: "🔍",
    label: "Inspector / Engineer",
    color: "#d97706",
    desc: "Submits inspection reports directly into the workspace. Findings auto-structured by AI.",
  },
  {
    role: "insurer",
    icon: "🛡️",
    label: "Insurance Broker",
    color: "#065f46",
    desc: "Reviews AI-flagged coverage gaps. Uploads certificates that are auto-tracked for expiration.",
  },
  {
    role: "investor",
    icon: "📊",
    label: "Investor",
    color: "#6d28d9",
    desc: "Views Investment Readiness Report, financials, occupancy, and tokenization status.",
  },
  {
    role: "servicer",
    icon: "⚙️",
    label: "Servicer",
    color: "#92400e",
    desc: "Accesses draw management, borrower financials, escrow tracking, and covenant monitoring.",
  },
  {
    role: "attorney",
    icon: "📜",
    label: "Attorney / Title",
    color: "#374151",
    desc: "Reviews legal structure documentation, title history, and compliance checklist.",
  },
];

const BASE_URL = typeof window !== "undefined"
  ? window.location.origin
  : "https://kontraplatform.com";

export default function InviteModal({ property, onClose }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [copied, setCopied] = useState(false);
  const [customNote, setCustomNote] = useState("");
  const [step, setStep] = useState("select"); // select | link

  const inviteLink = selectedRole
    ? `${BASE_URL}/deal-room/${property.id}?role=${selectedRole.role}&from=${encodeURIComponent(property.name)}`
    : null;

  const handleCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSelectRole = (r) => {
    setSelectedRole(r);
    setStep("link");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Invite to Deal Room</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
              {property.name} · {property.market || property.address}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === "select" ? (
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Who are you inviting? Each party gets a role-scoped view — they only see what's relevant to them.
            </p>
            <div className="space-y-2">
              {PARTY_ROLES.map((r) => (
                <button key={r.role}
                  onClick={() => handleSelectRole(r)}
                  className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition text-left group">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: r.color + "12" }}>
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-900">{r.label}</p>
                    <p className="text-xs text-gray-400 leading-relaxed mt-0.5">{r.desc}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition mt-2 shrink-0"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Back */}
            <button onClick={() => setStep("select")}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition mb-5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Change party type
            </button>

            {/* Selected role */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl mb-5"
              style={{ background: selectedRole.color + "08", border: `1px solid ${selectedRole.color}25` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: selectedRole.color + "15" }}>
                {selectedRole.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{selectedRole.label}</p>
                <p className="text-xs text-gray-500">Role-scoped access · Can't see other parties' data</p>
              </div>
            </div>

            {/* Optional note */}
            <div className="mb-5">
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Add a note <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={2}
                placeholder={`e.g. "Please review the inspection report and submit your findings by Friday."`}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition resize-none"
              />
            </div>

            {/* The link */}
            <div className="mb-2">
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Invite link</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <code className="text-xs text-gray-600 flex-1 truncate">{inviteLink}</code>
                <button onClick={handleCopy}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    copied ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}>
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-5">
              Anyone with this link can view the deal room in <strong>{selectedRole.label}</strong> mode. They'll need to sign in to take actions.
            </p>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button onClick={handleCopy}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: selectedRole.color }}>
                {copied ? "Link Copied ✓" : `Copy ${selectedRole.label} Link`}
              </button>
              {typeof window !== "undefined" && navigator.share && (
                <button
                  onClick={() => navigator.share({ title: `Deal Room — ${property.name}`, url: inviteLink })}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                  Share
                </button>
              )}
            </div>

            {/* What they'll see */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">What {selectedRole.label} will see</p>
              <p className="text-xs text-gray-500 leading-relaxed">{selectedRole.desc}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
