import React, { useState, useEffect, useCallback } from "react";
import { supabase as supabaseClient, isSupabaseConfigured } from "../../lib/supabaseClient";

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

function ExportActions({ pkg, propertyId }) {
  const [exporting, setExporting] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRecipient, setShareRecipient] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState(null); // { url, copied, emailSent }
  const [shareError, setShareError] = useState(null);

  function exportJSON() {
    setExporting("json");
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pkg.identity?.asset_name?.replace(/\s+/g, "-") || propertyId}-verified-asset-package.json`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExporting(null), 1500);
  }

  function exportClosingBinder() {
    setExporting("pdf");
    const content = document.getElementById("vap-print-content");
    if (content) {
      const win = window.open("", "_blank");
      win.document.write(`<!DOCTYPE html><html><head><title>Closing Binder — ${pkg.identity?.asset_name || ""}</title>
<style>
  body { font-family: -apple-system, sans-serif; color: #111; padding: 32px; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 22px; color: #800020; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #374151; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
  td:first-child { color: #6b7280; width: 40%; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .status-v { background: #dcfce7; color: #15803d; }
  .status-c { background: #fef9c3; color: #92400e; }
  .status-p { background: #f1f5f9; color: #64748b; }
  footer { margin-top: 40px; font-size: 10px; color: #9ca3af; }
  @media print { @page { margin: 1in; } }
</style></head><body>`);
      win.document.write(content.innerHTML);
      win.document.write(`<footer>Generated by Kontra Platform · ${new Date().toLocaleDateString()} · Asset: ${pkg.identity?.asset_name || propertyId}</footer>`);
      win.document.write("</body></html>");
      win.document.close();
      win.focus();
      win.print();
    }
    setTimeout(() => setExporting(null), 2000);
  }

  async function generateShareLink(sendEmail = false) {
    setSharing(true);
    setShareError(null);
    try {
      const body = sendEmail && shareEmail
        ? { email: shareEmail, recipientName: shareRecipient || undefined }
        : {};
      const res = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/verified-asset-package/share`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Server error ${res.status}`);
      }
      const { token } = await res.json();
      const shareUrl = `${window.location.origin}/verify/${token}`;
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      setShareResult({ url: shareUrl, copied: true, emailSent: sendEmail && !!shareEmail });
    } catch (e) {
      setShareError(e.message);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Export & Share</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={exportClosingBinder} disabled={!!exporting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
          {exporting === "pdf" ? "⏳" : "📋"} Closing Binder
        </button>
        <button onClick={exportJSON} disabled={!!exporting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
          {exporting === "json" ? "⏳" : "{ }"} Export JSON
        </button>
        <button
          onClick={() => { setShowShare(s => !s); setShareResult(null); setShareError(null); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition"
          style={showShare
            ? { background: ACCENT + "10", borderColor: ACCENT + "40", color: ACCENT }
            : { background: "white", borderColor: "#e5e7eb", color: "#374151" }}>
          🔗 Share Package
        </button>
      </div>

      {/* ── Share Panel ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 mb-3">
          <p className="text-xs font-bold text-gray-800 mb-1">Share with lenders & investors</p>
          <p className="text-xs text-gray-500 leading-relaxed mb-3">
            Generate a read-only link valid for 30 days. Recipients see all four sections of this
            package but cannot access the workspace or make any changes.
          </p>

          {shareResult ? (
            <div>
              <div className="flex items-center gap-2 bg-white border border-green-200 rounded-xl px-3 py-2.5 mb-3">
                <span className="text-green-600 text-sm">✓</span>
                <span className="text-xs font-mono text-gray-600 flex-1 truncate">{shareResult.url}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(shareResult.url).catch(() => {})}
                  className="text-[10px] font-bold text-gray-500 hover:text-gray-800 transition shrink-0">
                  Copy
                </button>
              </div>
              <p className="text-[11px] text-green-600 font-medium">
                {shareResult.copied ? "✓ Link copied to clipboard" : "Link generated"}
                {shareResult.emailSent && ` · Email sent to ${shareEmail}`}
              </p>
              <button
                onClick={() => { setShareResult(null); setShareEmail(""); setShareRecipient(""); }}
                className="mt-2 text-[11px] text-gray-400 underline hover:text-gray-600 transition">
                Generate another link
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Send via email (optional)
                </label>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  placeholder="investor@example.com"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:border-gray-400"
                  style={{ focusRingColor: ACCENT }}
                />
              </div>
              {shareEmail && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Recipient name (optional)
                  </label>
                  <input
                    type="text"
                    value={shareRecipient}
                    onChange={e => setShareRecipient(e.target.value)}
                    placeholder="John Smith"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:border-gray-400"
                  />
                </div>
              )}
              {shareError && (
                <p className="text-[11px] text-red-500">{shareError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => generateShareLink(false)}
                  disabled={sharing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
                  {sharing ? "⏳" : "🔗"} Copy link
                </button>
                {shareEmail && (
                  <button
                    onClick={() => generateShareLink(true)}
                    disabled={sharing}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50"
                    style={{ background: ACCENT }}>
                    {sharing ? "⏳" : "✉"} Send email + copy link
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 pt-1">
                Links expire in 30 days · Read-only · Powered by Kontra
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Tokenization Prep Panel ──────────────────────────────────────── */}
    </div>
  );
}

// ── Hidden print-only content ────────────────────────────────────────────────
function PrintContent({ pkg }) {
  const v = pkg.verification || {};
  const id = pkg.identity || {};
  const tr = pkg.transaction_record || {};
  const sd = pkg.structured_data || {};
  const statusClass = { Verified: "status-v", "Conditionally Verified": "status-c", Pending: "status-p" }[v.status] || "status-p";

  return (
    <div id="vap-print-content" style={{ display: "none" }}>
      <h1>Verified Transaction Package</h1>
      <div className="meta">
        {id.asset_name} · {id.asset_type} · {id.address}<br />
        Deal Amount: {id.deal_amount || "Not specified"} · Generated: {new Date().toLocaleDateString()}
      </div>

      <h2>Verification Status</h2>
      <p><span className={`badge ${statusClass}`}>{v.status}</span></p>
      <p style={{ fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>{v.summary}</p>

      {v.key_findings?.length > 0 && (
        <>
          <h2>Key Findings</h2>
          <ul style={{ fontSize: 12 }}>
            {v.key_findings.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </>
      )}

      <h2>Identity</h2>
      <table>
        <tbody>
          <tr><td>Asset Name</td><td>{id.asset_name}</td></tr>
          <tr><td>Asset Type</td><td>{id.asset_type}</td></tr>
          <tr><td>Address</td><td>{id.address || "—"}</td></tr>
          <tr><td>Deal Amount</td><td>{id.deal_amount || "—"}</td></tr>
          <tr><td>Transaction Stage</td><td>{id.deal_stage}</td></tr>
        </tbody>
      </table>

      <h2>Participants</h2>
      <table>
        <tbody>
          {(tr.participant_approvals || []).map((p, i) => (
            <tr key={i}>
              <td>{p.role}</td>
              <td>{p.name || "—"} · {p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Documents Uploaded ({tr.documents?.length || 0})</h2>
      <table>
        <tbody>
          {(tr.documents || []).map((d, i) => (
            <tr key={i}>
              <td>{d.section}</td>
              <td>{d.filename} · {d.uploaded_by}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {Object.keys(sd.financial_metrics || {}).length > 0 && (
        <>
          <h2>Financial Metrics</h2>
          <table>
            <tbody>
              {Object.entries(sd.financial_metrics).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{String(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VerifiedAssetPackage({ propertyId }) {
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const fetchPackage = useCallback(async (force = false) => {
    if (!propertyId) return;
    if (force) setGenerating(true);
    try {
      // ── Strategy 1: Supabase direct (public_read_vap RLS — no auth needed) ──
      // This bypasses the API server so the package is always readable even when
      // the API is unavailable or the endpoint is gated behind auth middleware.
      if (!force && isSupabaseConfigured && supabaseClient) {
        const { data: stored } = await supabaseClient
          .from("verified_asset_packages")
          .select("package, generated_at, sealed")
          .eq("property_id", propertyId)
          .maybeSingle();
        if (stored?.package) {
          setPkg({ ...stored.package, _stored: true, _sealed: stored.sealed });
          setError(null);
          setLoading(false);
          setGenerating(false);
          return;
        }
      }

      // ── Strategy 2: API server (generates + stores on-demand) ────────────────
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/verified-asset-package`, {
        headers: { "Cache-Control": force ? "no-cache" : "default" },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      setPkg(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [propertyId]);

  useEffect(() => { fetchPackage(); }, [fetchPackage]);

  // ── Stage is not closing/funded — show a teaser ──────────────────────────
  if (!loading && pkg && !["closing", "funded"].includes(pkg.identity?.deal_stage)) {
    const completeness = pkg.verification?.completeness_score ?? 0;
    return (
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: ACCENT + "12" }}>📦</div>
            <div>
              <p className="text-sm font-bold text-gray-900">Verified Transaction Package</p>
              <p className="text-[10px] text-gray-400">Generated at closing · Your deal's structured digital record</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
            Available at Closing
          </span>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { label: "Document Completeness", value: `${completeness}%`, color: completeness >= 80 ? "#16a34a" : "#d97706" },
              { label: "Parties", value: `${pkg.identity?.ownership_structure?.length || 0}`, color: "#374151" },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-base font-black" style={{ color: m.color }}>{m.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            When the deal reaches Closing, this panel generates your full Verified Transaction Package —
            including an AI verification summary, audit trail, structured data export, and party approvals.
            It's available to download as a Closing Binder or JSON.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base animate-pulse bg-gray-100">📦</div>
          <div>
            <div className="h-3.5 w-40 bg-gray-100 rounded animate-pulse mb-1.5" />
            <div className="h-2.5 w-52 bg-gray-50 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !pkg) {
    return (
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-lg">📦</span>
          <p className="text-sm font-bold text-gray-900">Verified Transaction Package</p>
        </div>
        <p className="text-xs text-red-500 mb-3">{error || "Could not load package"}</p>
        <button onClick={() => fetchPackage(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition"
          style={{ background: ACCENT }}>
          Retry
        </button>
      </div>
    );
  }

  const { identity: id, verification: v, transaction_record: tr, structured_data: sd } = pkg;
  const scoreColor = (v.completeness_score >= 80) ? "#16a34a" : (v.completeness_score >= 50) ? "#d97706" : "#dc2626";

  return (
    <div className="mb-6 rounded-2xl border-2 overflow-hidden" style={{ borderColor: ACCENT + "30" }}>
      {/* Header */}
      <div className="px-5 py-4" style={{ background: `linear-gradient(135deg, ${ACCENT}08 0%, ${ACCENT}03 100%)`, borderBottom: `1px solid ${ACCENT}20` }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: ACCENT + "15" }}>
              📦
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-gray-900">Verified Transaction Package</p>
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
        {v.missing_documents?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {v.missing_documents.map(d => (
              <span key={d} className="px-2 py-1 rounded-lg text-[11px] bg-red-50 text-red-600 border border-red-100">
                Missing: {d.replace(/_/g, " ")}
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
        </Section>

        {/* 3 — Transaction Record */}
        <Section title="Transaction Record" icon="📜">
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
              {Object.entries(sd.financial_metrics).map(([k, v]) => (
                <Row key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())} value={String(v)} />
              ))}
            </div>
          )}
          {Object.keys(sd.key_legal_terms || {}).length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Key Legal Terms</p>
              {Object.entries(sd.key_legal_terms).map(([k, v]) => (
                <Row key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                  value={Array.isArray(v) ? v.join(", ") : String(v)} />
              ))}
            </div>
          )}
        </Section>

        {/* Export actions */}
        <ExportActions pkg={pkg} propertyId={propertyId} />

        {/* Print-only content */}
        <PrintContent pkg={pkg} />

        <p className="text-[10px] text-gray-400 mt-4 pb-2 border-t border-gray-100 pt-2">
          Generated {formatTimestamp(pkg.generated_at)} · Verify all exported data independently before relying on it in legal or financial documents.
        </p>
      </div>

      {/* Regenerate */}
      <div className="px-5 pb-4">
        <button onClick={() => fetchPackage(true)} disabled={generating}
          className="text-[11px] text-gray-400 hover:text-gray-600 transition underline disabled:opacity-50">
          {generating ? "Regenerating…" : "↻ Regenerate package"}
        </button>
      </div>
    </div>
  );
}
