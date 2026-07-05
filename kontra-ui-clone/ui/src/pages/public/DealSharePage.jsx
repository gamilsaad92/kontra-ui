import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getWorkflowPack } from "../../lib/workflowPacks";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const TYPE_ICONS = {
  "Multifamily": "🏢", "Office": "🏛️", "Industrial": "🏭",
  "Retail": "🏪", "Mixed-Use": "🏙️", "Hotel / Hospitality": "🏨",
  "Self-Storage": "🗄️", "Land / Development": "🌍",
};

const STAGE_CONFIG = {
  uploading:    { label: "Collecting Documents", color: "#6b7280", bg: "#f3f4f6" },
  under_review: { label: "Under Review",         color: "#b45309", bg: "#fffbeb" },
  approved:     { label: "Approved",             color: "#15803d", bg: "#f0fdf4" },
  closing:      { label: "Closing",              color: "#1d4ed8", bg: "#eff6ff" },
  funded:       { label: "Funded",               color: "#7c3aed", bg: "#f5f3ff" },
};

const SECTION_META = {
  inspection: { icon: "🔍", label: "Property Inspection", color: "#1d4ed8" },
  insurance:  { icon: "🛡️", label: "Insurance Coverage",  color: "#7c3aed" },
  financials: { icon: "📊", label: "Financial Overview",  color: "#15803d" },
};

// Fallback for CRE Acquisition rooms when the pack lookup can't run yet
// (e.g. room hasn't loaded). Kept in sync with getRequiredRoles() below.
const FALLBACK_REQUIRED_ROLES = [
  { role: "lender",    icon: "🏦", label: "Lender" },
  { role: "inspector", icon: "🔍", label: "Inspector" },
  { role: "insurer",   icon: "🛡️", label: "Insurer" },
  { role: "attorney",  icon: "⚖️", label: "Attorney" },
];

// Which roles show in "Due Diligence Status" is pack-driven — each pack's
// `roles` list already marks `required: true` per role, so this reads
// straight from the pack instead of hardcoding CRE role keys.
function getRequiredRoles(workflowPackId) {
  const pack = getWorkflowPack(workflowPackId);
  const required = (pack.roles || [])
    .filter((r) => r.required && r.key !== "owner")
    .map((r) => ({ role: r.key, icon: r.icon, label: r.shortLabel || r.label }));
  return required.length > 0 ? required : FALLBACK_REQUIRED_ROLES;
}

function getText(analysis) {
  if (!analysis) return "";
  if (typeof analysis === "string") return analysis;
  return analysis.summary || analysis.text || "";
}
function getConfidence(analysis) {
  if (!analysis || typeof analysis === "string") return null;
  return analysis.confidence || null;
}

function healthScore(analyses) {
  let score = 60;
  const insp = analyses.find(a => a.section === "inspection");
  const ins  = analyses.find(a => a.section === "insurance");
  const fin  = analyses.find(a => a.section === "financials");
  if (insp) {
    const t = getText(insp.analysis).toLowerCase();
    score += t.includes("good") || t.includes("excellent") ? 15 : t.includes("minor") ? 8 : 0;
    if (t.match(/deferred.*\$[\d,]+/)) score -= 5;
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
    } else score += 10;
  }
  return Math.min(100, Math.max(0, score));
}

function scoreLabel(s) {
  if (s >= 85) return { label: "Low Risk",      color: "#15803d", bg: "#f0fdf4" };
  if (s >= 70) return { label: "Moderate Risk", color: "#b45309", bg: "#fffbeb" };
  if (s >= 50) return { label: "Elevated Risk", color: "#c2410c", bg: "#fff7ed" };
  return               { label: "High Risk",    color: "#b91c1c", bg: "#fef2f2" };
}

function extractMetrics(analyses) {
  const metrics = [];
  const fin  = analyses.find(a => a.section === "financials");
  const ins  = analyses.find(a => a.section === "insurance");
  const insp = analyses.find(a => a.section === "inspection");
  if (fin) {
    const t = getText(fin.analysis);
    const noi  = t.match(/NOI[:\s]*\$?([\d,]+)/i);
    const dscr = t.match(/DSCR[:\s]*([0-9.]+)/i);
    const occ  = t.match(/occupanc[yi][:\s]*([0-9]+)%/i);
    const cap  = t.match(/cap rate[:\s]*([0-9.]+)%/i);
    if (noi)  metrics.push({ label: "NOI",       value: `$${noi[1]}` });
    if (dscr) metrics.push({ label: "DSCR",      value: `${dscr[1]}×` });
    if (occ)  metrics.push({ label: "Occupancy", value: `${occ[1]}%` });
    if (cap)  metrics.push({ label: "Cap Rate",  value: `${cap[1]}%` });
  }
  if (ins) {
    const t = getText(ins.analysis);
    const exp = t.match(/[Ee]xpires?[:\s]*([A-Za-z0-9\-\/]+)/);
    if (exp) metrics.push({ label: "Ins. Expiry", value: exp[1] });
  }
  if (insp) {
    const t = getText(insp.analysis);
    const dm = t.match(/[Dd]eferred[^$]*\$([\d,]+)/);
    if (dm) metrics.push({ label: "Deferred Maint.", value: `$${dm[1]}` });
  }
  return metrics;
}

export default function DealSharePage() {
  const { propertyId } = useParams();
  const [room, setRoom]       = useState(null);
  const [analyses, setAn]     = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [contactSent, setContactSent] = useState(false);

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
    }).catch(() => setError("Failed to load deal package."))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafafa" }}>
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#800020] border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading deal package…</p>
      </div>
    </div>
  );

  if (error || !room) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafafa" }}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Deal package not found</h2>
        <p className="text-gray-500 text-sm mb-5">This deal package may have expired or the link is incorrect.</p>
        <Link to="/" className="text-sm font-semibold underline" style={{ color: "#800020" }}>Back to Kontra →</Link>
      </div>
    </div>
  );

  const score       = healthScore(analyses);
  const scoreCfg    = scoreLabel(score);
  const metrics     = extractMetrics(analyses);
  const stage       = room.deal_stage || "uploading";
  const stageCfg    = STAGE_CONFIG[stage] || STAGE_CONFIG.uploading;
  const submittedSet = new Set(parties.filter(p => p.doc_count > 0 || p.status === "submitted" || p.status === "approved").map(p => p.role));
  const requiredRoles = getRequiredRoles(room.workflow_pack_id);
  const orderedAn   = ["inspection", "insurance", "financials"].map(s => analyses.find(a => a.section === s)).filter(Boolean);
  const completePct = Math.round(orderedAn.length / 3 * 100);

  return (
    <div className="min-h-screen" style={{ background: "#f8f8f8", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Nav strip ── */}
      <div className="border-b border-gray-100 bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-white text-xs font-black px-2 py-1 rounded-lg" style={{ background: "#800020" }}>
              Kontra
            </span>
            <span className="text-xs text-gray-400">Deal Package</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: stageCfg.bg, color: stageCfg.color }}>
              {stageCfg.label}
            </span>
            <a href={`/deal-room/${propertyId}/summary`} target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
              Download PDF
            </a>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="border-b border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-3xl">{TYPE_ICONS[room.property_type] || "🏢"}</span>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{room.property_type || "Commercial"}</p>
                </div>
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-2">
                {room.property_name}
              </h1>
              {room.address && (
                <p className="text-gray-500 text-sm mb-4">{room.address}</p>
              )}
              <div className="flex flex-wrap gap-3">
                {room.deal_amount && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Deal Amount</p>
                    <p className="text-sm font-black text-gray-900">{room.deal_amount}</p>
                  </div>
                )}
                {room.deal_type && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Type</p>
                    <p className="text-sm font-black text-gray-900">{room.deal_type}</p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Package</p>
                  <p className="text-sm font-black text-gray-900">{completePct}% Complete</p>
                </div>
              </div>
            </div>

            {/* Health Score */}
            <div className="shrink-0 flex flex-col items-center p-6 rounded-2xl border-2"
              style={{ borderColor: scoreCfg.color + "30", background: scoreCfg.bg }}>
              <div className="relative w-20 h-20 mb-3">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke={scoreCfg.color}
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 88} 88`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-black" style={{ color: scoreCfg.color }}>{score}</span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Deal Health</p>
              <p className="text-sm font-extrabold" style={{ color: scoreCfg.color }}>{scoreCfg.label}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Key Metrics ── */}
      {metrics.length > 0 && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-6 py-5">
            <div className="flex flex-wrap gap-4">
              {metrics.map(m => (
                <div key={m.label} className="text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{m.label}</p>
                  <p className="text-xl font-black text-gray-900">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left — AI Analyses */}
        <div className="lg:col-span-2 space-y-5">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">AI Document Analysis</h2>

          {orderedAn.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center">
              <p className="text-gray-400 text-sm">Analyses not yet available for this deal.</p>
            </div>
          ) : orderedAn.map(a => {
            const meta = SECTION_META[a.section] || { icon: "📄", label: a.section, color: "#374151" };
            const text = getText(a.analysis);
            const conf = getConfidence(a.analysis);
            return (
              <div key={a.section} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2.5 px-5 py-3.5"
                  style={{ background: `${meta.color}09`, borderBottom: `1px solid ${meta.color}18` }}>
                  <span className="text-lg">{meta.icon}</span>
                  <p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: meta.color }}>
                    {meta.label}
                  </p>
                  {a.filename && (
                    <span className="ml-auto text-[10px] text-gray-400 font-mono truncate max-w-[160px]">
                      {a.filename}
                    </span>
                  )}
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm text-gray-700 leading-relaxed">{text || "No analysis available."}</p>
                  {conf && (
                    <p className="text-[10px] text-gray-400 mt-3 pt-2.5 border-t border-gray-50">
                      AI Confidence: <strong>{conf}</strong>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">

          {/* Party readiness */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Due Diligence Status</h3>
            <div className="space-y-2.5">
              {requiredRoles.map(({ role, icon, label }) => {
                const submitted = submittedSet.has(role);
                const p = parties.find(x => x.role === role);
                const isApproved = p?.status === "approved";
                return (
                  <div key={role} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                      isApproved ? "bg-green-100" : submitted ? "bg-amber-50" : "bg-gray-50"
                    }`}>
                      {isApproved ? "✅" : submitted ? icon : "⏳"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{label}</p>
                      <p className="text-[10px]" style={{ color: isApproved ? "#15803d" : submitted ? "#b45309" : "#9ca3af" }}>
                        {isApproved ? "Approved" : submitted ? `${p?.doc_count || 1} doc${(p?.doc_count||1)>1?"s":""} submitted` : "Awaiting documents"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA card */}
          <div className="rounded-2xl p-5 text-white" style={{ background: "#800020" }}>
            <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">Interested?</p>
            <p className="text-base font-extrabold mb-1">Request to participate</p>
            <p className="text-xs opacity-80 mb-4 leading-relaxed">
              Reply to let the deal coordinator know you're interested. No commitment required.
            </p>
            <a
              href={`mailto:hello@kontraplatform.com?subject=Interest in deal: ${encodeURIComponent(room.property_name || propertyId)}&body=I'm interested in participating in this deal. Please send me more information about ${encodeURIComponent(room.property_name || propertyId)}.`}
              className="block w-full text-center py-2.5 rounded-xl text-sm font-bold bg-white transition hover:bg-gray-50"
              style={{ color: "#800020" }}>
              Express Interest →
            </a>
          </div>

          {/* Package completeness */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Package</p>
              <span className="text-xs font-bold text-gray-700">{orderedAn.length}/3 sections</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${completePct}%`, background: "#800020" }} />
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              {completePct === 100 ? "All sections complete" : `${3 - orderedAn.length} section${3 - orderedAn.length > 1 ? "s" : ""} pending`}
            </p>
          </div>

        </div>
      </div>

      {/* ── Footer — Kontra growth loop ── */}
      <div className="border-t border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-white text-sm font-black px-2.5 py-1.5 rounded-lg" style={{ background: "#800020" }}>
              Kontra
            </span>
            <div>
              <p className="text-sm font-bold text-gray-800">CRE deal room infrastructure</p>
              <p className="text-xs text-gray-400">AI-analyzed documents · All parties in one place</p>
            </div>
          </div>
          <Link to="/create-deal-room"
            className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
            style={{ background: "#800020" }}>
            Create Your Deal Room · $499 →
          </Link>
        </div>
      </div>

    </div>
  );
}
