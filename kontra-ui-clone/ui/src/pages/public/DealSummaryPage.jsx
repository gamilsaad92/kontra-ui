import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const STAGE_LABELS = {
  uploading: "Uploading Documents",
  under_review: "Under Review",
  approved: "Approved",
  closing: "Closing",
  funded: "Funded",
};

const ROLE_LABELS = {
  owner: "Owner / Borrower", lender: "Lender / Underwriter",
  inspector: "Inspector", insurer: "Insurance Broker",
  attorney: "Attorney", investor: "Investor",
  servicer: "Servicer", franchisor: "Franchisor / Brand",
};

const STATUS_STYLE = {
  submitted:      { label: "Submitted",      color: "#b45309", bg: "#fffbeb" },
  approved:       { label: "Approved",       color: "#15803d", bg: "#f0fdf4" },
  needs_revision: { label: "Needs Revision", color: "#b91c1c", bg: "#fef2f2" },
  rejected:       { label: "Rejected",       color: "#b91c1c", bg: "#fef2f2" },
  awaiting:       { label: "Awaiting",       color: "#6b7280", bg: "#f3f4f6" },
};

function healthScore(analyses) {
  let score = 60;
  const insp = analyses.find(a => a.section === "inspection");
  const ins  = analyses.find(a => a.section === "insurance");
  const fin  = analyses.find(a => a.section === "financials");
  if (insp) {
    const t = getText(insp.analysis).toLowerCase();
    score += t.includes("good") || t.includes("excellent") ? 15 : t.includes("minor") ? 8 : 0;
    if (t.match(/deferred.*\$[\d,]+k?/)) score -= 5;
  }
  if (ins) {
    const t = getText(ins.analysis).toLowerCase();
    score += t.includes("compliant") || t.includes("comprehensive") ? 12 : 5;
    if (t.includes("gap")) score -= 4;
  }
  if (fin) {
    const t = getText(fin.analysis).toLowerCase();
    const dscr = t.match(/dscr[:\s]*([0-9.]+)/i);
    if (dscr) {
      const v = parseFloat(dscr[1]);
      score += v >= 1.35 ? 13 : v >= 1.2 ? 7 : v >= 1.0 ? 2 : -10;
    } else {
      score += 10;
    }
  }
  return Math.min(100, Math.max(0, score));
}

function scoreLabel(s) {
  if (s >= 85) return { label: "Low Risk",       color: "#15803d" };
  if (s >= 70) return { label: "Moderate Risk",  color: "#b45309" };
  if (s >= 50) return { label: "Elevated Risk",  color: "#c2410c" };
  return               { label: "High Risk",     color: "#b91c1c" };
}

function extractMetrics(analyses) {
  const metrics = [];
  const fin = analyses.find(a => a.section === "financials");
  if (fin) {
    const t = getText(fin.analysis);
    const noi   = t.match(/NOI[:\s]*\$?([\d,]+)/i);
    const dscr  = t.match(/DSCR[:\s]*([0-9.]+)/i);
    const occ   = t.match(/occupanc[yi][:\s]*([0-9]+)%/i);
    const cap   = t.match(/cap rate[:\s]*([0-9.]+)%/i);
    if (noi)  metrics.push({ label: "NOI",        value: `$${noi[1]}` });
    if (dscr) metrics.push({ label: "DSCR",       value: `${dscr[1]}×` });
    if (occ)  metrics.push({ label: "Occupancy",  value: `${occ[1]}%` });
    if (cap)  metrics.push({ label: "Cap Rate",   value: `${cap[1]}%` });
  }
  const ins = analyses.find(a => a.section === "insurance");
  if (ins) {
    const t = getText(ins.analysis);
    const exp = t.match(/[Ee]xpires?[:\s]*([A-Za-z0-9\-\/]+)/);
    if (exp) metrics.push({ label: "Ins. Expiry", value: exp[1] });
  }
  const insp = analyses.find(a => a.section === "inspection");
  if (insp) {
    const t = getText(insp.analysis);
    const dm = t.match(/[Dd]eferred[^$]*\$([\d,]+)/);
    if (dm) metrics.push({ label: "Deferred Maint.", value: `$${dm[1]}` });
  }
  return metrics;
}

const SECTION_META = {
  inspection: { icon: "🔍", label: "Property Inspection",  color: "#1d4ed8" },
  insurance:  { icon: "🛡️", label: "Insurance Coverage",   color: "#7c3aed" },
  financials: { icon: "📊", label: "Financial Overview",   color: "#15803d" },
};

const SECTION_ORDER = ["inspection", "insurance", "financials"];

// analysis field is an object { summary, confidence, sources } — extract plain text safely
function getText(analysis) {
  if (!analysis) return "";
  if (typeof analysis === "string") return analysis;
  return analysis.summary || analysis.text || JSON.stringify(analysis);
}
function getConfidence(analysis) {
  if (!analysis || typeof analysis === "string") return null;
  return analysis.confidence || null;
}
function getSources(analysis) {
  if (!analysis || typeof analysis === "string") return [];
  return analysis.sources || [];
}

export default function DealSummaryPage() {
  const { propertyId } = useParams();
  const [room, setRoom]       = useState(null);
  const [analyses, setAn]     = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  useEffect(() => {
    if (!propertyId) return;
    Promise.all([
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}`).then(r => r.json()),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`).then(r => r.ok ? r.json() : { analyses: [] }),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination`).then(r => r.ok ? r.json() : { parties: [] }),
    ]).then(([roomData, anData, coordData]) => {
      if (roomData.error) { setError(roomData.error); return; }
      setRoom(roomData);
      setAn(anData.analyses || []);
      setParties(coordData.parties || []);
    }).catch(() => setError("Failed to load deal summary."))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-gray-400 text-sm animate-pulse">Loading deal summary…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <Link to={`/deal-room/${propertyId}?role=owner`} className="text-sm underline text-gray-500">
          ← Back to deal room
        </Link>
      </div>
    </div>
  );

  const score          = healthScore(analyses);
  const scoreCfg       = scoreLabel(score);
  const metrics        = extractMetrics(analyses);
  const orderedAnalyses = SECTION_ORDER.map(s => analyses.find(a => a.section === s)).filter(Boolean);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @page { margin: 18mm 16mm; size: A4; }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="no-print bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <Link to={`/deal-room/${propertyId}?role=owner`}
          className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5 transition">
          ← Back to deal room
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 no-print">In print dialog → select "Save as PDF"</span>
          <button onClick={() => window.print()}
            className="px-5 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
            style={{ background: "#800020" }}>
            ⬇ Download PDF
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="max-w-[760px] mx-auto px-8 py-10 bg-white min-h-screen">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-900">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-white text-xs font-black px-2.5 py-1 rounded-lg"
                style={{ background: "#800020" }}>
                Kontra
              </span>
              <span className="text-xs text-gray-400 font-medium">Confidential Deal Summary</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">
              {room.property_name || propertyId}
            </h1>
            {room.address && (
              <p className="text-sm text-gray-500 mt-0.5">{room.address}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Generated</p>
            <p className="text-sm font-semibold text-gray-700">{generatedAt}</p>
            <p className="text-[10px] text-gray-300 mt-1 font-mono">{propertyId}</p>
          </div>
        </div>

        {/* ── Deal Overview tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
          {[
            { label: "Property Type", value: room.property_type || "—" },
            { label: "Deal Amount",   value: room.deal_amount   || "—" },
            { label: "Deal Type",     value: room.deal_type     || "—" },
            { label: "Deal Stage",    value: STAGE_LABELS[room.deal_stage] || room.deal_stage || "Uploading" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-bold text-gray-900 leading-snug">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Key Metrics strip ── */}
        {metrics.length > 0 && (
          <div className="flex flex-wrap gap-2.5 mb-7">
            {metrics.map(m => (
              <div key={m.label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{m.label}</span>
                <span className="text-sm font-black text-gray-900">{m.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Deal Health Score ── */}
        <div className="flex items-center gap-5 mb-7 p-5 rounded-2xl border border-gray-100 bg-gray-50">
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="14" fill="none" stroke={scoreCfg.color}
                strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 88} 88`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-base font-black" style={{ color: scoreCfg.color }}>{score}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Deal Health Score</p>
            <p className="text-lg font-black" style={{ color: scoreCfg.color }}>{scoreCfg.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Based on {orderedAnalyses.length} AI-analyzed section{orderedAnalyses.length !== 1 ? "s" : ""} ·{" "}
              {100 - score < 20
                ? "Strong fundamentals across all sections"
                : 100 - score < 35
                ? "Review flagged items before closing"
                : "Material issues require attention"}
            </p>
          </div>
        </div>

        {/* ── AI Analysis Sections ── */}
        {orderedAnalyses.length > 0 && (
          <section className="mb-7">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
              AI Document Analysis
            </h2>
            <div className="space-y-3">
              {orderedAnalyses.map(a => {
                const meta = SECTION_META[a.section] || { icon: "📄", label: a.section, color: "#374151" };
                return (
                  <div key={a.section} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5"
                      style={{ background: `${meta.color}10`, borderBottom: `1px solid ${meta.color}20` }}>
                      <span>{meta.icon}</span>
                      <p className="text-xs font-black uppercase tracking-wide" style={{ color: meta.color }}>
                        {meta.label}
                      </p>
                      {a.filename && (
                        <span className="ml-auto text-[10px] text-gray-400 font-mono truncate max-w-[200px]">
                          {a.filename}
                        </span>
                      )}
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {getText(a.analysis) || "No analysis available."}
                      </p>
                      {(getConfidence(a.analysis) || getSources(a.analysis).length > 0) && (
                        <p className="text-[10px] text-gray-400 mt-2.5 pt-2 border-t border-gray-50">
                          {getConfidence(a.analysis) && <>AI Confidence: <strong>{getConfidence(a.analysis)}</strong></>}
                          {getSources(a.analysis).length > 0 && ` · Sources: ${getSources(a.analysis).slice(0, 3).join(", ")}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Party Status ── */}
        {parties.length > 0 && (
          <section className="mb-7">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
              Party Status
            </h2>
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Role", "Name", "Docs", "Status"].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wide px-4 py-2.5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parties.map((p, i) => {
                    const st = STATUS_STYLE[p.status] || STATUS_STYLE.awaiting;
                    return (
                      <tr key={p.role} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                        <td className="px-4 py-2.5 font-semibold text-gray-700 text-xs">
                          {ROLE_LABELS[p.role] || p.role}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{p.name || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{p.doc_count || 0}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <div className="border-t border-gray-100 pt-5 mt-4">
          <p className="text-[9px] text-gray-300 leading-relaxed mb-4">
            This document was generated automatically by Kontra's AI deal room platform and is intended for internal use only.
            AI-generated analyses are based on uploaded documents and should not be relied upon as the sole basis for any
            investment, lending, or legal decision. All parties should conduct independent due diligence.
            Kontra Platform, Inc. makes no warranties regarding the accuracy or completeness of this summary.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black" style={{ color: "#800020" }}>Kontra</span>
            <span className="text-[10px] text-gray-300">kontraplatform.com · Confidential · {generatedAt}</span>
          </div>
        </div>
      </div>
    </>
  );
}
