import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { trackEvent } from "../../lib/analytics";
import PublicLayout from "./PublicLayout";
import DealCoordinationPanel from "./DealCoordinationPanel";
import ActivityTimeline from "./ActivityTimeline";
import CommentsPanel from "./CommentsPanel";
import TransactionRiskPanel from "./TransactionRiskPanel";
import TasksPanel from "./TasksPanel";
import AIBriefingPanel from "./AIBriefingPanel";
import ParticipantsPanel from "./ParticipantsPanel";
import DocumentsTabPanel from "./DocumentsTabPanel";
import VerifiedAssetPackage from "./VerifiedAssetPackage";
import NotificationsLog from "./NotificationsLog";
import LegalReviewPanel from "./LegalReviewPanel";
import { DEFAULT_PACK_ID, getWorkflowPack, ensureWorkflowPackLoaded, resolvePackId } from "../../lib/workflowPacks";
import { API_BASE as RESOLVED_API_BASE } from "../../lib/apiBase";
import DealRoomPinGate from "./DealRoomPinGate";
import { getInviteSession, getRoomAuthHeaders } from "../../lib/inviteUtils";

// ── Jurisdiction compliance data ─────────────────────────────────────────────
const JURISDICTION_INFO = {
  uae_adgm: {
    label: "UAE — ADGM / DFSA",
    flag: "🇦🇪",
    points: [
      "FSRA Category 3C or 3D licence (or exemption) required to operate a digital asset business within ADGM.",
      "Token issuances targeting UAE retail investors are subject to DFSA Financial Promotion rules — ensure marketing materials are approved by a licensed firm.",
      "KYC / AML obligations follow FSRA Anti-Money Laundering, Countering Financing of Terrorism and Sanctions (AML) rules.",
    ],
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  eu_mica: {
    label: "EU — MiCA (Markets in Crypto-Assets)",
    flag: "🇪🇺",
    points: [
      "MiCA White Paper mandatory for all crypto-asset offerings since 30 June 2024 — must be submitted to the competent national authority before publication.",
      "Asset-Referenced Tokens (ARTs) and E-Money Tokens (EMTs) carry additional reserve, governance, and own-funds requirements.",
      "Ongoing disclosure obligations apply: significant developments affecting the crypto-asset must be notified to investors promptly.",
    ],
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  us_reg_d: {
    label: "US — Regulation D (SEC)",
    flag: "🇺🇸",
    points: [
      "Rule 506(b): up to 35 non-accredited sophisticated investors permitted; no general solicitation or advertising allowed.",
      "Rule 506(c): unlimited accredited investors only; general solicitation permitted; must verify accredited status (income, net worth, or third-party letter).",
      "Form D must be filed with the SEC within 15 days after the first sale of securities. Blue-sky filings may be required in individual states.",
    ],
    color: "#6b21a8",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
  sg_mas: {
    label: "Singapore — MAS",
    flag: "🇸🇬",
    points: [
      "Digital tokens that constitute capital markets products (securities, CIS units, derivatives) require a prospectus or fall under an exemption (e.g. small offers under S$5M / 12-month period, private placement to ≤50 persons).",
      "MAS Payment Services Act licence required if the token issuance involves regulated payment services or DPT services.",
      "Anti-Money Laundering requirements follow MAS Notice PSN02 / SFA Notice SFA04-N02 — rigorous CDD on all investors.",
    ],
    color: "#0f766e",
    bg: "#f0fdfa",
    border: "#99f6e4",
  },
  uk_fca: {
    label: "UK — FCA",
    flag: "🇬🇧",
    points: [
      "Financial promotions for qualifying cryptoassets must be approved by an FCA-authorised firm or the issuer must be registered under the Cryptoasset Financial Promotion regime.",
      "Security tokens (qualifying as specified investments) require an FCA-approved prospectus or rely on an exemption (e.g. exempt under s86 FSMA for qualified investors / high-net-worth).",
      "Cryptoasset businesses must be registered with the FCA for AML/CTF purposes under the Money Laundering Regulations 2017.",
    ],
    color: "#9a3412",
    bg: "#fff7ed",
    border: "#fed7aa",
  },
};

function isDigitalAssetLayerEnabled(property, pack) {
  const metadataEnabled = property?.metadata_values?.digital_asset_enabled;
  return pack?.id === 'tokenization'
    || pack?.transactionType === 'tokenization'
    || property?.deal_type === 'tokenization'
    || metadataEnabled === true
    || metadataEnabled === 'true';
}

function JurisdictionComplianceCard({ jurisdiction }) {
  const info = JURISDICTION_INFO[jurisdiction];
  if (!info) return null;
  return (
    <div
      className="rounded-2xl border px-6 py-5"
      style={{ background: info.bg, borderColor: info.border }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{info.flag}</span>
        <span className="text-sm font-bold" style={{ color: info.color }}>{info.label}</span>
        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: info.border, color: info.color }}>
          Regulatory Checkpoints
        </span>
      </div>
      <ul className="space-y-1.5 mb-3">
        {info.points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-gray-700">
            <span className="mt-0.5 shrink-0" style={{ color: info.color }}>•</span>
            {p}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-gray-400 border-t pt-2.5 mt-2.5" style={{ borderColor: info.border }}>
        ⚠️ This is an informational summary only and does not constitute legal advice. Consult qualified legal counsel before making any regulatory decisions.
      </p>
    </div>
  );
}

class PanelErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 mb-6 text-xs text-red-400">
          Panel failed to load — {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

function usePageTitle(title) {
  useEffect(() => {
    const prev = document.title;
    if (title) document.title = `${title} — Kontra Deal Room`;
    return () => { document.title = prev; };
  }, [title]);
}

const API_BASE = RESOLVED_API_BASE;

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
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Requirement Status</p>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl font-black" style={{ color: property.compliancePassed === property.complianceItems ? "#16a34a" : "#d97706" }}>
          {property.compliancePassed}/{property.complianceItems}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Requirements Complete</p>
          <div className="mt-1 h-2 w-32 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(property.compliancePassed / property.complianceItems) * 100}%`, background: "#16a34a" }} />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-gray-400">Based on the requirements configured for this deal room.</p>
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
    { icon: "✅", label: "Requirement Checklist", done: property.compliancePassed === property.complianceItems },
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
    { icon: "✅", label: "Requirements", done: property.compliancePassed === property.complianceItems },
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
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: getRoomAuthHeaders(propertyId),
        body: fd,
      });
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
          <p className="text-sm font-semibold text-gray-700">Analyzing with AI…</p>
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
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/events`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/tasks`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : { tasks: [] }).catch(() => ({ tasks: [] })),
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

  const invitableLabels = (pack?.roles || []).filter(r => r.invitable).map(r => r.label);
  const roleList = invitableLabels.length > 0
    ? invitableLabels.slice(0, 4).join(", ")
    : "the parties configured for this deal room";
  const configuredSteps = (pack?.onboardingSteps || []).slice(0, 3);
  const steps = configuredSteps.length > 0
    ? configuredSteps.map((step, i) => ({
        label: step.title,
        detail: i === 0 && state.docCount > 0
          ? `${state.docCount} document${state.docCount === 1 ? "" : "s"} uploaded — ${step.desc}`
          : i === 0
            ? step.desc
            : i === 1 && state.invitedRoles > 0
              ? `${state.invitedRoles}/${totalInvitable || invitableLabels.length || "all"} parties invited — ${step.desc}`
              : step.desc,
        done: i === 0 ? state.docCount > 0 : i === 1 ? state.invitedRoles > 0 : state.taskCount > 0,
        href: i === 0 ? "#documents-panel" : i === 1 ? "#invite-panel" : "#tasks-panel",
      }))
    : [
        {
          label: "Invite the transaction team",
          detail: totalInvitable
            ? `${state.invitedRoles}/${totalInvitable} invited — send role-specific links to your ${roleList}`
            : `Send role-specific links to your ${roleList}`,
          done: state.invitedRoles > 0,
          href: "#invite-panel",
        },
        {
          label: "Upload the first documents",
          detail: state.docCount > 0
            ? `${state.docCount} document${state.docCount === 1 ? "" : "s"} uploaded — AI reviews each file as it arrives`
            : "Start with the documents your transaction needs most; AI reviews each file as it arrives",
          done: state.docCount > 0,
          href: "#documents-panel",
        },
        {
          label: "Review the first actions",
          detail: state.taskCount > 0
            ? `${state.taskCount} task${state.taskCount === 1 ? "" : "s"} identified — approvals, requirements, and stage tracked automatically`
            : "Once documents arrive, Kontra identifies approvals, requirements, and the next stage action",
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
  const [state, setState] = useState("idle"); // idle | copied | loading | error
  async function handleShare() {
    setState("loading");
    try {
      const ownerWriteToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || "";
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/preview-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(ownerWriteToken ? { "x-owner-write-token": ownerWriteToken } : {}) },
        body: JSON.stringify({ ownerWriteToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error || "Preview link unavailable");
      const shareUrl = `${window.location.origin}/deal-room/${propertyId}/share?preview=${encodeURIComponent(data.token)}`;
      await navigator.clipboard?.writeText(shareUrl);
      setState("copied");
      setTimeout(() => setState("idle"), 3000);
    } catch (err) {
      console.error("[preview-link]", err);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }
  return (
    <button onClick={handleShare}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition"
      style={state === "copied"
        ? { background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" }
        : { background: "white", color: "#800020", borderColor: "#80002030" }}>
      {state === "loading" ? "Creating preview…" : state === "copied" ? "✓ Preview Link Copied!" : state === "error" ? "Preview unavailable" : "↗ Share Read-only Preview"}
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

// ── Requirement Status — derived from pack document schema + uploaded analyses ──
// Shows which of the workspace's configured required documents are still missing,
// plus document-level quality checks (CRE pack only — those checks are CRE-
// specific and don't apply to business acquisitions, fundraising rounds, etc.).
// The required document list comes from `pack.getDocumentSchema()` so it is
// always correct for the active pack — never hardcoded CRE document names.
function ComplianceStatusPanel({ propertyId, pack, propertyType, refreshKey }) {
  const { analyses, loading } = useDealAnalyses(propertyId, refreshKey);

  const bySection = {};
  for (const a of analyses) if (!bySection[a.section]) bySection[a.section] = a;

  // Required documents come from the active pack, passing propertyType so CRE
  // subtype-specific schemas (Office, Industrial, Hotel, etc.) resolve correctly.
  // Non-CRE packs ignore the argument; it is safe to pass for all pack types.
  const allDocs = pack ? pack.getDocumentSchema(propertyType) : [];
  const requiredItems = allDocs.filter(d => d.required);
  const missingRequired = requiredItems.filter(i => !bySection[i.section]);
  const requiredDone = requiredItems.length - missingRequired.length;

  // Quality checks are CRE-specific (covenant status, title clearance, life-safety
  // findings). They are only shown for the CRE Acquisition pack — they don't
  // apply to a business acquisition or fundraising round.
  const isCREPack = pack?.id === 'cre_acquisition';
  const CHECKS = isCREPack ? [
    { key: "insurance",       label: "Insurance Coverage",     check: (a) => a.analysis?.complianceStatus === "Compliant" },
    { key: "legal",           label: "Legal / Title Review",   check: (a) => a.analysis?.complianceStatus && a.analysis.complianceStatus !== "Issues Found" },
    { key: "title",           label: "Title Commitment Clear", check: (a) => a.analysis?.clearToClose === true || (a.analysis?.scheduleBExceptions?.length ?? 1) === 0 },
    { key: "financials",      label: "Financial Covenants",    check: (a) => a.analysis?.covenantStatus === "Compliant" },
    { key: "inspection",      label: "Inspection — Life Safety", check: (a) => !(a.analysis?.lifeSafetyFindings?.length > 0) },
    { key: "brand-standards", label: "Brand Standards",        check: (a) => a.analysis?.complianceStatus === "Compliant" },
  ].filter(c => bySection[c.key]) : [];

  const passed = CHECKS.filter(c => c.check(bySection[c.key])).length;
  const anyUploaded = Object.keys(bySection).length > 0;
  const allGood = missingRequired.length === 0 && passed === CHECKS.length;

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
      <div className="h-4 w-32 bg-gray-100 rounded mb-3" />
      <div className="h-16 bg-gray-50 rounded-xl" />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Requirement Status</p>
        <div className="text-lg font-black" style={{ color: allGood ? "#16a34a" : "#d97706" }}>
          {requiredDone}/{requiredItems.length}
        </div>
      </div>

      <p className="text-[10px] text-gray-500 mb-3">
        {requiredDone} of {requiredItems.length} configured requirement{requiredItems.length !== 1 ? "s" : ""} complete
      </p>

      {requiredItems.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">No required documents have been configured for this deal room yet.</p>
      )}

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

      {missingRequired.length === 0 && CHECKS.length === 0 && anyUploaded && !allGood && (
        <p className="text-xs text-gray-400">All required documents are uploaded — quality checks will appear once documents are analyzed.</p>
      )}

      {allGood && requiredItems.length > 0 && (
        <p className="text-xs text-green-600 font-semibold">✓ All configured requirements complete.</p>
      )}

      <p className="text-[10px] text-gray-400 mt-3">Based on the requirements configured for this deal room.</p>
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
          <p className="text-sm font-semibold text-gray-700">Scoring with AI…</p>
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
// Kept here for RiskUploadPanel (auto-fill from extracted numbers).
function useDealAnalyses(propertyId, refreshKey) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) { setLoading(false); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(r => r.ok ? r.json() : { analyses: [] })
      .then(d => { setAnalyses(d.analyses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId, refreshKey]);

  return { analyses, loading };
}

// ── Transaction Details panel — schema-driven per Workflow Pack ───────────────
// Reads `pack.metadataFields` (set in businessAcquisition.js / fundraising.js)
// and renders them as a saveable key/value form. Falls back to a small set of
// universal fields when the pack provides none (e.g. custom ws_* workspaces).
// Saves to `metadata_values` JSONB column via PATCH …/:propertyId/metadata.
// Auth: owner write token read from localStorage (same pattern as stages PATCH).
function TransactionDetailsPanel({ property, propertyId, pack }) {
  const fields = (pack?.metadataFields && pack.metadataFields.length > 0)
    ? pack.metadataFields
    : [
        { id: "workspace_name",    label: "Deal Room Name",        fieldType: "text",     fullWidth: true, placeholder: property?.property_name || "" },
        { id: "transaction_value", label: "Transaction Value ($)", fieldType: "currency", placeholder: "e.g. 1000000" },
        { id: "target_close_date", label: "Target Closing Date",  fieldType: "date" },
        { id: "notes",             label: "Notes",                fieldType: "text",     fullWidth: true, placeholder: "Any additional context for this deal room…" },
      ];

  const sectionTitle = pack?.metadataLabel || "Transaction Details";

  // Seed initial form values from saved metadata_values; backfill legacy
  // stated_revenue / stated_ebitda columns for rooms created before this feature.
  const [form, setForm] = useState(() => {
    const saved = property?.metadata_values || {};
    const legacyMap = {
      annual_revenue: property?.stated_revenue != null ? String(property.stated_revenue) : "",
      ebitda:         property?.stated_ebitda  != null ? String(property.stated_ebitda)  : "",
    };
    return Object.fromEntries(
      fields.map(f => [f.id, saved[f.id] != null ? String(saved[f.id]) : (legacyMap[f.id] || "")])
    );
  });

  const [saving, setSaving]   = useState(false);
  const [saveOk,  setSaveOk]  = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [ownerToken, setOwnerToken] = useState("");

  useEffect(() => {
    try { setOwnerToken(localStorage.getItem(`kontra_owner_token_${propertyId}`) || ""); } catch {}
  }, [propertyId]);

  const isEditable = Boolean(ownerToken);

  async function handleSave() {
    setSaving(true); setSaveErr(""); setSaveOk(false);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/metadata`, {
        method: "PATCH",
        headers: getRoomAuthHeaders(propertyId, { "Content-Type": "application/json" }),
        body: JSON.stringify({ values: form, ownerWriteToken: ownerToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderField(field) {
    const val = form[field.id] ?? "";
    const inputClass = "w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-800";

    if (!isEditable) {
      return (
        <div key={field.id} className={`py-2 border-t border-gray-100 first:border-t-0 ${field.fullWidth ? "col-span-2" : ""}`}>
          <span className="text-xs text-gray-400 block mb-0.5">{field.label}</span>
          <span className="text-xs font-medium text-gray-800">{val || "—"}</span>
        </div>
      );
    }

    if (field.fieldType === "select" && field.options) {
      return (
        <div key={field.id} className={field.fullWidth ? "col-span-2" : ""}>
          <label className="text-xs text-gray-400 mb-1 block">{field.label}</label>
          <select value={val} onChange={e => setForm(f => ({ ...f, [field.id]: e.target.value }))}
            className={`${inputClass} bg-white`}>
            <option value="">Select…</option>
            {(field.options || []).map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      );
    }

    if (field.fieldType === "date") {
      return (
        <div key={field.id} className={field.fullWidth ? "col-span-2" : ""}>
          <label className="text-xs text-gray-400 mb-1 block">{field.label}</label>
          <input type="date" value={val}
            onChange={e => setForm(f => ({ ...f, [field.id]: e.target.value }))}
            className={inputClass} />
        </div>
      );
    }

    return (
      <div key={field.id} className={field.fullWidth ? "col-span-2" : ""}>
        <label className="text-xs text-gray-400 mb-1 block">{field.label}</label>
        <input
          type={field.fieldType === "number" || field.fieldType === "currency" ? "number" : "text"}
          value={val}
          onChange={e => setForm(f => ({ ...f, [field.id]: e.target.value }))}
          className={inputClass}
          placeholder={field.placeholder || ""}
          min={field.fieldType === "number" || field.fieldType === "currency" ? "0" : undefined}
        />
      </div>
    );
  }

  return (
    <div id="issuance-details" className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{sectionTitle}</p>
        {saveOk && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">✓ Saved</span>}
      </div>

      <div className={`grid gap-2 ${isEditable ? "grid-cols-2" : ""}`}>
        {fields.map(f => renderField(f))}
      </div>

      {isEditable && (
        <div className="mt-3">
          {saveErr && <p className="text-xs text-red-500 mb-2">{saveErr}</p>}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "#800020" }}>
            {saving ? "Saving…" : "Save Details"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── JurisdictionSettingsPanel ────────────────────────────────────────────────
// Task #167 — lets a workspace owner update the jurisdiction of an existing
// room from the Settings tab without recreating the room. Jurisdiction change
// also triggers a server-side readiness task evaluation.
const JURISDICTION_OPTIONS = [
  { value: 'uae_adgm', label: '🇦🇪  UAE — ADGM / DFSA'            },
  { value: 'eu_mica',  label: '🇪🇺  EU — MiCA'                      },
  { value: 'us_reg_d', label: '🇺🇸  US — Regulation D (SEC)'        },
  { value: 'sg_mas',   label: '🇸🇬  Singapore — MAS'                },
  { value: 'uk_fca',   label: '🇬🇧  UK — FCA'                       },
];

function JurisdictionSettingsPanel({ propertyId, property }) {
  const [value,   setValue]   = useState(property?.jurisdiction || '');
  const [saving,  setSaving]  = useState(false);
  const [saveOk,  setSaveOk]  = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [ownerToken, setOwnerToken] = useState('');

  useEffect(() => {
    try { setOwnerToken(localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''); } catch {}
  }, [propertyId]);

  const isEditable = Boolean(ownerToken);

  async function handleSave() {
    setSaving(true); setSaveErr(''); setSaveOk(false);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/jurisdiction`, {
        method: 'PATCH',
         headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ jurisdiction: value || null, ownerWriteToken: ownerToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Jurisdiction</p>
        {saveOk && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">✓ Saved</span>}
      </div>

      {isEditable ? (
        <>
          <p className="text-[11px] text-gray-400 mb-3 leading-snug">
             Sets the regulatory framework that governs this deal room and loads the corresponding compliance preparation checklist.
          </p>
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-800 bg-white mb-3">
            <option value="">— No jurisdiction set —</option>
            {JURISDICTION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {saveErr && <p className="text-xs text-red-500 mb-2">{saveErr}</p>}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: '#800020' }}>
            {saving ? 'Saving…' : 'Save Jurisdiction'}
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          {value
            ? (() => { const opt = JURISDICTION_OPTIONS.find(o => o.value === value); return <span className="text-xs font-medium text-gray-800">{opt?.label || value}</span>; })()
            : <span className="text-xs text-gray-400 italic">No jurisdiction set</span>}
        </div>
      )}
    </div>
  );
}

// ── DigitalAssetTogglePanel (#181) ───────────────────────────────────────────
// Lets owners of non-tokenization workspaces opt the Digital Asset Preparation
// Layer on or off without switching to the tokenization pack. Saves a single
// flag into metadata_values via the non-destructive /metadata-merge endpoint.
function DigitalAssetTogglePanel({ propertyId, property, pack, onEnabledChange }) {
  const isTokenization = pack?.id === 'tokenization'
    || pack?.transactionType === 'tokenization'
    || property?.deal_type === 'tokenization';
  const [enabled,    setEnabled]    = useState(!!(property?.metadata_values?.digital_asset_enabled));
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [ownerToken, setOwnerToken] = useState('');

  useEffect(() => {
    try { setOwnerToken(localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''); } catch {}
  }, [propertyId]);

  // Tokenization workspaces always have the layer on — no toggle needed.
  // Non-owners can't change this setting.
  if (isTokenization || !ownerToken) return null;

  async function handleToggle() {
    const next = !enabled;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/metadata-merge`, {
        method: 'PATCH',
         headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          values: { digital_asset_enabled: next ? 'true' : '' },
          ownerWriteToken: ownerToken,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEnabled(next);
      onEnabledChange?.(next);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch (err) {
      console.error('[DAToggle]', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Digital Asset Preparation</p>
          <p className="text-[11px] text-gray-400 leading-snug">
             Layers token-issuance preparation onto this deal room — enables the Digital Asset Readiness tracker,
            jurisdiction compliance checklist, and KYC progress on the Overview tab.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 mt-0.5">
          {saveOk && <span className="text-[10px] font-bold text-green-700">✓ Saved</span>}
          <button
            onClick={handleToggle}
            disabled={saving}
            aria-label={enabled ? 'Disable Digital Asset Preparation' : 'Enable Digital Asset Preparation'}
            className="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 shrink-0"
            style={{ background: enabled ? '#7c3aed' : '#e5e7eb' }}>
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0px)' }} />
          </button>
        </div>
      </div>
      {enabled && (
        <p className="text-[10px] font-medium mt-3 pt-3 border-t leading-relaxed"
          style={{ color: '#7c3aed', borderColor: '#ede9fe' }}>
          🪙 Digital Asset Preparation Layer active — the Overview tab now shows the full readiness tracker.
          Reload to see updated progress.
        </p>
      )}
    </div>
  );
}

// ── OwnershipStructurePanel (#182) ───────────────────────────────────────────
// Cap table and token economics — filled by the Token Issuer before the first
// investor joins. Saves via /metadata-merge so issuance details are not lost.
function OwnershipStructurePanel({ propertyId, property }) {
  const init = property?.metadata_values || {};
  const [vals, setVals] = useState({
    total_token_supply: init.total_token_supply || '',
    lead_investor:      init.lead_investor      || '',
    investor_token_pct: init.investor_token_pct || '',
    team_token_pct:     init.team_token_pct     || '',
    reserve_token_pct:  init.reserve_token_pct  || '',
    vesting_schedule:   init.vesting_schedule   || '',
    governance_rights:  init.governance_rights  || '',
  });
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [saveErr,    setSaveErr]    = useState('');
  const [ownerToken, setOwnerToken] = useState('');

  useEffect(() => {
    try { setOwnerToken(localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''); } catch {}
  }, [propertyId]);

  const FIELDS = [
    { id: 'total_token_supply', label: 'Total Token Supply',     type: 'number', placeholder: 'e.g. 1000000',               half: true  },
    { id: 'lead_investor',      label: 'Lead Investor / Anchor', type: 'text',   placeholder: 'e.g. Polymorphic Capital',    half: true  },
    { id: 'investor_token_pct', label: 'Investor Allocation %',  type: 'number', placeholder: 'e.g. 60',                    half: true  },
    { id: 'team_token_pct',     label: 'Team Allocation %',      type: 'number', placeholder: 'e.g. 20',                    half: true  },
    { id: 'reserve_token_pct',  label: 'Reserve / Treasury %',   type: 'number', placeholder: 'e.g. 20',                    half: true  },
    { id: 'vesting_schedule',   label: 'Vesting Schedule',       type: 'text',   placeholder: 'e.g. 4-year, 1-year cliff',  half: true  },
    { id: 'governance_rights',  label: 'Token Holder Rights',    type: 'text',   placeholder: 'e.g. Pro-rata liquidation, voting rights', half: false },
  ];

  const hasData = Object.values(vals).some(Boolean);

  async function handleSave() {
    setSaving(true); setSaveErr(''); setSaveOk(false);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/metadata-merge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: vals, ownerWriteToken: ownerToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!ownerToken) {
    if (!hasData) return null;
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5" id="ownership-structure">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Ownership & Token Structure</p>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.filter(f => vals[f.id]).map(f => (
            <div key={f.id} className={f.half ? '' : 'col-span-2'}>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{f.label}</p>
              <p className="text-sm font-medium text-gray-900">{vals[f.id]}{f.id.endsWith('_pct') ? '%' : ''}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5" id="ownership-structure">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Ownership & Token Structure</p>
        {saveOk && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">✓ Saved</span>}
      </div>
      <p className="text-[11px] text-gray-400 mb-4 leading-snug">
        Record cap table structure and token economics before the first investor joins.
        This data feeds the Verified Digital Asset Package.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {FIELDS.map(f => (
          <div key={f.id} className={f.half ? '' : 'col-span-2'}>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1 block">{f.label}</label>
            <input
              type={f.type === 'number' ? 'number' : 'text'}
              value={vals[f.id]}
              onChange={e => setVals(v => ({ ...v, [f.id]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-800 bg-white" />
          </div>
        ))}
      </div>
      {saveErr && <p className="text-xs text-red-500 mb-2">{saveErr}</p>}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        style={{ background: '#800020' }}>
        {saving ? 'Saving…' : 'Save Ownership Structure'}
      </button>
    </div>
  );
}

// ── DigitalAssetConfigPanel ──────────────────────────────────────────────────
// Spec §12 — shows the active configuration as a layered overlay display:
//   Base Pack  +  [Jurisdiction Overlay]  +  [Digital Asset Preparation Layer]
// Read-only summary; links to the relevant settings panels for editing.
function DigitalAssetConfigPanel({ property, pack }) {
  const packLabel = pack?.name || 'Custom Pack';
  const packColor = pack?.color || '#800020';
  const jurisdiction = property?.jurisdiction;
  const jurInfo = JURISDICTION_INFO[jurisdiction];
  const showDigitalLayer = isDigitalAssetLayerEnabled(property, pack);

  if (!jurisdiction && !showDigitalLayer) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Active Configuration</p>
      <div className="flex flex-wrap items-center gap-2">
        {/* Base pack */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-white"
          style={{ background: packColor }}>
          {pack?.icon || '📋'} {packLabel}
        </span>

        {/* Jurisdiction overlay */}
        {jurInfo && (
          <>
            <span className="text-gray-300 text-sm">+</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border"
              style={{ color: jurInfo.color, borderColor: jurInfo.border, background: jurInfo.bg }}>
              {jurInfo.flag} {jurInfo.label} Overlay
            </span>
          </>
        )}

        {/* Digital Asset Preparation Layer */}
        {showDigitalLayer && (
          <>
            <span className="text-gray-300 text-sm">+</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border"
              style={{ color: '#7c3aed', borderColor: '#ddd6fe', background: '#f5f3ff' }}>
              🪙 Digital Asset Preparation Layer
            </span>
          </>
        )}
      </div>

      {/* Contextual explanation */}
      <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
        {showDigitalLayer
           ? 'This deal room is configured for digital asset (token) issuance preparation. All readiness tracking, regulatory compliance, and document requirements reflect this configuration.'
           : 'Jurisdiction overlay loads the corresponding regulatory compliance checklist and readiness requirements for this deal room.'}
      </p>
    </div>
  );
}

// Build pending section map based on role
function buildPendingSectionMap(property, role, onAnalysisSaved, urlPropertyId, refreshKey, pack) {
  const pid = urlPropertyId || property?.property_id || property?.id;
  return {
    risk:       () => <RiskUploadPanel property={property} propertyId={pid} refreshKey={refreshKey} />,
    compliance: () => <ComplianceStatusPanel propertyId={pid} pack={pack} propertyType={property?.property_type || property?.type} refreshKey={refreshKey} />,
    readiness:  () => <PendingPanel title="Investment Readiness" icon="🏅" description="All 5 readiness pillars will be tracked as parties submit their documentation." />,
    property:   () => <PendingPropertyPanel property={property} />,
    metadata:   () => <TransactionDetailsPanel property={property} propertyId={pid} pack={pack} />,
  };
}

const PACK_LABELS = {
  cre_acquisition:     'CRE Acquisition',
  business_acquisition:'Business Acquisition',
  fundraising:         'Fundraising',
};

// ── AssetReadinessTab ─────────────────────────────────────────────────────────
// Kontra Tokenization Architecture — advisor brief (Aug 2026):
//   "Make every completed transaction automatically become Tokenization Ready."
// No blockchain dependency. Everything generated from existing workflow data.
// Exportable as JSON. API-first for future tokenization platform partners.
// Applies to ALL workspace types — not just tokenization.
function AssetReadinessTab({ propertyId, property, pack, onTabChange }) {
  const [expandedCat,    setExpandedCat]    = React.useState(null);
  const [showPassport,   setShowPassport]   = React.useState(false);
  const [showMetadata,   setShowMetadata]   = React.useState(false);
  const [checklistItems, setChecklistItems] = React.useState([]);
  const [events,         setEvents]         = React.useState([]);
  const [coordination,   setCoordination]   = React.useState(null);

  React.useEffect(() => {
    if (!propertyId) return;
    Promise.all([
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/checklist`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/events`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([ck, ev, coord]) => {
      setChecklistItems(Array.isArray(ck?.items) ? ck.items : []);
      setEvents(ev?.events || []);
      setCoordination(coord);
    });
  }, [propertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const metaValues      = property?.metadata_values || {};
  const docCount        = Object.values(coordination?.docsByRole || {}).reduce((a, b) => a + b, 0);
  const invitableRoles  = (pack.roles || []).filter(r => r.invitable !== false && !r.isCoordinator);
  const participantRows = invitableRoles.map(r => {
    const sub     = (coordination?.submissions || []).find(s => s.role === r.key);
    const invited = events.some(e => e.event_type === 'invite_sent' && e.metadata?.role === r.key);
    return {
      label: r.label, key: r.key, canManage: !!r.isCoordinator, invited, submitted: !!sub,
      status: sub?.status === 'approved' ? 'Approved' : sub ? 'Submitted' : invited ? 'Invited' : 'Not invited',
    };
  });

  const packName      = pack?.name || 'Transaction';
  const isAssetPack   = isDigitalAssetLayerEnabled(property, pack);
  const DONE          = new Set(['uploaded', 'approved', 'ai_complete']);

  // ── Category scores ─────────────────────────────────────────────────────────
  // 1. Ownership Structure
  const hasOwnerName = !!(property?.first_name || property?.entity_name || metaValues?.issuer_name);
  const hasOwnerData = !!(metaValues?.lead_investor || metaValues?.investor_token_pct || metaValues?.team_token_pct);
  const ownershipPct  = (hasOwnerName ? 50 : 0) + (hasOwnerData ? 50 : 0);
  const ownershipMiss = [
    ...(!hasOwnerName ? ['Owner / entity name not recorded'] : []),
    ...(!hasOwnerData ? ['Ownership structure not defined'] : []),
  ];

  // 2. Legal Documentation
  const legalItems = checklistItems.filter(i => i.category === 'Legal' || (i.section || '').toLowerCase().includes('agreement'));
  const legalDone  = legalItems.filter(i => DONE.has(i.status));
  const legalPct   = legalItems.length > 0 ? Math.round((legalDone.length / legalItems.length) * 100) : docCount > 0 ? 40 : 0;
  const legalMiss  = legalItems.filter(i => !DONE.has(i.status) && i.required).slice(0, 2).map(i => i.label);

  // 3. Financial Completeness
  const finItems  = checklistItems.filter(i => i.category === 'Financial' || (i.section || '').toLowerCase().includes('financial'));
  const finDone   = finItems.filter(i => DONE.has(i.status));
  const hasFinMeta = !!(metaValues?.raise_amount || metaValues?.stated_revenue || metaValues?.stated_ebitda || metaValues?.token_price);
  const finPct    = finItems.length > 0
    ? Math.min(Math.round((finDone.length / finItems.length) * 80 + (hasFinMeta ? 20 : 0)), 100)
    : hasFinMeta ? 50 : docCount > 2 ? 25 : 0;
  const finMiss   = [
    ...finItems.filter(i => !DONE.has(i.status) && i.required).slice(0, 2).map(i => i.label),
    ...(!hasFinMeta ? ['No financial figures recorded'] : []),
  ];

  // 4. Identity Verification
  const kycItems  = checklistItems.filter(i => i.category === 'KYC' || (i.section || '').toLowerCase().includes('kyc'));
  const submittedPtx = participantRows.filter(r => r.submitted || r.status === 'Approved').length;
  const totalPtx     = Math.max(participantRows.filter(r => !r.canManage).length, 1);
  const kycComputed  = kycItems.length > 0
    ? Math.round((kycItems.filter(i => DONE.has(i.status)).length / kycItems.length) * 60 + (submittedPtx / totalPtx) * 40)
    : Math.round((submittedPtx / totalPtx) * 50);
  const identityPct  = Math.min(kycComputed, 100);
  const identityMiss = kycItems.filter(i => !DONE.has(i.status) && i.required).slice(0, 2).map(i => i.label);

  // 5. Cap Table
  const capFields = ['total_token_supply', 'investor_token_pct', 'team_token_pct', 'reserve_token_pct', 'lead_investor'];
  const capFilled = capFields.filter(f => !!metaValues?.[f]);
  const capPct    = Math.round((capFilled.length / capFields.length) * 100);
  const CAP_LABELS = { total_token_supply: 'Total supply', investor_token_pct: 'Investor %', team_token_pct: 'Team %', reserve_token_pct: 'Reserve %', lead_investor: 'Lead investor' };
  const capMiss   = capFields.filter(f => !metaValues?.[f]).slice(0, 2).map(f => CAP_LABELS[f]);

  // 6. Audit Trail
  const auditPct  = Math.min(Math.round((events.length / 10) * 100), 100);
  const auditMiss = events.length < 3 ? ['Fewer than 3 events — invite parties and upload documents to build trail'] : [];

  // 7. Compliance
  const regItems  = checklistItems.filter(i => i.category === 'Regulatory' || (i.section || '').toLowerCase().includes('regulatory'));
  const regDone   = regItems.filter(i => DONE.has(i.status));
  const hasJur    = !!property?.jurisdiction;
  const compPct   = regItems.length > 0
    ? Math.round((hasJur ? 30 : 0) + 70 * (regDone.length / regItems.length))
    : hasJur ? 40 : 0;
  const compMiss  = [...(!hasJur ? ['Governing jurisdiction not set'] : []), ...regItems.filter(i => !DONE.has(i.status) && i.required).slice(0, 1).map(i => i.label)];

  // 8. Document Integrity
  const reqItems = checklistItems.filter(i => i.required);
  const reqDone  = reqItems.filter(i => DONE.has(i.status));
  const docIntPct = reqItems.length > 0
    ? Math.round((reqDone.length / reqItems.length) * 100)
    : Math.min(Math.round((docCount / 5) * 100), 70);
  const docIntMiss = reqItems.filter(i => !DONE.has(i.status)).slice(0, 2).map(i => i.label);

  const ALL_CATEGORIES = [
    { key: 'ownership',    icon: '🏛️', label: 'Ownership Structure',    pct: ownershipPct, weight: 0.15, missing: ownershipMiss, cta: 'Settings → Ownership',   onClick: () => { onTabChange?.('settings'); setTimeout(() => document.getElementById('ownership-structure')?.scrollIntoView({ behavior: 'smooth' }), 150); },
      explanation: isAssetPack
        ? 'Records who owns the asset, the entity structure, and beneficial ownership information required for institutional transactions and regulatory filings.'
        : 'Records who owns the asset and the entity structure — required for due diligence, title transfer, and closing documentation.' },
    { key: 'legal',        icon: '📋', label: 'Legal Documentation',    pct: legalPct,     weight: 0.15, missing: legalMiss,     cta: 'Upload legal docs',       onClick: () => onTabChange?.('documents'),
      explanation: 'Executed agreements, title documents, and corporate authorizations that form the foundation of a verifiable transaction record.' },
    { key: 'financial',    icon: '💰', label: 'Financial Completeness', pct: finPct,       weight: 0.12, missing: finMiss,       cta: 'Upload financial docs',   onClick: () => onTabChange?.('documents'),
      explanation: isAssetPack
        ? 'Financial statements, valuations, raise amount, and token price that enable independent assessment of the asset\'s financial position.'
        : 'Financial statements, valuations, and key figures that enable independent assessment of the asset\'s financial position.' },
    { key: 'identity',     icon: '🪪', label: 'Identity Verification',  pct: identityPct,  weight: 0.12, missing: identityMiss,  cta: 'Documents → KYC',         onClick: () => onTabChange?.('documents'),
      explanation: isAssetPack
        ? 'KYC/AML verification of all transaction parties. Required by all regulated issuance platforms and custodians before asset transfer or token issuance can proceed.'
        : 'Identity verification of all transaction parties. Required for closing, escrow release, and regulatory compliance.' },
    ...(isAssetPack ? [
      { key: 'cap_table',  icon: '📊', label: 'Cap Table',              pct: capPct,       weight: 0.12, missing: capMiss,       cta: 'Settings → Ownership',   onClick: () => { onTabChange?.('settings'); setTimeout(() => document.getElementById('ownership-structure')?.scrollIntoView({ behavior: 'smooth' }), 150); },
        explanation: 'Token allocation breakdown — investor, team, and reserve percentages, vesting schedules, and lead investor details.' },
    ] : []),
    { key: 'audit',        icon: '🔍', label: 'Audit Trail',            pct: auditPct,     weight: 0.12, missing: auditMiss,     cta: 'Activity tab',            onClick: () => onTabChange?.('activity'),
       explanation: 'Complete, timestamped log of every action taken in the deal room. Forms the immutable record required by institutional auditors and counterparties.' },
    { key: 'compliance',   icon: '✅', label: isAssetPack ? 'Compliance' : 'Deal Compliance', pct: compPct, weight: 0.12, missing: compMiss, cta: 'Settings → Jurisdiction', onClick: () => onTabChange?.('settings'),
      explanation: isAssetPack
        ? 'Regulatory framework compliance — jurisdiction set, required regulatory filings uploaded, and any jurisdiction-specific exemptions documented.'
        : 'Governing framework — jurisdiction set and any required regulatory or deal-specific filings uploaded.' },
    { key: 'doc_integrity',icon: '🔒', label: 'Document Integrity',     pct: docIntPct,    weight: 0.10, missing: docIntMiss,    cta: 'Documents tab',           onClick: () => onTabChange?.('documents'),
      explanation: 'All required documents uploaded and AI-verified. Document integrity is the baseline requirement for the closing package and any downstream export.' },
  ];

  // Normalize weights to 1.0 after conditional cap_table exclusion
  const rawWeightSum = ALL_CATEGORIES.reduce((a, c) => a + c.weight, 0);
  const CATEGORIES   = ALL_CATEGORIES.map(c => ({ ...c, weight: c.weight / rawWeightSum }));

  const overall      = Math.round(CATEGORIES.reduce((a, c) => a + c.pct * c.weight, 0));
  const readinessTitle = isAssetPack ? 'Tokenization Readiness' : 'Transaction Readiness';
  const overallLabel = overall >= 80
    ? (isAssetPack ? 'Tokenization Ready' : 'Closing Ready')
    : overall >= 55 ? 'Needs Review'
    : (isAssetPack ? 'Not Eligible' : 'Needs Attention');
  const overallColor = overall >= 80 ? '#16a34a' : overall >= 55 ? '#d97706' : '#dc2626';
  const overallBg    = overall >= 80 ? '#f0fdf4' : overall >= 55 ? '#fffbeb' : '#fef2f2';

  // ── Asset Passport ──────────────────────────────────────────────────────────
  const ownerName  = [property?.first_name, property?.last_name].filter(Boolean).join(' ') || property?.entity_name || metaValues?.issuer_name || '—';
  const closingDate = property?.target_close_date || metaValues?.target_close_date || null;
  const passportData = {
    asset_id:             propertyId,
    asset_name:           property?.name || property?.property_name || '—',
    asset_type:           metaValues?.asset_type || packName,
    jurisdiction:         property?.jurisdiction || 'Not specified',
    owner:                ownerName,
    entity:               property?.entity_name || null,
    closing_date:         closingDate,
    pack:                 packName,
    document_count:       docCount,
    event_count:          events.length,
    verification_status:  overall >= 80 ? 'Verified' : overall >= 55 ? 'Pending' : 'Incomplete',
    tokenization_readiness: overall,
    readiness_label:      overallLabel,
    participants:         participantRows.map(r => ({ role: r.label, status: r.status || 'Not invited' })),
    settlement_method:    metaValues?.settlement_method || null,
    settlement_provider:  SETTLEMENT_PROVIDERS.find(p => p.id === metaValues?.settlement_method)?.label || null,
    settlement_status:    metaValues?.settlement_status || null,
    settlement_confirmed_at: metaValues?.settlement_saved_at || null,
    generated_at:         new Date().toISOString(),
    kontra_version:       '2.0',
  };

  // ── Asset Metadata export object ────────────────────────────────────────────
  const metadataExport = {
    asset_id:       propertyId,
    asset_name:     passportData.asset_name,
    asset_type:     passportData.asset_type,
    jurisdiction:   property?.jurisdiction || null,
    entity:         property?.entity_name || null,
    closing_date:   closingDate || null,
    currency:       'USD',
    participants:   passportData.participants,
    ownership_structure: {
      owner:              ownerName,
      lead_investor:      metaValues?.lead_investor || null,
      total_token_supply: metaValues?.total_token_supply || null,
      investor_pct:       metaValues?.investor_token_pct || null,
      team_pct:           metaValues?.team_token_pct || null,
      reserve_pct:        metaValues?.reserve_token_pct || null,
      vesting_schedule:   metaValues?.vesting_schedule || null,
      governance_rights:  metaValues?.governance_rights || null,
    },
    valuation: {
      raise_amount:   metaValues?.raise_amount   || null,
      token_price:    metaValues?.token_price    || null,
      min_investment: metaValues?.min_investment || null,
      total_tokens:   metaValues?.total_tokens   || null,
    },
    supporting_documents: {
      total_uploaded:    docCount,
      required_complete: `${reqDone.length}/${reqItems.length || '?'}`,
    },
    risk_summary:    property?.risk ? `${property.risk} Risk · ${property.score}/100` : null,
    verification_status: passportData.verification_status,
    audit_trail_events:  events.length,
    tokenization_readiness: {
      overall_pct: overall,
      status:      overallLabel,
      categories:  CATEGORIES.map(c => ({ name: c.label, score: c.pct, weight: c.weight })),
    },
    compatible_networks: ['XRPL', 'Ethereum', 'Polygon', 'Canton', 'Stellar'],
    schema_version: '1.0',
    generated_at:   new Date().toISOString(),
  };

  function triggerDownload(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click(); URL.revokeObjectURL(url);
  }

  function downloadCSV() {
    const rows = [
      ['Field', 'Value'],
      ['Asset ID', propertyId],
      ['Asset Name', passportData.asset_name],
      ['Asset Type', passportData.asset_type],
      ['Jurisdiction', passportData.jurisdiction],
      ['Owner', ownerName],
      ['Pack', packName],
      ['Documents Uploaded', docCount],
      ['Events Recorded', events.length],
      [`${readinessTitle} %`, overall],
      ['Readiness Status', overallLabel],
      ['Verification Status', passportData.verification_status],
      ...CATEGORIES.map(c => [`Score — ${c.label}`, `${c.pct}%`]),
    ];
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${propertyId}-asset-readiness.csv` });
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">

      {/* ── Overall score ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 pt-6 pb-5" style={{ background: overallBg }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                {readinessTitle}
              </p>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-black leading-none" style={{ color: overallColor }}>
                  {overall}%
                </span>
                <div className="mb-1">
                  <span className="text-sm font-bold block" style={{ color: overallColor }}>
                    {overallLabel}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Suggested preparation — not a regulatory determination
                  </span>
                </div>
              </div>
              <div className="mt-3 h-2 w-72 max-w-full rounded-full bg-white/60 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${overall}%`, background: overallColor }} />
              </div>
            </div>
            {isAssetPack && (
              <div className="text-right shrink-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Blockchain Neutral</p>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {['XRPL', 'Ethereum', 'Polygon', 'Canton', 'Stellar'].map(n => (
                    <span key={n} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 bg-white/80">
                      {n}
                    </span>
                  ))}
                </div>
                <p className="text-[9px] text-gray-300 mt-1.5">
                  Compatible with any issuance platform
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 8-category breakdown */}
        <div className="divide-y divide-gray-100">
          {CATEGORIES.map(cat => {
            const done     = cat.pct >= 100;
            const partial  = cat.pct > 0 && cat.pct < 100;
            const cc       = done ? '#16a34a' : partial ? '#d97706' : '#9ca3af';
            const expanded = expandedCat === cat.key;
            return (
              <div key={cat.key}>
                <button
                  className="w-full px-6 py-3 flex items-center gap-3 hover:bg-gray-50 transition text-left"
                  onClick={() => setExpandedCat(expanded ? null : cat.key)}>
                  <span className="text-sm shrink-0">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-700">{cat.label}</span>
                      <span className="text-[11px] font-bold shrink-0" style={{ color: cc }}>
                        {done ? '✓ Complete' : `${cat.pct}%`}
                      </span>
                    </div>
                    {!done && !expanded && cat.missing.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {cat.missing[0]}{cat.missing.length > 1 && ` +${cat.missing.length - 1} more`}
                      </p>
                    )}
                  </div>
                  <div className="w-16 h-1.5 rounded-full bg-gray-100 shrink-0 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${cat.pct}%`, background: cc }} />
                  </div>
                  <span className="text-[10px] text-gray-300 shrink-0">{expanded ? '▲' : '▼'}</span>
                </button>
                {expanded && (
                  <div className="px-6 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                    <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{cat.explanation}</p>
                    {!done && cat.missing.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Missing</p>
                        <ul className="space-y-0.5">
                          {cat.missing.map((m, i) => (
                            <li key={i} className="text-[11px] text-gray-600 flex items-center gap-1.5">
                              <span className="text-gray-300">·</span>{m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!done && (
                      <button onClick={cat.onClick}
                        className="text-[11px] font-bold hover:opacity-80 transition"
                        style={{ color: '#800020' }}>
                        {cat.cta} →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Asset Passport ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
          onClick={() => setShowPassport(v => !v)}>
          <div className="flex items-center gap-3">
            <span className="text-xl">🪪</span>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">Asset Passport</p>
              <p className="text-[10px] text-gray-400">
                 Permanent digital identity of this asset · auto-generated from deal room data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: overallColor, background: overallColor + '18' }}>
              {overallLabel}
            </span>
            <span className="text-gray-300 text-xs">{showPassport ? '▲' : '▼'}</span>
          </div>
        </button>
        {showPassport && (
          <div className="border-t border-gray-100 px-6 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-5">
              {[
                { label: 'Asset ID',     value: propertyId },
                { label: 'Asset Name',   value: passportData.asset_name },
                { label: 'Asset Type',   value: passportData.asset_type },
                { label: 'Pack',         value: passportData.pack },
                { label: 'Jurisdiction', value: passportData.jurisdiction },
                { label: 'Owner',        value: passportData.owner },
                ...(passportData.entity ? [{ label: 'Entity', value: passportData.entity }] : []),
                ...(closingDate ? [{ label: 'Closing Date', value: new Date(closingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }] : []),
                { label: 'Documents',    value: `${docCount} uploaded` },
                { label: 'Events',       value: `${events.length} recorded` },
                { label: 'Verification', value: passportData.verification_status },
                { label: 'Readiness',    value: `${overall}% · ${overallLabel}` },
                ...(passportData.settlement_provider ? [{ label: 'Settlement', value: `${passportData.settlement_provider} · ${passportData.settlement_status || 'Pending'}` }] : []),
              ].map((row, i) => (
                <div key={i}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{row.label}</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{row.value}</p>
                </div>
              ))}
            </div>
            {passportData.participants.length > 0 && (
              <div className="mb-4">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2">Participants</p>
                <div className="flex flex-wrap gap-1.5">
                  {passportData.participants.map((p, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">
                      {p.role} · {p.status}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <p className="text-[9px] text-gray-300">
                Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Kontra v2.0
              </p>
              <button
                onClick={() => triggerDownload(passportData, `${propertyId}-asset-passport.json`)}
                className="text-[10px] font-bold hover:opacity-80 transition" style={{ color: '#800020' }}>
                Export Passport →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Asset Metadata ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
          onClick={() => setShowMetadata(v => !v)}>
          <div className="flex items-center gap-3">
            <span className="text-xl">📦</span>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">Asset Metadata</p>
              <p className="text-[10px] text-gray-400">
                {isAssetPack
                ? 'Structured data layer · consumable by any tokenization platform or custodian'
                : 'Structured data layer · exportable for due diligence, closing, or downstream platforms'}
              </p>
            </div>
          </div>
          <span className="text-gray-300 text-xs">{showMetadata ? '▲' : '▼'}</span>
        </button>
        {showMetadata && (
          <div className="border-t border-gray-100">
            <pre className="px-6 py-4 text-[10px] font-mono leading-relaxed text-gray-600 bg-gray-50 overflow-x-auto max-h-80">
              {JSON.stringify(metadataExport, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* ── Export ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Export</p>
        <p className="text-[11px] text-gray-400 mb-4 leading-snug">
          {isAssetPack
            ? 'Package everything already collected. No blockchain interaction required. Future tokenization partners consume these exports directly via API or file.'
            : 'Package everything already collected into a portable, structured record — ready for closing, audit, or transfer to any downstream platform.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <button
            onClick={() => triggerDownload(metadataExport, `${propertyId}-asset-metadata.json`)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-400 transition text-xs font-bold text-gray-700">
            &#123;&#125; Standard JSON
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-400 transition text-xs font-bold text-gray-700">
            📄 CSV Export
          </button>
          {isAssetPack && (
            <button
              onClick={() => triggerDownload({ ...metadataExport, asset_passport: passportData, export_type: 'tokenization_package', tokenization_package_version: '1.0' }, `${propertyId}-tokenization-package.json`)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-xs font-bold text-white hover:opacity-90 transition"
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
              🪙 Tokenization Package
            </button>
          )}
        </div>
        <p className="text-[9px] text-gray-300">
          API: GET /api/public/deal-room/{propertyId}/asset-passport · /asset-metadata · /readiness
        </p>
      </div>

      {/* ── Adapter Interfaces ─────────────────────────────────────────────── */}
      {/* Architecture principle: Transaction → Verification → Closing →      */}
      {/*   Asset Package → Settlement Adapter → External Infrastructure.      */}
      {/* Kontra orchestrates — it never becomes the external system.          */}

      {/* Settlement Adapter */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Settlement Adapter</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${metaValues?.settlement_method ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            {metaValues?.settlement_method ? 'Configured' : 'Not configured'}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mb-4 leading-snug">
          Wire and Escrow are active today. Stripe, Bridge, Stablecoin, and CBDC
          connect when your customers need them — no rebuild required.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {SETTLEMENT_PROVIDERS.map(p => (
            <div key={p.id}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${
                p.active ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-40'
              }`}>
              <span className="text-sm shrink-0">{p.icon}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-700 leading-tight">{p.label}</p>
                {p.active
                  ? <p className="text-[9px] font-semibold text-green-600">Active</p>
                  : <p className="text-[9px] text-gray-400">Coming soon</p>}
              </div>
            </div>
          ))}
        </div>
        {!metaValues?.settlement_method && (
          <button onClick={() => onTabChange?.('overview')}
            className="mt-3 text-[11px] font-bold hover:opacity-80 transition"
            style={{ color: '#800020' }}>
            Configure in Overview →
          </button>
        )}
      </div>

      {/* Tokenization Adapter */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Tokenization Adapter</p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 uppercase">
            Coming soon
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mb-4 leading-snug">
          The Asset Package and Passport are already structured for handoff to any
          issuance network. Kontra prepares and exports — it never issues tokens.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            { icon: '🌊', label: 'XRPL',           desc: 'XRP Ledger'            },
            { icon: '⬡',  label: 'Ethereum',        desc: 'ERC-3643 / ERC-20'    },
            { icon: '⬡',  label: 'Polygon',         desc: 'Layer 2'              },
            { icon: '🔷', label: 'Canton',           desc: 'DAML / Digital Asset' },
            { icon: '✦',  label: 'Stellar',          desc: 'Stellar Network'      },
            { icon: '+',  label: 'Future Network',   desc: 'Plug in any chain'    },
          ].map(n => (
            <div key={n.label}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-gray-200 opacity-40 cursor-not-allowed select-none">
              <span className="text-sm shrink-0">{n.icon}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-700 leading-tight">{n.label}</p>
                <p className="text-[9px] text-gray-400">{n.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Adapter */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Compliance Adapter</p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 uppercase">
            Coming soon
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mb-4 leading-snug">
          KYC, AML, transfer agents, and custodians connect through this adapter.
          Kontra coordinates the workflow — they execute the regulated activity.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            { icon: '🪪', label: 'KYC Provider',       desc: 'Identity verification' },
            { icon: '🔍', label: 'AML Screening',       desc: 'Anti-money laundering' },
            { icon: '🔄', label: 'Transfer Agent',      desc: 'Ownership registry'    },
            { icon: '🏦', label: 'Custodian',           desc: 'Asset custody'         },
            { icon: '⚖️', label: 'Compliance Network',  desc: 'Regulatory framework'  },
            { icon: '+',  label: 'Future Provider',     desc: 'Plug in any provider'  },
          ].map(n => (
            <div key={n.label}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-gray-200 opacity-40 cursor-not-allowed select-none">
              <span className="text-sm shrink-0">{n.icon}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-700 leading-tight">{n.label}</p>
                <p className="text-[9px] text-gray-400">{n.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── WorkspaceTabNav ───────────────────────────────────────────────────────────
function WorkspaceTabNav({ activeTab, onChange, showDigitalAssetTab = false }) {
  const TABS = [
    { key: 'overview',     label: 'Overview'     },
    { key: 'documents',    label: 'Documents'    },
    { key: 'participants', label: 'Participants' },
    { key: 'tasks',        label: 'Tasks'        },
    { key: 'activity',     label: 'Activity'     },
    { key: 'settings',     label: 'Settings'     },
    ...(showDigitalAssetTab ? [{ key: 'readiness', label: 'Asset Readiness' }] : []),
  ];
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-0 -mb-px overflow-x-auto hide-scrollbar">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`shrink-0 px-4 py-3.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-[#800020] text-[#800020]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── OperationsManagerView ─────────────────────────────────────────────────────
// Five-area coordinator home screen replacing the old stacked morning-brief layout.
//   Area 1 — Transaction header (name · type · stage · target close · status)
//   Area 2 — Operations Manager (AI-driven action cards)
//   Area 3 — Transaction progress (stage tracker + 4 metrics)
//   Area 4 — Participant status (compact table)
//   Area 5 — Recent activity (last 5 events)
// ── Settlement Provider abstraction ──────────────────────────────────────────
// Advisor brief: "Add a SettlementProvider abstraction — initially only Wire
// and Escrow active, others behind feature flags." Kontra never holds funds;
// it orchestrates the handoff to the chosen provider.
const SETTLEMENT_PROVIDERS = [
  {
    id:     'wire',
    label:  'Wire Transfer',
    icon:   '🏦',
    active: true,
    desc:   'ACH · Fedwire · SWIFT — standard bank-to-bank settlement',
    note:   'Add bank details or instructions in the notes below. Your attorney or escrow officer will coordinate the actual transfer.',
  },
  {
    id:     'escrow',
    label:  'Escrow',
    icon:   '🔐',
    active: true,
    desc:   'Third-party holdback — funds released when conditions are met',
    note:   'Name your escrow provider and any release conditions. Kontra will log this against the audit trail.',
  },
  {
    id:     'stablecoin',
    label:  'Stablecoin',
    icon:   '💵',
    active: false,
    desc:   'Connect via Bridge · USDC · USDT — coming soon',
    note:   '',
  },
  {
    id:     'stripe',
    label:  'Stripe',
    icon:   '⚡',
    active: false,
    desc:   'Stripe Payment Links — coming soon',
    note:   '',
  },
  {
    id:     'cbdc',
    label:  'CBDC',
    icon:   '🏛️',
    active: false,
    desc:   'Central Bank Digital Currency — coming soon',
    note:   '',
  },
  {
    id:     'ramp_bridge',
    label:  'Ramp / Bridge',
    icon:   '🔄',
    active: false,
    desc:   'Ramp · Bridge · Circle · Ripple — coming soon',
    note:   '',
  },
];

// ── SettlementPanel ───────────────────────────────────────────────────────────
// Shows after Close in the Overview tab. Lets the coordinator choose a
// settlement method and record any notes. Saves to metadata_values via
// the /metadata-merge endpoint. No funds held or processed by Kontra.
function SettlementPanel({ propertyId, property, isAtFinalStage }) {
  const meta              = property?.metadata_values || {};
  const [selected, setSelected] = useState(meta.settlement_method || null);
  const [details,  setDetails]  = useState(meta.settlement_details || '');
  const [status,   setStatus]   = useState(meta.settlement_status  || 'pending'); // pending | confirmed | complete
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const activeProvider = SETTLEMENT_PROVIDERS.find(p => p.id === selected && p.active);

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/metadata-merge`, {
        method:  'PATCH',
        headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
        body:    JSON.stringify({
          values: {
            settlement_method: selected,
            settlement_details: details,
            settlement_status: 'confirmed',
            settlement_saved_at: new Date().toISOString(),
          },
          ownerWriteToken: (() => {
            try { return localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch { return ''; }
          })(),
        }),
      });
      setStatus('confirmed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-lg">💸</span>
          <div>
            <p className="text-sm font-bold text-gray-900">Settlement</p>
            <p className="text-[10px] text-gray-400">
              {status === 'confirmed'
                ? `Method confirmed · ${SETTLEMENT_PROVIDERS.find(p => p.id === selected)?.label || selected}`
                : isAtFinalStage
                  ? 'Choose how this transaction settles'
                  : 'Available at closing — select a method in advance'}
            </p>
          </div>
        </div>
        {status === 'confirmed' && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
            ✓ Confirmed
          </span>
        )}
      </div>

      <div className="px-6 py-5">
        {/* Provider grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
          {SETTLEMENT_PROVIDERS.map(p => {
            const isSelected = selected === p.id;
            return (
              <button
                key={p.id}
                disabled={!p.active}
                onClick={() => p.active && setSelected(p.id === selected ? null : p.id)}
                className={[
                  'relative flex flex-col items-start gap-1 px-3 py-3 rounded-xl border-2 text-left transition',
                  !p.active
                    ? 'border-dashed border-gray-200 opacity-40 cursor-not-allowed'
                    : isSelected
                      ? 'border-[#800020] bg-[#80002008] cursor-pointer'
                      : 'border-gray-200 hover:border-gray-400 cursor-pointer',
                ].join(' ')}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-base">{p.icon}</span>
                  {!p.active && (
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Soon</span>
                  )}
                  {isSelected && p.active && (
                    <span className="text-[10px] font-bold text-[#800020]">✓</span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-gray-800 leading-tight">{p.label}</p>
                <p className="text-[9px] text-gray-400 leading-snug">{p.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Detail fields — shown when an active provider is selected */}
        {activeProvider && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              {activeProvider.label} — Notes & Instructions
            </p>
            <p className="text-[10px] text-gray-400 mb-2 leading-snug">{activeProvider.note}</p>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder={`Add any ${activeProvider.label.toLowerCase()} details, instructions, or provider information…`}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 resize-none"
              style={{ '--tw-ring-color': '#800020' }}
            />
          </div>
        )}

        {/* Save / confirm row */}
        {selected && activeProvider && (
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              style={{ background: '#800020' }}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Confirm Settlement Method'}
            </button>
            {status === 'confirmed' && !saving && (
              <button
                onClick={() => setSelected(null)}
                className="text-[11px] text-gray-400 hover:text-gray-600 transition">
                Change
              </button>
            )}
          </div>
        )}

        {/* Future providers note */}
        <p className="text-[9px] text-gray-300 mt-4 leading-snug">
          Kontra does not hold or process funds. Settlement is handled by your chosen provider.
          Future: Stripe · Bridge · Ramp · Circle · Ripple · CBDC
        </p>
      </div>
    </div>
  );
}

function OperationsManagerView({ propertyId, property, pack, role, onTabChange }) {
  const [briefing,     setBriefing]     = useState(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [coordination, setCoordination] = useState(null);
  const [stages,       setStages]       = useState([]);
  const [events,       setEvents]       = useState([]);
  const [dataLoading,  setDataLoading]  = useState(true);
  // checklist items — used for accurate doc-to-requirement mapping in the
  // Digital Asset Readiness card. Fetched in parallel with the other data.
  const [checklistItems, setChecklistItems] = useState([]);
  // Which readiness category row is expanded (shows explanation + full missing list)
  const [expandedReadinessKey, setExpandedReadinessKey] = useState(null);
  // Stage advance (task #100) — owner-only; reads token from localStorage
  const [ownerToken,    setOwnerToken]    = useState('');
  const [advancingStage, setAdvancingStage] = useState(false);

  useEffect(() => {
    try { setOwnerToken(localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''); } catch {}
  }, [propertyId]);

  async function handleAdvanceStage(nextStageKey) {
    if (!nextStageKey || advancingStage) return;
    setAdvancingStage(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/advance`, {
        method: 'POST',
        headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ stage: nextStageKey }),
      });
      if (res.ok) {
        // Refresh coordination so the stage indicator and progress bar update immediately
        const coord = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination`, {
          headers: getRoomAuthHeaders(propertyId),
        })
          .then(r => r.ok ? r.json() : null).catch(() => null);
        if (coord) setCoordination(coord);
      }
    } catch {}
    setAdvancingStage(false);
  }

  useEffect(() => {
    if (!propertyId) return;
    const fb = fetch(`${API_BASE}/api/public/deal-room/${propertyId}/brain/briefing`)
      .then(r => r.ok ? r.json() : null).catch(() => null);
    const fc = fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination`, { headers: getRoomAuthHeaders(propertyId) })
      .then(r => r.ok ? r.json() : null).catch(() => null);
    const fs = fetch(`${API_BASE}/api/public/deal-room/${propertyId}/stages`, { headers: getRoomAuthHeaders(propertyId) })
      .then(r => r.ok ? r.json() : null).catch(() => null);
    const fe = fetch(`${API_BASE}/api/public/deal-room/${propertyId}/events`, { headers: getRoomAuthHeaders(propertyId) })
      .then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] }));
    const fk = fetch(`${API_BASE}/api/public/deal-room/${propertyId}/checklist`, { headers: getRoomAuthHeaders(propertyId) })
      .then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] }));

    Promise.all([fb, fc, fs, fe, fk]).then(([b, coord, stageData, evData, ckData]) => {
      setBriefing(b);
      setBriefLoading(false);
      setCoordination(coord);
      setStages(
        Array.isArray(stageData?.stages) && stageData.stages.length >= 2
          ? stageData.stages
          : (pack.stages || [])
      );
      setEvents(evData?.events || []);
      setChecklistItems(Array.isArray(ckData?.items) ? ckData.items : []);
      setDataLoading(false);
    });
  }, [propertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ───────────────────────────────────────────────────────────
  const ROLE_META_OM = Object.fromEntries((pack.roles || []).map(r => [r.key, r]));
  const docCount        = Object.values(coordination?.docsByRole || {}).reduce((a, b) => a + b, 0);
  const submittedRoles  = new Set((coordination?.submissions || []).map(s => s.role));
  const requiredRoles   = Object.entries(ROLE_META_OM).filter(([, m]) => m.required).map(([k]) => k);
  const inviteSentCount = events.filter(e => e.event_type === 'invite_sent').length;

  const currentStageKey = coordination?.stage || stages[0]?.key;
  const currentStageIdx = Math.max(0, stages.findIndex(s => s.key === currentStageKey));
  const currentStageData = stages[currentStageIdx];

  const docSchema       = pack.getDocumentSchema?.(property?.property_type || property?.type) || [];
  const requiredDocCount = docSchema.filter(d => d.required).length;
  const openBlockers    = (briefing?.risks || briefing?.open_items || []).length;
  const closingDate     = property?.closing_date || property?.target_close_date || property?.close_date || '';
  const daysToClose     = closingDate
    ? Math.ceil((new Date(closingDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  // ── Overall status ─────────────────────────────────────────────────────────
  const STATUS_CFG = {
    not_enough_info: { label: 'Not Enough Information', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
    on_track:        { label: 'On Track',               color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    needs_attention: { label: 'Needs Attention',        color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    at_risk:         { label: 'At Risk',                color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    blocked:         { label: 'Blocked',                color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  };
  function computeStatus() {
    if (docCount === 0 && inviteSentCount === 0) return 'not_enough_info';
    const risks   = briefing?.risks   || briefing?.open_items   || [];
    const actions = briefing?.actions || briefing?.next_actions || [];
    const hasBlocker = actions.some(a => {
      const t = (typeof a === 'string' ? a : (a.text || '')).toLowerCase();
      return t.includes('block') || t.includes('urgent') || t.includes('critical') || t.includes('immediately');
    });
    if (hasBlocker) return 'blocked';
    const pendingRequired = requiredRoles.filter(r => !submittedRoles.has(r)).length;
    if (risks.length > 2 || pendingRequired > 1) return 'at_risk';
    if (risks.length > 0 || pendingRequired > 0) return 'needs_attention';
    return 'on_track';
  }
  const statusKey = computeStatus();
  const statusCfg = STATUS_CFG[statusKey];

  // ── Tokenization-specific derived state ────────────────────────────────────
  const isTokenization = isDigitalAssetLayerEnabled(property, pack);
  const metaValues = property?.metadata_values || {};

  // KYC progress — read from briefing snapshot if available
  const kycMetrics   = briefing?.snapshot?.kyc_aml?.metrics || briefing?.bySection?.kyc_aml?.metrics || {};
  const kycVerified  = kycMetrics.investors_verified  != null ? Number(kycMetrics.investors_verified)  : null;
  const kycPending   = kycMetrics.investors_pending   != null ? Number(kycMetrics.investors_pending)   : null;
  const kycTotal     = kycVerified != null && kycPending != null ? kycVerified + kycPending : null;
  const kycPct       = kycTotal > 0 ? Math.round((kycVerified / kycTotal) * 100) : null;

  // Tokenization 4-step setup guide completion signals
  const step1Done = !!(metaValues.raise_amount || metaValues.asset_type || metaValues.token_price);
  const step2Done = docCount > 0;
  const step3Done = events.some(e =>
    e.event_type === 'invite_sent' && ['counsel', 'compliance'].includes(e.metadata?.role)
  );
  const step4Done = currentStageIdx >= 2; // subscription or later

  // ── Action cards ───────────────────────────────────────────────────────────
  const rawActions  = briefing?.actions || briefing?.next_actions || [];
  const actionCards = rawActions.slice(0, 5).map((a, i) => ({
    text:        typeof a === 'string' ? a : (a.text || a.action || ''),
    severity:    typeof a === 'object' ? (a.severity || (i === 0 ? 'high' : 'medium')) : (i === 0 ? 'high' : 'medium'),
    responsible: typeof a === 'object' ? (a.party || a.responsible || a.role || '') : '',
    dueDate:     typeof a === 'object' ? (a.due_date || a.dueDate || '') : '',
    source:      typeof a === 'object' ? (a.source || a.from || '') : '',
  }));
  const SEVERITY_CFG = {
    high:     { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: 'High'     },
    critical: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: 'Critical' },
    medium:   { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: 'Medium'   },
    low:      { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', label: 'Low'      },
  };

  // ── Task #145 — Missing required documents (Overview action cards) ──────────
  // Cross-reference the pack's required document schema with the actual checklist
  // state so missing docs surface as amber cards at the top of the action area.
  // Uses live checklistItems (fetched in parallel on mount); falls back to the
  // pack's document schema when the checklist hasn't been seeded yet.
  const missingRequiredDocs = (() => {
    if (checklistItems.length > 0) {
      return checklistItems.filter(
        item => item.required && item.status !== 'uploaded' && !item.uploaded
      );
    }
    // Checklist not yet seeded: derive from pack schema; only show when the
    // room already has some activity (at least one upload or invite) so we
    // don't flood a brand-new empty room with placeholder warnings.
    if (docCount === 0 && inviteSentCount === 0) return [];
    return docSchema.filter(d => d.required).map(d => ({
      label: d.label, section: d.section, required: true,
    }));
  })();

  // ── Participant rows ────────────────────────────────────────────────────────
  const invitableRoles = (pack.roles || []).filter(r => r.invitable !== false);
  const participantRows = invitableRoles.map(r => {
    const sub     = (coordination?.submissions || []).find(s => s.role === r.key);
    const invited = events.some(e => e.event_type === 'invite_sent' && e.metadata?.role === r.key);
    const lastEv  = [...events].reverse().find(e =>
      (e.metadata?.role === r.key || e.actor_role === r.key) && e.created_at
    );
    const lastActivity = lastEv
      ? new Date(lastEv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—';
    let status = 'Not invited';
    if (invited && !sub)                         status = 'Invited';
    if (sub?.status === 'approved')              status = 'Approved';
    else if (sub?.status === 'needs_revision')   status = 'Needs Revision';
    else if (sub)                                status = 'Submitted';
    const statusStyle =
      status === 'Approved'       ? { color: '#16a34a', bg: '#f0fdf4' }
      : status === 'Submitted'    ? { color: '#1e40af', bg: '#eff6ff' }
      : status === 'Needs Revision'? { color: '#d97706', bg: '#fffbeb' }
      : status === 'Invited'      ? { color: '#6b7280', bg: '#f9fafb' }
      :                             { color: '#9ca3af', bg: '#f9fafb' };
    return { ...r, status, lastActivity, statusStyle, invited, submitted: !!sub };
  });

  // ── Recent events ──────────────────────────────────────────────────────────
  const EVENT_ICON = {
    invite_sent: '📧', doc_uploaded: '📄', party_submitted: '✅',
    stage_advance: '⏩', analysis_complete: '🤖', status_change: '🔄',
    lender_doc_ready: '📦', vap_ready: '✅',
  };
  const EVENT_LABEL = {
    invite_sent: 'Invite sent', doc_uploaded: 'Document uploaded',
    party_submitted: 'Party submitted', stage_advance: 'Stage advanced',
    status_change: 'Status changed', lender_doc_ready: 'Lender document ready',
    vap_ready: 'Verified package ready', analysis_complete: 'AI analysis complete',
  };
  const recentActivity = [...events].reverse().slice(0, 5).map(e => ({
    id: e.id, type: e.event_type,
    label: EVENT_LABEL[e.event_type] || (e.event_type || '').replace(/_/g, ' '),
    description: e.description || '',
    time: e.created_at
      ? new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '',
  }));

  return (
    <div className="space-y-5">

      {/* ── Area 1: Transaction header ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1.5 leading-tight">
              {property?.name || property?.property_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {pack.name && <span className="text-sm text-gray-500">{pack.name}</span>}
              {currentStageData && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <span className="text-gray-300 text-xs">·</span>
                  {currentStageData.icon} {currentStageData.label}
                </span>
              )}
              {closingDate && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <span className="text-gray-300 text-xs">·</span>
                  Target close: {new Date(closingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {isTokenization && property?.jurisdiction && JURISDICTION_INFO[property.jurisdiction] && (
                <span className="text-sm flex items-center gap-1.5">
                  <span className="text-gray-300 text-xs">·</span>
                  <span>{JURISDICTION_INFO[property.jurisdiction].flag}</span>
                  <span style={{ color: JURISDICTION_INFO[property.jurisdiction].color }}>
                    {JURISDICTION_INFO[property.jurisdiction].label}
                  </span>
                  {/* #177 — regulatory compliance progress badge (tokenization workspaces only) */}
                  {isTokenization && (() => {
                    const DONE_SET = new Set(['uploaded', 'approved', 'ai_complete']);
                    const regItems = checklistItems.filter(i =>
                      i.category === 'Regulatory' || (i.section || '').toLowerCase().includes('regulatory')
                    );
                    if (regItems.length === 0) return null;
                    const done  = regItems.filter(i => DONE_SET.has(i.status)).length;
                    const total = regItems.length;
                    const color = done === total ? '#16a34a' : done > 0 ? '#d97706' : '#dc2626';
                    return (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ color, background: color + '18' }}>
                        {done}/{total} regulatory
                      </span>
                    );
                  })()}
                </span>
              )}
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl text-sm font-bold border shrink-0"
            style={{ background: statusCfg.bg, color: statusCfg.color, borderColor: statusCfg.border }}>
            {statusCfg.label}
          </div>
        </div>
        {statusKey === 'not_enough_info' && (
          <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
            Upload documents and invite participants before Kontra can assess transaction risk.
          </p>
        )}
      </div>

      {/* ── Token offering KPI strip (tokenization only) ───────────────── */}
      {isTokenization && (() => {
        function fmtCurrency(raw) {
          const n = Number(raw);
          if (!raw || isNaN(n)) return null;
          if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
          if (n >= 1_000)     return `$${n.toLocaleString()}`;
          return `$${n}`;
        }
        const kpis = [
          { label: 'Raise Target',    value: fmtCurrency(metaValues.raise_amount),  field: 'raise_amount'   },
          { label: 'Token Price',     value: fmtCurrency(metaValues.token_price),   field: 'token_price'    },
          { label: 'Min Investment',  value: fmtCurrency(metaValues.min_investment),field: 'min_investment' },
          { label: 'Asset Type',      value: metaValues.asset_type || null,          field: 'asset_type'     },
        ];
        return (
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Token Offering</p>
              <button
                onClick={() => { onTabChange?.('settings'); setTimeout(() => document.getElementById('issuance-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }}
                className="text-[11px] font-semibold hover:opacity-80 transition" style={{ color: '#800020' }}>
                Edit details →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpis.map(kpi => (
                <div key={kpi.field} className="bg-gray-50 rounded-xl px-3 py-3 text-center">
                  {kpi.value ? (
                    <>
                      <p className="text-base font-black text-gray-900 mb-0.5 truncate">{kpi.value}</p>
                      <p className="text-[10px] text-gray-400 leading-tight">{kpi.label}</p>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { onTabChange?.('settings'); setTimeout(() => document.getElementById('issuance-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }}
                        className="text-sm font-bold hover:opacity-70 transition" style={{ color: '#800020' }}>
                        Set →
                      </button>
                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{kpi.label}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Ownership & Token Structure KPI strip (#182) ────────────────── */}
      {isTokenization && (() => {
        const mv = metaValues;
        const hasOwnership = mv.total_token_supply || mv.lead_investor || mv.investor_token_pct;
        if (!hasOwnership) return null;
        const ownershipKpis = [
          { label: 'Total Supply',      value: mv.total_token_supply ? Number(mv.total_token_supply).toLocaleString() : null },
          { label: 'Lead Investor',     value: mv.lead_investor || null },
          { label: 'Investor Alloc.',   value: mv.investor_token_pct  ? `${mv.investor_token_pct}%`  : null },
          { label: 'Team / Reserve',    value: (mv.team_token_pct || mv.reserve_token_pct)
              ? `${mv.team_token_pct || 0}% / ${mv.reserve_token_pct || 0}%` : null },
        ].filter(k => k.value);
        if (ownershipKpis.length === 0) return null;
        return (
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Ownership & Token Structure</p>
              <button
                onClick={() => { onTabChange?.('settings'); setTimeout(() => document.getElementById('ownership-structure')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }}
                className="text-[11px] font-semibold hover:opacity-80 transition" style={{ color: '#800020' }}>
                Edit →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ownershipKpis.map((kpi, i) => (
                <div key={i} className="bg-gray-50 rounded-xl px-3 py-3 text-center">
                  <p className="text-sm font-black text-gray-900 mb-0.5 truncate">{kpi.value}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">{kpi.label}</p>
                </div>
              ))}
            </div>
            {mv.vesting_schedule && (
              <p className="text-[10px] text-gray-400 mt-3 pt-3 border-t border-gray-100">
                <span className="font-semibold text-gray-500">Vesting:</span> {mv.vesting_schedule}
                {mv.governance_rights && <> &nbsp;·&nbsp; <span className="font-semibold text-gray-500">Rights:</span> {mv.governance_rights}</>}
              </p>
            )}
          </div>
        );
      })()}

      {/* ── Jurisdiction compliance card (tokenization only) ───────────── */}
      {/* Only shown for tokenization workspaces — the card contains token-issuance
          specific regulatory content (FSRA licence, MiCA White Paper, etc.) that
          is irrelevant and misleading on CRE or business acquisition deals. */}
      {isTokenization && property?.jurisdiction && JURISDICTION_INFO[property.jurisdiction] && (
        <JurisdictionComplianceCard jurisdiction={property.jurisdiction} />
      )}

      {/* ── Digital Asset Readiness overview card (tokenization only) ────── */}
      {/* Phase 2 of the Digital Asset Layer spec. A scored, categorised snapshot
          of how prepared the workspace is for token issuance. Suggested preparation
          only — not a legal or regulatory determination (spec §3). */}
      {isTokenization && (() => {
        // 1. Issuance setup — are the four key offering parameters filled?
        const ISSUANCE_FIELDS = [
          { key: 'raise_amount',   label: 'Raise Target'   },
          { key: 'token_price',    label: 'Token Price'    },
          { key: 'asset_type',     label: 'Asset Type'     },
          { key: 'min_investment', label: 'Min Investment' },
        ];
        const filledIssuance  = ISSUANCE_FIELDS.filter(f => !!metaValues[f.key]);
        const missingIssuance = ISSUANCE_FIELDS.filter(f => !metaValues[f.key]).map(f => f.label);
        const issuancePct     = Math.round((filledIssuance.length / ISSUANCE_FIELDS.length) * 100);

        // 2. Documentation — use real checklist when available; fall back to docCount heuristic
        const reqItems         = checklistItems.filter(i => i.required);
        const UPLOADED_STATUSES = new Set(['uploaded', 'approved', 'ai_complete']);
        const uploadedReqItems = reqItems.filter(i => UPLOADED_STATUSES.has(i.status));
        const DOC_TARGET = 5;
        const docPct = reqItems.length > 0
          ? Math.min(Math.round((uploadedReqItems.length / reqItems.length) * 100), 100)
          : Math.min(Math.round((Math.min(docCount, DOC_TARGET) / DOC_TARGET) * 100), 100);
        const docMissing = reqItems.length > 0
          ? reqItems
              .filter(i => !UPLOADED_STATUSES.has(i.status))
              .slice(0, 2)
              .map(i => i.label || i.section || 'Required document')
          : docCount === 0
            ? ['No documents uploaded yet']
            : docCount < DOC_TARGET
              ? [`${DOC_TARGET - docCount} more document${DOC_TARGET - docCount !== 1 ? 's' : ''} suggested`]
              : [];

        // 3. Jurisdiction & regulatory — use Regulatory checklist items when available
        const hasJurisdiction = !!property?.jurisdiction;
        const regItems        = checklistItems.filter(i =>
          i.category === 'Regulatory' || (i.section || '').toLowerCase().includes('regulatory')
        );
        const uploadedRegItems = regItems.filter(i => UPLOADED_STATUSES.has(i.status));
        const jurisdictionPct  = regItems.length > 0
          ? Math.round(((hasJurisdiction ? 0.4 : 0) + 0.6 * (uploadedRegItems.length / regItems.length)) * 100)
          : Math.round((((hasJurisdiction ? 1 : 0) + (hasJurisdiction && docCount > 0 ? 1 : 0)) / 2) * 100);
        const jurisdictionMissing = !hasJurisdiction
          ? ['Jurisdiction not selected']
          : regItems.length > 0
            ? regItems.filter(i => !UPLOADED_STATUSES.has(i.status)).slice(0, 2).map(i => i.label || i.section)
            : docCount === 0 ? ['Upload regulatory documents'] : [];

        // 4. Participants — non-coordinator roles invited or submitted
        const nonCoordRows      = participantRows.filter(r => !r.canManage);
        const invitedCount      = nonCoordRows.filter(r => r.invited || r.submitted).length;
        const participantTarget = Math.max(nonCoordRows.length, 1);
        const participantPct    = nonCoordRows.length === 0 ? 0
          : Math.min(Math.round((invitedCount / participantTarget) * 100), 100);
        const uninvited          = nonCoordRows.filter(r => !r.invited && !r.submitted).map(r => r.label).slice(0, 2);
        const participantMissing = uninvited.map(l => `${l} not yet invited`);

        // 5. KYC & verification
        const kycComputed  = kycPct != null ? kycPct : (step3Done ? 25 : 0);
        const kycPctCapped = Math.min(kycComputed, 100);
        const kycMissing   = kycComputed === 0
          ? ['No KYC documents analyzed yet']
          : kycPct != null && kycPct < 100
            ? [`${100 - kycPct}% of investors pending verification`]
            : [];

        // Weighted overall score
        const WEIGHTS = [0.20, 0.25, 0.20, 0.20, 0.15];
        const PCTS    = [issuancePct, docPct, jurisdictionPct, participantPct, kycPctCapped];
        const overall = Math.round(PCTS.reduce((acc, p, i) => acc + p * WEIGHTS[i], 0));
        const overallColor  = overall >= 75 ? '#16a34a' : overall >= 40 ? '#d97706' : '#dc2626';
        const overallStatus = overall >= 75 ? 'On Track' : overall >= 40 ? 'In Progress' : 'Getting Started';

        const goToSettings     = () => { onTabChange?.('settings'); setTimeout(() => document.getElementById('issuance-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); };
        const goToDocuments    = () => onTabChange?.('documents');
        const goToParticipants = () => onTabChange?.('participants');

        // Each category carries an explanation (shown when expanded) so coordinators
        // understand WHY the requirement exists — spec §2 requirement-level explanations.
        const CATEGORIES = [
          {
            key: 'issuance',
            icon: '🏷️', label: 'Issuance Details', pct: issuancePct,
            missing: missingIssuance,
            ctaLabel: 'Settings → Issuance Details', onClick: goToSettings,
            explanation: 'Raise Target, Token Price, Min Investment, and Asset Type are the four parameters that define your token offering. Investors and platform providers need these to evaluate whether participation is suitable for them.',
          },
          {
            key: 'documents',
            icon: '📄', label: 'Documents Uploaded', pct: docPct,
            missing: docMissing,
            ctaLabel: 'Documents tab', onClick: goToDocuments,
            explanation: 'A token offering requires a verified document package: the Token Offering Memorandum, legal agreements, financial statements, and any other materials counterparties need to assess the offering. These form the foundation of the Verified Digital Asset Package.',
          },
          {
            key: 'jurisdiction',
            icon: '🌍', label: 'Jurisdiction & Regulatory', pct: jurisdictionPct,
            missing: jurisdictionMissing,
            ctaLabel: !hasJurisdiction ? 'Settings → Jurisdiction' : 'Upload regulatory docs', onClick: goToSettings,
            explanation: 'Jurisdiction determines which regulatory framework governs your offering — ADGM, MiCA, Reg D, MAS, or FCA. Each framework has specific required filings, approvals, and disclosures. Selecting a jurisdiction loads the right preparation checklist.',
          },
          {
            key: 'participants',
            icon: '👥', label: 'Participants Invited', pct: participantPct,
            missing: participantMissing,
            ctaLabel: 'Participants tab', onClick: goToParticipants,
            explanation: 'Legal Counsel, Compliance Officer, and KYC/AML Provider must be in the workspace before a token offering can proceed. Their reviews and approvals are required to complete the Verified Digital Asset Package.',
          },
          {
            key: 'kyc',
            icon: '✅', label: 'KYC & Verification', pct: kycPctCapped,
            missing: kycMissing,
            ctaLabel: 'Upload KYC documents', onClick: goToDocuments,
            explanation: 'All investors must be KYC/AML-verified before subscription closes. Upload KYC documents (passports, proof of address, accreditation letters) so the AI can extract and track verification status across the investor pool.',
          },
        ];

        return (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 pt-4 pb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                Digital Asset Readiness
              </p>
              <div className="flex items-end justify-between gap-2 flex-wrap">
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-black leading-none" style={{ color: overallColor }}>{overall}%</span>
                  <span className="text-sm text-gray-500 mb-0.5 leading-tight">{overallStatus}</span>
                </div>
                <span className="text-[10px] text-gray-300 leading-snug text-right max-w-[180px]">
                  Suggested preparation — not a regulatory determination
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${overall}%`, background: overallColor }} />
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {CATEGORIES.map(cat => {
                const done     = cat.pct >= 100;
                const partial  = cat.pct > 0 && cat.pct < 100;
                const cc       = done ? '#16a34a' : partial ? '#d97706' : '#9ca3af';
                const expanded = expandedReadinessKey === cat.key;
                return (
                  <div key={cat.key}>
                    {/* Row header — click to expand/collapse explanation */}
                    <button
                      className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition text-left"
                      onClick={() => setExpandedReadinessKey(expanded ? null : cat.key)}>
                      <span className="text-sm shrink-0">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-gray-700">{cat.label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-bold" style={{ color: cc }}>
                              {done ? '✓ Complete' : `${cat.pct}%`}
                            </span>
                            <span className="text-[10px] text-gray-300">{expanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {!done && !expanded && cat.missing.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5 leading-snug truncate">
                            {cat.missing[0]}{cat.missing.length > 1 && <span> +{cat.missing.length - 1} more</span>}
                          </p>
                        )}
                      </div>
                      <div className="w-14 h-1 rounded-full bg-gray-100 shrink-0 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${cat.pct}%`, background: cc }} />
                      </div>
                    </button>

                    {/* Expanded explanation panel */}
                    {expanded && (
                      <div className="px-5 pb-3 pt-1 bg-gray-50 border-t border-gray-100">
                        <p className="text-[11px] text-gray-500 leading-relaxed mb-2">{cat.explanation}</p>
                        {!done && cat.missing.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Missing</p>
                            <ul className="space-y-0.5">
                              {cat.missing.map((m, mi) => (
                                <li key={mi} className="text-[11px] text-gray-600 flex items-center gap-1.5">
                                  <span className="text-gray-300">·</span>{m}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <button onClick={cat.onClick}
                          className="text-[11px] font-bold hover:opacity-70 transition" style={{ color: '#800020' }}>
                          {cat.ctaLabel} →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 leading-snug">
                Suggested preparation checklist only. Review all requirements with qualified legal, financial,
                and regulatory advisers. Completion does not imply regulatory approval or eligibility to issue tokens.
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Area 2: Issuance Manager / Operations Manager ───────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#800020' }}>
            {isTokenization ? 'Issuance Manager' : 'Operations Manager'}
          </p>
          <p className="text-base font-bold text-gray-900">
            {isTokenization ? 'Launch your token offering.' : 'Here is what needs attention next.'}
          </p>
        </div>
        <div className="p-5">
          {/* Task #145 — Missing required document action cards on Overview tab.
              Shown when there are outstanding required docs and brief has loaded,
              so coordinators can act without switching to the Documents tab. */}
          {!briefLoading && missingRequiredDocs.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">📋</span>
                <p className="text-xs font-bold text-amber-700">
                  {missingRequiredDocs.length} required document{missingRequiredDocs.length !== 1 ? 's' : ''} still needed
                </p>
                <button
                  onClick={() => onTabChange?.('documents')}
                  className="ml-auto text-[11px] font-semibold text-[#800020] hover:underline transition"
                >
                  Go to Documents →
                </button>
              </div>
              <div className="space-y-1.5">
                {missingRequiredDocs.slice(0, 3).map((doc, i) => (
                  <div key={i}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50">
                    <span className="text-amber-400 shrink-0">📄</span>
                    <span className="text-xs font-medium text-amber-900 flex-1 truncate">
                      {doc.label || doc.section || 'Required document'}
                    </span>
                    <button
                      onClick={() => onTabChange?.('documents')}
                      className="shrink-0 text-[11px] font-bold text-amber-700 hover:text-amber-900 transition"
                    >
                      Upload →
                    </button>
                  </div>
                ))}
                {missingRequiredDocs.length > 3 && (
                  <button
                    onClick={() => onTabChange?.('documents')}
                    className="w-full text-[11px] text-amber-600 hover:text-amber-900 transition py-1 text-center rounded-lg hover:bg-amber-50"
                  >
                    + {missingRequiredDocs.length - 3} more missing → view all
                  </button>
                )}
              </div>
            </div>
          )}

          {briefLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}
            </div>
          ) : actionCards.length === 0 ? (
            isTokenization ? (
              /* ── Tokenization 4-step setup guide ── */
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Get your issuance ready</p>
                <p className="text-xs text-gray-400 mb-4">Complete these steps to open your subscription period.</p>
                <div className="space-y-2.5">
                  {[
                    {
                      done: step1Done,
                      icon: '📋',
                      title: 'Complete issuance details',
                      sub:   'Set raise amount, token price, asset type, and minimum investment',
                      action: () => { onTabChange?.('settings'); setTimeout(() => document.getElementById('issuance-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); },
                      cta: 'Fill in →',
                    },
                    {
                      done: step2Done,
                      icon: '📄',
                      title: 'Upload TOM & regulatory documents',
                      sub:   'Token Offering Memorandum and any jurisdiction-required filings',
                      action: () => onTabChange?.('documents'),
                      cta: 'Upload →',
                    },
                    {
                      done: step3Done,
                      icon: '⚖️',
                      title: 'Invite Counsel & Compliance Officer',
                      sub:   'They will review documents and complete KYC/AML verification',
                      action: () => onTabChange?.('participants'),
                      cta: 'Invite →',
                    },
                    {
                      done: step4Done,
                      icon: '🏛️',
                      title: 'Open subscription period',
                       sub:   'Advance the deal room to Subscription stage and invite lead investors',
                      action: () => onTabChange?.('participants'),
                      cta: 'Advance →',
                    },
                  ].map((step, i) => (
                    <div key={i}
                      className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition ${step.done ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-200'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${step.done ? 'bg-green-500 text-white' : 'bg-white border border-gray-300 text-gray-400'}`}>
                        {step.done ? '✓' : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${step.done ? 'text-green-800 line-through decoration-green-400' : 'text-gray-800'}`}>{step.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-snug">{step.sub}</p>
                      </div>
                      {!step.done && (
                        <button onClick={step.action}
                          className="shrink-0 text-[11px] font-bold hover:opacity-80 transition mt-0.5" style={{ color: '#800020' }}>
                          {step.cta}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            <div>
               <p className="text-sm font-semibold text-gray-800 mb-1">Get your deal room moving</p>
              <p className="text-xs text-gray-400 mb-4">Kontra will surface prioritized actions once participants and documents are added.</p>
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => onTabChange?.('participants')}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition text-left group">
                  <span className="text-lg">👥</span>
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Invite Participants</span>
                </button>
                <button onClick={() => onTabChange?.('documents')}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition text-left group">
                  <span className="text-lg">📄</span>
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Upload Document</span>
                </button>
              </div>
            </div>
            )
          ) : (
            <div className="space-y-3">
              {actionCards.map((card, i) => {
                const sev = SEVERITY_CFG[card.severity] || SEVERITY_CFG.medium;
                return (
                  <div key={i} className="rounded-xl border px-4 py-3 flex items-start gap-3"
                    style={{ borderColor: i === 0 ? sev.border : '#e5e7eb', background: i === 0 ? sev.bg : '#fafafa' }}>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5"
                      style={{ background: sev.bg, color: sev.text, borderColor: sev.border }}>
                      {sev.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-relaxed">{card.text}</p>
                      {(card.responsible || card.dueDate || card.source) && (
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          {card.responsible && <span className="text-[11px] text-gray-400">👤 {card.responsible}</span>}
                          {card.dueDate     && <span className="text-[11px] text-gray-400">📅 {card.dueDate}</span>}
                          {card.source      && <span className="text-[11px] text-gray-400">📎 {card.source}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!briefLoading && (briefing?.risks || briefing?.open_items || []).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Open items</p>
              <div className="space-y-1.5">
                {(briefing?.risks || briefing?.open_items).slice(0, 3).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                    <span className="text-amber-500 shrink-0 mt-0.5 text-xs">⚠</span>
                    <span className="text-xs text-amber-800">
                      {typeof r === 'string' ? r : (r.text || r.risk || '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Area 3: Transaction progress ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Transaction Progress</p>
        {stages.length > 0 && (
          <div className="flex items-center gap-1 mb-5">
            {stages.map((s, i) => {
              const done   = i < currentStageIdx;
              const active = i === currentStageIdx;
              return (
                <div key={s.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all
                      ${done ? 'bg-[#800020] text-white' : active ? 'bg-[#800020]/10 border-2 border-[#800020] text-[#800020]' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? '✓' : (s.icon || '·')}
                    </div>
                    <p className={`text-[9px] font-semibold text-center leading-tight
                      ${active ? 'text-[#800020]' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                      {s.label}
                    </p>
                  </div>
                  {i < stages.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mb-3 rounded ${i < currentStageIdx ? 'bg-[#800020]' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Required documents',
              value: requiredDocCount > 0 ? `${docCount} / ${requiredDocCount}` : `${docCount} uploaded`,
              ok: docCount > 0,
            },
            {
              label: 'Participants current',
              value: submittedRoles.size > 0 ? `${submittedRoles.size} submitted` : `${inviteSentCount} invited`,
              ok: submittedRoles.size > 0,
            },
            {
              label: 'Open blockers',
              value: !briefing ? 'Not assessed' : openBlockers > 0 ? String(openBlockers) : 'None',
              ok: !!briefing && openBlockers === 0,
            },
            {
              label: 'Days to close',
              value: daysToClose != null ? `${daysToClose}d` : '—',
              ok: daysToClose == null || daysToClose > 14,
            },
          ].map(m => (
            <div key={m.label} className="bg-gray-50 rounded-xl px-3 py-3 text-center">
              <p className={`text-lg font-black mb-0.5 ${m.ok ? 'text-gray-900' : 'text-amber-600'}`}>{m.value}</p>
              <p className="text-[10px] text-gray-400 leading-tight">{m.label}</p>
            </div>
          ))}
        </div>

        {/* ── Advance stage — visible to workspace owners on all pack types ─ */}
        {/* Task #100: non-CRE packs had no way to move through lifecycle stages */}
        {ownerToken && stages.length > 0 && currentStageIdx < stages.length - 1 && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 leading-snug">
                Next stage:{' '}
                <span className="font-semibold text-gray-800">
                  {stages[currentStageIdx + 1]?.icon && `${stages[currentStageIdx + 1].icon} `}
                  {stages[currentStageIdx + 1]?.label}
                </span>
              </p>
              {stages[currentStageIdx + 1]?.desc && (
                <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                  {stages[currentStageIdx + 1].desc}
                </p>
              )}
            </div>
            <button
              onClick={() => handleAdvanceStage(stages[currentStageIdx + 1]?.key)}
              disabled={advancingStage}
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              style={{ background: '#800020' }}>
              {advancingStage
                ? 'Advancing…'
                : `Advance to ${stages[currentStageIdx + 1]?.label} →`}
            </button>
          </div>
        )}
        {/* Final stage — show completion badge */}
        {ownerToken && stages.length > 0 && currentStageIdx === stages.length - 1 && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
            <span className="text-sm">🎉</span>
            <p className="text-xs font-semibold text-green-700">
              Transaction reached final stage: {stages[currentStageIdx]?.label}
            </p>
          </div>
        )}

        {/* ── KYC / Investor progress (tokenization only) ─────────────── */}
        {isTokenization && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">KYC / Investor Progress</p>
              {kycTotal != null && kycTotal > 0 && (
                <span className="text-[10px] font-semibold"
                  style={{ color: kycPct >= 80 ? '#16a34a' : kycPct >= 40 ? '#d97706' : '#dc2626' }}>
                  {kycPct}% verified
                </span>
              )}
            </div>
            {kycTotal != null && kycTotal > 0 ? (
              <>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${kycPct}%`,
                      background: kycPct >= 80 ? '#16a34a' : kycPct >= 40 ? '#d97706' : '#dc2626',
                    }} />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">
                    <span className="font-bold text-gray-800">{kycVerified}</span> verified
                  </span>
                  {kycPending > 0 && (
                    <span className="text-xs text-amber-600 font-semibold">
                      {kycPending} pending KYC
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400">
                KYC progress will appear after the KYC/AML Certificate is uploaded and analyzed.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Settlement Layer ─────────────────────────────────────────────── */}
      <SettlementPanel
        propertyId={propertyId}
        property={property}
        isAtFinalStage={stages.length > 0 && currentStageIdx >= stages.length - 1}
      />

      {/* ── Area 4: Participant status ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Participant Status</p>
          <button onClick={() => onTabChange?.('participants')}
            className="text-[11px] font-semibold text-[#800020] hover:opacity-80 transition">
            Manage →
          </button>
        </div>
        {dataLoading ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        ) : participantRows.length === 0 ? (
           <p className="px-5 py-6 text-sm text-gray-400 text-center">No roles configured for this deal room.</p>
        ) : (
          <div>
            <div className="hidden sm:grid grid-cols-[2fr_2fr_1fr_auto] gap-4 px-5 py-2 bg-gray-50 border-b border-gray-100">
              {['Participant / Role', 'Responsibility', 'Status', 'Action'].map(h => (
                <p key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</p>
              ))}
            </div>
            <div className="divide-y divide-gray-100">
              {participantRows.map(p => (
                <div key={p.key} className="grid sm:grid-cols-[2fr_2fr_1fr_auto] gap-4 items-center px-5 py-3">
                  <div className="flex items-center gap-2.5 col-span-full sm:col-span-1">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
                      style={{ background: (p.color || '#800020') + '15' }}>
                      {p.icon}
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{p.label}</span>
                  </div>
                  <p className="hidden sm:block text-xs text-gray-400 truncate">{p.headline || p.subtext || p.label}</p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
                    style={{ background: p.statusStyle.bg, color: p.statusStyle.color }}>
                    {p.status}
                  </span>
                  <div className="flex items-center gap-2 sm:justify-end">
                    {p.status === 'Not invited' && (
                      <button onClick={() => onTabChange?.('participants')}
                        className="text-[11px] font-semibold text-[#800020] hover:underline transition shrink-0">
                        Invite →
                      </button>
                    )}
                    {p.status === 'Invited' && (
                      <button onClick={() => onTabChange?.('participants')}
                        className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition shrink-0">
                        Send reminder
                      </button>
                    )}
                    {p.status === 'Needs Revision' && (
                      <button onClick={() => onTabChange?.('participants')}
                        className="text-[11px] font-semibold text-amber-600 hover:underline transition shrink-0">
                        Notify →
                      </button>
                    )}
                    {(p.status === 'Submitted' || p.status === 'Approved') && (
                      <span className="text-[11px] text-gray-300">{p.lastActivity}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Area 5: Recent activity ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recent Activity</p>
          <button onClick={() => onTabChange?.('activity')}
            className="text-[11px] font-semibold text-[#800020] hover:opacity-80 transition">
            View all activity →
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              Activity will appear here after participants are invited or documents are uploaded.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentActivity.map((e, i) => (
              <div key={e.id || i} className="px-5 py-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 bg-gray-50 mt-0.5">
                  {EVENT_ICON[e.type] || '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">{e.label}</p>
                  {e.description && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{e.description}</p>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">{e.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default function DealRoomPage() {
  const { propertyId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get("role") || "owner";
  const from = searchParams.get("from") || "";

  const inviteToken = searchParams.get("invite") || null;
  const [participantSession, setParticipantSession] = useState(() => getInviteSession(propertyId));
  const [accessRole, setAccessRole] = useState(null);
  const role = accessRole || (participantSession ? "guest" : requestedRole);

  const [showDemoIntro, setShowDemoIntro] = useState(() => {
    const demoIds = ['kontra-demo', 'kontra-demo-biz', 'kontra-demo-fundraising'];
    return demoIds.includes(propertyId) && !sessionStorage.getItem('kontra-demo-intro-seen');
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [apiProperty, setApiProperty] = useState(null);
  const [loadingApi, setLoadingApi] = useState(true);
  const [packLoadError, setPackLoadError] = useState("");
  // packReady: true once the custom pack for this room is registered in the
  // client-side PACKS registry. Demo rooms always use a built-in pack so it
  // starts true; live rooms wait for ensureWorkflowPackLoaded to resolve.
  const [packReady, setPackReady] = useState(!!DEMO_PROPERTIES[propertyId]);
  const [analysesRefreshKey, setAnalysesRefreshKey] = useState(0);
  const [activeTab, setActiveTabRaw] = useState('overview');
  // Wrap tab setter to emit analytics
  const setActiveTab = useCallback((tab) => {
    setActiveTabRaw(tab);
    trackEvent('workspace_tab_viewed', { tab, workspace_id: propertyId });
  }, [propertyId]);
  // Pack correction: set when AI thinks the stored pack is wrong for this room
  const [packSuggestion, setPackSuggestion] = useState(null); // { suggestedPack, currentPack }
  const [repackLoading, setRepackLoading] = useState(false);

  const onAnalysisSaved = () => setAnalysesRefreshKey(k => k + 1);

  // Track workspace page view on load
  useEffect(() => {
    trackEvent('workspace_viewed', { workspace_id: propertyId });
  }, [propertyId]);

  // Try to fetch custom deal room from API
  useEffect(() => {
    // Skip API fetch for demo rooms
    if (DEMO_PROPERTIES[propertyId]) {
      setLoadingApi(false);
      return;
    }
    if (inviteToken && !participantSession) return;
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || `Workspace request failed (${r.status})`);
        return data;
      })
      .then(async data => {
        setPackLoadError("");
        if (data?.workflow_pack_id) {
          await ensureWorkflowPackLoaded(
            data.workflow_pack_id,
            data.workflow_pack_config || null,
          );
        }
        // Mark pack ready BEFORE setApiProperty so DocumentChecklistPanel
        // receives a resolved workflowPack on its first seed attempt.
        setPackReady(true);
        setApiProperty(data);
        if (data?.access?.mode === 'participant' && data.access.role) {
          setAccessRole(data.access.role);
        }
        // Owner: always grant coordinator access regardless of the checkout-selected role.
        // The stored DB role may be 'buyer', 'lender', etc. when the owner chose a
        // non-coordinator role during room creation. The API now returns safe.role =
        // 'deal_coordinator' for owner-token requests, but setAccessRole here ensures
        // isCoordinator resolves correctly even against a stale cached response.
        if (data?.access?.mode === 'owner') {
          setAccessRole('deal_coordinator');
        }
        setLoadingApi(false);
      })
      .catch((error) => {
        console.error("[deal-room-load]", error);
        setPackLoadError(error.message || "The workspace configuration could not be loaded.");
        setPackReady(false);
        setLoadingApi(false);
      });
  }, [propertyId, inviteToken, participantSession]);

  // After a room loads, ask AI whether the stored pack matches the transaction.
  // Only runs for coordinator view of live (non-demo) rooms with a standard built-in pack.
  // Custom ws_* packs are always intentional — never suggest a change for those.
  useEffect(() => {
    if (!apiProperty || DEMO_PROPERTIES[propertyId]) return;
    const stored = apiProperty.workflow_pack_id;
    if (!stored || stored.startsWith('ws_')) return;
    fetch(`${API_BASE}/api/public/classify-pack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: apiProperty.property_name,
        dealType: apiProperty.deal_type,
        address: apiProperty.address,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.packId && data.packId !== stored) {
          setPackSuggestion({ suggestedPack: data.packId, currentPack: stored });
        }
      })
      .catch(() => {});
  }, [apiProperty?.property_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRepack(acceptedPackId) {
    setRepackLoading(true);
    setPackSuggestion(null);
    try {
      // Read the owner token stored at checkout — same credential used by the checklist PUT
      let ownerWriteToken = '';
      try { ownerWriteToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch {}

      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/repack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: acceptedPackId, ownerWriteToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[repack]', data.error);
        setRepackLoading(false);
        return;
      }
      window.location.reload();
    } catch {
      setRepackLoading(false);
    }
  }

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

  const isDemo = ['kontra-demo', 'kontra-demo-biz', 'kontra-demo-fundraising'].includes(propertyId);

  // Per-demo hero image overrides — each room gets a visually appropriate photo
  if (propertyId === 'kontra-demo' && property) {
    property.image = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80";
    property.market = "Miami, FL";
    property.deal_amount = property.deal_amount || "14,000,000";
  }
  if (propertyId === 'kontra-demo-biz' && property) {
    property.image = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80";
    property.market = "Austin, TX";
    property.deal_amount = property.deal_amount || "8,500,000";
  }
  if (propertyId === 'kontra-demo-fundraising' && property) {
    property.image = "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80";
    property.market = "San Francisco, CA";
    property.deal_amount = property.deal_amount || "42,000,000";
  }

  // Which Workflow Pack powers this deal room. Demo properties are always
  // CRE Acquisition; custom rooms carry their pack id from creation time.
  // Resolution (deal_type inference wins over the stored workflow_pack_id
  // column) lives in one shared place — lib/workflowPacks.resolvePackId —
  // so every page that needs a room's pack (this page, checkout success,
  // invite links, etc.) agrees, instead of duplicating/drifting logic.
  const packId = demoProperty ? DEFAULT_PACK_ID : resolvePackId(apiProperty);
  const pack = getWorkflowPack(packId);
  const isCREPack       = packId === DEFAULT_PACK_ID;
  const isTokenization  = isDigitalAssetLayerEnabled(apiProperty, pack);

  if (inviteToken && !participantSession) {
    return (
      <DealRoomPinGate
        propertyId={propertyId}
        role={requestedRole}
        inviteToken={inviteToken}
        onUnlocked={(sessionToken) => setParticipantSession(sessionToken)}
      />
    );
  }

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
    headline: "Review the shared documents and transaction materials",
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

  // isCoordinator: true for the managing/primary role in any pack.
  // canManage covers pack-native roles (owner/CRE, buyer/M&A, founder/Fundraising, lender/CRE).
  // role === 'owner' is the legacy default URL param used by checkout and invite flows for
  // every pack — keep it as a coordinator fallback for backward compatibility so existing
  // deal-room links (?role=owner) continue to grant management access in non-CRE packs.
  // property?.access?.mode === 'owner' is belt-and-suspenders: covers the initial render
  // frame before setAccessRole has propagated, and custom packs where 'deal_coordinator'
  // may not be a named role key with canManage set.
  const isCoordinator = !!roleConfig?.canManage || role === 'owner' || property?.access?.mode === 'owner';

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

  // Task #187 — prevent participants from seeing room content before their session
  // is confirmed on slow connections. When an invite token is present the page
  // must NOT flash any room content while the API is still loading; show a
  // dedicated "confirming access" spinner instead of the generic workspace spinner.
  if (inviteToken && loadingApi) {
    return (
      <PublicLayout hideFooter>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-xs">
            <div className="w-10 h-10 border-2 border-gray-200 border-t-[#800020] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-gray-700">Confirming your access…</p>
            <p className="text-xs text-gray-400 mt-1">Please wait while we verify your invitation.</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // Generic loading state
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

  if (packLoadError && isCustom) {
    return (
      <PublicLayout hideFooter>
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="max-w-lg w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Deal room configuration unavailable</h1>
            <p className="text-sm text-gray-600">
              This deal room could not load its transaction-specific configuration, so Kontra stopped instead of showing the wrong template.
            </p>
            <p className="mt-3 text-xs text-red-700 break-words">{packLoadError}</p>
            <button onClick={() => window.location.reload()}
              className="mt-5 px-4 py-2 rounded-xl bg-[#800020] text-white text-sm font-semibold">
              Try again
            </button>
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
    ? buildPendingSectionMap(property, role, onAnalysisSaved, propertyId, analysesRefreshKey, pack)
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
    <>
    {/* ── Demo intro overlay ───────────────────────────────────────────── */}
    {showDemoIntro && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/95 backdrop-blur-sm px-6">
        <div className="bg-gray-900 border border-gray-700 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6"
            style={{ background: "#80002015", border: "1px solid #80002040" }}>
            {propertyId === 'kontra-demo-biz' ? '💼' : propertyId === 'kontra-demo-fundraising' ? '📈' : '🏢'}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#c0392b" }}>
            Welcome to the Kontra Demo
          </p>
          <h2 className="text-2xl font-black text-white mb-4 leading-snug">
            You're about to enter a live deal room.
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Watch how Kontra's AI Operations Manager coordinates participants, tracks documents, identifies blockers, and keeps every party moving toward closing.
          </p>
          <ul className="text-left space-y-3 mb-8">
            {[
              "Coordinates all participants from one deal room",
              "AI reviews every document and surfaces flags",
              "Tracks what's missing and who needs to act",
              "Generates a verified closing package at completion",
            ].map(item => (
              <li key={item} className="flex items-start gap-3 text-sm text-gray-300">
                <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              sessionStorage.setItem('kontra-demo-intro-seen', '1');
              setShowDemoIntro(false);
            }}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "#800020" }}>
            Enter Demo →
          </button>
          <p className="text-xs text-gray-600 mt-3">No account required</p>
        </div>
      </div>
    )}
    <PublicLayout
      hideFooter
      dealRoomMode={!!(property.isCustom && !isDemo)}
      dealRoomTitle={property.name || property.property_name || ""}
    >
      {/* Pack correction banner — shown to coordinators when AI detects a wrong workflow pack */}
      {packSuggestion && isCoordinator && !isDemo && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-lg shrink-0">🔍</span>
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  This looks like a {PACK_LABELS[packSuggestion.suggestedPack] || packSuggestion.suggestedPack} deal room
                </p>
                <p className="text-[10px] text-amber-700">
                  Currently using {PACK_LABELS[packSuggestion.currentPack] || packSuggestion.currentPack} template — switching loads the right document checklist, roles, and stages
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleRepack(packSuggestion.suggestedPack)}
                disabled={repackLoading}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: '#d97706' }}>
                {repackLoading ? 'Switching…' : `Switch to ${PACK_LABELS[packSuggestion.suggestedPack]} →`}
              </button>
              <button
                onClick={() => setPackSuggestion(null)}
                className="text-xs text-amber-600 hover:text-amber-900 transition px-2">
                Keep current
              </button>
            </div>
          </div>
        </div>
      )}

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
                <p className="text-xs font-semibold text-white">{property?.name || property?.property_name || 'Kontra Demo'} · AI features active</p>
                <p className="text-[10px] text-white/50">Shared demo room · Explore all panels · No signup required</p>
              </div>
            </div>
            <Link to="/create-deal-room"
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
              Create Your Deal Room →
            </Link>
          </div>
        </div>
      ) : property.isCustom && isCoordinator ? (
        <div className="border-b border-green-100 bg-green-50 px-6 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0 bg-green-100">
                🔑
              </div>
              <div>
                <p className="text-xs font-semibold text-green-900">Deal room active — invite participants and upload documents to begin</p>
                <p className="text-[10px] text-green-600">Secure role-based access for every participant · AI analyzes each file as it's uploaded</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ShareButton propertyId={propertyId} />
            </div>
          </div>
        </div>
      ) : property.isCustom ? (
        <div className="border-b px-6 py-3" style={{ borderColor: roleConfig.color + '20', background: roleConfig.color + '06' }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: roleConfig.color + '15' }}>
                {roleConfig.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">
                  {from ? `${decodeURIComponent(from)} invited you` : "You've been invited"} · <span style={{ color: roleConfig.color }}>{roleConfig.label}</span>
                </p>
                <p className="text-[10px] text-gray-400">Review the documents assigned to your role below · Access via secure invitation link</p>
              </div>
            </div>
            <Link to="/create-deal-room"
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
              style={{ background: roleConfig.color }}>
              Create Your Room →
            </Link>
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

      {/* Workspace tab nav — coordinator view of live paid rooms only */}
      {property.isCustom && isCoordinator && !isDemo && (
        <WorkspaceTabNav
          activeTab={activeTab}
          onChange={setActiveTab}
          showDigitalAssetTab={isTokenization}
        />
      )}

      <div className="max-w-5xl mx-auto px-6 py-8">

        {property.isCustom && isCoordinator && !isDemo ? (

          /* ── Coordinator tabbed layout ────────────────────────────────── */
          <>
            {activeTab === 'overview' && (
              <OperationsManagerView
                propertyId={pid}
                property={property}
                pack={pack}
                role={role}
                onTabChange={setActiveTab}
              />
            )}

            {activeTab === 'documents' && (
              <>
                <div id="documents-panel">
                  <DocumentsTabPanel
                    propertyId={pid}
                    propertyType={property.property_type || property.type}
                    role={role}
                    isDemo={false}
                    packId={packId}
                    packReady={packReady}
                    onAnalysisSaved={onAnalysisSaved}
                    refreshKey={analysesRefreshKey}
                  />
                </div>
              </>
            )}

            {activeTab === 'participants' && (
              <ParticipantsPanel
                roomId={pid}
                packId={packId}
                isV2={!!property.auth_v2_enabled}
              />
            )}

            {activeTab === 'tasks' && (
              <div id="tasks-panel">
                <TasksPanel propertyId={pid} role={role} onTabChange={setActiveTab} />
              </div>
            )}

            {activeTab === 'activity' && (
              <>
                <div className="mb-6">
                  <ActivityTimeline propertyId={pid} />
                </div>
                <NotificationsLog propertyId={pid} />
              </>
            )}

            {activeTab === 'readiness' && (
              <AssetReadinessTab
                propertyId={pid}
                property={property}
                pack={pack}
                onTabChange={setActiveTab}
              />
            )}

            {activeTab === 'settings' && (
              <div>
                {/* Active configuration overlay display (spec §12) */}
                <DigitalAssetConfigPanel property={property} pack={pack} />

                {/* Digital Asset toggle — non-tokenization workspaces (#181) */}
                <DigitalAssetTogglePanel
                  propertyId={pid}
                  property={property}
                  pack={pack}
                  onEnabledChange={(enabled) => {
                    setApiProperty(prev => prev ? {
                      ...prev,
                      metadata_values: {
                        ...(prev.metadata_values || {}),
                        ...(enabled
                          ? { digital_asset_enabled: 'true' }
                          : { digital_asset_enabled: '' }),
                      },
                    } : prev);
                    if (!enabled) setActiveTab('overview');
                  }}
                />

                {/* Ownership & Token Structure — tokenization workspaces (#182) */}
                {isTokenization && <OwnershipStructurePanel propertyId={pid} property={property} />}

                <TransactionRiskPanel propertyId={pid} />
                <PanelErrorBoundary>
                  <VerifiedAssetPackage propertyId={pid} />
                </PanelErrorBoundary>
                {visibleOutstandingSections.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-5 mb-6">
                    {visibleOutstandingSections.map((sectionKey) => {
                      const Panel = SECTION_MAP[sectionKey];
                      return Panel ? <Panel key={sectionKey} /> : null;
                    })}
                  </div>
                )}
                {/* Jurisdiction editor — task #167 */}
                {isTokenization && <JurisdictionSettingsPanel propertyId={pid} property={property} />}
                <LegalReviewPanel propertyId={pid} pack={pack} isDemo={false} />
              </div>
            )}
          </>

        ) : (

          /* ── Non-coordinator / demo / participant stacked layout ─────── */
          <>
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

            {/* Role context card */}
            {!isCoordinator && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6"
                style={{ borderLeftWidth: 4, borderLeftColor: roleConfig.color }}>
                <h2 className="text-base font-bold text-gray-900 mb-1">{roleConfig.headline}</h2>
                <p className="text-sm text-gray-500 leading-relaxed">{roleConfig.subtext}</p>
              </div>
            )}

            {/* #180 — Tokenization: role-specific action items for participants */}
            {property.isCustom && isTokenization && !isCoordinator && (() => {
              const DONE_SET = new Set(['uploaded', 'approved', 'ai_complete']);
              const myDocs = (docSchema || []).filter(d =>
                Array.isArray(d.assignedTo) && d.assignedTo.includes(role) && d.required
              );
              if (myDocs.length === 0) return null;
              const myItems = myDocs.map(d => {
                const item = checklistItems.find(i => i.section === d.section || i.id === d.id);
                return { ...d, done: item ? DONE_SET.has(item.status) : false };
              });
              const pending = myItems.filter(i => !i.done);
              const done    = myItems.filter(i => i.done);
              const allDone = pending.length === 0 && done.length > 0;
              const accentColor = allDone ? '#16a34a' : '#d97706';
              return (
                <div className="rounded-2xl border p-5 mb-6"
                  style={{
                    borderLeftWidth: 4, borderLeftColor: accentColor,
                    background: allDone ? '#f0fdf4' : '#fffbeb',
                    borderColor: allDone ? '#bbf7d0' : '#fde68a',
                  }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: allDone ? '#15803d' : '#92400e' }}>
                    {allDone ? '✓ Your action items — all complete' : 'Your action items'}
                  </p>
                  <div className="space-y-2.5">
                    {pending.map((doc, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="text-amber-500 text-sm shrink-0 mt-0.5">○</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                          {doc.jurisdictionNote && (
                            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{doc.jurisdictionNote}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {done.map((doc, i) => (
                      <div key={i} className="flex items-center gap-2.5 opacity-50">
                        <span className="text-green-600 text-sm shrink-0">✓</span>
                        <p className="text-sm text-gray-600 line-through">{doc.label}</p>
                      </div>
                    ))}
                  </div>
                  {pending.length > 0 && (
                    <button
                      onClick={() => onTabChange?.('documents')}
                      className="mt-3 text-[11px] font-bold hover:opacity-80 transition"
                      style={{ color: '#92400e' }}>
                      Go to Documents → upload your files
                    </button>
                  )}
                </div>
              );
            })()}

            {/* AI Briefing Panel */}
            {property.isCustom && (
              <AIBriefingPanel propertyId={pid} ownerName={property.first_name} dealName={property.name || property.property_name} />
            )}

            {/* Activity Timeline */}
            {property.isCustom && (
              <div className="mb-6">
                <ActivityTimeline propertyId={pid} />
              </div>
            )}

            {/* Tasks / Today's Actions */}
            {property.isCustom && (
              <div id="tasks-panel">
                <TasksPanel propertyId={pid} role={role} onTabChange={setActiveTab} />
              </div>
            )}

            {/* Setup checklist — shown only to the managing/primary role */}
            {property.isCustom && isCoordinator && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6"
                style={{ borderLeftWidth: 4, borderLeftColor: roleConfig.color }}>
                <h2 className="text-base font-bold text-gray-900 mb-3">Setup Checklist</h2>
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
                      "Track approvals — monitor transaction stage, party status, and action items in real time",
                    ].map((text, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                          style={{ background: roleConfig.color }}>{i + 1}</span>
                        {text}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {/* Documents panel */}
            {property.isCustom && (
              <div id="documents-panel">
                <DocumentsTabPanel
                  propertyId={pid}
                  propertyType={property.property_type || property.type}
                  role={role}
                  isDemo={isDemo}
                  packId={packId}
                  packReady={packReady}
                  onAnalysisSaved={onAnalysisSaved}
                  refreshKey={analysesRefreshKey}
                  jurisdiction={isTokenization ? (property.jurisdiction || "") : ""}
                />
              </div>
            )}

            {/* Legal Intelligence */}
            {property.isCustom && (isCoordinator || role === 'attorney' || role === 'counsel') && (
              <LegalReviewPanel propertyId={pid} pack={pack} isDemo={isDemo} />
            )}

            {/* Transaction Risk — coordinator only */}
            {property.isCustom && isCoordinator && (
              <TransactionRiskPanel propertyId={pid} />
            )}

            {/* Deal Coordination Panel */}
            {property.isCustom && (
              <DealCoordinationPanel
                propertyId={pid}
                role={role}
                packId={packId}
                propertyType={property.property_type || property.type}
              />
            )}

            {/* Verified Asset Package */}
            {property.isCustom && !isDemo && isCoordinator && (
              <PanelErrorBoundary>
                <VerifiedAssetPackage propertyId={pid} />
              </PanelErrorBoundary>
            )}

            {/* Notification log */}
            {property.isCustom && !isDemo && isCoordinator && (
              <NotificationsLog propertyId={pid} />
            )}

            {/* Outstanding Items */}
            {visibleOutstandingSections.length > 0 && (
              <div className="grid md:grid-cols-2 gap-5 mb-6">
                {visibleOutstandingSections.map((sectionKey) => {
                  const Panel = SECTION_MAP[sectionKey];
                  return Panel ? <Panel key={sectionKey} /> : null;
                })}
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
          </>
        )}

      </div>
    </PublicLayout>
    </>
  );
}

