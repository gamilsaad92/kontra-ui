import React, { useState, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import PublicLayout from "./PublicLayout";
import DealCoordinationPanel from "./DealCoordinationPanel";
import ActivityTimeline from "./ActivityTimeline";
import CommentsPanel from "./CommentsPanel";
import TransactionRiskPanel from "./TransactionRiskPanel";
import TasksPanel from "./TasksPanel";
import AIOperationsManager from "./AIOperationsManager";
import DailyStandup from "./DailyStandup";
import InvitePanel from "./InvitePanel";
import DocumentChecklistPanel from "./DocumentChecklistPanel";
import VerificationPanel from "./VerificationPanel";
import { getTemplate } from "./documentChecklistUtils";
import { DEFAULT_PACK_ID, getWorkflowPack, ensureWorkflowPackLoaded, resolvePackId } from "../../lib/workflowPacks";

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

// Note: "financials", "inspection", "insurance", "legal", "brand-standards", and "documents"
// are intentionally NOT listed as sections on any role below — the Due Diligence Checklist
// above already covers uploading and AI-analyzing every one of those document types. Listing
// them again here would just re-prompt the user to upload something they've already submitted.
// These per-role sections only cover things the checklist doesn't: risk scoring, compliance
// rollup, readiness, and basic property info.
//
// Role metadata itself (label/icon/color/headline/subtext/sections) is no longer defined here.
// It lives in shared/workflowRoles.json, scoped per Workflow Pack, and is looked up below via
// pack.getRole(role) — never from a flat cross-pack dict — since a role key like "lender" can
// mean something different in another pack (see workflowPacks/*.js `roles` exports).

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
          <p className="text-[10px] text-gray-400 mt-3 leading-relaxed max-w-xs mx-auto">
            File is stored securely and analyzed by AI (OpenAI API). Retained per our{" "}
            <a href="/privacy" target="_blank" className="underline hover:text-gray-600">Privacy Policy</a>.
          </p>
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

function ConfidenceBadge({ confidence }) {
  if (confidence == null) return null;
  const color = confidence >= 90 ? '#16a34a' : confidence >= 70 ? '#d97706' : '#dc2626';
  return (
    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">AI Confidence</p>
      <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${confidence}%`, background: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color }}>{confidence}%</span>
    </div>
  );
}

function SourceCitations({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-2">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Source Citations</p>
      <div className="space-y-1">
        {sources.slice(0, 3).map((s, i) => (
          <div key={i} className="flex gap-2 bg-purple-50 rounded-lg px-3 py-1.5">
            <span className="text-[10px] font-bold text-purple-700 shrink-0 mt-0.5 whitespace-nowrap">{s.page}</span>
            <span className="text-[10px] text-gray-500 italic line-clamp-2">"{s.quote}"</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Onboarding Progress — replaces the old static "Next Steps" text with
// real, verifiable progress for a brand-new owner room. Nothing here is
// mocked: invited counts come from deal_events, document counts from
// deal_analyses (via /coordination), and the AI step from the Task Engine
// actually having generated something. Rows link straight to the panel
// that completes them so there's no hunting around the page. ──
function OnboardingProgress({ propertyId, accentColor, totalInvitable, pack }) {
  const [state, setState] = useState({ loading: true, invitedRoles: 0, docCount: 0, taskCount: 0 });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/events`).then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination`).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/tasks`).then(r => r.ok ? r.json() : { tasks: [] }).catch(() => ({ tasks: [] })),
    ]).then(([evRes, coord, taskRes]) => {
      if (cancelled) return;
      const invitedRoles = new Set(
        (evRes.events || []).filter(e => e.event_type === "invite_sent" && e.metadata?.role).map(e => e.metadata.role)
      ).size;
      const docCount = Object.values(coord.docsByRole || {}).reduce((a, b) => a + b, 0);
      const taskCount = (taskRes.tasks || []).length;
      setState({ loading: false, invitedRoles, docCount, taskCount });
    }).catch(() => cancelled || setState(s => ({ ...s, loading: false })));
    return () => { cancelled = true; };
  }, [propertyId]);

  if (state.loading) {
    return <div className="h-16 rounded-xl bg-gray-50 animate-pulse" />;
  }

  const steps = [
    {
      label: "Invite parties",
      detail: (() => {
        const invitableLabels = (pack?.roles || []).filter(r => r.invitable).map(r => r.label);
        const roleList = invitableLabels.length > 0
          ? invitableLabels.slice(0, 4).join(", ")
          : "lender, inspector, insurer, and attorney";
        return totalInvitable
          ? `${state.invitedRoles}/${totalInvitable} invited — send role-specific links to your ${roleList}`
          : `Send role-specific links to your ${roleList}`;
      })(),
      done: state.invitedRoles > 0,
      href: "#invite-panel",
    },
    {
      label: "Upload documents",
      detail: state.docCount > 0
        ? `${state.docCount} document${state.docCount === 1 ? "" : "s"} uploaded — AI reviews each file as it arrives`
        : "AI reviews each file as it arrives and surfaces key findings",
      done: state.docCount > 0,
      href: "#documents-panel",
    },
    {
      label: "AI takes over",
      detail: state.taskCount > 0
        ? `${state.taskCount} task${state.taskCount === 1 ? "" : "s"} identified — approvals, compliance, and deal stage tracked automatically`
        : "Once documents arrive, AI tracks approvals, compliance, and deal stage automatically",
      done: state.taskCount > 0,
      href: "#tasks-panel",
    },
  ];

  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={s.label}>
          <a href={s.href} className="flex items-start gap-2.5 text-sm group">
            <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 transition"
              style={s.done ? { background: "#16a34a", color: "#fff" } : { background: accentColor, color: "#fff" }}>
              {s.done ? "✓" : i + 1}
            </span>
            <span className={s.done ? "text-gray-400 line-through decoration-gray-300" : "text-gray-600 group-hover:text-gray-900"}>
              {s.detail}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

function ShareButton({ propertyId }) {
  const [state, setState] = useState("idle"); // idle | copied
  const shareUrl = `${window.location.origin}/deal-room/${propertyId}/share`;
  function handleShare() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    });
  }
  return (
    <button onClick={handleShare}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition"
      style={state === "copied"
        ? { background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" }
        : { background: "white", color: "#800020", borderColor: "#80002030" }}>
      {state === "copied" ? "✓ Link Copied!" : "↗ Share Deal"}
    </button>
  );
}

// ── Auto Risk Signals — derived from documents already uploaded/analyzed ──
function AutoRiskSignals({ propertyId, refreshKey }) {
  const { analyses, loading } = useDealAnalyses(propertyId, refreshKey);
  if (loading || !analyses.length) return null;

  const flags = [];
  for (const a of analyses) {
    const an = a.analysis || {};
    (an.redFlags || []).forEach(f => flags.push({ text: typeof f === "string" ? f : `${f.issue}${f.severity ? ` (${f.severity})` : ""}`, severity: (f.severity || "medium").toLowerCase() }));
    (an.anomalies || []).forEach(f => flags.push({ text: typeof f === "string" ? f : `${f.item}: ${f.description}`, severity: (f.severity || "medium").toLowerCase() }));
    (an.coverageGaps || []).forEach(f => flags.push({ text: typeof f === "string" ? f : (f.gap || JSON.stringify(f)), severity: "medium" }));
    (an.lifeSafetyFindings || []).forEach(f => flags.push({ text: typeof f === "string" ? f : (f.issue || f.finding || JSON.stringify(f)), severity: "high" }));
    (an.scheduleBExceptions || []).forEach(f => flags.push({ text: `Title exception: ${f.item || f.description || f}`, severity: (f.severity || "medium").toLowerCase() }));
    if (an.covenantStatus === "Breached") flags.push({ text: "Financial covenant breached", severity: "high" });
    else if (an.covenantStatus === "At Risk") flags.push({ text: "Financial covenant at risk", severity: "medium" });
    if (an.complianceStatus === "Non-Compliant") flags.push({ text: `${a.section} flagged as non-compliant`, severity: "high" });
    if (an.expiresInDays != null && an.expiresInDays < 45) flags.push({ text: `Insurance expires in ${an.expiresInDays} days`, severity: "medium" });
    if (an.totalDeferredCost) flags.push({ text: `Deferred maintenance: ${an.totalDeferredCost}`, severity: "medium" });
  }

  const isHigh = (s) => s === "high" || s === "critical";
  const highCount = flags.filter(f => isHigh(f.severity)).length;
  const level = highCount > 0 ? "High" : flags.length > 2 ? "Medium" : flags.length > 0 ? "Low" : "Low";
  const color = { High: "#dc2626", Medium: "#d97706", Low: "#16a34a" }[level];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Auto Risk Signals</p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: color + "18", color }}>
          {level} Signal Risk
        </span>
      </div>
      {flags.length === 0 ? (
        <p className="text-xs text-gray-400">No red flags or anomalies detected in the documents analyzed so far.</p>
      ) : (
        <ul className="space-y-1.5">
          {flags.slice(0, 6).map((f, i) => (
            <li key={i} className={`text-xs rounded-lg px-3 py-1.5 ${isHigh(f.severity) ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
              {f.text}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-gray-400 mt-3">Derived automatically from documents already uploaded in this deal room. Use the score generator below for a full weighted risk assessment.</p>
    </div>
  );
}

// ── Compliance Status — derived from documents already uploaded/analyzed ──
// Names exactly which required documents are still missing (instead of a vague
// "Awaiting Upload"), plus which uploaded documents have open compliance issues.
function ComplianceStatusPanel({ propertyId, propertyType, refreshKey }) {
  const { analyses, loading } = useDealAnalyses(propertyId, refreshKey);

  const bySection = {};
  for (const a of analyses) if (!bySection[a.section]) bySection[a.section] = a;

  const template = getTemplate(propertyType);
  const requiredItems = template.filter(i => i.required);
  const missingRequired = requiredItems.filter(i => !bySection[i.section]);
  const requiredDone = requiredItems.length - missingRequired.length;

  const CHECKS = [
    { key: "insurance", label: "Insurance Coverage", check: (a) => a.analysis?.complianceStatus === "Compliant" },
    { key: "legal", label: "Legal / Title Review", check: (a) => a.analysis?.complianceStatus && a.analysis.complianceStatus !== "Issues Found" },
    { key: "title", label: "Title Commitment Clear", check: (a) => a.analysis?.clearToClose === true || (a.analysis?.scheduleBExceptions?.length ?? 1) === 0 },
    { key: "financials", label: "Financial Covenants", check: (a) => a.analysis?.covenantStatus === "Compliant" },
    { key: "inspection", label: "Inspection — Life Safety", check: (a) => !(a.analysis?.lifeSafetyFindings?.length > 0) },
    { key: "brand-standards", label: "Brand Standards", check: (a) => a.analysis?.complianceStatus === "Compliant" },
  ].filter(c => bySection[c.key]);

  const passed = CHECKS.filter(c => c.check(bySection[c.key])).length;
  const total = CHECKS.length;
  const anyUploaded = Object.keys(bySection).length > 0;
  const allGood = missingRequired.length === 0 && passed === total;

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
      <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
      <div className="h-16 bg-gray-50 rounded-xl" />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Compliance Status</p>
        <div className="text-lg font-black" style={{ color: allGood ? "#16a34a" : "#d97706" }}>
          {requiredDone}/{requiredItems.length}
        </div>
      </div>

      {missingRequired.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1.5">Missing Required Documents</p>
          <div className="flex flex-wrap gap-1.5">
            {missingRequired.map(i => (
              <span key={i.section} className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                {i.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {anyUploaded && CHECKS.length > 0 && (
        <div className="space-y-2">
          {CHECKS.map(c => {
            const ok = c.check(bySection[c.key]);
            return (
              <div key={c.key} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-xs font-medium text-gray-700">{c.label}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: ok ? "#16a34a18" : "#d9770618", color: ok ? "#16a34a" : "#d97706" }}>
                  {ok ? "Passed ✓" : "Needs Review"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {missingRequired.length === 0 && CHECKS.length === 0 && !allGood && (
        <p className="text-xs text-gray-400">All required documents are uploaded — no compliance-relevant AI checks apply yet.</p>
      )}

      {allGood && (
        <p className="text-xs text-green-600 font-semibold">✓ All required documents uploaded and passing compliance checks.</p>
      )}

      <p className="text-[10px] text-gray-400 mt-3">Based on the Due Diligence Checklist above — upload the missing items there to close these gaps.</p>
    </div>
  );
}

function parseNumericField(val) {
  if (val == null) return "";
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? "" : n;
}

function RiskUploadPanel({ property, propertyId, refreshKey }) {
  const { analyses } = useDealAnalyses(propertyId, refreshKey);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);
  const [form, setForm] = useState({
    propertyName: property?.property_name || property?.name || "",
    propertyType: property?.property_type || "Multifamily",
    address: property?.address || "",
    units: "", askingPrice: "", capRate: "", occupancy: "",
  });

  // Auto-fill from documents already uploaded and analyzed elsewhere in the deal
  // room — nobody should have to retype numbers the AI already extracted.
  useEffect(() => {
    if (!analyses.length) return;
    const bySection = {};
    for (const a of analyses) if (!bySection[a.section]) bySection[a.section] = a.analysis;
    const fin = bySection.financials;
    const pa = bySection.purchase_agreement;
    const rr = bySection.rent_roll;

    const derivedAskingPrice = parseNumericField(pa?.purchasePrice);
    const derivedOccupancy = parseNumericField(fin?.occupancy) || parseNumericField(rr?.occupancyRate);
    const derivedUnits = parseNumericField(rr?.totalUnits);

    setForm(f => {
      const next = {
        ...f,
        askingPrice: f.askingPrice || derivedAskingPrice || f.askingPrice,
        occupancy: f.occupancy || derivedOccupancy || f.occupancy,
        units: f.units || derivedUnits || f.units,
      };
      if (derivedAskingPrice || derivedOccupancy) setAutoFilled(true);
      return next;
    });
  }, [analyses]);

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
    <div>
      <AutoRiskSignals propertyId={propertyId} refreshKey={refreshKey} />
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Risk Assessment</p>
        {autoFilled && (status === "idle" || status === "error") && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">✓ Auto-filled from uploads</span>
        )}
      </div>

      {(status === "idle" || status === "error") && (
        <div className="space-y-3">
          {autoFilled && (
            <p className="text-[11px] text-gray-400">Fields below were pre-filled from documents already uploaded — edit anything, then generate the score.</p>
          )}
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
    </div>
  );
}

// ── Shared hook: fetch all saved AI analyses for a deal room ─────────────
function useDealAnalyses(propertyId, refreshKey) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) { setLoading(false); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`)
      .then(r => r.ok ? r.json() : { analyses: [] })
      .then(d => { setAnalyses(d.analyses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId, refreshKey]);

  return { analyses, loading };
}

// ── Deal Intelligence Dashboard — shows all saved AI analyses. Which
// sections get a card, and how each one is badged/highlighted, comes from
// the active Workflow Pack — this component has no CRE-specific knowledge. ──
function DealIntelligenceDashboard({ propertyId, refreshKey, packId = DEFAULT_PACK_ID }) {
  const { analyses, loading } = useDealAnalyses(propertyId, refreshKey);
  const pack = getWorkflowPack(packId);
  const SECTIONS = pack.intelligenceSections || [];
  const getBadge = pack.getIntelligenceBadge || (() => null);
  const getHighlight = pack.getIntelligenceHighlight || (() => null);

  // Latest per section
  const bySection = {};
  for (const a of analyses) {
    if (!bySection[a.section]) bySection[a.section] = a;
  }

  const doneCount = SECTIONS.filter(s => bySection[s.key]).length;

  if (SECTIONS.length === 0) return null;

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
            {doneCount === 0 ? "Upload documents to begin AI analysis" : `${doneCount}/${SECTIONS.length} sections analyzed`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doneCount > 0 && (
            <a href={`/deal-room/${propertyId}/summary`} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">
              🖨 Print Summary
            </a>
          )}
          <div className="text-2xl font-black" style={{ color: doneCount === SECTIONS.length ? "#16a34a" : doneCount >= 1 ? "#d97706" : "#9ca3af" }}>
            {Math.round(doneCount / SECTIONS.length * 100)}%
          </div>
        </div>
      </div>

      {/* Readiness bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.round(doneCount / SECTIONS.length * 100)}%`, background: doneCount === SECTIONS.length ? "#16a34a" : "#d97706" }} />
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
                  {a.storage_path && (
                    <a
                      href={`${API_BASE}/api/public/document-url?path=${encodeURIComponent(a.storage_path)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1 hover:bg-gray-100 transition shrink-0"
                      style={{ color: "#800020", borderColor: "#80002030" }}>
                      ↓ Original
                    </a>
                  )}
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

      {doneCount === SECTIONS.length && (
        <div className="mt-4 p-3 rounded-xl bg-green-50 border border-green-100">
          <p className="text-xs font-semibold text-green-800">✓ Deal room fully populated — ready to share with your lender</p>
          <p className="text-[10px] text-green-600 mt-0.5">All key sections have been analyzed. Use the invite links below to send the lender their view.</p>
        </div>
      )}
    </div>
  );
}

// ── Financial Summary — read-only rollup of key numbers already extracted ──
// by AI from the purchase agreement, rent roll, and financial statements.
// No upload button here — this is purely derived from the checklist above.
// The rollup fields and covenant flag come from the active Workflow Pack —
// this component has no CRE-specific knowledge of NOI/DSCR/etc.
function FinancialSnapshotPanel({ propertyId, refreshKey, packId = DEFAULT_PACK_ID }) {
  const { analyses, loading } = useDealAnalyses(propertyId, refreshKey);
  const pack = getWorkflowPack(packId);

  const bySection = {};
  for (const a of analyses) if (!bySection[a.section]) bySection[a.section] = a.analysis;

  const stats = (pack.getSnapshotStats ? pack.getSnapshotStats(bySection) : []);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 animate-pulse">
      <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
      <div className="h-16 bg-gray-50 rounded-xl" />
    </div>
  );

  if (stats.length === 0) return null;

  const covenantFlag = pack.getSnapshotFlag ? pack.getSnapshotFlag(bySection) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Financial Summary</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-center">
            <div className="text-sm font-bold text-gray-800">{s.value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      {covenantFlag && (
        <div className={`mt-3 px-3 py-2 rounded-xl text-xs font-medium ${covenantFlag.sev === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
          ⚠ {covenantFlag.text}
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-3">Pulled automatically from documents already uploaded — no need to re-enter these numbers.</p>
    </div>
  );
}

// Build pending section map based on role
function buildPendingSectionMap(property, role, onAnalysisSaved, urlPropertyId, refreshKey) {
  const pid = urlPropertyId || property?.property_id || property?.id;
  return {
    risk:       () => <RiskUploadPanel property={property} propertyId={pid} refreshKey={refreshKey} />,
    compliance: () => <ComplianceStatusPanel propertyId={pid} propertyType={property?.property_type || property?.type} refreshKey={refreshKey} />,
    readiness:  () => <PendingPanel title="Investment Readiness" icon="🏅" description="All 5 readiness pillars will be tracked as parties submit their documentation." />,
    property:   () => <PendingPropertyPanel property={property} />,
  };
}

export default function DealRoomPage() {
  const { propertyId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "owner";
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
      .then(async data => {
        if (data?.workflow_pack_id) await ensureWorkflowPackLoaded(data.workflow_pack_id);
        setApiProperty(data);
        setLoadingApi(false);
      })
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

  async function handleDemoActivate() {
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const property = DEMO_PROPERTIES[propertyId] || apiProperty;
      const res = await fetch(`${API_BASE}/api/checkout/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "deal",
          propertyId,
          propertyName: property?.property_name || property?.name || propertyId,
          email: "dev@kontraplatform.com",
          role: "owner",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || "Demo activation failed.");
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

  const isDemo = propertyId === 'kontra-demo';

  // For the demo room — override with a great hero image
  if (isDemo && property) {
    property.image = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80";
    property.market = "Austin, TX";
    property.deal_amount = property.deal_amount || "14,000,000";
  }

  // Which Workflow Pack powers this deal room. Demo properties are always
  // CRE Acquisition; custom rooms carry their pack id from creation time.
  // Resolution (deal_type inference wins over the stored workflow_pack_id
  // column) lives in one shared place — lib/workflowPacks.resolvePackId —
  // so every page that needs a room's pack (this page, checkout success,
  // invite links, etc.) agrees, instead of duplicating/drifting logic.
  const packId = demoProperty ? DEFAULT_PACK_ID : resolvePackId(apiProperty);
  const pack = getWorkflowPack(packId);
  const isCREPack = packId === DEFAULT_PACK_ID;

  // Role metadata (label/icon/color/headline/subtext/sections) is looked up
  // scoped to this pack — never from a flat cross-pack dict — since a role
  // key like "lender" can mean something different in another pack.
  // Fallback: if the role isn't in this pack (e.g. old bundle, typo, new role
  // not yet deployed), show a neutral "invited" message rather than the primary
  // owner's private "full view of all parties" copy.
  const _genericFallback = {
    key: role,
    label: role.charAt(0).toUpperCase() + role.slice(1),
    icon: "👤",
    color: pack.roles[0]?.color || "#800020",
    needsDocs: false,
    headline: "You've been invited to this deal room",
    subtext: "You can review the documents and status shared in this deal room.",
    sections: [],
    invitable: true,
  };
  const baseRoleConfig = pack.getRole(role) || _genericFallback;
  const isHotel = (property?.property_type || "").toLowerCase().includes("hotel") ||
                  (property?.property_type || "").toLowerCase().includes("hospitality");
  const roleConfig = isHotel && ['owner', 'broker', 'borrower'].includes(role)
    ? { ...baseRoleConfig, sections: ['brand-standards', ...(baseRoleConfig.sections || [])] }
    : baseRoleConfig;

  // The "Outstanding Items" grid (risk/compliance/property panels) still
  // hardcodes CRE concepts (NOI, DSCR, occupancy) inside the panels
  // themselves, but *which* panels a pack supports is now pack-driven:
  // roleConfig.sections says which sections a role wants to see, the pack's
  // `outstandingItemsSections` says which ones it actually has. Business
  // Acquisition declares none, so the grid is naturally empty for it.
  const visibleOutstandingSections = (roleConfig.sections || []).filter(
    (s) => pack.outstandingItemsSections?.includes(s)
  );

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
    ? buildPendingSectionMap(property, role, onAnalysisSaved, propertyId, analysesRefreshKey)
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

  const pid = propertyId || property.property_id || property.id;

  return (
    <PublicLayout
      hideFooter
      dealRoomMode={!!(property.isCustom && !isDemo)}
      dealRoomTitle={property.name || property.property_name || ""}
    >
      {/* Top bar — demo banner | owner bar | invite bar */}
      {isDemo ? (
        <div className="border-b px-6 py-3" style={{ background: "linear-gradient(90deg, #4a0010 0%, #800020 100%)", borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white" style={{ background: "rgba(255,255,255,0.12)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                LIVE DEMO
              </span>
              <div>
                <p className="text-xs font-semibold text-white">550 Madison Avenue — $28.5M Acquisition · Closing at risk</p>
                <p className="text-[10px] text-white/50">Explore a real Kontra deal room · All AI features active · No signup required</p>
              </div>
            </div>
            <Link to="/create-deal-room"
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
              Create Your Workspace →
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
            <div className="flex items-center gap-2 shrink-0">
              <ShareButton propertyId={propertyId} />
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-green-700 bg-green-100">
                ✓ Paid & Active
              </span>
            </div>
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
                {isCREPack
                  ? [property.type, property.market].filter(Boolean).join(" · ")
                  : [pack.name, property.market || property.address].filter(Boolean).join(" · ")}
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

        {/* Investment Readiness summary bar — demo rooms only */}
        {!property.isCustom && (
          <ReadinessSummaryBar property={property} />
        )}

        {/* AI Operations Manager — the primary interface, not a reporting
            dashboard. Advisor feedback: "the AI should talk first, the UI
            should be supporting evidence." This must render before the Next
            Steps card so the greeting + status is the very first thing an
            owner sees, not buried below a checklist. See lib/operationsManager.js
            and .agents/memory/kontra-task-architecture.md. */}
        {property.isCustom && (
          <AIOperationsManager propertyId={pid} ownerName={property.first_name} dealName={property.name || property.property_name} />
        )}

        {/* Daily Standup — evening counterpart to the morning briefing above.
            Same grounding (Task Engine + closing chain), different lens: what
            moved today, what's still open, and what's planned for tomorrow. */}
        {property.isCustom && (
          <DailyStandup propertyId={pid} ownerName={property.first_name} />
        )}

        {/* Role headline — owner gets concise Next Steps; others get role description */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6"
          style={{ borderLeftWidth: 4, borderLeftColor: roleConfig.color }}>
          {property.isCustom && role === "owner" ? (
            <>
              <h2 className="text-base font-bold text-gray-900 mb-3">Next Steps</h2>
              {!isDemo ? (
                <OnboardingProgress
                  propertyId={pid}
                  accentColor={roleConfig.color}
                  totalInvitable={(pack.roles || []).filter(r => r.invitable).length}
                  pack={pack}
                />
              ) : (
                <ol className="space-y-2.5">
                  {[
                    `Invite parties — send role-specific links to ${(pack.roles || []).filter(r => r.invitable).slice(0, 3).map(r => r.label).join(", ") || "every stakeholder"}`,
                    "Upload documents — AI reviews each file as it arrives and surfaces key findings",
                    "Track approvals — monitor deal stage, party status, and action items in real time",
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                        style={{ background: roleConfig.color }}>{i + 1}</span>
                      {text}
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <>
              <h2 className="text-base font-bold text-gray-900 mb-1">{roleConfig.headline}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{roleConfig.subtext}</p>
            </>
          )}
        </div>

        {/* Due Diligence Checklist */}
        {property.isCustom && (
          <div id="documents-panel">
            <DocumentChecklistPanel
              propertyId={pid}
              propertyType={property.property_type || property.type}
              role={role}
              isDemo={isDemo}
              packId={packId}
              onAnalysisSaved={onAnalysisSaved}
            />
            {/* Verification log — surfaces cross-document consistency checks */}
            <VerificationPanel propertyId={pid} />
          </div>
        )}

        {/* Invite panel — early in the flow so owner invites first */}
        {property.isCustom && !isDemo && (
          <div id="invite-panel">
            <InvitePanel
              propertyId={pid}
              senderName={property.first_name || property.property_name || undefined}
              packId={packId}
            />
          </div>
        )}

        {/* Transaction Risk — replaces numeric Deal Health score */}
        {property.isCustom && (
          <TransactionRiskPanel propertyId={pid} />
        )}

        {/* Tasks — Task Engine + AI Ownership Layer (Observe Mode). Every open
            item has an explicit owner (human role or AI); AI-drafted actions
            (e.g. reminder emails) require an explicit Approve click. */}
        {property.isCustom && (
          <div id="tasks-panel">
            <TasksPanel propertyId={pid} role={role} />
          </div>
        )}

        {/* Deal Intelligence Dashboard (AI Findings) — reveals as documents are uploaded.
            Pack-driven: which sections appear and how they're badged comes from the
            active Workflow Pack, so this renders nothing until a pack defines any. */}
        {property.isCustom && (
          <DealIntelligenceDashboard
            propertyId={pid}
            refreshKey={analysesRefreshKey}
            packId={packId}
          />
        )}

        {/* Financial Summary — auto-derived from uploaded docs, no re-entry. Pack-driven:
            renders nothing until a pack's getSnapshotStats returns something. */}
        {property.isCustom && (
          <FinancialSnapshotPanel
            propertyId={pid}
            refreshKey={analysesRefreshKey}
            packId={packId}
          />
        )}

        {/* Deal Coordination Panel — party status + lifecycle stage */}
        {property.isCustom && (
          <DealCoordinationPanel
            propertyId={pid}
            role={role}
            packId={packId}
            propertyType={property.property_type || property.type}
          />
        )}

        {/* Outstanding Items — role-scoped sections (risk/compliance/property).
            Which of these panels a pack supports comes from
            pack.outstandingItemsSections; roleConfig.sections only says which
            sections a role *wants* to see, the pack says which ones it
            actually *has*. Business Acquisition declares none yet, so this
            grid renders nothing for that pack without any packId check here. */}
        {visibleOutstandingSections.length > 0 && (
          <div className="grid md:grid-cols-2 gap-5 mb-6">
            {visibleOutstandingSections.map((sectionKey) => {
              const Panel = SECTION_MAP[sectionKey];
              return Panel ? <Panel key={sectionKey} /> : null;
            })}
          </div>
        )}

        {/* Activity Timeline — last, historical record of everything above */}
        {property.isCustom && (
          <div className="mb-6">
            <ActivityTimeline propertyId={pid} />
          </div>
        )}

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
              {import.meta.env.DEV && (
                <button onClick={handleDemoActivate} disabled={checkoutLoading}
                  className="mt-3 inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 transition disabled:opacity-40">
                  ⚡ Dev: Skip Payment
                </button>
              )}
              {checkoutError && <p className="text-xs text-red-200 mt-3">{checkoutError}</p>}
              <p className="text-xs text-white/40 mt-3">Secure checkout via Stripe · One-time fee</p>
            </div>
            <div className="bg-gray-50 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">Are you the owner of this deal room?</p>
                <p className="text-xs text-gray-400">Access your dashboard to manage this room</p>
              </div>
              <Link to="/my-deal-rooms"
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: roleConfig.color }}>
                My Deal Rooms →
              </Link>
            </div>
          </div>
        )}

        {/* Demo bottom CTA */}
        {isDemo && (
          <div className="rounded-2xl overflow-hidden border border-indigo-100 mt-2">
            <div className="px-8 py-8 text-center" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                You just experienced Kontra
              </p>
              <h2 className="text-2xl font-extrabold text-white mb-2">
                Ready to coordinate your deal to closing?
              </h2>
              <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
                Set up a deal room for your property in under 2 minutes. AI analyzes every document as it's uploaded. Every party gets their own view.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/create-deal-room"
                  className="px-8 py-3 rounded-xl text-sm font-bold bg-white text-indigo-900 hover:opacity-90 transition">
                  Create Your Workspace — $499 →
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
