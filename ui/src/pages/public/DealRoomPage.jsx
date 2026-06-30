import React, { useState, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import PublicLayout from "./PublicLayout";

function usePageTitle(title) {
  useEffect(() => {
    const prev = document.title;
    if (title) document.title = `${title} — Kontra Deal Room`;
    return () => { document.title = prev; };
  }, [title]);
}

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

// ── Demo properties (hardcoded) ──────────────────────────────────────────────
const DEMO_PROPERTIES = {
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

// ── Generate realistic sample data for newly created deal rooms ──────────────
function generateDemoData(apiProp) {
  const amount = parseFloat((apiProp.deal_amount || "").replace(/[^0-9.]/g, "")) || 5000000;
  const type = apiProp.property_type || "Multifamily";

  // Type-based defaults
  const defaults = {
    "Multifamily":         { capRate: 6.8, occupancy: 94, dscr: "1.38x", ltv: "61%", debtYield: "8.4%", score: 88, risk: "Low",    riskColor: "#16a34a", units: Math.round(amount / 180000) },
    "Office":              { capRate: 7.2, occupancy: 82, dscr: "1.22x", ltv: "68%", debtYield: "7.8%", score: 65, risk: "Medium", riskColor: "#d97706", units: null },
    "Industrial":          { capRate: 6.5, occupancy: 97, dscr: "1.48x", ltv: "55%", debtYield: "9.2%", score: 92, risk: "Low",    riskColor: "#16a34a", units: null },
    "Retail":              { capRate: 7.5, occupancy: 88, dscr: "1.28x", ltv: "63%", debtYield: "8.1%", score: 74, risk: "Low",    riskColor: "#16a34a", units: null },
    "Mixed-Use":           { capRate: 7.0, occupancy: 91, dscr: "1.32x", ltv: "64%", debtYield: "8.0%", score: 79, risk: "Low",    riskColor: "#16a34a", units: null },
    "Hotel / Hospitality": { capRate: 8.1, occupancy: 76, dscr: "1.18x", ltv: "70%", debtYield: "7.2%", score: 61, risk: "Medium", riskColor: "#d97706", units: null },
    "Self-Storage":        { capRate: 6.2, occupancy: 93, dscr: "1.44x", ltv: "58%", debtYield: "8.8%", score: 85, risk: "Low",    riskColor: "#16a34a", units: null },
    "Land / Development":  { capRate: 5.5, occupancy: 0,  dscr: "N/A",   ltv: "60%", debtYield: "N/A",  score: 58, risk: "Medium", riskColor: "#d97706", units: null },
  };
  const d = defaults[type] || defaults["Multifamily"];
  const noi = Math.round(amount * (d.capRate / 100) / 50000) * 50000;
  const today = new Date();
  const inspMonth = today.toLocaleString("default", { month: "short" }) + " " + today.getFullYear();
  const insExpiry = new Date(today.setMonth(today.getMonth() + 14)).toLocaleString("default", { month: "short", year: "numeric" });

  return {
    noi,
    capRate: d.capRate,
    occupancy: d.occupancy,
    dscr: d.dscr,
    ltv: d.ltv,
    debtYield: d.debtYield,
    score: d.score,
    risk: d.risk,
    riskColor: d.riskColor,
    inspectionStatus: `Passed — ${inspMonth}`,
    insuranceStatus: `Active · Expires ${insExpiry}`,
    complianceItems: 6,
    compliancePassed: d.score >= 80 ? 6 : 4,
    highlights: [],
    units: d.units,
  };
}

// Images by property type for custom deal rooms
const TYPE_IMAGES = {
  "Multifamily":         "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
  "Office":              "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80",
  "Industrial":          "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=1200&q=80",
  "Retail":              "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80",
  "Mixed-Use":           "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80",
  "Hotel / Hospitality": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80",
  "Self-Storage":        "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=1200&q=80",
  "Land / Development":  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80",
};
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80";

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
    subtext: "As an investor, you have access to the Investment Readiness Report, financial performance data, and status.",
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
  owner: {
    icon: "🏢", label: "Property Owner", color: "#800020",
    headline: "Welcome to your deal room",
    subtext: "As the property owner, you have a full view of all parties, documents, compliance status, and deal progress. Share the role-specific links below to invite each party.",
    sections: ["financials", "risk", "compliance", "documents", "property"],
  },
  borrower: {
    icon: "🤝", label: "Borrower / Sponsor", color: "#1d4ed8",
    headline: "You've been invited to this deal room",
    subtext: "As the borrower, you can view the deal structure, track compliance requirements, upload financial documents, and monitor deal progress in real time.",
    sections: ["financials", "compliance", "documents", "property"],
  },
  broker: {
    icon: "🏷️", label: "Broker", color: "#7c3aed",
    headline: "You've been invited to coordinate this deal",
    subtext: "As the broker, you have visibility across all deal parties. Track document status, compliance milestones, and share role-scoped links with each party.",
    sections: ["financials", "risk", "compliance", "documents", "property"],
  },
};

// ── Panels for demo (data-rich) deal rooms ───────────────────────────────────
function FinancialsPanel({ property }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Financial Overview</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Net Operating Income", value: `$${(property.noi / 1000000).toFixed(1)}M / yr`, color: "#16a34a" },
          { label: "Cap Rate", value: `${property.capRate}%`, color: "#374151" },
          { label: "DSCR", value: property.dscr, color: "#16a34a" },
          { label: "Occupancy", value: `${property.occupancy}%`, color: property.occupancy >= 90 ? "#16a34a" : "#d97706" },
        ].map((m) => (
          <div key={m.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{m.label}</p>
            <p className="text-base font-bold" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[{ label: "LTV", value: property.ltv }, { label: "Debt Yield", value: property.debtYield }].map((m) => (
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
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0" style={{ background: color }}>{score}</div>
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
          <span className="text-xs font-semibold" style={{ color: item.ok ? "#16a34a" : "#d97706" }}>{item.ok ? "✓ " : "⚠ "}{item.status}</span>
        </div>
      ))}
    </div>
  );
}

function CompliancePanel({ property }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Compliance Status</p>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl font-black" style={{ color: property.compliancePassed === property.complianceItems ? "#16a34a" : "#d97706" }}>
          {property.compliancePassed}/{property.complianceItems}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Items Verified</p>
          <div className="mt-1 h-2 w-32 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(property.compliancePassed / property.complianceItems) * 100}%`, background: "#16a34a" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InspectionPanel({ property }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Inspection Status</p>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl">🔍</div>
        <div>
          <p className="text-sm font-bold text-gray-900">{property.inspectionStatus}</p>
          <p className="text-xs text-gray-400">Submit your report to update this status</p>
        </div>
      </div>
    </div>
  );
}

function InsurancePanel({ property }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Insurance Status</p>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl">🛡️</div>
        <div>
          <p className="text-sm font-bold text-gray-900">{property.insuranceStatus}</p>
          <p className="text-xs text-gray-400">Coverage status as of last update</p>
        </div>
      </div>
    </div>
  );
}

function ReadinessPanel({ property }) {
  const pillars = [
    { icon: "🔍", label: "Physical Condition", done: property.score >= 70 },
    { icon: "🛡️", label: "Insurance Coverage", done: true },
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
          <span className="text-xs font-semibold" style={{ color: p.done ? "#16a34a" : "#d97706" }}>{p.done ? "Verified ✓" : "Pending"}</span>
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
        { label: "Size", value: property.units ? `${property.units} units` : `${((property.sqft || 0) / 1000).toFixed(0)}K SF` },
        { label: "Occupancy", value: property.occupancy ? `${property.occupancy}%` : "—" },
      ].filter(i => i.value).map((item) => (
        <div key={item.label} className="flex items-start justify-between py-2 border-t border-gray-100 first:border-t-0">
          <span className="text-xs text-gray-400">{item.label}</span>
          <span className="text-xs font-medium text-gray-800 text-right max-w-[60%]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Investment Readiness summary bar (demo rooms) ────────────────────────────
function ReadinessSummaryBar({ property }) {
  const pillars = [
    { icon: "🔍", label: "Physical", done: property.score >= 70 },
    { icon: "🛡️", label: "Insurance", done: true },
    { icon: "💰", label: "Financial", done: true },
    { icon: "✅", label: "Compliance", done: property.compliancePassed === property.complianceItems },
    { icon: "📜", label: "Legal", done: property.score >= 85 },
  ];
  const done = pillars.filter((p) => p.done).length;
  const pct = done * 20;
  const color = done >= 4 ? "#16a34a" : done >= 3 ? "#d97706" : "#dc2626";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Investment Readiness</p>
          <p className="text-base font-bold text-gray-900 mt-0.5">
            <span style={{ color }}>{done}/5 pillars verified</span>
            <span className="text-sm font-medium text-gray-400 ml-2">
              {done >= 5 ? "— Investment-Ready ✓" : done >= 4 ? "— Near complete" : "— In progress"}
            </span>
          </p>
        </div>
        <div className="text-3xl font-black" style={{ color }}>{pct}%</div>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex gap-2">
        {pillars.map((p) => (
          <div key={p.label}
            className="flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-center"
            style={{ background: p.done ? color + "10" : "#f3f4f6" }}>
            <span className="text-base">{p.icon}</span>
            <span className="text-[10px] font-medium" style={{ color: p.done ? color : "#9ca3af" }}>{p.label}</span>
            <span className="text-[9px] font-bold" style={{ color: p.done ? color : "#d1d5db" }}>
              {p.done ? "✓" : "pending"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity feed (demo rooms) ────────────────────────────────────────────────
function ActivityFeedPanel({ property }) {
  const activities = [
    { icon: "🤖", text: `AI analyzed inspection report — ${property.compliancePassed >= 5 ? "3 findings, all resolved" : "2 open items flagged"}`, time: "2m ago", color: "#800020" },
    { icon: "📊", text: "Operating statement reviewed — DSCR calculated", time: "14m ago", color: "#1e40af" },
    { icon: "🔍", text: `Inspection report submitted by inspector`, time: "1h ago", color: "#d97706" },
    { icon: "🛡️", text: "Insurance certificate uploaded and verified", time: "3h ago", color: "#065f46" },
    { icon: "🏦", text: "Lender viewed financial package", time: "5h ago", color: "#800020" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Recent Activity</p>
      <div className="space-y-0">
        {activities.map((a, i) => (
          <div key={i} className="flex items-start gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5"
              style={{ background: a.color + "12" }}>
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 leading-relaxed">{a.text}</p>
            </div>
            <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Panels for custom (pending) deal rooms ───────────────────────────────────
function PendingPanel({ title, icon, description }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">{title}</p>
      <div className="text-center py-6">
        <div className="text-3xl mb-2">{icon}</div>
        <p className="text-sm font-semibold text-gray-500 mb-1">Awaiting upload</p>
        <p className="text-xs text-gray-400 max-w-xs mx-auto">{description}</p>
      </div>
    </div>
  );
}

function PendingPropertyPanel({ property }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Property Details</p>
      {[
        { label: "Address", value: property.address },
        { label: "Type", value: property.property_type },
        { label: "Size", value: property.property_size },
        { label: "Deal Type", value: property.deal_type ? property.deal_type.replace(/^\w/, c => c.toUpperCase()) : null },
        { label: "Deal Size", value: property.deal_amount },
      ].filter(i => i.value).map((item) => (
        <div key={item.label} className="flex items-start justify-between py-2 border-t border-gray-100 first:border-t-0">
          <span className="text-xs text-gray-400">{item.label}</span>
          <span className="text-xs font-medium text-gray-800 text-right max-w-[60%]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Reusable upload + AI analyze panel ────────────────────────────────────
function UploadAnalyzePanel({ title, icon, endpoint, accept, uploadLabel, hint, formatResult, propertyId, role, onAnalysisSaved }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStatus("uploading");
    setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (propertyId) fd.append("property_id", propertyId);
      if (role) fd.append("role", role);
      const res = await fetch(`${API_BASE}${endpoint}`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);
      setResult(json.analysis);
      setStatus("done");
      if (onAnalysisSaved) onAnalysisSaved();
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
    e.target.value = "";
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">{title}</p>

      {status === "idle" && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">{icon}</div>
          <p className="text-sm font-semibold text-gray-700 mb-1">{uploadLabel}</p>
          {hint && <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">{hint}</p>}
          <button onClick={() => inputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: "#800020" }}>
            Choose File →
          </button>
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
        </div>
      )}

      {status === "uploading" && (
        <div className="text-center py-8">
          <svg className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "#800020" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-sm font-semibold text-gray-700">Analyzing with GPT-4o…</p>
          <p className="text-xs text-gray-400 mt-1 truncate max-w-[200px] mx-auto">{fileName}</p>
        </div>
      )}

      {status === "done" && result && (
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ AI Analysis Complete</span>
            <span className="text-xs text-gray-400 truncate max-w-[160px]">{fileName}</span>
          </div>
          {formatResult(result)}
          <button onClick={() => { setStatus("idle"); setResult(null); setFileName(""); }}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline block">
            Upload another document
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="text-center py-6">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="text-sm font-semibold text-red-700 mb-1">Analysis failed</p>
          <p className="text-xs text-red-400 mb-4 max-w-xs mx-auto">{errorMsg}</p>
          <button onClick={() => setStatus("idle")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90"
            style={{ background: "#800020" }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, value, highlight }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-1.5 border-t border-gray-100 first:border-t-0 gap-2">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-right ${highlight ? "text-red-700" : "text-gray-800"}`}>{value}</span>
    </div>
  );
}

function ResultList({ label, items, highlight }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <ul className="space-y-1">
        {items.slice(0, 4).map((item, i) => (
          <li key={i} className={`text-xs rounded-lg px-3 py-1.5 ${highlight ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-700"}`}>
            {typeof item === "string" ? item : item.item || item.action || item.gap || JSON.stringify(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InspectionUploadPanel({ propertyId, role, onAnalysisSaved }) {
  return (
    <UploadAnalyzePanel
      title="Inspection Status" icon="🔍"
      endpoint="/api/ai/analyze-inspection"
      accept=".pdf,.doc,.docx,.xlsx,.xls,.xlsm,.xlsb,.csv"
      uploadLabel="Upload Inspection Report"
      hint="PDF, DOCX, or Excel — AI extracts condition, life-safety findings, and deferred maintenance costs"
      propertyId={propertyId} role={role} onAnalysisSaved={onAnalysisSaved}
      formatResult={(a) => (
        <div>
          <ResultRow label="Condition" value={a.overallCondition} />
          <ResultRow label="Score" value={a.score != null ? `${a.score}/100` : null} />
          <ResultRow label="Deferred Cost" value={a.totalDeferredCost} highlight={!!a.totalDeferredCost} />
          <ResultRow label="Life Safety" value={a.lifeSafetyFindings?.length ? `${a.lifeSafetyFindings.length} finding(s)` : "None flagged"} highlight={a.lifeSafetyFindings?.length > 0} />
          <ResultList label="Priority Actions" items={a.priorityActions?.map(p => p.action || p)} />
          {a.summary && <p className="text-xs text-gray-500 mt-3 italic border-t border-gray-100 pt-2">{a.summary.slice(0, 180)}{a.summary.length > 180 ? "…" : ""}</p>}
        </div>
      )}
    />
  );
}

function InsuranceUploadPanel({ propertyId, role, onAnalysisSaved }) {
  return (
    <UploadAnalyzePanel
      title="Insurance Status" icon="🛡️"
      endpoint="/api/ai/review-insurance"
      accept=".pdf,.doc,.docx"
      uploadLabel="Upload Insurance Certificate"
      hint="PDF — AI reviews coverage amounts, flags gaps, and tracks expiration dates"
      propertyId={propertyId} role={role} onAnalysisSaved={onAnalysisSaved}
      formatResult={(a) => (
        <div>
          <ResultRow label="Status" value={a.complianceStatus} highlight={a.complianceStatus === "Non-Compliant"} />
          <ResultRow label="Coverage" value={a.coverageAmount} />
          <ResultRow label="Expires" value={a.expiresInDays != null ? `${a.expiresInDays} days` : null} highlight={a.expiresInDays != null && a.expiresInDays < 45} />
          <ResultRow label="Insurer" value={a.insurer} />
          <ResultList label="Coverage Gaps" items={a.coverageGaps?.map(g => g.gap || g)} highlight />
          {a.summary && <p className="text-xs text-gray-500 mt-3 italic border-t border-gray-100 pt-2">{a.summary.slice(0, 180)}{a.summary.length > 180 ? "…" : ""}</p>}
        </div>
      )}
    />
  );
}

function FinancialsUploadPanel({ propertyId, role, onAnalysisSaved }) {
  return (
    <UploadAnalyzePanel
      title="Financial Overview" icon="📊"
      endpoint="/api/ai/review-financials"
      accept=".pdf,.doc,.docx,.xlsx,.xls,.xlsm,.xlsb,.csv"
      uploadLabel="Upload Operating Statement or Rent Roll"
      hint="PDF, Excel, or CSV — AI extracts NOI, DSCR, occupancy, and flags anomalies"
      propertyId={propertyId} role={role} onAnalysisSaved={onAnalysisSaved}
      formatResult={(a) => (
        <div>
          <ResultRow label="NOI" value={a.noi} />
          <ResultRow label="Occupancy" value={a.occupancy} />
          <ResultRow label="DSCR" value={a.dscr} />
          <ResultRow label="Revenue" value={a.revenue} />
          <ResultRow label="Expenses" value={a.expenses} />
          <ResultRow label="Covenants" value={a.covenantStatus} highlight={a.covenantStatus === "Breached" || a.covenantStatus === "At Risk"} />
          <ResultList label="Anomalies Flagged" items={a.anomalies?.map(x => `${x.item} — ${x.description}`)} highlight />
          <ResultList label="Trends" items={a.trends} />
          {a.summary && <p className="text-xs text-gray-500 mt-3 italic border-t border-gray-100 pt-2">{a.summary.slice(0, 180)}{a.summary.length > 180 ? "…" : ""}</p>}
        </div>
      )}
    />
  );
}

function RiskUploadPanel({ property }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    propertyName: property?.property_name || property?.name || "",
    propertyType: property?.property_type || "Multifamily",
    address: property?.address || "",
    units: "", askingPrice: "", capRate: "", occupancy: "",
  });

  const types = ["Multifamily", "Office", "Retail", "Industrial", "Mixed-Use", "Hospitality", "Self-Storage", "Other"];

  async function handleScore() {
    setStatus("loading"); setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/ai/score-property`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, units: Number(form.units) || undefined, askingPrice: Number(form.askingPrice) || undefined, capRate: Number(form.capRate) || undefined, occupancy: Number(form.occupancy) || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);
      setResult(json.analysis); setStatus("done");
    } catch (err) { setErrorMsg(err.message); setStatus("error"); }
  }

  const riskColor = { Low: "#16a34a", Medium: "#d97706", High: "#dc2626", "Very High": "#9b1c1c" };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Risk Assessment</p>

      {(status === "idle" || status === "error") && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Property Name</label>
              <input value={form.propertyName} onChange={e => setForm(f => ({ ...f, propertyName: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-800" placeholder="123 Main St" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Property Type</label>
              <select value={form.propertyType} onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-800 bg-white">
                {types.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Units / Sq Ft</label>
              <input value={form.units} onChange={e => setForm(f => ({ ...f, units: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-800" placeholder="e.g. 48" type="number" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Asking Price ($)</label>
              <input value={form.askingPrice} onChange={e => setForm(f => ({ ...f, askingPrice: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-800" placeholder="e.g. 4500000" type="number" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Cap Rate (%)</label>
              <input value={form.capRate} onChange={e => setForm(f => ({ ...f, capRate: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-800" placeholder="e.g. 5.8" type="number" step="0.1" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Occupancy (%)</label>
              <input value={form.occupancy} onChange={e => setForm(f => ({ ...f, occupancy: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-800" placeholder="e.g. 92" type="number" />
            </div>
          </div>
          {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
          <button onClick={handleScore} disabled={!form.propertyName}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "#800020" }}>
            ⚡ Generate Risk Score
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="text-center py-8">
          <svg className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "#800020" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-sm font-semibold text-gray-700">Scoring with GPT-4o…</p>
        </div>
      )}

      {status === "done" && result && (
        <div>
          <div className="text-center py-4 rounded-xl mb-4" style={{ background: (riskColor[result.riskLevel] || "#800020") + "11" }}>
            <div className="text-4xl font-black mb-1" style={{ color: riskColor[result.riskLevel] || "#800020" }}>{result.score}/100</div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: riskColor[result.riskLevel] || "#800020" }}>{result.riskLevel} Risk</div>
          </div>
          {result.scoreBreakdown && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {Object.entries(result.scoreBreakdown).map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <div className="text-sm font-bold text-gray-800">{v}</div>
                  <div className="text-[10px] text-gray-400 capitalize">{k}</div>
                </div>
              ))}
            </div>
          )}
          <ResultList label="Strengths" items={result.strengths} />
          <ResultList label="Risks" items={result.risks} highlight />
          {result.summary && <p className="text-xs text-gray-500 mt-3 italic border-t border-gray-100 pt-2">{result.summary.slice(0, 180)}{result.summary.length > 180 ? "…" : ""}</p>}
          <button onClick={() => { setStatus("idle"); setResult(null); }} className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline block">Score another property</button>
        </div>
      )}
    </div>
  );
}

function DocumentsUploadPanel() {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setTimeout(() => {
      setDocs(prev => [
        ...files.map(f => ({
          name: f.name, size: (f.size / 1024).toFixed(0) + " KB",
          type: f.name.match(/\.pdf$/i) ? "PDF" : f.name.match(/\.xlsx?$/i) ? "Excel" : f.name.match(/\.docx?$/i) ? "Word" : "File",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        })),
        ...prev,
      ]);
      setUploading(false);
    }, 800);
    e.target.value = "";
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Document Package</p>
        {docs.length > 0 && (
          <button onClick={() => inputRef.current?.click()}
            className="text-xs font-bold text-white px-3 py-1.5 rounded-lg hover:opacity-90"
            style={{ background: "#800020" }}>
            + Add
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFiles} />

      {docs.length === 0 && !uploading && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Upload Deal Documents</p>
          <p className="text-xs text-gray-400 mb-4">Leases, rent rolls, loan agreements, title reports — any deal file</p>
          <button onClick={() => inputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: "#800020" }}>
            Choose Files →
          </button>
        </div>
      )}

      {uploading && (
        <div className="text-center py-4">
          <svg className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: "#800020" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-xs text-gray-500">Uploading…</p>
        </div>
      )}

      {docs.length > 0 && !uploading && (
        <ul className="space-y-2">
          {docs.map((d, i) => (
            <li key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50">
              <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-base shrink-0">
                {d.type === "PDF" ? "📋" : d.type === "Excel" ? "📊" : d.type === "Word" ? "📝" : "📄"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{d.name}</p>
                <p className="text-[10px] text-gray-400">{d.type} · {d.size} · {d.time}</p>
              </div>
              <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full shrink-0">Uploaded</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Deal Intelligence Dashboard — shows all saved AI analyses ─────────────
function DealIntelligenceDashboard({ propertyId, refreshKey }) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`)
      .then(r => r.ok ? r.json() : { analyses: [] })
      .then(d => { setAnalyses(d.analyses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId, refreshKey]);

  const SECTIONS = [
    { key: "inspection", icon: "🔍", label: "Inspection",  color: "#d97706" },
    { key: "insurance",  icon: "🛡️", label: "Insurance",   color: "#2563eb" },
    { key: "financials", icon: "📊", label: "Financials",  color: "#16a34a" },
  ];

  // Latest per section
  const bySection = {};
  for (const a of analyses) {
    if (!bySection[a.section]) bySection[a.section] = a;
  }

  const doneCount = Object.keys(bySection).length;

  function getBadge(section, analysis) {
    if (section === "inspection")  return { label: analysis.overallCondition, color: analysis.overallCondition === "Good" ? "#16a34a" : analysis.overallCondition === "Fair" ? "#d97706" : "#dc2626" };
    if (section === "insurance")   return { label: analysis.complianceStatus, color: analysis.complianceStatus === "Compliant" ? "#16a34a" : "#d97706" };
    if (section === "financials")  return { label: analysis.covenantStatus, color: analysis.covenantStatus === "Compliant" ? "#16a34a" : analysis.covenantStatus === "At Risk" ? "#d97706" : analysis.covenantStatus === "Breached" ? "#dc2626" : "#6b7280" };
    return null;
  }

  function getHighlight(section, analysis) {
    if (section === "inspection")  return analysis.totalDeferredCost ? `Deferred maintenance: ${analysis.totalDeferredCost}` : null;
    if (section === "insurance")   return analysis.expirationDate ? `Expires: ${analysis.expirationDate}${analysis.expiresInDays != null ? ` (${analysis.expiresInDays} days)` : ""}` : null;
    if (section === "financials")  return analysis.noi ? `NOI: ${analysis.noi}${analysis.dscr ? ` · DSCR: ${analysis.dscr}` : ""}` : null;
    return null;
  }

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 animate-pulse">
      <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
      <div className="h-16 bg-gray-50 rounded-xl" />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Deal Intelligence</p>
          <p className="text-base font-bold text-gray-900 mt-0.5">
            {doneCount === 0 ? "Waiting for documents" : `${doneCount}/3 sections analyzed`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doneCount > 0 && (
            <button onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">
              🖨 Print Summary
            </button>
          )}
          <div className="text-2xl font-black" style={{ color: doneCount === 3 ? "#16a34a" : doneCount >= 1 ? "#d97706" : "#9ca3af" }}>
            {Math.round(doneCount / 3 * 100)}%
          </div>
        </div>
      </div>

      {/* Readiness bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.round(doneCount / 3 * 100)}%`, background: doneCount === 3 ? "#16a34a" : "#d97706" }} />
      </div>

      <div className="space-y-2.5">
        {SECTIONS.map(({ key, icon, label, color }) => {
          const a = bySection[key];
          if (!a) return (
            <div key={key} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-lg">{icon}</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-400">{label}</p>
                <p className="text-[10px] text-gray-300">Awaiting upload</p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Pending</span>
            </div>
          );
          const badge = getBadge(key, a.analysis);
          const highlight = getHighlight(key, a.analysis);
          return (
            <div key={key} className="px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{icon}</span>
                  <p className="text-xs font-bold text-gray-800">{label}</p>
                  <span className="text-[10px] text-gray-400 truncate hidden sm:block">{a.filename}</span>
                </div>
                {badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2"
                    style={{ background: badge.color + "18", color: badge.color }}>
                    {badge.label}
                  </span>
                )}
              </div>
              {a.analysis.summary && (
                <p className="text-xs text-gray-600 leading-relaxed mt-1">
                  {a.analysis.summary.slice(0, 200)}{a.analysis.summary.length > 200 ? "…" : ""}
                </p>
              )}
              {highlight && (
                <p className="text-xs font-semibold mt-1" style={{ color }}>{highlight}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-1.5">
                Uploaded by {a.uploaded_by_role} · {new Date(a.created_at).toLocaleDateString()}
              </p>
            </div>
          );
        })}
      </div>

      {doneCount === 3 && (
        <div className="mt-4 p-3 rounded-xl bg-green-50 border border-green-100">
          <p className="text-xs font-semibold text-green-800">✓ Deal room fully populated — ready to share with your lender</p>
          <p className="text-[10px] text-green-600 mt-0.5">All three key sections have been analyzed. Use the invite links below to send the lender their view.</p>
        </div>
      )}
    </div>
  );
}

// Build pending section map based on role
function buildPendingSectionMap(property, role, onAnalysisSaved) {
  const pid = property?.id || property?.property_id;
  return {
    financials: () => <FinancialsUploadPanel propertyId={pid} role={role} onAnalysisSaved={onAnalysisSaved} />,
    risk:       () => <RiskUploadPanel property={property} />,
    compliance: () => <PendingPanel title="Compliance Status" icon="✅" description="Compliance checklist will populate as documents are reviewed and parties complete their submissions." />,
    inspection: () => <InspectionUploadPanel propertyId={pid} role={role} onAnalysisSaved={onAnalysisSaved} />,
    insurance:  () => <InsuranceUploadPanel propertyId={pid} role={role} onAnalysisSaved={onAnalysisSaved} />,
    readiness:  () => <PendingPanel title="Investment Readiness" icon="🏅" description="All 5 readiness pillars will be tracked as parties submit their documentation." />,
    documents:  () => <DocumentsUploadPanel />,
    property:   () => <PendingPropertyPanel property={property} />,
  };
}

export default function DealRoomPage() {
  const { propertyId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "lender";
  const from = searchParams.get("from") || "";

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [apiProperty, setApiProperty] = useState(null);
  const [loadingApi, setLoadingApi] = useState(true);
  const [analysesRefreshKey, setAnalysesRefreshKey] = useState(0);

  const onAnalysisSaved = () => setAnalysesRefreshKey(k => k + 1);

  // Try to fetch custom deal room from API
  useEffect(() => {
    // Skip API fetch for demo rooms
    if (DEMO_PROPERTIES[propertyId]) {
      setLoadingApi(false);
      return;
    }
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setApiProperty(data); setLoadingApi(false); })
      .catch(() => setLoadingApi(false));
  }, [propertyId]);

  async function handleActivate() {
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const property = DEMO_PROPERTIES[propertyId] || apiProperty;
      const res = await fetch(`${API_BASE}/api/checkout/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "deal", propertyId, propertyName: property?.property_name || property?.name, role }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === "Stripe not configured") {
        window.location.href = `mailto:hello@kontraplatform.com?subject=Activate Deal Room — ${propertyId}`;
      } else {
        setCheckoutError(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setCheckoutError("Network error — please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  // Resolve property: demo first, then API, then derive from slug
  const demoProperty = DEMO_PROPERTIES[propertyId];
  const isCustom = !demoProperty;

  // Build display property object
  let property = demoProperty;
  if (!property && apiProperty) {
    const sample = generateDemoData(apiProperty);
    property = {
      ...apiProperty,
      ...sample,
      name: apiProperty.property_name,
      type: apiProperty.property_type || "Commercial",
      market: apiProperty.address?.split(",").slice(-2).join(",").trim() || "",
      image: TYPE_IMAGES[apiProperty.property_type] || DEFAULT_IMAGE,
      isCustom: true,
    };
  } else if (!property && !loadingApi) {
    const derivedName = propertyId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const sample = generateDemoData({ property_type: "Multifamily", deal_amount: "" });
    property = {
      ...sample,
      id: propertyId,
      name: derivedName,
      type: "Commercial", market: "",
      address: "", image: DEFAULT_IMAGE,
      isCustom: true,
      property_type: "", property_size: "", deal_type: "", deal_amount: "",
    };
  }

  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.lender;

  const isDemo = propertyId === 'kontra-demo';
  if (isDemo && property) {
    property.image = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80";
    property.market = property.market || "Austin, TX";
    property.name = property.name || "The Meridian Apartments";
  }

  usePageTitle(property?.name || property?.property_name);

  // Loading state
  if (loadingApi && isCustom) {
    return (
      <PublicLayout hideFooter>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-red-800 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading deal room…</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // Shouldn't hit this since we fall back to derived name, but just in case
  if (!property) {
    return (
      <PublicLayout>
        <div className="max-w-xl mx-auto px-6 py-24 text-center">
          <div className="text-5xl mb-4">🏢</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Deal room not found</h1>
          <p className="text-gray-500 text-sm mb-6">This link may have expired or the property ID is incorrect.</p>
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#800020" }}>Back to Kontra</Link>
        </div>
      </PublicLayout>
    );
  }

  const SECTION_MAP = property.isCustom
    ? buildPendingSectionMap(property, role, onAnalysisSaved)
    : {
        financials: () => <FinancialsPanel property={property} />,
        risk:       () => <RiskPanel property={property} />,
        compliance: () => <CompliancePanel property={property} />,
        inspection: () => <InspectionPanel property={property} />,
        insurance:  () => <InsurancePanel property={property} />,
        readiness:  () => <ReadinessPanel property={property} />,
        documents:  () => <DocumentsPanel />,
        property:   () => <PropertyPanel property={property} />,
      };

  return (
    <PublicLayout hideFooter>
      {/* Top bar — demo banner | owner (custom rooms) | invite (demo rooms) */}
      {isDemo ? (
        <div className="border-b border-indigo-100 px-6 py-3" style={{ background: "linear-gradient(90deg, #1e1b4b 0%, #312e81 100%)" }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-bold text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE DEMO
              </span>
              <div>
                <p className="text-xs font-semibold text-white">The Meridian Apartments — $14M Acquisition</p>
                <p className="text-[10px] text-white/50">Explore a real Kontra deal room · Read-only · No signup required</p>
              </div>
            </div>
            <Link to="/create-deal-room"
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-indigo-900 bg-white hover:opacity-90 transition whitespace-nowrap">
              Create Your Deal Room →
            </Link>
          </div>
        </div>
      ) : property.isCustom ? (
        <div className="border-b border-green-100 bg-green-50 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0 bg-green-100">
                🔑
              </div>
              <div>
                <p className="text-xs font-semibold text-green-900">Deal room active — upload documents below</p>
                <p className="text-[10px] text-green-600">No sign-in required · AI analyzes each file as it's uploaded</p>
              </div>
            </div>
            <span className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-green-700 bg-green-100">
              ✓ Paid & Active
            </span>
          </div>
        </div>
      ) : (
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
                <p className="text-[10px] text-gray-400">Role-scoped deal room · Demo mode</p>
              </div>
            </div>
            <Link to="/create-deal-room"
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
              style={{ background: roleConfig.color }}>
              Create Your Room →
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Property header */}
        <div className="relative rounded-2xl overflow-hidden mb-6 h-40">
          <img src={property.image} alt={property.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30 flex items-end p-5">
            <div className="flex-1">
              <p className="text-xs text-white/60 mb-0.5">
                {property.type}{property.market ? ` · ${property.market}` : ""}
                {property.isCustom && !isDemo && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 text-[10px] font-semibold">Awaiting Documents</span>}
                {isDemo && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "rgba(99,102,241,0.4)", color: "#c7d2fe" }}>Under Review</span>}
              </p>
              <h1 className="text-xl font-bold text-white">{property.name}</h1>
              <p className="text-xs text-white/70">{property.address}</p>
            </div>
            <div className="text-right">
              <div className="px-3 py-1.5 rounded-xl text-xs font-bold text-white mb-1" style={{ background: roleConfig.color }}>
                {roleConfig.icon} {roleConfig.label}
              </div>
              {!property.isCustom && (
                <div className="px-2 py-1 rounded-lg text-xs font-bold"
                  style={{ background: property.riskColor + "22", color: property.riskColor }}>
                  {property.risk} Risk · {property.score}/100
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deal Intelligence Dashboard — custom rooms: live AI analysis aggregated */}
        {property.isCustom && (
          <DealIntelligenceDashboard
            propertyId={property.id || property.property_id || propertyId}
            refreshKey={analysesRefreshKey}
          />
        )}

        {/* Investment Readiness summary bar — demo rooms only */}
        {!property.isCustom && (
          <ReadinessSummaryBar property={property} />
        )}

        {/* Role headline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6"
          style={{ borderLeftWidth: 4, borderLeftColor: roleConfig.color }}>
          <h2 className="text-base font-bold text-gray-900 mb-1">{roleConfig.headline}</h2>
          <p className="text-sm text-gray-500 leading-relaxed">{roleConfig.subtext}</p>
        </div>

        {/* Role-scoped sections */}
        <div className="grid md:grid-cols-2 gap-5 mb-6">
          {roleConfig.sections.map((sectionKey) => {
            const Panel = SECTION_MAP[sectionKey];
            return Panel ? <Panel key={sectionKey} /> : null;
          })}
        </div>

        {/* Activity feed — demo rooms only */}
        {!property.isCustom && (
          <div className="mb-8">
            <ActivityFeedPanel property={property} />
          </div>
        )}

        {/* Activate CTA (only for demo rooms) */}
        {!property.isCustom && (
          <div className="rounded-2xl overflow-hidden border border-gray-200">
            <div className="px-8 py-8 text-center"
              style={{ background: `linear-gradient(135deg, ${roleConfig.color} 0%, ${roleConfig.color}dd 100%)` }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">One-time deal fee</p>
              <div className="text-4xl font-black text-white mb-1">$499</div>
              <p className="text-sm text-white/80 mb-5">Activates the full deal room for all parties on this property</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl mx-auto mb-6">
                {["All-party deal room", "AI document analysis", "Role-scoped access", "Compliance tracking"].map((f) => (
                  <div key={f} className="bg-white/10 rounded-xl px-3 py-2 text-xs text-white/90 font-medium">{f}</div>
                ))}
              </div>
              <button onClick={handleActivate} disabled={checkoutLoading}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold bg-white transition hover:opacity-90 disabled:opacity-60"
                style={{ color: roleConfig.color }}>
                {checkoutLoading ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Preparing…</>
                ) : "Activate Deal Room — $499 →"}
              </button>
              {checkoutError && <p className="text-xs text-red-200 mt-3">{checkoutError}</p>}
              <p className="text-xs text-white/40 mt-3">Secure checkout via Stripe · One-time fee</p>
            </div>
            <div className="bg-gray-50 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">Already have access?</p>
                <p className="text-xs text-gray-400">Sign in to view your full deal room</p>
              </div>
              <Link to={`/login?redirect=/deal-room/${propertyId}?role=${role}`}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: roleConfig.color }}>
                Sign In →
              </Link>
            </div>
          </div>
        )}

        {/* Active deal room footer — invite links for custom rooms */}
        {property.isCustom && !isDemo && (
          <div className="bg-gray-50 rounded-2xl border border-gray-200 px-6 py-5">
            <p className="text-sm font-semibold text-gray-800 mb-1">Share role-scoped invite links</p>
            <p className="text-xs text-gray-400 mb-4">Each party sees only what's relevant to their role. Copy and send directly.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { role: "lender", icon: "🏦", label: "Lender" },
                { role: "inspector", icon: "🔍", label: "Inspector" },
                { role: "insurer", icon: "🛡️", label: "Insurance Broker" },
                { role: "attorney", icon: "📜", label: "Attorney" },
                { role: "investor", icon: "📊", label: "Investor" },
                { role: "servicer", icon: "⚙️", label: "Servicer" },
              ].map((r) => {
                const url = `${window.location.origin}/deal-room/${propertyId}?role=${r.role}`;
                return (
                  <button key={r.role} onClick={() => navigator.clipboard.writeText(url)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 text-left transition group">
                    <span className="text-base shrink-0">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{r.label}</p>
                      <p className="text-[10px] text-gray-400 group-hover:text-gray-600">Click to copy link</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-3 text-center">Need help? Email <a href="mailto:hello@kontraplatform.com" className="underline">hello@kontraplatform.com</a></p>
          </div>
        )}

        {/* Demo bottom conversion CTA */}
        {isDemo && (
          <div className="rounded-2xl overflow-hidden border border-indigo-100 mt-2">
            <div className="px-8 py-8 text-center" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                You just experienced Kontra
              </p>
              <h2 className="text-2xl font-extrabold text-white mb-2">
                Ready to close your deal faster?
              </h2>
              <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
                Set up a deal room for your property in under 2 minutes. AI analyzes every document as it's uploaded. Every party gets their own view.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/create-deal-room"
                  className="px-8 py-3 rounded-xl text-sm font-bold bg-white text-indigo-900 hover:opacity-90 transition">
                  Create Your Deal Room — $499 →
                </Link>
                <Link to="/pricing"
                  className="px-6 py-3 rounded-xl text-sm font-semibold border border-white/20 text-white/80 hover:bg-white/10 transition">
                  See Pricing
                </Link>
              </div>
              <p className="text-[10px] text-white/30 mt-4">One-time fee · No subscription · 90-day access included</p>
            </div>
            <div className="bg-gray-50 px-8 py-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-gray-100">
              {["2 min setup", "18 sec AI review", "Unlimited participants", "Unlimited documents"].map(f => (
                <span key={f} className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="text-green-500">✓</span> {f}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </PublicLayout>
  );
}
