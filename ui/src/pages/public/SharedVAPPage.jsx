import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const ACCENT = "#800020";

// ── Helpers ──────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 56 }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#f3f4f6" strokeWidth="4" />
      <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 24 24)" />
      <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>{score}</text>
    </svg>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    Verified:               { bg: "#dcfce7", color: "#15803d", dot: "#16a34a" },
    "Conditionally Verified": { bg: "#fef9c3", color: "#92400e", dot: "#ca8a04" },
    "Partially Verified":   { bg: "#fff7ed", color: "#9a3412", dot: "#f97316" },
    Pending:                { bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" },
  }[status] || { bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {status}
    </span>
  );
}

function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-3">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-600">{title}</span>
        </div>
        <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

function Row({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between py-1.5 border-t border-gray-50 first:border-t-0 gap-3">
      <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-gray-800 text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}


function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ts; }
}

function formatDate(ts) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return ts; }
}

function AuditRow({ event }) {
  const ICONS = {
    document_uploaded: "📄", stage_advanced: "→", invite_sent: "✉️",
    party_submitted: "✅", ai_analysis_complete: "🤖", ownership_transfer: "🏦",
    comment_added: "💬", status_changed: "🔄",
  };
  return (
    <div className="flex items-start gap-2.5 py-2 border-t border-gray-50 first:border-t-0">
      <span className="text-sm shrink-0 mt-0.5">{ICONS[event.type] || "•"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 leading-relaxed">{event.description || event.type?.replace(/_/g, " ")}</p>
        {event.actor && <p className="text-[10px] text-gray-400">{event.actor}</p>}
      </div>
      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{formatTimestamp(event.timestamp)}</span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function SharedVAPPage() {
  const { token } = useParams();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/public/verify/${token}`)
      .then(async r => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || `Error ${r.status}`);
        }
        return r.json();
      })
      .then(data => { setPkg(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 animate-pulse flex items-center justify-center text-xl">📦</div>
          <p className="text-sm text-gray-400">Loading AI-prepared transaction package…</p>
        </div>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-3xl mb-3">🔒</p>
          <p className="text-base font-bold text-gray-900 mb-2">Link Unavailable</p>
          <p className="text-sm text-gray-500 mb-1">{error || "This link is invalid or has expired."}</p>
          <p className="text-xs text-gray-400">AI-prepared package links are valid for 30 days. Contact the deal owner for a new link.</p>
        </div>
      </div>
    );
  }

  const { identity: id, verification: v, transaction_record: tr, structured_data: sd } = pkg;
  const scoreColor = (v.completeness_score >= 80) ? "#16a34a" : (v.completeness_score >= 50) ? "#d97706" : "#dc2626";
  const expiresAt = pkg._expires_at ? formatDate(pkg._expires_at) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav bar — read-only indicator */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-black" style={{ color: ACCENT }}>Kontra</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500">Read-only view</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
          🔒 View Only
        </span>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header card */}
        <div className="rounded-2xl border-2 overflow-hidden mb-4" style={{ borderColor: ACCENT + "30" }}>
          <div className="px-5 py-4" style={{ background: `linear-gradient(135deg, ${ACCENT}08 0%, ${ACCENT}03 100%)`, borderBottom: `1px solid ${ACCENT}20` }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: ACCENT + "15" }}>📦</div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-bold text-gray-900">AI-prepared transaction package</p>
                    <StatusBadge status={v.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{v.headline}</p>
                </div>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <ScoreRing score={v.completeness_score} size={52} />
                <p className="text-[9px] text-gray-400 mt-0.5">completeness</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">{v.summary}</p>
            {v.key_findings?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {v.key_findings.slice(0, 3).map((f, i) => (
                  <span key={i} className="px-2 py-1 rounded-lg text-[11px] bg-amber-50 text-amber-700 border border-amber-100">
                    ⚠ {f}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sections */}
          <div className="px-5 pt-4 pb-2">

            {/* 1 — Identity */}
            <Section title="Identity" icon="🏢" defaultOpen>
              <Row label="Asset Name" value={id.asset_name} />
              <Row label="Asset Type" value={id.asset_type} />
              <Row label="Address" value={id.address} />
              <Row label="Deal Amount" value={id.deal_amount} />
              <Row label="Deal Stage" value={id.deal_stage?.replace(/_/g, " ")} />
              <Row label="Activated" value={formatDate(id.activated_at)} />
              {id.ownership_structure?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Ownership Structure</p>
                  <div className="space-y-1">
                    {id.ownership_structure.map((p, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                        <div>
                          <span className="text-xs font-medium text-gray-700 capitalize">{p.role}</span>
                          {p.name && <span className="text-[10px] text-gray-400 ml-1.5">— {p.name}</span>}
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: p.status === "approved" ? "#dcfce7" : "#fff7ed", color: p.status === "approved" ? "#15803d" : "#92400e" }}>
                          {p.status || "submitted"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* 2 — Verification */}
            <Section title="Verification" icon="✅" defaultOpen>
              <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-gray-50">
                <ScoreRing score={v.completeness_score} size={48} />
                <div>
                  <p className="text-xs font-bold text-gray-800">Document Completeness</p>
                  <p className="text-[10px] text-gray-400">{v.documents_reviewed} of {v.required_total} required document types uploaded</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs font-bold text-gray-600">AI Confidence</p>
                  <p className="text-sm font-black" style={{ color: scoreColor }}>{v.confidence}%</p>
                </div>
              </div>
              {v.risk_findings?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1.5">Risk Findings</p>
                  <ul className="space-y-1">
                    {v.risk_findings.map((f, i) => (
                      <li key={i} className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {v.missing_documents?.length === 0 && (
                <p className="text-xs text-green-600 font-semibold">✓ All required documents present</p>
              )}
              {v.missing_documents?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {v.missing_documents.map(d => (
                    <span key={d} className="px-2 py-1 rounded-lg text-[11px] bg-red-50 text-red-600 border border-red-100">
                      Missing: {d.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            {/* 3 — Structured transaction record */}
            <Section title="Structured transaction record" icon="📜">
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Documents", value: tr.documents?.length || 0 },
                  { label: "Participants", value: tr.participant_approvals?.length || 0 },
                  { label: "Events", value: tr.audit_trail?.length || 0 },
                ].map(m => (
                  <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-gray-800">{m.value}</p>
                    <p className="text-[10px] text-gray-400">{m.label}</p>
                  </div>
                ))}
              </div>
              <Row label="Activated" value={formatDate(tr.closing_timeline?.activated_at)} />
              <Row label="Last Activity" value={formatTimestamp(tr.closing_timeline?.last_activity)} />
              <Row label="Stage" value={tr.closing_timeline?.current_stage?.replace(/_/g, " ")} />
              {tr.audit_trail?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Audit Trail (last {Math.min(tr.audit_trail.length, 10)})</p>
                  {tr.audit_trail.slice(-10).reverse().map((e, i) => <AuditRow key={i} event={e} />)}
                </div>
              )}
            </Section>

            {/* 4 — Structured Data */}
            <Section title="Structured Data" icon="📊">
              {Object.keys(sd.financial_metrics || {}).length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Financial Metrics</p>
                  {Object.entries(sd.financial_metrics).map(([k, val]) => (
                    <Row key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())} value={String(val)} />
                  ))}
                </div>
              )}
              {Object.keys(sd.key_legal_terms || {}).length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Key Legal Terms</p>
                  {Object.entries(sd.key_legal_terms).map(([k, val]) => (
                    <Row key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                      value={Array.isArray(val) ? val.join(", ") : String(val)} />
                  ))}
                </div>
              )}
            </Section>

            <p className="text-[10px] text-gray-400 mt-4 pb-2 border-t border-gray-100 pt-2">
              Generated {formatTimestamp(pkg.generated_at)}
              {expiresAt && ` · Link expires ${expiresAt}`}
              {" · "}Verify all data independently before relying on it in legal or financial documents.
            </p>
          </div>
        </div>

        {/* Powered by Kontra footer */}
        <div className="flex flex-col items-center gap-2 py-6">
          <a href="https://kontraplatform.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-black hover:opacity-80 transition"
            style={{ color: ACCENT }}>
            Powered by Kontra
          </a>
          <p className="text-[11px] text-gray-400 text-center max-w-xs">
            Kontra is a deal room platform for private transactions of all types.
            This package was generated and verified using Kontra AI.
          </p>
          <a href="https://kontraplatform.com" target="_blank" rel="noopener noreferrer"
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
            Get started free →
          </a>
        </div>
      </div>
    </div>
  );
}
