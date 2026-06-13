import React, { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const PROPERTIES = {
  "harbor-view": {
    id: "harbor-view", name: "Harbor View Apartments", type: "Multifamily", market: "Miami, FL",
    address: "1425 Brickell Ave, Miami, FL 33131", units: 312, sqft: 285000, year: 2019,
    occupancy: 97, noi: 3400000, capRate: 7.1, risk: "Low", riskColor: "#16a34a", score: 93,
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
    dscr: "1.42x", ltv: "58%", debtYield: "8.9%",
    inspectionStatus: "Passed — Jun 2026", insuranceStatus: "Active · Expires Nov 2026",
    complianceItems: 6, compliancePassed: 6,
    highlights: ["97% occupancy (stabilized)", "Recent $4.2M capital improvement", "Walk Score 94", "LEED Silver certified"],
  },
  "meridian-tower": {
    id: "meridian-tower", name: "The Meridian", type: "Office", market: "Dallas, TX",
    address: "2100 McKinney Ave, Dallas, TX 75201", sqft: 185000, year: 2016,
    occupancy: 78, noi: 2100000, capRate: 7.1, risk: "Medium", riskColor: "#d97706", score: 62,
    image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80",
    dscr: "1.18x", ltv: "71%", debtYield: "7.1%",
    inspectionStatus: "Due Soon — Aug 2026", insuranceStatus: "Active · Expires Feb 2027",
    complianceItems: 6, compliancePassed: 4,
    highlights: ["Uptown Dallas submarket", "Lease rollover risk", "Strong building infrastructure"],
  },
  "summit-industrial": {
    id: "summit-industrial", name: "Summit Industrial Park", type: "Industrial", market: "Atlanta, GA",
    address: "7200 Industrial Blvd, Atlanta, GA 30336", sqft: 420000, year: 2017,
    occupancy: 100, noi: 3900000, capRate: 7.2, risk: "Low", riskColor: "#16a34a", score: 95,
    image: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=1200&q=80",
    dscr: "1.55x", ltv: "52%", debtYield: "9.6%",
    inspectionStatus: "Passed — Mar 2026", insuranceStatus: "Active · Expires Jan 2027",
    complianceItems: 6, compliancePassed: 6,
    highlights: ["100% leased — NNN", "36-ft clear height", "BNSF rail access"],
  },
  "westside-commons": {
    id: "westside-commons", name: "Westside Commons", type: "Multifamily", market: "Los Angeles, CA",
    address: "1800 S La Cienega Blvd, Los Angeles, CA 90035", units: 195, sqft: 165000, year: 2018,
    occupancy: 94, noi: 4200000, capRate: 6.8, risk: "Low", riskColor: "#16a34a", score: 88,
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
    dscr: "1.38x", ltv: "61%", debtYield: "8.4%",
    inspectionStatus: "Passed — Apr 2026", insuranceStatus: "Active · Expires Sep 2026",
    complianceItems: 6, compliancePassed: 5,
    highlights: ["LA Metro adjacent", "Ground floor retail", "EV charging"],
  },
};

const ROLE_CONFIG = {
  lender: {
    icon: "🏦", label: "Lender / Underwriter", color: "#800020",
    headline: "You've been invited to review this deal",
    subtext: "As a lender, you have access to the financial package, risk score, compliance status, and AI-analyzed documents.",
    sections: ["financials", "risk", "compliance", "documents"],
  },
  inspector: {
    icon: "🔍", label: "Inspector / Engineer", color: "#d97706",
    headline: "You've been invited to submit your report",
    subtext: "As the inspector, you can submit your inspection report directly into this deal room. Findings will be AI-structured and shared with the lender automatically.",
    sections: ["inspection", "property", "documents"],
  },
  insurer: {
    icon: "🛡️", label: "Insurance Broker", color: "#065f46",
    headline: "You've been invited to provide insurance coverage",
    subtext: "Review any coverage gaps flagged by AI and upload the insurance certificate. Expiration dates are tracked automatically for the lender.",
    sections: ["insurance", "property", "documents"],
  },
  investor: {
    icon: "📊", label: "Investor", color: "#6d28d9",
    headline: "You've been invited to review this investment",
    subtext: "As an investor, you have access to the Investment Readiness Report, financial performance data, and tokenization readiness status.",
    sections: ["financials", "readiness", "risk"],
  },
  servicer: {
    icon: "⚙️", label: "Servicer", color: "#92400e",
    headline: "You've been invited to this servicing deal",
    subtext: "As the servicer, you have access to draw management, borrower financials, escrow status, and covenant tracking.",
    sections: ["financials", "compliance", "documents"],
  },
  attorney: {
    icon: "📜", label: "Attorney / Title", color: "#374151",
    headline: "You've been invited to review the legal package",
    subtext: "Review the legal structure documentation, title history, and compliance checklist for this property.",
    sections: ["compliance", "documents", "property"],
  },
};

function FinancialsPanel({ property }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Financial Overview</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Net Operating Income", value: `$${(property.noi / 1000000).toFixed(1)}M / yr`, color: "#16a34a" },
          { label: "Cap Rate", value: `${property.capRate}%`, color: "#374151" },
          { label: "DSCR", value: property.dscr, color: property.dscr?.startsWith("1.4") || property.dscr?.startsWith("1.5") ? "#16a34a" : "#d97706" },
          { label: "Occupancy", value: `${property.occupancy}%`, color: property.occupancy >= 90 ? "#16a34a" : "#d97706" },
        ].map((m) => (
          <div key={m.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{m.label}</p>
            <p className="text-base font-bold" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "LTV", value: property.ltv },
          { label: "Debt Yield", value: property.debtYield },
        ].map((m) => (
          <div key={m.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{m.label}</p>
            <p className="text-base font-bold text-gray-800">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskPanel({ property }) {
  const score = property.score;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Risk Assessment</p>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0"
          style={{ background: color }}>
          {score}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{property.risk} Risk</p>
          <p className="text-xs text-gray-500">Kontra Property Health Score</p>
          <div className="mt-1.5 h-2 w-32 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
          </div>
        </div>
      </div>
      {[
        { label: "Occupancy", status: property.occupancy >= 90 ? "Strong" : "Watch", ok: property.occupancy >= 90 },
        { label: "DSCR", status: "Above threshold", ok: true },
        { label: "Inspection", status: property.inspectionStatus, ok: !property.inspectionStatus?.includes("Due Soon") },
        { label: "Insurance", status: "Active", ok: true },
      ].map((item) => (
        <div key={item.label} className="flex items-center justify-between py-2 border-t border-gray-100 first:border-t-0">
          <span className="text-xs text-gray-600">{item.label}</span>
          <span className="text-xs font-semibold" style={{ color: item.ok ? "#16a34a" : "#d97706" }}>
            {item.ok ? "✓ " : "⚠ "}{item.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function CompliancePanel({ property }) {
  const pct = Math.round((property.compliancePassed / property.complianceItems) * 100);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Compliance Status</p>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl font-black" style={{ color: pct === 100 ? "#16a34a" : "#d97706" }}>
          {property.compliancePassed}/{property.complianceItems}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Compliance Items Passed</p>
          <div className="mt-1 h-2 w-32 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "#16a34a" : "#d97706" }} />
          </div>
        </div>
      </div>
      {[
        { label: "Insurance Certificate", ok: property.compliancePassed >= 1 },
        { label: "Inspection Report", ok: property.compliancePassed >= 2 },
        { label: "Tax Payment Current", ok: property.compliancePassed >= 3 },
        { label: "Occupancy Covenant", ok: property.compliancePassed >= 4 },
        { label: "Financial Reporting", ok: property.compliancePassed >= 5 },
        { label: "Open Violations", ok: property.compliancePassed >= 6 },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-2 py-1.5 border-t border-gray-100 first:border-t-0">
          <span className={`text-xs ${item.ok ? "text-green-500" : "text-gray-300"}`}>{item.ok ? "✓" : "○"}</span>
          <span className="text-xs text-gray-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function InspectionPanel({ property }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Inspection Status</p>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: property.inspectionStatus?.includes("Passed") ? "#f0fdf4" : "#fffbeb" }}>
          🔍
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{property.inspectionStatus}</p>
          <p className="text-xs text-gray-400">Submit your report to update this status</p>
        </div>
      </div>
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <p className="text-xs font-semibold text-blue-800 mb-1">Sign in to submit your report</p>
        <p className="text-xs text-blue-600 leading-relaxed">Once signed in, you can upload your inspection report directly into this deal room. AI will structure your findings automatically.</p>
      </div>
    </div>
  );
}

function InsurancePanel({ property }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Insurance Status</p>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-green-50">🛡️</div>
        <div>
          <p className="text-sm font-bold text-gray-900">{property.insuranceStatus}</p>
          <p className="text-xs text-gray-400">Coverage status as of last update</p>
        </div>
      </div>
      <div className="space-y-2">
        {[
          { label: "General Liability", status: "Active", ok: true },
          { label: "Property Coverage", status: "Active", ok: true },
          { label: "Flood Rider", status: "Missing", ok: false },
          { label: "Business Interruption", status: "Active", ok: true },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between py-1.5 border-t border-gray-100 first:border-t-0">
            <span className="text-xs text-gray-600">{item.label}</span>
            <span className="text-xs font-semibold" style={{ color: item.ok ? "#16a34a" : "#dc2626" }}>
              {item.ok ? "✓ " : "✗ "}{item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadinessPanel({ property }) {
  const pillars = [
    { icon: "🔍", label: "Physical Condition", done: property.score >= 70 },
    { icon: "🛡️", label: "Insurance Coverage", done: property.compliancePassed >= 1 },
    { icon: "💰", label: "Financial Review", done: true },
    { icon: "✅", label: "Compliance Checklist", done: property.compliancePassed === property.complianceItems },
    { icon: "📜", label: "Legal Structure", done: property.score >= 85 },
  ];
  const done = pillars.filter((p) => p.done).length;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Investment Readiness</p>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl font-black" style={{ color: done >= 4 ? "#16a34a" : "#d97706" }}>{done}/5</div>
        <div>
          <p className="text-sm font-bold text-gray-900">Pillars Verified</p>
          <div className="mt-1 h-2 w-32 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${done * 20}%`, background: done >= 4 ? "#16a34a" : "#d97706" }} />
          </div>
        </div>
      </div>
      {pillars.map((p) => (
        <div key={p.label} className="flex items-center gap-2.5 py-1.5 border-t border-gray-100 first:border-t-0">
          <span className="text-sm">{p.icon}</span>
          <span className="text-xs text-gray-700 flex-1">{p.label}</span>
          <span className="text-xs font-semibold" style={{ color: p.done ? "#16a34a" : "#d97706" }}>
            {p.done ? "Verified ✓" : "Pending"}
          </span>
        </div>
      ))}
    </div>
  );
}

function DocumentsPanel() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Document Package</p>
      {[
        { icon: "📊", name: "Q3 2025 Operating Statement", tag: "Financials", status: "AI Reviewed" },
        { icon: "🔍", name: "Inspection Report — Jun 2026", tag: "Inspection", status: "AI Reviewed" },
        { icon: "🛡️", name: "Insurance Certificate", tag: "Insurance", status: "On File" },
        { icon: "📋", name: "Rent Roll — Jun 2026", tag: "Leasing", status: "AI Reviewed" },
      ].map((doc) => (
        <div key={doc.name} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
          <span className="text-lg">{doc.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{doc.name}</p>
            <p className="text-[10px] text-gray-400">{doc.tag}</p>
          </div>
          <span className="text-[10px] font-semibold text-green-600 shrink-0">{doc.status}</span>
        </div>
      ))}
      <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
        <p className="text-xs text-amber-700">Sign in to download or view full documents.</p>
      </div>
    </div>
  );
}

function PropertyPanel({ property }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Property Details</p>
      {[
        { label: "Address", value: property.address },
        { label: "Type", value: property.type },
        { label: "Year Built", value: property.year },
        { label: "Size", value: property.units ? `${property.units} units` : `${(property.sqft / 1000).toFixed(0)}K SF` },
        { label: "Occupancy", value: `${property.occupancy}%` },
      ].map((item) => (
        <div key={item.label} className="flex items-start justify-between py-2 border-t border-gray-100 first:border-t-0">
          <span className="text-xs text-gray-400">{item.label}</span>
          <span className="text-xs font-medium text-gray-800 text-right max-w-[60%]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DealRoomPage() {
  const { propertyId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "lender";
  const from = searchParams.get("from") || "";
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  async function handleActivate() {
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const res = await fetch(`${API_BASE}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: "deal", propertyId, propertyName: property?.name }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === "Stripe not configured") {
        window.location.href = `mailto:hello@kontraplatform.com?subject=Activate Deal Room — ${property?.name}`;
      } else {
        setCheckoutError(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setCheckoutError("Network error — please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  const property = PROPERTIES[propertyId];
  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.lender;

  const SECTION_MAP = {
    financials: FinancialsPanel,
    risk: RiskPanel,
    compliance: CompliancePanel,
    inspection: InspectionPanel,
    insurance: InsurancePanel,
    readiness: ReadinessPanel,
    documents: DocumentsPanel,
    property: PropertyPanel,
  };

  if (!property) {
    return (
      <PublicLayout>
        <div className="max-w-xl mx-auto px-6 py-24 text-center">
          <div className="text-5xl mb-4">🏢</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Deal room not found</h1>
          <p className="text-gray-500 text-sm mb-6">This link may have expired or the property doesn't exist yet.</p>
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#800020" }}>
            Back to Kontra
          </Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout hideFooter>
      {/* Invite banner */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
              style={{ background: roleConfig.color + "12" }}>
              {roleConfig.icon}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">
                {from ? `${decodeURIComponent(from)} invited you` : "You've been invited"} · <span style={{ color: roleConfig.color }}>{roleConfig.label} view</span>
              </p>
              <p className="text-[10px] text-gray-400">You're viewing a role-scoped deal room — sign in to take action</p>
            </div>
          </div>
          <Link to={`/login?redirect=/deal-room/${propertyId}?role=${role}`}
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: roleConfig.color }}>
            Sign In to Join →
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Property header */}
        <div className="relative rounded-2xl overflow-hidden mb-6 h-40">
          <img src={property.image} alt={property.name}
            className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30 flex items-end p-5">
            <div className="flex-1">
              <p className="text-xs text-white/60 mb-0.5">{property.type} · {property.market}</p>
              <h1 className="text-xl font-bold text-white">{property.name}</h1>
              <p className="text-xs text-white/70">{property.address}</p>
            </div>
            <div className="text-right">
              <div className="px-3 py-1.5 rounded-xl text-xs font-bold text-white mb-1"
                style={{ background: roleConfig.color }}>
                {roleConfig.icon} {roleConfig.label}
              </div>
              <div className="px-2 py-1 rounded-lg text-xs font-bold"
                style={{ background: property.riskColor + "22", color: property.riskColor }}>
                {property.risk} Risk · {property.score}/100
              </div>
            </div>
          </div>
        </div>

        {/* Role headline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6"
          style={{ borderLeftWidth: 4, borderLeftColor: roleConfig.color }}>
          <h2 className="text-base font-bold text-gray-900 mb-1">{roleConfig.headline}</h2>
          <p className="text-sm text-gray-500 leading-relaxed">{roleConfig.subtext}</p>
        </div>

        {/* Role-scoped sections */}
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          {roleConfig.sections.map((sectionKey) => {
            const Panel = SECTION_MAP[sectionKey];
            return Panel ? <Panel key={sectionKey} property={property} /> : null;
          })}
        </div>

        {/* Activate Deal Room CTA */}
        <div className="rounded-2xl overflow-hidden border border-gray-200">
          {/* Top — payment */}
          <div className="px-8 py-8 text-center"
            style={{ background: `linear-gradient(135deg, ${roleConfig.color} 0%, ${roleConfig.color}dd 100%)` }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">One-time deal fee</p>
            <div className="text-4xl font-black text-white mb-1">$499</div>
            <p className="text-sm text-white/80 mb-5">Activates the full deal room for all parties on this property</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl mx-auto mb-6">
              {[
                "All-party deal room",
                "AI document analysis",
                "Role-scoped access",
                "Compliance tracking",
              ].map((f) => (
                <div key={f} className="bg-white/10 rounded-xl px-3 py-2 text-xs text-white/90 font-medium">{f}</div>
              ))}
            </div>
            <button
              onClick={handleActivate}
              disabled={checkoutLoading}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold bg-white transition hover:opacity-90 disabled:opacity-60"
              style={{ color: roleConfig.color }}>
              {checkoutLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Preparing checkout…
                </>
              ) : (
                "Activate Deal Room — $499 →"
              )}
            </button>
            {checkoutError && (
              <p className="text-xs text-red-200 mt-3">{checkoutError}</p>
            )}
            <p className="text-xs text-white/40 mt-3">Secure checkout via Stripe · One-time fee · No subscription</p>
          </div>

          {/* Bottom — free account option */}
          <div className="bg-gray-50 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-800">Already have access?</p>
              <p className="text-xs text-gray-400">Sign in to view your full deal room and take action</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link to={`/login?redirect=/deal-room/${propertyId}?role=${role}`}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: roleConfig.color }}>
                Sign In →
              </Link>
              <Link to={`/login?redirect=/deal-room/${propertyId}?role=${role}`}
                className="px-5 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-100 transition">
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
