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
import NotificationsLog from "./NotificationsLog";
import LegalReviewPanel from "./LegalReviewPanel";
import { DEFAULT_PACK_ID, getWorkflowPack, ensureWorkflowPackLoaded, resolvePackId, getEffectiveStages, getCapabilities, isInSettlementPhase } from "../../lib/workflowPacks";
import { API_BASE as RESOLVED_API_BASE } from "../../lib/apiBase";
import DealRoomPinGate from "./DealRoomPinGate";
import { getInviteSession, getRoomAuthHeaders } from "../../lib/inviteUtils";
import SettlementReadinessPanel from "./SettlementReadinessPanel";
import {
  getPackRecordSchema,
  getRequiredRecordFields,
  isRecordFieldRenderable,
  resolveSchemaKey,
} from "../../lib/workflowPacks/transactionRecordSchema";
import {
  getExternalParticipantRoles,
  isRoleSatisfiedByWorkspaceOwner,
} from "../../lib/workflowRoles";
import { resolveParticipantStates } from "../../lib/participantState";

// ── Jurisdiction compliance data ─────────────────────────────────────────────
const JURISDICTION_INFO = {
  uae_adgm: {
    label: "UAE — ADGM / DFSA",
    flag: "🇦🇪",
    points: [
        "Record the proposed ADGM / DFSA jurisdiction and ask qualified counsel to confirm the applicable framework.",
        "Coordinate any financial-promotion, licensing, or exemption questions with the issuer's counsel and external providers.",
        "Capture the KYC / AML preparation status and keep the supporting source documents in the workspace.",
    ],
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  eu_mica: {
    label: "EU — MiCA (Markets in Crypto-Assets)",
    flag: "🇪🇺",
    points: [
        "Record the proposed EU jurisdiction and ask qualified counsel to identify any applicable MiCA preparation inputs.",
        "Coordinate white-paper, reserve, governance, disclosure, and provider-review questions with the issuer's advisers.",
        "Keep source documents and professional review notes linked to the Transaction Record.",
    ],
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  us_reg_d: {
    label: "US — Regulation D (SEC)",
    flag: "🇺🇸",
    points: [
        "Record the proposed US jurisdiction and have counsel confirm whether a particular offering pathway is applicable.",
        "Coordinate investor, disclosure, filing, and verification questions with qualified counsel and external providers.",
        "Use the workspace to organize supporting documents and review status; it does not determine eligibility.",
    ],
    color: "#6b21a8",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
  sg_mas: {
    label: "Singapore — MAS",
    flag: "🇸🇬",
    points: [
        "Record the proposed Singapore jurisdiction and ask counsel to identify the relevant preparation path.",
        "Coordinate capital-markets, payment-services, investor, and AML/KYC questions with qualified advisers.",
        "Keep the evidence and review status organized for external professional review.",
    ],
    color: "#0f766e",
    bg: "#f0fdfa",
    border: "#99f6e4",
  },
  uk_fca: {
    label: "UK — FCA",
    flag: "🇬🇧",
    points: [
        "Record the proposed UK jurisdiction and ask qualified counsel to confirm the applicable preparation inputs.",
        "Coordinate financial-promotion, prospectus, registration, and AML/CTF questions with qualified advisers.",
        "Use the workspace for document organization and review tracking, not for a legal or regulatory determination.",
    ],
    color: "#9a3412",
    bg: "#fff7ed",
    border: "#fed7aa",
  },
};

// Transaction types where digital asset preparation is contextually relevant.
// For all other types (acquisition, lending, licensing, etc.) DA stays hidden
// unless the user explicitly turns it on.
const TOKENIZATION_RELEVANT_TYPES = new Set([
  'tokenization', 'token_issuance', 'sto', 'security_token', 'digital_asset', 'rwa',
]);

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
          Preparation Checkpoints
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
         ⚠️ This is an informational preparation summary only. Consult qualified counsel before relying on it or making legal or regulatory decisions.
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

// Public demo rooms are backed by the same seeded coordinator endpoints as
// live rooms. Keep their IDs separate from the older static sample properties
// above so demo routing does not skip the room payload request.
const DEMO_ROOM_IDS = new Set([
  'kontra-demo',
  'kontra-demo-biz',
  'kontra-demo-fundraising',
]);

// Demo room identity is stable and intentionally duplicated here as a tiny
// first-paint shell. The API response still replaces this object immediately
// after it arrives; keeping the shell local avoids showing a blank loading
// screen while the seeded public fixture request is in flight.
const DEMO_ROOM_SHELLS = {
  'kontra-demo': {
    id: 'kontra-demo',
    property_id: 'kontra-demo',
    property_name: 'Harbor View Apartments',
    name: 'Harbor View Apartments',
    property_type: 'Multifamily',
    type: 'Multifamily',
    address: '1425 Brickell Ave, Miami, FL 33131',
    deal_amount: '14000000',
    deal_stage: 'under_review',
    workflow_pack_id: 'cre_acquisition',
    metadata_values: {
      target_close_date: '2026-09-18',
      transaction_value: '$14,000,000',
      transaction_type: 'Commercial real estate acquisition',
    },
    market: 'Miami, FL',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80',
    isCustom: true,
    is_demo: true,
  },
  'kontra-demo-biz': {
    id: 'kontra-demo-biz',
    property_id: 'kontra-demo-biz',
    property_name: 'Meridian Software Group',
    name: 'Meridian Software Group',
    property_type: 'Business Acquisition',
    type: 'Business Acquisition',
    address: 'Austin, TX',
    deal_amount: '8500000',
    deal_stage: 'under_review',
    workflow_pack_id: 'business_acquisition',
    metadata_values: {
      target_close_date: '2026-10-02',
      transaction_value: '$8,500,000',
      transaction_type: 'Business acquisition',
    },
    market: 'Austin, TX',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80',
    isCustom: true,
    is_demo: true,
  },
  'kontra-demo-fundraising': {
    id: 'kontra-demo-fundraising',
    property_id: 'kontra-demo-fundraising',
    property_name: 'Nexus AI — Series B',
    name: 'Nexus AI — Series B',
    property_type: 'Technology',
    type: 'Technology',
    address: 'San Francisco, CA',
    deal_amount: '42000000',
    deal_stage: 'under_review',
    workflow_pack_id: 'fundraising',
    metadata_values: {
      target_close_date: '2026-10-15',
      transaction_value: '$42,000,000',
      transaction_type: 'Series B fundraising',
      transaction_structure: 'Series B preferred stock',
    },
    market: 'San Francisco, CA',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
    isCustom: true,
    is_demo: true,
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

function getGeneratedValuePresentation(property) {
  const proposal = getGeneratedProposal(property);
  if (!proposal) {
    return property?.deal_amount ? { label: "Deal Size", value: property.deal_amount } : null;
  }
  const fields = Array.isArray(proposal.transaction_record_fields) ? proposal.transaction_record_fields : [];
  const valueFields = fields.filter(field =>
    field?.value !== null
      && field?.value !== undefined
      && String(field.value).trim()
      && /\b(value|price|proceeds|raise|capital|loan|funding|amount|budget)\b/i.test(`${field.key || ''} ${field.label || ''}`),
  );
  const valueField = valueFields.find(field =>
    /\b(proceeds|purchase price|asking price|target raise|loan amount|funding amount)\b/i.test(`${field.key || ''} ${field.label || ''}`),
  ) || valueFields[0];
  return valueField ? { label: valueField.label, value: valueField.value } : null;
}

function PendingPropertyPanel({ property }) {
  const generatedValue = getGeneratedValuePresentation(property);
  const generatedProposal = getGeneratedProposal(property);
  const generatedTypeLabel = generatedProposal?.transaction?.label
    || property?.metadata_values?.transaction_type_label
    || property?.deal_type?.replace(/[_-]+/g, " ").replace(/\b\w/g, char => char.toUpperCase());
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Property Details</p>
      {[
        { label: "Address", value: property.address },
        { label: "Type", value: property.property_type },
        { label: "Size", value: property.property_size },
        { label: "Deal Type", value: generatedTypeLabel },
         generatedValue,
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
  const [recordFields, setRecordFields] = useState([]);
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
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/transaction-record`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(res => res.ok ? res.json() : { fields: [] })
      .then(data => setRecordFields(data.fields || []))
      .catch(() => setRecordFields([]));
  }, [propertyId, refreshKey]);

  useEffect(() => {
    if (!analyses.length && !recordFields.length) return;
    const bySection = {};
    for (const a of analyses) if (!bySection[a.section]) bySection[a.section] = a.analysis;
    const fin = bySection.financials;
    const pa = bySection.purchase_agreement;
    const rr = bySection.rent_roll;

    const recordValue = key => {
      const field = recordFields.find(item => item.field_key === key && item.status !== "not_applicable");
      return field?.value_text || "";
    };
    const derivedAskingPrice = parseNumericField(recordValue("transaction.purchase_price")) || parseNumericField(pa?.purchasePrice);
    const derivedOccupancy = parseNumericField(recordValue("financial.occupancy")) ||
      parseNumericField(fin?.occupancy) || parseNumericField(rr?.occupancyRate);
    const derivedUnits = parseNumericField(recordValue("asset.room_count")) || parseNumericField(rr?.totalUnits);

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
  }, [analyses, recordFields]);

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
function TransactionDetailsPanel({ property, propertyId, pack, recordFields = [], recordState = null, onSaved }) {
  const isLegacyTokenPack = pack?.id === 'tokenization' || pack?.transactionType === 'tokenization';
  const hiddenLaunchFields = new Set([
    'asset_type', 'raise_amount', 'raise_target', 'token_price',
    'min_investment', 'token_name', 'token_symbol', 'total_supply',
    'total_token_supply', 'asset_valuation', 'pct_tokenized', 'cap_table_rows',
  ]);
  const packFields = (isLegacyTokenPack
    ? (pack?.metadataFields || []).filter(field => !hiddenLaunchFields.has(field.id))
    : (pack?.metadataFields || []));
  const creationFields = [
    { id: "workspace_name",          label: "Deal Room Name",        fieldType: "text",     fullWidth: true, placeholder: property?.property_name || "" },
    { id: "transaction_description", label: "Transaction Description", fieldType: "text", fullWidth: true },
    { id: "transaction_type",        label: "Transaction Type",      fieldType: "text" },
    { id: "transaction_structure",   label: "Transaction Structure", fieldType: "text" },
    { id: "transaction_value",       label: "Transaction Value ($)", fieldType: "currency", placeholder: "e.g. 1000000" },
  ];
  const fields = [
    ...creationFields,
    ...packFields.filter(field => !creationFields.some(creationField => creationField.id === field.id)),
  ].filter(isRecordFieldRenderable);

  const sectionTitle = isLegacyTokenPack ? "Deal Room Details" : (pack?.metadataLabel || "Transaction Details");
  const savedMetadata = property?.metadata_values || {};
  const readCanonicalValue = (key) => {
    const stateField = recordState?.fields?.find(field =>
      field.key === key
      && field.status !== 'not_applicable'
      && String(field.value || '').trim(),
    );
    if (stateField) return String(stateField.value);
    const recordField = recordFields.find(field =>
      field.field_key === key
      && field.status !== 'not_applicable'
      && String(field.value_text || '').trim(),
    );
    return recordField?.value_text ? String(recordField.value_text) : '';
  };
  const canonicalClosingDate = readCanonicalValue('transaction.closing_date')
    || savedMetadata.target_close_date
    || property?.closing_date
    || property?.target_close_date
    || property?.close_date
    || '';
  const canonicalTransactionValue = (pack?.id === 'fundraising'
    ? readCanonicalValue('financial.target_raise')
    : readCanonicalValue('transaction.purchase_price'))
    || savedMetadata.transaction_value
    || savedMetadata.raise_amount
    || '';

  // Seed initial form values from saved metadata_values; backfill legacy
  // stated_revenue / stated_ebitda columns for rooms created before this feature.
  const [form, setForm] = useState(() => {
    const legacyMap = {
      annual_revenue: property?.stated_revenue != null ? String(property.stated_revenue) : "",
      ebitda:         property?.stated_ebitda  != null ? String(property.stated_ebitda)  : "",
    };
    return Object.fromEntries(
       fields.map(f => [
         f.id,
         savedMetadata[f.id] != null
           ? String(savedMetadata[f.id])
           : f.id === "transaction_value"
             ? String(canonicalTransactionValue)
             : f.id === "target_close_date"
               ? String(canonicalClosingDate).slice(0, 10)
               : (legacyMap[f.id] || ""),
       ])
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
      onSaved?.();
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderField(field) {
    const val = !isEditable && field.id === "transaction_value" && canonicalTransactionValue
      ? canonicalTransactionValue
      : !isEditable && field.id === "target_close_date" && canonicalClosingDate
        ? String(canonicalClosingDate).slice(0, 10)
        : (form[field.id] ?? "");
    const inputClass = "w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-800";

    if (!isEditable) {
      return (
        <div key={field.id} className={`py-2 border-t border-gray-100 first:border-t-0 ${field.fullWidth ? "col-span-2" : ""}`}>
          <span className="text-xs text-gray-400 block mb-0.5">{field.label}</span>
          <span className="break-words text-xs font-medium text-gray-800">{val || "—"}</span>
        </div>
      );
    }

    if (field.fieldType === "select" && field.options) {
      return (
        <div key={field.id} className={field.fullWidth ? "sm:col-span-2" : ""}>
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
        <div key={field.id} className={field.fullWidth ? "sm:col-span-2" : ""}>
          <label className="text-xs text-gray-400 mb-1 block">{field.label}</label>
          <input type="date" value={val}
            onChange={e => setForm(f => ({ ...f, [field.id]: e.target.value }))}
            className={inputClass} />
        </div>
      );
    }

    return (
      <div key={field.id} className={field.fullWidth ? "sm:col-span-2" : ""}>
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

      <div className={`grid gap-2 ${isEditable ? "sm:grid-cols-2" : ""}`}>
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
             Records the jurisdiction context for this deal room and loads the corresponding preparation checklist for professional review.
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
             Adds an optional preparation request to this deal room. Kontra will use the facts already collected and ask only for missing information.
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
// investor joins. Uses PATCH /ownership so cap_table_rows is not truncated.
function OwnershipStructurePanel({ propertyId, property }) {
  const init = property?.metadata_values || {};
  const parseCap = (raw) => {
    try { const r = JSON.parse(raw); return Array.isArray(r) ? r : []; } catch { return []; }
  };
  const [vals, setVals] = useState({
    token_name:      init.token_name      || '',
    token_symbol:    init.token_symbol    || '',
    total_supply:    init.total_supply    || init.total_token_supply || '',
    token_price:     init.token_price     || '',
    raise_target:    init.raise_target    || init.raise_amount || '',
    asset_valuation: init.asset_valuation || '',
    pct_tokenized:   init.pct_tokenized   || '',
  });
  const [capRows, setCapRows] = useState(() => parseCap(init.cap_table_rows));
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [saveErr,    setSaveErr]    = useState('');
  const [ownerToken, setOwnerToken] = useState('');

  useEffect(() => {
    try { setOwnerToken(localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''); } catch {}
  }, [propertyId]);

  const SCALAR_FIELDS = [
    { id: 'token_name',      label: 'Token Name',          type: 'text',   placeholder: 'e.g. Meridian Tower Token' },
    { id: 'token_symbol',    label: 'Symbol / Ticker',     type: 'text',   placeholder: 'e.g. MTT'                  },
    { id: 'total_supply',    label: 'Total Token Supply',  type: 'number', placeholder: 'e.g. 1000000'              },
    { id: 'token_price',     label: 'Price per Token ($)', type: 'number', placeholder: 'e.g. 100'                  },
    { id: 'raise_target',    label: 'Raise Target ($)',    type: 'number', placeholder: 'e.g. 25000000'             },
    { id: 'asset_valuation', label: 'Asset Valuation ($)', type: 'number', placeholder: 'e.g. 80000000'             },
    { id: 'pct_tokenized',   label: '% Being Tokenized',   type: 'number', placeholder: 'e.g. 30'                  },
  ];

  const hasData = Object.values(vals).some(Boolean) || capRows.length > 0;

  function addCapRow()           { setCapRows(r => [...r, { name: '', role: '', pct: '' }]); }
  function removeCapRow(i)       { setCapRows(r => r.filter((_, idx) => idx !== i)); }
  function updateCapRow(i, k, v) { setCapRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row)); }

  async function handleSave() {
    setSaving(true); setSaveErr(''); setSaveOk(false);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/ownership`, {
        method: 'PATCH',
        headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...vals, cap_table_rows: capRows, ownerWriteToken: ownerToken }),
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

  // Read-only view for non-owners — only render if there's data to show
  if (!ownerToken) {
    if (!hasData) return null;
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5" id="ownership-structure">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Ownership & Token Structure</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {SCALAR_FIELDS.filter(f => vals[f.id]).map(f => (
            <div key={f.id}>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{f.label}</p>
              <p className="text-sm font-medium text-gray-900">
                {vals[f.id]}{f.id === 'pct_tokenized' ? '%' : ''}
              </p>
            </div>
          ))}
        </div>
        {capRows.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Cap Table</p>
            <div className="space-y-1.5">
              {capRows.map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="font-medium text-gray-900 flex-1">{r.name}</span>
                  <span className="text-gray-400">{r.role}</span>
                  <span className="font-semibold text-gray-700 w-10 text-right">{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
        Record token economics and cap table before the first investor joins.
        This data populates the Verified Digital Asset Package.
      </p>

      {/* Token economics fields */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {SCALAR_FIELDS.map(f => (
          <div key={f.id}>
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

      {/* Cap-table editor */}
      <div className="border-t border-gray-100 pt-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cap Table</p>
          <button onClick={addCapRow}
            className="text-[10px] font-bold px-2 py-1 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-700 transition">
            + Add row
          </button>
        </div>
        {capRows.length === 0 && (
          <p className="text-[11px] text-gray-400 italic">No cap table entries yet. Click "+ Add row" to start.</p>
        )}
        <div className="space-y-2">
          {capRows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={r.name} onChange={e => updateCapRow(i, 'name', e.target.value)}
                placeholder="Name / Entity"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-800 bg-white" />
              <input value={r.role} onChange={e => updateCapRow(i, 'role', e.target.value)}
                placeholder="Role"
                className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-800 bg-white" />
              <input value={r.pct} onChange={e => updateCapRow(i, 'pct', e.target.value)}
                placeholder="%" type="number"
                className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-800 bg-white" />
              <button onClick={() => removeCapRow(i)}
                className="text-gray-300 hover:text-red-500 transition text-base font-bold leading-none pb-0.5">×</button>
            </div>
          ))}
        </div>
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
           ? 'This optional deal-room layer organizes digital-asset preparation inputs for external professional and provider review. It does not determine eligibility or approval.'
           : 'Jurisdiction context helps organize preparation questions and source documents for professional review.'}
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
//   "Keep digital-asset preparation optional and downstream of the verified transaction record."
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
  const [recordFields,   setRecordFields]   = React.useState([]);
  const [readiness,      setReadiness]      = React.useState(null);

  React.useEffect(() => {
    if (!propertyId) return;
    Promise.all([
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/checklist`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/events`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/transaction-record`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : { fields: [] }).catch(() => ({ fields: [] })),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/readiness`, { headers: getRoomAuthHeaders(propertyId) }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([ck, ev, coord, record, readinessData]) => {
      setChecklistItems(Array.isArray(ck?.items) ? ck.items : []);
      setEvents(ev?.events || []);
      setCoordination(coord);
      setRecordFields(record?.fields || []);
      setReadiness(readinessData);
    });
  }, [propertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const metaValues      = property?.metadata_values || {};
  const docCount        = Object.values(coordination?.docsByRole || {}).reduce((a, b) => a + b, 0);
  const invitableRoles  = getExternalParticipantRoles(pack);
   const participantRows = resolveParticipantStates(invitableRoles, {
     invites: coordination?.participantInvites || [],
     submissions: coordination?.submissions || [],
   }).map(state => ({
     ...state,
     label: state.label,
     key: state.key,
     canManage: !!state.isCoordinator,
     submitted: !!state.submission,
     status: state.stateLabel,
   }));

  const packName      = pack?.name || 'Transaction';
  const isAssetPack   = isDigitalAssetLayerEnabled(property, pack);
  const DONE          = new Set(['uploaded', 'approved', 'ai_complete']);
  const recordValue = (...keys) => {
    const field = recordFields.find(item =>
      keys.includes(item.field_key) && item.status !== 'not_applicable'
    );
    return field?.value_text || '';
  };

  // ── Category scores ─────────────────────────────────────────────────────────
  // 1. Ownership Structure
  const hasOwnerName = !!(
    recordValue('asset.ownership_entity', 'ownership.acquiring_entity', 'asset.issuer') ||
    property?.first_name || property?.entity_name || metaValues?.issuer_name
  );
  const hasOwnerData = !!(
    recordValue('ownership.cap_table', 'ownership.beneficial_owners') ||
    metaValues?.lead_investor || metaValues?.investor_token_pct || metaValues?.team_token_pct
  );
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
  const hasFinMeta = !!(
    recordValue('financial.noi', 'financial.revenue', 'financial.ebitda', 'financial.target_raise') ||
    metaValues?.raise_amount || metaValues?.stated_revenue || metaValues?.stated_ebitda || metaValues?.token_price
  );
  const finPct    = finItems.length > 0
    ? Math.min(Math.round((finDone.length / finItems.length) * 80 + (hasFinMeta ? 20 : 0)), 100)
    : hasFinMeta ? 50 : docCount > 2 ? 25 : 0;
  const finMiss   = [
    ...finItems.filter(i => !DONE.has(i.status) && i.required).slice(0, 2).map(i => i.label),
    ...(!hasFinMeta ? ['No financial figures recorded'] : []),
  ];

  // 4. Identity Verification
  const kycItems  = checklistItems.filter(i => i.category === 'KYC' || (i.section || '').toLowerCase().includes('kyc'));
   const submittedPtx = participantRows.filter(r => r.complete).length;
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
  const hasJur    = !!(recordValue('transaction.jurisdiction') || property?.jurisdiction);
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
        ? 'Records who owns the asset, the entity structure, and beneficial ownership information needed for institutional review and downstream coordination.'
        : 'Records who owns the asset and the entity structure — required for due diligence, title transfer, and closing documentation.' },
    { key: 'legal',        icon: '📋', label: 'Legal Documentation',    pct: legalPct,     weight: 0.15, missing: legalMiss,     cta: 'Upload legal docs',       onClick: () => onTabChange?.('documents'),
      explanation: 'Executed agreements, title documents, and corporate authorizations that form the foundation of a verifiable transaction record.' },
    { key: 'financial',    icon: '💰', label: 'Financial Completeness', pct: finPct,       weight: 0.12, missing: finMiss,       cta: 'Upload financial docs',   onClick: () => onTabChange?.('documents'),
      explanation: isAssetPack
        ? 'Financial statements, valuations, raise amount, and token price that enable independent assessment of the asset\'s financial position.'
        : 'Financial statements, valuations, and key figures that enable independent assessment of the asset\'s financial position.' },
    { key: 'identity',     icon: '🪪', label: 'Identity Verification',  pct: identityPct,  weight: 0.12, missing: identityMiss,  cta: 'Documents → KYC',         onClick: () => onTabChange?.('documents'),
      explanation: isAssetPack
        ? 'KYC/AML preparation status for transaction parties. Coordinate the applicable review with qualified advisers and external providers.'
        : 'Identity verification of all transaction parties for closing, escrow release, and counterparty review.' },
    ...(isAssetPack ? [
      { key: 'cap_table',  icon: '📊', label: 'Cap Table',              pct: capPct,       weight: 0.12, missing: capMiss,       cta: 'Settings → Ownership',   onClick: () => { onTabChange?.('settings'); setTimeout(() => document.getElementById('ownership-structure')?.scrollIntoView({ behavior: 'smooth' }), 150); },
        explanation: 'Token allocation breakdown — investor, team, and reserve percentages, vesting schedules, and lead investor details.' },
    ] : []),
    { key: 'audit',        icon: '🔍', label: 'Audit Trail',            pct: auditPct,     weight: 0.12, missing: auditMiss,     cta: 'Activity tab',            onClick: () => onTabChange?.('activity'),
       explanation: 'Complete, timestamped log of every action taken in the deal room. Forms the immutable record required by institutional auditors and counterparties.' },
    { key: 'compliance',   icon: '✅', label: isAssetPack ? 'Compliance' : 'Deal Compliance', pct: compPct, weight: 0.12, missing: compMiss, cta: 'Settings → Jurisdiction', onClick: () => onTabChange?.('settings'),
      explanation: isAssetPack
        ? 'Jurisdiction and review inputs — proposed framework recorded, supporting documents organized, and open adviser questions visible.'
        : 'Governing framework — jurisdiction context recorded and deal-specific supporting documents organized.' },
    { key: 'doc_integrity',icon: '🔒', label: 'Document Integrity',     pct: docIntPct,    weight: 0.10, missing: docIntMiss,    cta: 'Documents tab',           onClick: () => onTabChange?.('documents'),
      explanation: 'All required documents uploaded and AI-verified. Document integrity is the baseline requirement for the closing package and any downstream export.' },
  ];

  // Normalize weights to 1.0 after conditional cap_table exclusion
  const rawWeightSum = ALL_CATEGORIES.reduce((a, c) => a + c.weight, 0);
  const CATEGORIES   = ALL_CATEGORIES.map(c => ({ ...c, weight: c.weight / rawWeightSum }));

  const locallyComputedOverall = Math.round(CATEGORIES.reduce((a, c) => a + c.pct * c.weight, 0));
  const overall = Number(readiness?.transaction_readiness?.overall_pct ?? locallyComputedOverall);
  // Every transaction has the same core outcome: a verified record that is
  // ready for closing. Digital-asset preparation is an optional downstream
  // layer, never the primary status of the transaction.
  const readinessTitle = 'Transaction Readiness';
  const overallLabel = readiness?.transaction_readiness?.status
    || (overall === 0 ? 'Getting Started' : overall >= 80 ? 'Closing Ready' : overall >= 55 ? 'Needs Review' : 'Needs Attention');
  const overallColor = overall >= 80 ? '#16a34a' : overall >= 55 ? '#d97706' : '#dc2626';
  const overallBg    = overall >= 80 ? '#f0fdf4' : overall >= 55 ? '#fffbeb' : '#fef2f2';

  // ── Asset Passport ──────────────────────────────────────────────────────────
  const ownerName  = [property?.first_name, property?.last_name].filter(Boolean).join(' ') || property?.entity_name || metaValues?.issuer_name || '—';
  const closingDate = recordValue('transaction.closing_date') ||
    property?.target_close_date || metaValues?.target_close_date || null;
  const recordAssetName = recordValue('asset.name', 'asset.legal_name', 'asset.issuer');
  const recordAssetType = recordValue('asset.type');
  const recordOwner = recordValue('asset.ownership_entity', 'ownership.acquiring_entity', 'asset.issuer');
  const passportData = {
    asset_id:             propertyId,
    asset_name:           recordAssetName || property?.name || property?.property_name || '—',
    asset_type:           recordAssetType || metaValues?.asset_type || packName,
    jurisdiction:         recordValue('transaction.jurisdiction') || property?.jurisdiction || 'Not specified',
    owner:                recordOwner || ownerName,
    entity:               property?.entity_name || null,
    closing_date:         closingDate,
    pack:                 packName,
    document_count:       docCount,
    event_count:          events.length,
    verification_status:  overall >= 80 ? 'Verified' : overall >= 55 ? 'Pending' : 'Incomplete',
    transaction_readiness: overall,
    // Compatibility alias for existing downstream consumers.
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
    transaction_readiness: {
      overall_pct: overall,
      status:      overallLabel,
      categories:  CATEGORIES.map(c => ({ name: c.label, score: c.pct, weight: c.weight })),
    },
    ...(isAssetPack ? {
      digital_asset_layer: {
        enabled: true,
        compatible_networks: ['XRPL', 'Ethereum', 'Polygon', 'Canton', 'Stellar'],
      },
    } : {}),
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
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-snug break-words">
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

      {/* ── Structured Transaction Record ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
          onClick={() => setShowPassport(v => !v)}>
          <div className="flex items-center gap-3">
            <span className="text-xl">🪪</span>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">Structured Transaction Record</p>
              <p className="text-[10px] text-gray-400">
                 Structured, auditable record of this transaction · auto-generated from workspace data
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
                ...(closingDate ? [{ label: 'Closing Date', value: formatDateOnlyLabel(closingDate) }] : []),
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
                onClick={() => triggerDownload(passportData, `${propertyId}-verified-transaction-record.json`)}
                className="text-[10px] font-bold hover:opacity-80 transition" style={{ color: '#800020' }}>
                Export Record →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Transaction Metadata ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
          onClick={() => setShowMetadata(v => !v)}>
          <div className="flex items-center gap-3">
            <span className="text-xl">📦</span>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">Transaction Metadata</p>
              <p className="text-[10px] text-gray-400">
                {isAssetPack
                ? 'Structured record for closing, audit, and optional digital-asset handoff'
                : 'Structured record · exportable for due diligence, closing, or downstream platforms'}
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

      {/* ── AI-prepared transaction package ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">AI-prepared transaction package</p>
        <p className="text-[11px] text-gray-400 mb-4 leading-snug">
          Package everything already collected into a portable, structured record
          ready for closing, audit, or transfer to a downstream provider.
          {isAssetPack && ' Digital-asset preparation remains available as an optional adapter export.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <button
            onClick={() => triggerDownload(metadataExport, `${propertyId}-asset-metadata.json`)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-400 transition text-xs font-bold text-gray-700">
            &#123;&#125; Transaction JSON
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-400 transition text-xs font-bold text-gray-700">
            📄 Closing CSV
          </button>
          {isAssetPack && (
            <button
              onClick={() => triggerDownload({ ...metadataExport, asset_passport: passportData, export_type: 'digital_asset_adapter', digital_asset_adapter_version: '1.0' }, `${propertyId}-digital-asset-adapter.json`)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-xs font-bold text-white hover:opacity-90 transition"
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
              🪙 Digital Asset Adapter
            </button>
          )}
        </div>
        <p className="text-[9px] text-gray-300">
          API: GET /api/public/deal-room/{propertyId}/asset-passport · /asset-metadata · /readiness
        </p>
      </div>

      {/* ── External handoff adapters ──────────────────────────────────────── */}
      {/* Kontra prepares and coordinates the transaction, then hands the
          verified record to external providers. It does not become the
          settlement or issuance system. */}

      {/* Closing & Handoff */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Closing & Handoff</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${metaValues?.settlement_method ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            {metaValues?.settlement_method ? 'Configured' : 'Not configured'}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mb-4 leading-snug">
          Record the closing method and hand the prepared transaction package
          to the provider your parties use. Kontra coordinates; providers execute.
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

      {/* Digital Asset Handoff */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Digital Asset Handoff</p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 uppercase">
            Coming soon
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mb-4 leading-snug">
           The structured transaction record is already prepared for handoff to
          future digital-asset providers. Kontra prepares and exports — it never
          issues tokens.
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
function WorkspaceTabNav({ activeTab, onChange, isCoordinator = false, isDemo = false }) {
  const TABS = [
    { key: 'overview',      label: 'Overview'                 },
    { key: 'documents',     label: 'Documents'                },
    { key: 'people',        label: 'People'                   },
  ];
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-0 -mb-px overflow-x-auto hide-scrollbar">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={`relative z-10 shrink-0 px-4 py-3.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-[#800020] text-[#800020]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isCoordinator && !isDemo && <button
          type="button"
          onClick={() => onChange('settings')}
          aria-label="Open workspace settings"
          title="Workspace settings"
          className={`shrink-0 ml-3 mb-[-1px] w-9 h-9 rounded-lg flex items-center justify-center border-b-2 transition ${
            activeTab === 'settings'
              ? 'border-[#800020] text-[#800020] bg-[#80002008]'
              : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 2.8h3.4l.5 2.2a7.7 7.7 0 0 1 1.7 1l2.1-.8 1.7 2.9-1.6 1.5c.1.6.1 1.3 0 1.9l1.6 1.5-1.7 2.9-2.1-.8a7.7 7.7 0 0 1-1.7 1l-.5 2.2h-3.4l-.5-2.2a7.7 7.7 0 0 1-1.7-1L6 15.9l-1.7-2.9L6 11.5a7.7 7.7 0 0 1 0-1.9L4.3 8.1 6 5.2l2.1.8a7.7 7.7 0 0 1 1.7-1l.5-2.2Z" />
            <circle cx="12" cy="10.5" r="2.7" />
          </svg>
        </button>}
      </div>
    </div>
  );
}

// ── AI transaction findings ───────────────────────────────────────────────────
// The structured transaction record remains the factual backend source of truth,
// but coordinators act on its most useful findings here instead of opening a
// record editor.
function TransactionFindingsPanel({ propertyId, onTabChange }) {
  const [fields, setFields] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState('');
  const [expanded, setExpanded] = useState('');
  const [history, setHistory] = useState({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/transaction-record`, {
        headers: getRoomAuthHeaders(propertyId),
      });
      const data = res.ok ? await res.json() : { fields: [] };
      setFields(Array.isArray(data?.fields) ? data.fields : []);
      setConflicts(Array.isArray(data?.conflicts) ? data.conflicts : []);
    } catch {
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  async function confirmField(field) {
    let ownerWriteToken = '';
    try { ownerWriteToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch {}
    if (!ownerWriteToken || confirming) return;
    setConfirming(field.id);
    try {
      const res = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${field.id}/verify`,
        {
          method: 'POST',
          headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ownerWriteToken, actorRole: 'coordinator' }),
        },
      );
      if (res.ok) await load();
    } finally {
      setConfirming('');
    }
  }

  async function resolveConflict(conflict, valueText) {
    let ownerWriteToken = '';
    try { ownerWriteToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch {}
    if (!ownerWriteToken || confirming) return;
    setConfirming(conflict.id);
    try {
      const res = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/conflicts/${conflict.id}/resolve`,
        {
          method: 'POST',
          headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ownerWriteToken, value_text: valueText }),
        },
      );
      if (res.ok) await load();
    } finally {
      setConfirming('');
    }
  }

  async function toggleHistory(field) {
    if (expanded === field.id) {
      setExpanded('');
      return;
    }
    setExpanded(field.id);
    if (history[field.id]) return;
    const res = await fetch(
      `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${field.id}/history`,
      { headers: getRoomAuthHeaders(propertyId) },
    );
    const data = res.ok ? await res.json() : { history: [] };
    setHistory(prev => ({ ...prev, [field.id]: Array.isArray(data?.history) ? data.history : [] }));
  }

  const findings = fields
    .filter(field => ['extracted', 'needs_review', 'conflicting', 'source_changed'].includes(field.status))
    .sort((a, b) => {
      const priority = { source_changed: 0, conflicting: 1, needs_review: 2, extracted: 3 };
      return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
    })
    .slice(0, 5);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="h-3 w-32 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-3 w-64 bg-gray-50 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">AI findings</p>
          <p className="text-sm font-bold text-gray-900 mt-1">Review what Kontra found</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Confirm facts in context. Source excerpts and history stay attached.
          </p>
        </div>
        <button
          onClick={() => onTabChange?.('documents')}
          className="text-[11px] font-semibold text-[#800020] hover:opacity-80 transition shrink-0">
          Add documents →
        </button>
      </div>

      {findings.length === 0 ? (
        <div className="px-5 py-5">
          <p className="text-sm font-medium text-gray-700">No new findings need your attention.</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload a purchase agreement, financial statement, title commitment, or other transaction document to start the AI review.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {findings.map(field => {
            const isConflict = field.status === 'conflicting' || field.status === 'source_changed';
            const isExpanded = expanded === field.id;
            return (
              <div key={field.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isConflict ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-500">{field.display_label || field.field_key}</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5 break-words">
                          {field.value_text || 'Information still needed'}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        isConflict ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {field.status === 'source_changed' ? 'Source changed' :
                          field.status === 'conflicting' ? 'Conflict' :
                          field.status === 'needs_review' ? 'Needs review' : 'Confirm'}
                      </span>
                    </div>
                    {field.source_excerpt && (
                      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                        “{field.source_excerpt}”
                        {field.source_page ? ` · page ${field.source_page}` : ''}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {!isConflict && field.value_text && (
                        <button
                          onClick={() => confirmField(field)}
                          disabled={confirming === field.id}
                          className="text-[11px] font-bold text-white px-3 py-1.5 rounded-lg bg-[#800020] hover:opacity-90 disabled:opacity-50 transition">
                          {confirming === field.id ? 'Confirming…' : 'Confirm this finding'}
                        </button>
                      )}
                      <button
                        onClick={() => toggleHistory(field)}
                        className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 transition">
                        {isExpanded ? 'Hide source history' : 'View source history'}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                        {(history[field.id] || []).length === 0 ? (
                          <p className="text-[10px] text-gray-400">No history available yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {history[field.id].slice(0, 4).map((event, index) => (
                              <div key={event.id || index} className="text-[10px] text-gray-500">
                                <span className="font-semibold text-gray-700">
                                  {(event.event_type || 'update').replace(/_/g, ' ')}
                                </span>
                                {event.created_at ? ` · ${new Date(event.created_at).toLocaleDateString()}` : ''}
                                {event.source_excerpt ? ` · “${event.source_excerpt}”` : ''}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="border-t border-red-100 bg-red-50/40 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Unresolved source discrepancies</p>
          <div className="mt-2 space-y-3">
            {conflicts.map(conflict => (
              <div key={conflict.id} className="rounded-xl border border-red-100 bg-white px-3.5 py-3">
                <p className="text-sm font-bold text-gray-900">
                  {/repair\s*cost/i.test(`${conflict.label || ''} ${conflict.fieldKey || ''}`)
                    ? 'Resolve Repair Cost Discrepancy'
                    : `Resolve ${conflict.label || conflict.fieldKey || 'Transaction Record'} Discrepancy`}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Canonical: <span className="font-semibold">{conflict.canonicalValue || 'Not recorded'}</span>
                  {' · '}
                  Other source: <span className="font-semibold">{conflict.conflictingValue || 'Not recorded'}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => resolveConflict(conflict, conflict.canonicalValue)}
                    disabled={confirming === conflict.id}
                    className="rounded-lg bg-[#800020] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {confirming === conflict.id ? 'Saving…' : 'Keep canonical value'}
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveConflict(conflict, conflict.conflictingValue)}
                    disabled={confirming === conflict.id}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 disabled:opacity-50"
                  >
                    Use other source
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DigitalAssetPrepCard({ propertyId, recordFields = [], readiness = null }) {
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function requestPrep() {
    if (loading) return;
    setLoading(true);
    try {
      // This legacy card is retained for compatibility with older pack
      // layouts, but package generation now requires an explicitly selected
      // persisted eligible snapshot in CoordinatorOverview.
      setRequested(true);
      setResult({
        status: 'snapshot_required',
        missing: [{ label: 'Select an eligible immutable readiness snapshot' }],
      });
    } finally {
      setLoading(false);
    }
  }

  const tokenizationRecordState = readiness?.transaction_record || null;
  const tokenizationDefinitions = getRequiredRecordFields('tokenization');
  const tokenizationInputStates = tokenizationDefinitions.map(definition =>
    getRecordDefinitionState(definition, recordFields, tokenizationRecordState)
  );
  const tokenizationGaps = tokenizationInputStates.filter(item => item.status !== 'confirmed');
  const hasEnoughInformation = readiness?.digital_asset_readiness?.sufficient === true
    && tokenizationGaps.length === 0;

  // Digital Asset Prep is intentionally progressive: it is a downstream
  // structured-package action, not a default destination for an empty room.
  if (!hasEnoughInformation) return null;

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 7.5 7.5 4.3 7.5-4.3M12 12v9" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Optional downstream step</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">Generate Digital Asset Preparation Package</p>
            </div>
            {!requested && (
              <button
                onClick={requestPrep}
                disabled={loading}
                className="shrink-0 rounded-lg bg-[#800020] px-3 py-1.5 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-50">
                {loading ? 'Generating…' : 'Generate package'}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
             Organize the confirmed tokenization-specific inputs already collected into an AI-prepared structured package for external review.
          </p>
          {requested && (
            <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-gray-800">
                 {result?.status === 'inputs_captured' ? 'AI-prepared package generated for external review.' : 'A few inputs are still needed.'}
              </p>
              {result?.missing?.length > 0 && (
                <p className="text-[11px] text-gray-500 mt-1">
                  Missing: {result.missing.slice(0, 4).map(item => item.label).join(', ')}
                  {result.missing.length > 4 ? ` +${result.missing.length - 4} more` : ''}
                </p>
              )}
              <p className="text-[10px] text-gray-400 mt-1">
                 AI-prepared only. Kontra does not determine legal or regulatory outcomes, and does not issue, sell, recommend, custody, or settle digital assets.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSnapshotValue(field) {
  if (!field?.value_text) return 'Not recorded';
  return field.value_text;
}

function getTransactionRecordCategory(field) {
  const fieldText = [
    field?.key,
    field?.field_key,
    field?.canonicalKey,
    field?.persistedKey,
    field?.definitionKey,
    field?.label,
    field?.display_label,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/(units?[\s_-]+(damaged|affected)|properties?[\s_-]+damaged)/.test(fieldText)) {
    return 'asset';
  }
  if (/(additional[\s_-]+work[\s_-]+invoice|fund[\s_-]+release[\s_-]+request)/.test(fieldText)) {
    return 'financial';
  }
  const rawCategory = String(
    field?.category
    || field?.field_category
    || field?.key
    || field?.field_key
    || '',
  ).split('.')[0].toLowerCase();
  return {
    transaction: 'terms',
    terms: 'terms',
     parties: 'parties',
     organization: 'parties',
     organizer: 'parties',
    beneficial_ownership: 'parties',
    party: 'parties',
    asset: 'asset',
    asset_identity: 'asset',
    property: 'asset',
    company: 'asset',
    identity: 'asset',
    financial: 'financial',
    finance: 'financial',
    financials: 'financial',
    economics: 'financial',
    funding: 'financial',
    financing: 'financial',
    insurance: 'financial',
    coverage: 'financial',
    repairs: 'financial',
    repair: 'financial',
    legal: 'legal',
    diligence: 'legal',
    regulatory: 'legal',
    approvals: 'legal',
    approval: 'legal',
    ownership: 'parties',
    cap_table: 'parties',
    hazard: 'terms',
    incident: 'terms',
    loss: 'terms',
    event: 'terms',
    timeline: 'terms',
    document: 'legal',
    documents: 'legal',
    evidence: 'legal',
  }[rawCategory]
    || (/(fund|proceed|repair|cost|insurance|coverage|financial)/.test(
      String(field?.label || field?.display_label || '').toLowerCase(),
    )
      ? 'financial'
      : /(investor|agency|borrower|lender|buyer|seller|party|owner)/.test(
        String(field?.label || field?.display_label || '').toLowerCase(),
      )
        ? 'parties'
        : /(hazard|loss|incident|damage|completion|event|date)/.test(
          String(field?.label || field?.display_label || '').toLowerCase(),
        )
          ? 'terms'
          : rawCategory);
}

// ── WhatNeedsAttention ────────────────────────────────────────────────────────
// Unified prioritized feed merging AI findings, next actions, and issues.
// Replaces the old separate "Next Actions", "AI Findings", and "Issues" cards.
function WhatNeedsAttention({
  briefing,
  analyses = [],
  recordFields,
  recordState = null,
  conflicts = [],
  checklistItems = [],
  events = [],
  coordination = null,
  pack = null,
  packId = DEFAULT_PACK_ID,
  property,
  loading,
  onTabChange,
  propertyId,
  isCoordinator = false,
  compact = false,
  onOverviewAction,
  onRefresh,
}) {
  const [confirming, setConfirming] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [showAll, setShowAll] = useState(false);

  async function confirmField(field) {
    let ownerWriteToken = '';
    try { ownerWriteToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch {}
    if (!ownerWriteToken || confirming) return;
    const fieldId = field.id || field.fieldId;
    if (!fieldId) return;
    setConfirming(fieldId);
    setConfirmError('');
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${fieldId}/verify`,
        {
          method: 'POST',
          headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ownerWriteToken, actorRole: 'coordinator' }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || 'The Transaction Record field could not be confirmed.');
      }
      await onRefresh?.();
    } catch (error) {
      setConfirmError(error.message || 'The Transaction Record field could not be confirmed.');
    } finally {
      setConfirming('');
    }
  }

  // The command center derives these actions from the same state rendered in
  // Documents, People, and Transaction Record. This is prioritization only —
  // the existing tabs remain the source of truth and own the actual flows.
  const isRecordValue = field => {
    const value = String(field?.value_text || '').trim().toLowerCase();
    return value && !['n/a', 'na', 'not applicable', 'not_applicable', 'unknown'].includes(value)
      && field?.status !== 'not_applicable';
  };
  const schemaKey = recordState?.schemaKey || getEffectiveRecordSchemaKey(property, packId, pack);
  const recordSchema = getEffectiveRecordDefinitions(schemaKey, property, recordFields, recordState);
  const visibleRecordDefinitions = schemaKey === 'generated_ai'
    ? recordSchema
    : recordSchema.length > 0
    ? recordSchema
    : [
        { key: 'parties.buyer', label: 'Buyer' },
        { key: 'parties.seller', label: 'Seller' },
        { key: 'asset.name', label: 'Asset name' },
        { key: 'transaction.value', label: 'Transaction value', aliasOf: 'transaction.purchase_price' },
        { key: 'transaction.purchase_price', label: 'Purchase price' },
        { key: 'ownership.cap_table', label: 'Cap table / ownership' },
      ];
  const operationalRecordDefinitions = getHazardLossOperationalFieldDefinitions(
    property,
    recordState,
    recordFields,
  );
  const canonicalRequiredDefinitions = (Array.isArray(recordState?.requiredFields)
    ? recordState.requiredFields
    : []
  ).map(field => {
    const key = field?.definitionKey
      || field?.key
      || field?.persistedKey
      || field?.field_key;
    return {
      ...field,
      key,
      canonicalKey: field?.key || field?.persistedKey || field?.field_key || key,
      persistedKey: field?.persistedKey || field?.field_key || field?.key || key,
      label: field?.label || field?.display_label || key,
      category: normalizeRecordCategory(
        field?.category || field?.field_category,
        key,
        field?.label || field?.display_label,
      ),
      workflowRequired: true,
      required: true,
      renderable: field?.renderable !== false,
    };
  }).filter(field => field.key && field.renderable !== false);
  const effectiveRecordDefinitions = [
    ...visibleRecordDefinitions,
    ...canonicalRequiredDefinitions,
    ...operationalRecordDefinitions,
  ].filter((definition, index, definitions) => {
    const identity = normalizeAttentionFieldKey(
      definition.canonicalKey || definition.key || definition.persistedKey,
    );
    const label = normalizeAttentionText(definition.label || definition.display_label);
    return index === definitions.findIndex(candidate =>
      identity && identity === normalizeAttentionFieldKey(
        candidate.canonicalKey || candidate.key || candidate.persistedKey,
      )
        || (label && label === normalizeAttentionText(candidate.label || candidate.display_label))
    );
  });
  const canonicalRecordKey = definition => normalizeAttentionFieldKey(
    definition.aliasOf || definition.key,
  );
  const canonicalStateField = definition => recordState?.fields?.find(field =>
    getRecordFieldIdentitySet(field).has(canonicalRecordKey(definition))
  );
  const missingCanonicalKeys = new Set();
  const recordMissing = effectiveRecordDefinitions
    .filter(def => def.workflowRequired === true || def.required === true)
    .filter(def => {
      const canonicalKey = canonicalRecordKey(def);
      if (missingCanonicalKeys.has(canonicalKey)) return false;
      const authoritative = recordStateFieldForDefinition(def, recordState)
        || canonicalStateField(def);
      if (authoritative) {
        if (!['missing', 'not_applicable'].includes(normalizeRecordStatus(authoritative))) return false;
        missingCanonicalKeys.add(canonicalKey);
        return true;
      }
      const matches = recordFields.filter(field =>
        field.field_key === def.key || field.field_key === def.aliasOf
      );
      if (matches.some(isRecordValue)) return false;
      missingCanonicalKeys.add(canonicalKey);
      return true;
    });
  const confirmedCanonicalKeys = new Set();
  const recordConfirmedCount = effectiveRecordDefinitions.reduce((count, def) => {
    const canonicalKey = canonicalRecordKey(def);
    if (confirmedCanonicalKeys.has(canonicalKey)) return count;
    const authoritative = recordStateFieldForDefinition(def, recordState)
      || canonicalStateField(def);
    if (authoritative) {
      if (normalizeRecordStatus(authoritative) !== 'confirmed') return count;
      confirmedCanonicalKeys.add(canonicalKey);
      return count + 1;
    }
    const confirmed = recordFields.some(field =>
      (field.field_key === def.key || field.field_key === def.aliasOf) && isRecordValue(field)
    );
    if (!confirmed) return count;
    confirmedCanonicalKeys.add(canonicalKey);
    return count + 1;
  }, 0);

   const schemaDocuments = typeof pack?.getDocumentSchema === 'function'
    ? pack.getDocumentSchema(property?.property_type || property?.type)
    : (Array.isArray(pack?.documentSchema) ? pack.documentSchema : []);
   const documentStats = getDocumentRequirementStats(checklistItems, pack, property, analyses);
   const missingDocuments = documentStats.missingDocuments;
   const documentReviewItems = analyses
     .filter(hasDocumentReviewFinding)
     .filter(analysis => {
       const section = String(analysis.section || '').toLowerCase();
       return documentStats.reviewDocuments.some(item =>
         String(item.section || '').toLowerCase() === section
       ) || documentStats.receivedDocuments.some(item =>
         String(item.section || '').toLowerCase() === section
       );
     })
     .slice(0, 4);

  const roleMeta = Object.fromEntries((pack?.roles || []).map(role => [role.key, role]));
  const partyRows = Array.isArray(coordination?.submissions)
    ? coordination.submissions
    : (Array.isArray(coordination?.parties) ? coordination.parties : []);
  const requiredParticipantRoles = getExternalParticipantRoles(pack, { isCoordinator })
    .filter(role => role.required);
  const participantStates = resolveParticipantStates(requiredParticipantRoles, {
    invites: coordination?.participantInvites || [],
    submissions: partyRows,
  });
  const missingParticipants = participantStates.filter(state => {
    if (isRoleSatisfiedByWorkspaceOwner(state, { pack, isCoordinator })) return false;
    return !state.invited;
  });

  const hasMeaningfulActivity = recordFields.some(isRecordValue)
    || missingDocuments.length < schemaDocuments.filter(item => item.required).length
    || partyRows.length > 0
     || (coordination?.participantInvites || []).length > 0;

  const items = [];

  documentReviewItems.forEach(analysis => {
    const result = analysis.analysis || {};
    items.push({
      id: `document-review-${analysis.id || analysis.section}`,
      urgency: 'medium',
      title: `${analysis.filename || analysis.section || 'Uploaded document'} needs review`,
      reason: result.summary || result.review_reason || result.reviewReason
        || 'AI found an item that needs coordinator review.',
      actions: [{ label: 'Review document', onClick: () => onTabChange?.('documents') }],
      sourcePriority: 1,
    });
  });

  // 1. Conflicting / source-changed — highest urgency
  const canonicalConflicts = getCanonicalUnresolvedConflicts(recordState);
  canonicalConflicts.forEach(conflict => {
    const fieldKey = conflict.fieldKey || conflict.field_key || '';
    const label = conflict.label || conflict.display_label || fieldKey || 'Transaction Record';
    items.push({
      id: `transaction-conflict-${conflict.id || fieldKey}`,
      fieldKey: normalizeAttentionFieldKey(fieldKey),
      urgency: 'high',
      title: /repair\s*cost/i.test(`${label} ${fieldKey}`)
        ? 'Resolve Repair Cost Discrepancy'
        : `Resolve ${label} Discrepancy`,
      reason: `Canonical value ${conflict.canonicalValue || conflict.canonical_value || 'not recorded'} conflicts with ${conflict.conflictingValue || conflict.conflicting_value || 'another source'}.`,
      excerpt: conflict.conflictingSourceExcerpt || conflict.conflicting_source_excerpt || null,
      routeItem: { field_key: fieldKey },
      actions: [{ label: 'Review discrepancy', onClick: () => onOverviewAction?.({ type: 'conflict', conflict }) }],
      sourcePriority: 0,
    });
  });
  // 2. Needs review / newly extracted
  getCanonicalAwaitingRecordFields(recordState)
    .slice(0, 4)
    .forEach(f => items.push({
      id: `review-${f.fieldId || f.id || f.key}`,
      fieldKey: normalizeAttentionFieldKey(f.key || f.field_key || f.persistedKey),
      urgency: 'medium',
      title: f.label || f.display_label || f.key,
      reason: `Kontra extracted "${f.value ?? f.value_text}" from an uploaded document. Confirm this is correct.`,
      excerpt: f.sourceExcerpt || f.source_excerpt
        ? `"${f.sourceExcerpt || f.source_excerpt}"${f.sourcePage || f.source_page ? ` · page ${f.sourcePage || f.source_page}` : ''}`
        : null,
      field: f,
      actions: [{ label: confirming === (f.fieldId || f.id) ? 'Confirming…' : 'Confirm', primary: true, disabled: !!confirming, onClick: () => confirmField(f) }],
    }));

  // 3. Specific actions derived from existing workflow state. Required
  // documents blocking the current stage come first, followed by missing
  // participants, then critical record fields, then other required documents.
  const stageKey = String(coordination?.stage || '').toLowerCase();
  const isCurrentStageDocument = item => {
    const section = String(item.section || item.category || '').toLowerCase();
    if (!stageKey) return false;
    if (stageKey.includes('clos')) return /(legal|closing|title|purchase|agreement)/.test(section);
    if (stageKey.includes('due') || stageKey.includes('diligence')) return /(financial|inspection|property|operational|legal)/.test(section);
    return /(loi|term|purchase|agreement)/.test(section);
  };
  const documentActions = missingDocuments.map((document, index) => ({
    id: `missing-document-${document.id || document.section || index}`,
    urgency: isCurrentStageDocument(document) ? 'high' : 'medium',
    title: (() => {
      const assignedRoles = document.assignedTo || document.assigned_to || [];
      const coordinatorOwnsDocument = assignedRoles.some(roleKey =>
        isRoleSatisfiedByWorkspaceOwner(roleMeta[roleKey], { pack, isCoordinator })
      );
      return `${coordinatorOwnsDocument ? 'Upload' : 'Request'} ${document.label || document.name || 'required document'}`;
    })(),
    reason: document.assignedTo?.length || document.assigned_to?.length
      ? `Required · ${(document.assignedTo || document.assigned_to).map(role => roleMeta[role]?.label || role).join(' / ')}`
      : 'Required for the transaction record',
    routeItem: { ...document, document: true },
    actions: [],
    sourcePriority: isCurrentStageDocument(document) ? 1 : 4,
  }));
  const participantActions = missingParticipants.map(role => ({
    id: `missing-participant-${role.key}`,
    urgency: 'high',
    title: `Invite ${role.label}`,
    reason: 'Needed to complete Identity & Parties',
    routeItem: { participant: true, role: role.key },
    actions: [],
    sourcePriority: 2,
  }));
  const recordActions = recordMissing.map(field => ({
    id: `missing-record-${field.key}`,
    fieldKey: normalizeAttentionFieldKey(field.key),
    urgency: 'high',
    title: `Provide ${field.label}`,
    reason: `Required Transaction Record field "${field.label}" is missing. Add and confirm the authoritative value.`,
    field: {
      ...field,
      ...(recordStateFieldForDefinition(field, recordState) || {}),
      key: field.canonicalKey || field.key,
      field_key: field.canonicalKey || field.key,
      label: field.label,
      status: recordStateFieldForDefinition(field, recordState)?.status || 'missing',
    },
    routeItem: {
      field_key: field.canonicalKey || field.key,
      key: field.canonicalKey || field.key,
      label: field.label,
      status: 'missing',
    },
    actions: [],
    sourcePriority: 1,
  }));

  const derivedActions = [...documentActions, ...participantActions, ...recordActions]
    .sort((a, b) => a.sourcePriority - b.sourcePriority);
  const canonicalAwaitingFields = getCanonicalAwaitingRecordFields(recordState);
  const canonicalActionKeys = new Set([
    ...recordMissing,
    ...canonicalAwaitingFields,
    ...canonicalConflicts,
  ].flatMap(field => [...getRecordFieldIdentitySet(field)]));

  // Existing briefing/task-engine actions remain useful after concrete state
  // actions, and still provide the fallback for custom workflow packs.
  const briefingActions = filterStaleRecordActions(filterLiveDocumentActions([
    ...(Array.isArray(briefing?.criticalPath) ? briefing.criticalPath : []),
    ...(Array.isArray(briefing?.actions) ? briefing.actions : []),
    ...(Array.isArray(briefing?.next_actions) ? briefing.next_actions : []),
    ...(Array.isArray(briefing?.missingDocuments) ? briefing.missingDocuments.map(document => ({
      title: `Upload ${typeof document === 'string' ? document : document.label || document.name || 'required document'}`,
      document: true,
    })) : []),
  ], documentStats), recordState, recordFields, canonicalActionKeys)
    .filter(action => !isBorrowerFundsRecordAction(action));
  const seenBriefingActions = new Set();
  derivedActions.forEach(item => items.push(item));
  briefingActions.forEach((item, i) => {
    const text = typeof item === 'string'
      ? item
      : (item.text || item.action || item.item || item.title || '');
    const normalizedText = String(text).trim();
    const dedupeKey = normalizedText.toLowerCase();
    if (!normalizedText || seenBriefingActions.has(dedupeKey)) return;
    seenBriefingActions.add(dedupeKey);
    const structuredField = item?.field_key || item?.fieldKey
      ? { field_key: item.field_key || item.fieldKey }
      : null;
    const matchedRecordField = findCanonicalRecordFieldForAction(item, recordState, recordFields);
    const routeItem = structuredField || item;
    const isCritical = item?.taskId || item?.chainStep || briefing?.criticalPath?.includes(item);
    items.push({
      id: `action-${i}`,
      fieldKey: matchedRecordField
        ? [...getRecordFieldIdentitySet(matchedRecordField)][0]
        : normalizeAttentionFieldKey(item?.field_key || item?.fieldKey),
      urgency: isCritical ? 'high' : i === 0 ? 'medium' : 'low',
      title: normalizedText,
      reason: typeof item === 'object' ? (item.reason || item.note || item.why || '') : '',
      routeItem,
      actions: [],
    });
  });

  // 4. Issues / risks, deduplicated against the existing action feed.
  const rawIssues = filterStaleRecordActions(
    [...(briefing?.risks || []), ...(briefing?.open_items || [])],
    recordState,
    recordFields,
    canonicalActionKeys,
  ).filter(item => !isBorrowerFundsRecordAction(item));
  rawIssues.slice(0, 3).forEach((item, i) => {
    const text = typeof item === 'string' ? item : (item.text || item.risk || item.item || item.title || '');
    const normalizedText = String(text).trim();
    if (!normalizedText || seenBriefingActions.has(normalizedText.toLowerCase())) return;
    seenBriefingActions.add(normalizedText.toLowerCase());
    const matchedRecordField = findCanonicalRecordFieldForAction(item, recordState, recordFields);
    items.push({
      id: `issue-${i}`,
      fieldKey: matchedRecordField
        ? [...getRecordFieldIdentitySet(matchedRecordField)][0]
        : normalizeAttentionFieldKey(item?.field_key || item?.fieldKey),
      urgency: 'high',
      title: normalizedText,
      reason: '',
      routeItem: item,
      actions: [],
    });
  });

  const urgencyPriority = { high: 0, medium: 1, low: 2 };
   const prioritizedItems = dedupeAttentionItems(items)
    .map((item, index) => ({ item, index }))
    .sort((a, b) =>
      (urgencyPriority[a.item.urgency] ?? 3) - (urgencyPriority[b.item.urgency] ?? 3)
      || (a.item.sourcePriority ?? 9) - (b.item.sourcePriority ?? 9)
      || a.index - b.index
    )
    .map(entry => entry.item);
  const urgencyDot = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-gray-300' };

  // The command center keeps the existing prioritization data, but every
  // displayed action must lead somewhere useful. Do not create a second task
  // system here — these are only routing affordances for the existing items.
  function goToRecord(field) {
    const normalizeLabel = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
    const label = field?.label || field?.display_label || '';
    const labelMatch = label
      ? [...recordSchema, ...(recordState?.requiredFields || [])].find(candidate =>
        normalizeLabel(candidate?.label || candidate?.display_label) === normalizeLabel(label)
      )
      : null;
    const fieldKey = field?.key
      || field?.field_key
      || field?.canonicalKey
      || field?.persistedKey
      || field?.definitionKey
      || labelMatch?.key
      || labelMatch?.field_key
      || labelMatch?.persistedKey
      || labelMatch?.definitionKey
      || '';
    const keys = [
      fieldKey,
      field?.key,
      field?.field_key,
      field?.canonicalKey,
      field?.persistedKey,
      field?.definitionKey,
    ].filter(Boolean);
    onOverviewAction?.({
      type: 'record',
      field: { ...field, key: fieldKey, field_key: field?.field_key || fieldKey },
      keys: [...new Set(keys)],
      label,
      autoEdit: ['missing', 'not_applicable'].includes(String(field?.status || '').toLowerCase())
        || !String(field?.value ?? field?.value_text ?? '').trim(),
    });
  }

  function routeForText(text) {
    const value = String(text || '').toLowerCase();
    if (/(document|upload|file|nda|loi|agreement|checklist|esa|report|certificate|binder|commitment|rent roll|inspection)/.test(value)) {
      return { label: 'Open Documents', onClick: () => onOverviewAction?.({ type: 'tab', tab: 'documents' }) };
    }
    if (/(invite|participant|buyer|seller|party|counsel|lender|advisor)/.test(value)) {
      return { label: 'Open People', onClick: () => onOverviewAction?.({ type: 'tab', tab: 'people' }) };
    }
    if (/(borrower.*(advanced|advance).*fund|(advanced|advance).*fund.*borrower)/.test(value)) {
      return {
        label: 'Review record',
        onClick: () => goToRecord({ field_key: 'financial.borrower_funds_advanced', label: 'Borrower funds advanced' }),
      };
    }
    if (/funding\s+request|fund\s+release\s+request/.test(value)) {
      return {
        label: 'Review record',
        onClick: () => goToRecord({ field_key: 'funding.request', label: 'Funding request' }),
      };
    }
    if (/investor\s*(\/|or)\s*agency|investor.*agency|agency.*investor/.test(value)) {
      return {
        label: 'Review record',
        onClick: () => goToRecord({ field_key: 'organization.investor_or_agency', label: 'Investor / agency' }),
      };
    }
    if (/(term|purchase price|transaction value|closing date|structure)/.test(value)) {
      return { label: 'Review terms', onClick: () => goToRecord({ field_key: 'transaction.terms' }) };
    }
    if (/(financial|revenue|noi|ebitda|loan|deal value)/.test(value)) {
      return { label: 'Review financials', onClick: () => goToRecord({ field_key: 'financial.deal_value' }) };
    }
    if (/(title|legal|liens|encumbrance|regulatory)/.test(value)) {
      return { label: 'Review legal', onClick: () => goToRecord({ field_key: 'legal.title_status' }) };
    }
    return { label: 'Review record', onClick: () => onOverviewAction?.({ type: 'record', field: { field_key: 'transaction.terms' } }) };
  }

  function routeForItem(item) {
    if (item?.participant) {
      return { label: 'Open People', onClick: () => onOverviewAction?.({ type: 'tab', tab: 'people' }) };
    }
    if (item?.field_key || item?.fieldKey) {
      return { label: 'Review record', onClick: () => goToRecord(item) };
    }
    if (item?.document || item?.documentId || item?.document_id) {
      const assignedRoles = item.assignedTo || item.assigned_to || [];
      const coordinatorOwnsDocument = assignedRoles.some(role =>
        isRoleSatisfiedByWorkspaceOwner(roleMeta[role], { pack, isCoordinator })
      );
      return { label: coordinatorOwnsDocument ? 'Upload' : 'Request', onClick: () => onOverviewAction?.({ type: 'tab', tab: 'documents' }) };
    }
    return routeForText(item?.title || item?.item || item?.text || item?.action);
  }

  if (compact) {
    const compactItems = showAll ? prioritizedItems : prioritizedItems.slice(0, 3);
    return (
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Next actions</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {loading ? 'Loading…' : compactItems.length > 0
                ? 'Priority next actions'
                : hasMeaningfulActivity ? 'Nothing urgent right now' : 'Start this transaction'}
            </p>
          </div>
        </div>
        {confirmError && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
            {confirmError}
          </p>
        )}
         {loading ? (
          <div className="mt-3 space-y-2">
            {[1, 2].map(n => <div key={n} className="h-9 animate-pulse rounded-lg bg-gray-50" />)}
          </div>
         ) : compactItems.length === 0 ? (
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            {hasMeaningfulActivity
              ? 'Kontra is monitoring the transaction for missing information and inconsistencies.'
              : 'Upload a document or invite a participant to begin organizing the transaction.'}
          </p>
         ) : (
          <div className="mt-2 divide-y divide-gray-100">
            {compactItems.map(item => {
              const action = item.field
                ? { label: 'Review record', onClick: () => goToRecord(item.field) }
                : item.actions.find(candidate => typeof candidate?.onClick === 'function')
                  || routeForItem(item.routeItem || item);
              return (
                  <div key={item.id} className="flex items-start gap-2.5 py-2.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${urgencyDot[item.urgency]}`} />
                   <div className="min-w-0 flex-1">
                      <p className="break-words text-xs font-semibold text-gray-800">{item.title}</p>
                      {item.reason && <p className="mt-0.5 break-words text-[10px] text-gray-400">{item.reason}</p>}
                   </div>
                  <button
                    type="button"
                     onClick={(event) => { event.preventDefault(); event.stopPropagation(); action.onClick?.(); }}
                    disabled={action.disabled}
                     className={`relative z-10 max-w-full shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-bold transition disabled:opacity-50 ${
                       action.primary
                         ? 'bg-[#800020] text-white hover:opacity-90'
                         : 'border border-[#800020] bg-white text-[#800020] hover:bg-[#800020]/5'
                     }`}>
                    {action.label}
                  </button>
                </div>
              );
            })}
          </div>
        )}
          {!loading && prioritizedItems.length > 3 && (
           <button
             type="button"
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); setShowAll(value => !value); }}
             className="mt-3 text-[11px] font-semibold text-[#800020] hover:opacity-80 transition">
              {showAll ? 'Show top 3' : `View all ${prioritizedItems.length} actions`} →
           </button>
         )}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">What needs attention</p>
        <p className="mt-1 text-sm font-bold text-gray-900">
          {loading ? 'Loading…' : prioritizedItems.length > 0
            ? `${prioritizedItems.length} item${prioritizedItems.length === 1 ? '' : 's'} to address`
            : hasMeaningfulActivity ? 'Nothing urgent right now' : 'Start this transaction'}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          {hasMeaningfulActivity
            ? 'Kontra prioritizes the items currently moving or blocking this transaction.'
            : 'Add the first transaction documents and participants so Kontra can begin organizing the deal.'}
        </p>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[1, 2].map(n => <div key={n} className="h-14 animate-pulse rounded-xl bg-gray-50" />)}
        </div>
      ) : prioritizedItems.length === 0 && !hasMeaningfulActivity ? (
        /* ── STATE A: Genuinely empty room ────────────────────────────── */
        <div className="px-5 py-6">
          <p className="text-sm font-semibold text-gray-900">Start this transaction</p>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed max-w-md">
            Add the first transaction documents and participants so Kontra can begin organizing the deal.
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => onOverviewAction?.({ type: 'tab', tab: 'documents' })}
              className="rounded-xl bg-[#800020] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90">
              Upload first document
            </button>
            <button type="button" onClick={() => onOverviewAction?.({ type: 'tab', tab: 'people' })}
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
              Invite participant
            </button>
          </div>
          <ul className="mt-4 space-y-1.5">
            {[
              'Upload a core transaction document',
              'Invite the primary transaction parties',
              'Confirm the basic transaction information',
            ].map(task => (
              <li key={task} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                {task}
              </li>
            ))}
          </ul>
        </div>
      ) : prioritizedItems.length === 0 ? (
        /* ── STATE B: Active but no blockers — only shown when meaningful activity exists ── */
        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-gray-800">Nothing requires your attention right now.</p>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed">
            Kontra is monitoring the transaction for missing information, inconsistencies, participant requests, and upcoming actions.
          </p>
        </div>
      ) : (
        /* ── STATE C/D: Items to address ──────────────────────────────── */
        <>
          <div className="divide-y divide-gray-100">
            {prioritizedItems.slice(0, 5).map(item => {
              const itemActions = Array.isArray(item.actions)
                ? item.actions.filter(action => typeof action?.onClick === 'function')
                : [];
              const renderedActions = item.field
                ? [{ label: 'Review record', onClick: () => goToRecord(item.field) }]
                : itemActions.length > 0
                  ? itemActions
                  : [routeForItem(item.routeItem || item)];
              return (
              <div key={item.id} className={`flex min-w-0 items-start gap-3 px-5 py-4 ${item.urgency === 'high' ? 'bg-red-50/40' : ''}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${urgencyDot[item.urgency]}`} />
                <div className="flex-1 min-w-0">
                  <p className="break-words text-sm font-semibold leading-snug text-gray-900">{item.title}</p>
                  {item.reason ? <p className="mt-0.5 break-words text-xs leading-relaxed text-gray-500">{item.reason}</p> : null}
                  {item.excerpt ? <p className="mt-1 break-words text-[11px] italic leading-relaxed text-gray-400">{item.excerpt}</p> : null}
                  {renderedActions.length > 0 && (
                    <div className="mt-2.5 flex max-w-full flex-wrap items-center gap-2">
                      {renderedActions.map((a, ai) => (
                         <button key={ai} type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); a.onClick?.(); }} disabled={a.disabled}
                           className={`relative z-10 max-w-full cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                            a.primary ? 'bg-[#800020] text-white hover:opacity-90' : 'border border-[#800020] bg-white text-[#800020] hover:bg-[#800020]/5'
                          }`}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
      {items.length > 3 && (
            <div className="border-t border-gray-100 px-5 py-3">
               <button type="button" onClick={() => onOverviewAction?.({ type: 'tab', tab: 'documents' })}
                className="text-[11px] font-semibold text-[#800020] hover:opacity-80 transition">
                View all in Documents →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── DigitalAssetReadinessSection ──────────────────────────────────────────────
// Category-based readiness derived from structured transaction record fields.
// Four states: Not started / Building / Needs information / Ready for review.
// Rows are expandable — shows confirmed fields, missing fields, and sources.
function DigitalAssetReadinessSection({
  propertyId,
  property,
  recordFields,
  recordState = null,
  readiness,
  provenanceGaps = [],
  ownerToken = '',
  onTabChange,
  schemaKey = DEFAULT_PACK_ID,
  readinessPhase = 'transaction',
  digitalAssetEnabled = false,
  embedded = false,
  onRecordUpdated,
  focusRequest = null,
}) {
  const [expandedCat, setExpandedCat] = useState(null);
  const [confirmingField, setConfirmingField] = useState('');
  const [editingMissing, setEditingMissing] = useState('');
  const [missingValue, setMissingValue] = useState('');
  const [editingField, setEditingField] = useState('');
  const [editValue, setEditValue] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [focusedFieldKey, setFocusedFieldKey] = useState('');

  useEffect(() => {
    const requestedKeys = [
      ...(Array.isArray(focusRequest?.keys) ? focusRequest.keys : []),
      focusRequest?.key,
      focusRequest?.fieldKey,
      focusRequest?.field_key,
      focusRequest?.canonicalKey,
      focusRequest?.persistedKey,
    ].filter(Boolean);
    const requestedLabels = [
      focusRequest?.label,
      focusRequest?.displayLabel,
    ].filter(Boolean).map(value => String(value).trim().toLowerCase());
    if (requestedKeys.length === 0) return;
    const key = requestedKeys[0];
    const category = getTransactionRecordCategory({ field_key: key });
    setExpandedCat(category);
    setFocusedFieldKey(key);
    const focusTimer = window.setTimeout(() => setFocusedFieldKey(''), 2400);
    if (focusRequest?.autoEdit) {
      setEditingMissing(key);
      setMissingValue('');
      setMutationError('');
    }
    let cancelled = false;
    const focusTarget = (attempt = 0) => {
      if (cancelled) return;
      const target = requestedKeys
        .map(candidate => document.getElementById(`transaction-record-field-${encodeURIComponent(candidate)}`))
        .find(Boolean)
        || (requestedLabels.length > 0
          ? [...document.querySelectorAll('[data-transaction-record-field]')].find(element =>
            requestedLabels.includes(String(element.dataset.transactionRecordLabel || '').trim().toLowerCase())
          )
          : null);
      if (target) {
        setFocusedFieldKey(target.dataset.transactionRecordKey || key);
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempt < 20) {
        window.setTimeout(() => focusTarget(attempt + 1), 50);
      }
    };
    window.requestAnimationFrame(() => focusTarget());
    return () => {
      cancelled = true;
      window.clearTimeout(focusTimer);
    };
  }, [focusRequest]);

  // Keep the existing five visual categories, but derive their fields from the
  // same pack schema and required canonical state used by the Overview and the
  // full Transaction Record. This is data wiring only; the rendered layout is
  // intentionally unchanged.
  const canonicalRecordState = recordState || readiness?.transaction_record || null;
  const proposalFields = Array.isArray(getGeneratedProposal(property)?.transaction_record_fields)
    ? getGeneratedProposal(property).transaction_record_fields
    : [];
  // Once the room has hydrated, the persisted record state is the generated
  // schema. The proposal remains only a pre-materialization compatibility
  // fallback; it must never make a populated canonical row appear missing.
  const generatedFields = schemaKey === 'generated_ai' && canonicalRecordState?.fields?.length
    ? canonicalRecordState.fields.map(field => ({
        ...field,
        key: field.key || field.persistedKey,
        definitionKey: field.definitionKey || field.persistedKey || field.key,
        canonicalKey: field.key || field.persistedKey,
        label: field.label || field.persistedKey || field.key,
        category: normalizeRecordCategory(field.category, field.key || field.persistedKey),
        workflowRequired: field.required !== false && field.isRequired !== false,
        renderable: true,
      }))
    : proposalFields;
  const generatedSchemaKeys = generatedFields
    .map(field => field?.key)
    .filter(Boolean);
  const requiredKeys = new Set(
      (canonicalRecordState?.requiredFields?.length
      ? canonicalRecordState.requiredFields
      : (generatedSchemaKeys.length
        ? generatedSchemaKeys.map(key => ({ key }))
        : getRequiredRecordFields(schemaKey)))
      .map(field => field.key || field.canonicalKey || field.persistedKey || field.field_key || field.definitionKey)
      .filter(Boolean),
  );
  const baseSchemaFields = generatedFields.length
    ? generatedFields.map(field => ({
        ...field,
        category: normalizeRecordCategory(field.category || field.field_category, field.key),
        workflowRequired: field.required !== false,
        canonicalKey: field.key,
        renderable: true,
      }))
    : Object.entries(getPackRecordSchema(schemaKey)).flatMap(([category, fields]) =>
        fields.map(field => ({ ...field, category })),
      );
  // The canonical API can contain required fields added by a room-specific
  // workflow pack that is not present in the older static schema. Keep those
  // fields visible so Overview actions never land on an empty category.
  const canonicalSchemaFields = (canonicalRecordState?.requiredFields || [])
    .map(field => {
      const key = field?.key || field?.persistedKey || field?.field_key || field?.definitionKey || '';
      const canonicalKey = field?.canonicalKey || field?.definitionKey || field?.persistedKey || key;
      const uiCategory = getTransactionRecordCategory({ ...field, field_key: key });
      const category = {
        parties: 'parties',
        asset: 'asset_identity',
        terms: 'transaction',
        financial: 'financial',
        legal: 'legal',
      }[uiCategory] || uiCategory;
      return {
        ...field,
        key,
        canonicalKey,
        label: field?.label || field?.display_label || key,
        category,
        workflowRequired: true,
        renderable: true,
      };
    })
    .filter(field => field.key);
  const operationalSchemaFields = getHazardLossOperationalFieldDefinitions(
    property,
    canonicalRecordState,
    recordFields,
  );
  const schemaFieldKeys = new Set(baseSchemaFields.map(field => field.canonicalKey || field.key));
  const rawSchemaFields = [
    ...baseSchemaFields,
    ...canonicalSchemaFields.filter(field =>
      !schemaFieldKeys.has(field.canonicalKey || field.key)
    ),
    ...operationalSchemaFields.filter(field =>
      !schemaFieldKeys.has(field.canonicalKey || field.key)
      && !canonicalSchemaFields.some(canonical =>
        (canonical.canonicalKey || canonical.key) === (field.canonicalKey || field.key)
      )
    ),
  ];
  const operationalByIdentity = new Map();
  operationalSchemaFields.forEach(field => {
    [
      field.key,
      field.canonicalKey,
      field.persistedKey,
      field.definitionKey,
    ].filter(Boolean).forEach(identity => {
      operationalByIdentity.set(normalizeAttentionFieldKey(identity), field);
    });
  });
  const schemaFields = rawSchemaFields.map(field => {
    const operational = [
      field.key,
      field.canonicalKey,
      field.persistedKey,
      field.definitionKey,
    ].filter(Boolean)
      .map(identity => operationalByIdentity.get(normalizeAttentionFieldKey(identity)))
      .find(Boolean);
    return operational
      ? { ...field, label: operational.label, category: operational.category, hint: operational.hint, sources: operational.sources }
      : field;
  });
  const categorySchemaGroups = {
    parties: ['parties', 'beneficial_ownership'],
    asset: ['asset_identity'],
    terms: ['transaction'],
    financial: ['financial'],
    legal: ['legal', 'approvals'],
  };
  const CAT_FIELD_DEFS = Object.fromEntries(
    Object.entries(categorySchemaGroups).map(([categoryKey, schemaCategories]) => [
      categoryKey,
      schemaFields
        .filter(field =>
          schemaCategories.includes(field.category)
         && (generatedFields.length
           ? field.workflowRequired !== false
           : requiredKeys.has(field.canonicalKey || field.key))
          && field.renderable !== false,
        )
        .map(field => ({
          key: field.key,
          canonicalKey: field.canonicalKey || field.key,
          aliasOf: field.aliasOf || null,
          label: field.label,
           hint: field.hint || '',
        })),
    ]),
  );

  // Returns field objects from recordFields that match a given key (supports * prefix)
  function matchingFields(keyDef) {
    const keys = [keyDef.key, keyDef.definitionKey, keyDef.aliasOf, keyDef.canonicalKey].filter(Boolean);
    return recordFields.filter(f =>
      keyDef.key.endsWith('*')
        ? f.field_key?.startsWith(keyDef.key.slice(0, -1))
        : keys.includes(f.field_key) || (f.definition_key && keys.includes(f.definition_key))
    );
  }

  const SKIP_VALUES = new Set(['n/a', 'na', 'not applicable', 'not_applicable', 'unknown']);

  function isPopulated(f) {
    const val = String(f.value_text || '').trim().toLowerCase();
    return val && !SKIP_VALUES.has(val) && f.status !== 'not_applicable';
  }

  // Build enhanced category objects
  const categories = [
    { key: 'parties',   label: 'Identity & Parties',   fieldDefs: CAT_FIELD_DEFS.parties },
    { key: 'asset',     label: 'Asset / Company',       fieldDefs: CAT_FIELD_DEFS.asset },
    { key: 'terms',     label: 'Transaction Terms',     fieldDefs: CAT_FIELD_DEFS.terms },
    { key: 'financial', label: 'Financial Information', fieldDefs: CAT_FIELD_DEFS.financial },
    { key: 'legal',     label: 'Legal & Diligence',     fieldDefs: CAT_FIELD_DEFS.legal },
  ].map(cat => {
    const enriched = cat.fieldDefs.map(def => {
      const matched = matchingFields(def);
      const state = getRecordDefinitionState(def, recordFields, canonicalRecordState);
       const populated = ['confirmed', 'awaiting'].includes(state.status)
         ? matched.find(f => isPopulated(f)) || (state.field ? {
             ...state.field,
             value_text: state.value,
              status: state.status === 'confirmed' ? 'verified' : 'extracted',
           } : null)
        : null;
      return { ...def, field: populated, state, allMatches: matched };
    });
    const confirmedDefs = enriched.filter(d => d.state.status === 'confirmed');
     const awaitingDefs  = enriched.filter(d => d.state.status === 'awaiting');
     const missingDefs   = enriched.filter(d => d.state.status === 'missing');
    const count = confirmedDefs.length;
    const total = enriched.length;
    // Derive sources from populated fields
    const sources = [...new Set(
      confirmedDefs.flatMap(d => [d.field?.source_document, d.field?.source_file, d.field?.source_section].filter(Boolean))
    )].slice(0, 3);

    // Four-state status
    const st = count === 0
      ? 'not_started'
      : count >= Math.ceil(total * 0.67)
        ? 'ready'
        : count >= Math.ceil(total * 0.34)
          ? 'needs_info'
          : 'building';

     const missingLabels = missingDefs.map(d => d.label.toLowerCase());
      const summary = missingDefs.length === 0 && awaitingDefs.length === 0
       ? 'All key fields present'
        : awaitingDefs.length > 0 && missingDefs.length === 0
          ? `${awaitingDefs.length} field${awaitingDefs.length === 1 ? '' : 's'} awaiting confirmation`
       : cat.key === 'parties' && missingLabels.some(label => label.includes('investor'))
         ? 'Add the investor / agency here'
       : cat.key === 'parties' && missingLabels.some(label => label.includes('buyer'))
         && missingLabels.some(label => label.includes('seller'))
         ? 'Buyer and seller not identified'
         : cat.key === 'financial' && missingLabels.some(label => label.includes('funding request'))
           ? 'Add the requested release amount here'
         : cat.key === 'terms' && missingLabels.some(label => label.includes('value') || label.includes('price'))
           ? 'Transaction value missing'
           : `${missingDefs[0].label} missing`;

     return { ...cat, enriched, confirmedDefs, awaitingDefs, missingDefs, count, total, sources, st, summary };
  });

  const readyCount   = categories.filter(c => c.st === 'ready').length;
  const buildingCount = categories.filter(c => ['building','needs_info'].includes(c.st)).length;
  const serverSufficient = readiness?.digital_asset_readiness?.sufficient;
  const tokenizationDefinitions = generatedFields.length ? [] : getRequiredRecordFields('tokenization');
  const tokenizationInputStates = tokenizationDefinitions.map(definition =>
    getRecordDefinitionState(definition, recordFields, recordState || readiness?.transaction_record || null)
  );
  const tokenizationGaps = tokenizationInputStates.filter(item => item.status !== 'confirmed');
  const tokenizationInputsComplete = serverSufficient === true
    && tokenizationGaps.length === 0;
  const allReady     = tokenizationInputsComplete;

  async function confirmRecordField(field) {
    const fieldId = field?.fieldId || field?.id;
    if (!fieldId || confirmingField) return;
    let ownerWriteToken = '';
    try { ownerWriteToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch {}
    if (!ownerWriteToken) return;
    setConfirmingField(fieldId);
    setMutationError('');
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${fieldId}/verify`,
        {
          method: 'POST',
          headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            ownerWriteToken,
            actorRole: field?.approveProvenance ? 'Workspace Owner' : 'coordinator',
            approveProvenance: field?.approveProvenance === true,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || (
          field?.approveProvenance
            ? 'Manual provenance approval could not be recorded.'
            : 'The Transaction Record field could not be confirmed.'
        ));
      }
      await onRecordUpdated?.();
    } catch (error) {
      setMutationError(error.message || 'The Transaction Record field could not be confirmed.');
    } finally {
      setConfirmingField('');
    }
  }

  async function saveMissingField(field) {
    const value = missingValue.trim();
    if (!value) return;
    const fieldKey = field?.canonicalKey || field?.key || field?.field_key || '';
    const fieldCategory = field?.category || field?.field_category
      || getTransactionRecordCategory({ field_key: fieldKey });
    if (!fieldKey || !fieldCategory) {
      setMutationError('This Transaction Record field is missing its canonical category and cannot be saved yet.');
      return;
    }
    let ownerWriteToken = '';
    try { ownerWriteToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch {}
    if (!ownerWriteToken) {
      setMutationError('Owner session required to add a Transaction Record value.');
      return;
    }
    setMutationError('');
    setConfirmingField(field.key);
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields`,
        {
          method: 'POST',
          headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            field_key: fieldKey,
            display_label: field.label,
            field_category: fieldCategory,
            value_text: value,
            status: 'needs_review',
            ownerWriteToken,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.id) {
        throw new Error(data.message || data.error || 'The Transaction Record value could not be saved.');
      }
      const verifyResponse = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${data.id}/verify`,
        {
          method: 'POST',
          headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ownerWriteToken, actorRole: 'coordinator' }),
        },
      );
      const verifyData = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok) {
        throw new Error(verifyData.message || verifyData.error || 'The new Transaction Record value could not be confirmed.');
      }
      setEditingMissing('');
      setMissingValue('');
      await onRecordUpdated?.();
    } catch (error) {
      setMutationError(error.message || 'The Transaction Record value could not be saved.');
    } finally {
      setConfirmingField('');
    }
  }

  async function updateRecordField(field, changes) {
    const fieldId = field?.fieldId || field?.id;
    if (!fieldId) {
      setMutationError('This Transaction Record field is not editable until it has a persisted field ID.');
      return;
    }
    let ownerWriteToken = '';
    try { ownerWriteToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch {}
    if (!ownerWriteToken) {
      setMutationError('Owner session required to update the Transaction Record.');
      return;
    }
    setMutationError('');
    setConfirmingField(fieldId);
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${fieldId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...changes, ownerWriteToken }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'The Transaction Record field could not be updated.');
      setEditingField('');
      setEditValue('');
      await onRecordUpdated?.();
    } catch (error) {
      setMutationError(error.message || 'The Transaction Record field could not be updated.');
    } finally {
      setConfirmingField('');
    }
  }

  // Overall state
  const overallState = allReady
    ? { label: 'Preparation available', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' }
    : readyCount >= 3
      ? { label: 'Substantial',  color: 'text-indigo-700', bg: 'bg-indigo-50',   border: 'border-indigo-100' }
      : buildingCount >= 2
        ? { label: 'Building',   color: 'text-amber-700',  bg: 'bg-amber-50',    border: 'border-amber-100' }
        : { label: 'Early',      color: 'text-gray-500',   bg: 'bg-gray-50',     border: 'border-gray-200' };

  const stLabel = { not_started: 'Not started', building: 'Building', needs_info: 'Needs information', ready: 'Key fields present' };
  const stColor = { not_started: 'text-gray-400', building: 'text-amber-600', needs_info: 'text-orange-600', ready: 'text-emerald-600' };
  const stDot   = { not_started: 'bg-gray-200',   building: 'bg-amber-400',   needs_info: 'bg-orange-400',   ready: 'bg-emerald-400' };
  const stBar   = { not_started: 'bg-gray-100',   building: 'bg-amber-300',   needs_info: 'bg-orange-300',   ready: 'bg-emerald-400' };

  return (
    <div className={embedded ? 'mt-6 border-t border-gray-100 pt-5' : 'rounded-2xl border border-gray-200 bg-white overflow-hidden'}>
      {/* Header */}
      <div className={embedded ? '' : 'px-5 py-4 border-b border-gray-100'}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {embedded ? 'Transaction record' : (readinessPhase === 'closing' ? 'Closing readiness' : 'Transaction readiness')}
            </p>
            <p className="mt-1 text-sm font-bold text-gray-900">
              {embedded
                ? 'Structured truth from documents, inputs, and verified facts'
                : readinessPhase === 'closing'
                ? 'Preparing for transaction close'
                : 'Building your verified transaction record'}
            </p>
          </div>
          {!embedded && (
            <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${overallState.color} ${overallState.bg} ${overallState.border}`}>
              {overallState.label}
            </span>
          )}
        </div>
        {!embedded && (
          <>
            <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
              {readinessPhase === 'closing'
                ? 'Verify all conditions are satisfied and parties are ready to close.'
                : 'Kontra organizes transaction information as documents are reviewed, participants respond, and facts are confirmed.'}
            </p>
            {/* Visual category state only; the authoritative overall score lives above. */}
            <div className="mt-3 flex items-center gap-1">
              {categories.map(cat => (
                <div key={cat.key} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${stBar[cat.st]}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Category rows — each expandable */}
      <div className="divide-y divide-gray-100">
        {categories.map(cat => {
          const isExpanded = expandedCat === cat.key;
          return (
            <div key={cat.key} id={`transaction-record-category-${cat.key}`}>
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedCat(isExpanded ? null : cat.key)}
                className="flex items-center justify-between w-full px-5 py-3 gap-4 text-left hover:bg-gray-50 transition">
                  <div className="min-w-0">
                   <div className="flex items-center gap-2 min-w-0">
                     <span className={`h-2 w-2 shrink-0 rounded-full ${stDot[cat.st]}`} />
                      <p className="break-words text-sm leading-snug text-gray-700 sm:truncate sm:leading-normal">{cat.label}</p>
                   </div>
                   {cat.summary && (cat.missingDefs.length > 0 || cat.awaitingDefs.length > 0) && (
                      <p className="mt-0.5 pl-4 break-words text-[11px] leading-snug text-gray-400 sm:truncate sm:leading-normal">{cat.summary}</p>
                   )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-semibold ${embedded ? 'text-gray-500' : stColor[cat.st]}`}>
                     {cat.count} confirmed · {cat.awaitingDefs.length} awaiting · {cat.missingDefs.length} missing
                  </span>
                  <svg className={`w-3 h-3 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div className="px-5 pb-4 pt-1 bg-gray-50/60 border-t border-gray-100">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Confirmed */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Confirmed</p>
                      {cat.confirmedDefs.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Nothing confirmed yet.</p>
                      ) : (
                        <ul className="space-y-1">
                          {cat.confirmedDefs.map(d => {
                            const confirmedFieldId = d.state?.fieldId || d.state?.field?.id;
                            const provenanceGap = getCurrentProvenanceGap(d, provenanceGaps);
                            return (
                              <li key={d.key} id={`transaction-record-field-${encodeURIComponent(d.key)}`} data-transaction-record-field="true" data-transaction-record-key={d.key} data-transaction-record-label={d.label} className={`rounded-lg px-1 text-xs text-gray-700 transition-shadow ${focusedFieldKey === d.key ? 'bg-emerald-50 ring-2 ring-emerald-300 ring-offset-1' : ''}`}>
                                <span className="flex items-start gap-1.5">
                                  <span className="mt-0.5 text-emerald-500 shrink-0">✓</span>
                                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                                    <span className="break-words">{d.label}{d.state?.value ? <span className="text-gray-400"> — {d.state.value}</span> : ''}</span>
                                    {confirmedFieldId && (
                                      <span className="flex max-w-full flex-wrap items-center gap-1">
                                        <button type="button"
                                          onClick={() => { setEditingField(confirmedFieldId); setEditValue(d.state.value || ''); setMutationError(''); }}
                                          disabled={!!confirmingField}
                                          className="rounded-lg border border-[#800020] bg-white px-2 py-1 text-[10px] font-bold text-[#800020] hover:bg-[#800020]/5 disabled:opacity-50">
                                          Edit/correct
                                        </button>
                                        <button type="button"
                                          onClick={() => updateRecordField(d.state.field || d.state, { value_text: '', status: 'missing' })}
                                          disabled={!!confirmingField}
                                          className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-bold text-red-600 disabled:opacity-50">
                                          Reject/Clear
                                        </button>
                                        {provenanceGap && (
                                          <button
                                            type="button"
                                            onClick={() => confirmRecordField({ ...d.state, approveProvenance: true })}
                                            disabled={!!confirmingField || !ownerToken}
                                            title={ownerToken ? 'Record an auditable owner approval for the current value.' : 'Owner session required.'}
                                            className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            {confirmingField === confirmedFieldId ? 'Working…' : 'Approve provenance'}
                                          </button>
                                        )}
                                      </span>
                                    )}
                                  </span>
                                </span>
                                {provenanceGap && (
                                  <span className="mt-1 block pl-4 text-[10px] leading-relaxed text-amber-700">
                                    {provenanceGap.requirement || 'Current value needs document/file provenance or an auditable owner approval.'}
                                  </span>
                                )}
                                {editingField === confirmedFieldId && (
                                  <span className="mt-1 flex w-full items-center gap-1 pl-4">
                                    <input value={editValue} onChange={event => setEditValue(event.target.value)}
                                      aria-label={`Correct ${d.label}`} className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[10px]" />
                                    <button type="button" onClick={() => updateRecordField(d.state.field || d.state, { value_text: editValue, status: 'needs_review' })}
                                      disabled={!editValue.trim() || !!confirmingField} className="rounded bg-[#800020] px-2 py-1 text-[10px] font-bold text-white hover:opacity-90 disabled:opacity-50">
                                      Save correction
                                    </button>
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                     {/* Awaiting confirmation */}
                     <div>
                       <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Awaiting confirmation</p>
                       {cat.awaitingDefs.length === 0 ? (
                         <p className="text-xs text-gray-400 italic">No unconfirmed candidates.</p>
                       ) : (
                         <ul className="space-y-1">
                           {cat.awaitingDefs.slice(0, 4).map(d => (
                              <li key={d.key} id={`transaction-record-field-${encodeURIComponent(d.key)}`} data-transaction-record-field="true" data-transaction-record-key={d.key} data-transaction-record-label={d.label} className={`flex items-start gap-1.5 rounded-lg px-1 text-xs text-blue-700 transition-shadow ${focusedFieldKey === d.key ? 'bg-blue-50 ring-2 ring-blue-300 ring-offset-1' : ''}`}>
                               <span className="mt-0.5 text-blue-500 shrink-0">●</span>
                               <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                                 <span className="break-words">{d.label}{d.state?.value ? <span className="text-gray-400"> — {d.state.value}</span> : ''}</span>
                                  {(d.state?.fieldId || d.state?.field?.id) && d.state?.value && (
                                    <span className="flex max-w-full flex-wrap items-center gap-1">
                                      <button type="button" onClick={() => confirmRecordField(d.state)} disabled={!!confirmingField}
                                        className="rounded-lg bg-[#800020] px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50">
                                        {confirmingField ? 'Working…' : 'Confirm'}
                                      </button>
                                      <button type="button"
                                        onClick={() => { setEditingField(d.state.fieldId || d.state.field.id); setEditValue(d.state.value || ''); setMutationError(''); }}
                                        disabled={!!confirmingField}
                                         className="rounded-lg border border-[#800020] bg-white px-2 py-1 text-[10px] font-bold text-[#800020] hover:bg-[#800020]/5 disabled:opacity-50">
                                        Edit/correct
                                      </button>
                                      <button type="button"
                                        onClick={() => updateRecordField(d.state.field || d.state, { value_text: '', status: 'missing' })}
                                        disabled={!!confirmingField}
                                        className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-bold text-red-600 disabled:opacity-50">
                                        Reject/Clear
                                      </button>
                                    </span>
                                  )}
                               </span>
                                {editingField === (d.state?.fieldId || d.state?.field?.id) && (
                                  <span className="mt-1 flex w-full items-center gap-1 pl-4">
                                    <input value={editValue} onChange={event => setEditValue(event.target.value)}
                                      aria-label={`Correct ${d.label}`} className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[10px]" />
                                    <button type="button" onClick={() => updateRecordField(d.state.field || d.state, { value_text: editValue, status: 'needs_review' })}
                                       disabled={!editValue.trim() || !!confirmingField} className="rounded bg-[#800020] px-2 py-1 text-[10px] font-bold text-white hover:opacity-90 disabled:opacity-50">
                                      Save correction
                                    </button>
                                  </span>
                                )}
                             </li>
                           ))}
                           {cat.awaitingDefs.length > 4 && (
                             <li className="text-[10px] text-gray-400">+{cat.awaitingDefs.length - 4} more</li>
                           )}
                         </ul>
                       )}
                     </div>
                     {/* Missing */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Missing</p>
                      {cat.missingDefs.length === 0 ? (
                        <p className="text-xs text-emerald-600 font-medium">All key fields present.</p>
                      ) : (
                           <ul className="space-y-1">
                          {cat.missingDefs.slice(0, 4).map(d => (
                              <li key={d.key} id={`transaction-record-field-${encodeURIComponent(d.key)}`} data-transaction-record-field="true" data-transaction-record-key={d.key} data-transaction-record-label={d.label} className={`flex items-start gap-1.5 rounded-lg px-1 text-xs text-gray-500 transition-shadow ${focusedFieldKey === d.key ? 'bg-amber-50 ring-2 ring-amber-300 ring-offset-1' : ''}`}>
                              <span className="mt-0.5 text-gray-300 shrink-0">○</span>
                               <span className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
                                 <span className="min-w-0 flex-1 break-words">{d.label}{d.state?.value ? <span className="text-gray-400"> — {d.state.value}</span> : ''}</span>
                                   {editingMissing === d.key ? (
                                     <span className="flex max-w-full shrink-0 flex-wrap items-center gap-1">
                                       <input
                                         value={missingValue}
                                         onChange={event => setMissingValue(event.target.value)}
                                          placeholder={
                                            d.key === 'organization.investor_or_agency'
                                              ? 'e.g. Freddie Mac'
                                              : d.key === 'funding.request'
                                                ? 'e.g. $5,500'
                                                : 'Enter value'
                                          }
                                         aria-label={`Enter ${d.label}`}
                                         className="w-28 rounded border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-700"
                                       />
                                       <button
                                         type="button"
                                         onClick={() => saveMissingField(d)}
                                         disabled={!missingValue.trim() || confirmingField === d.key}
                                         className="rounded bg-[#800020] px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                                       >
                                         {confirmingField === d.key ? 'Saving…' : 'Save & confirm'}
                                       </button>
                                     </span>
                                   ) : (
                                     <button
                                       type="button"
                                       onClick={() => { setEditingMissing(d.key); setMissingValue(''); setMutationError(''); }}
                                          className="shrink-0 rounded-lg border border-[#800020] bg-white px-2 py-1 text-[10px] font-bold text-[#800020] hover:bg-[#800020]/5"
                                     >
                                       Add value
                                     </button>
                                   )}
                              </span>
                            </li>
                          ))}
                          {cat.missingDefs.length > 4 && (
                            <li className="text-[10px] text-gray-400">+{cat.missingDefs.length - 4} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                  {/* Sources */}
                  {cat.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Sources</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.sources.map(src => (
                          <span key={src} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">{src}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {mutationError && (
        <p className="border-t border-red-100 bg-red-50 px-5 py-2.5 text-[11px] font-semibold text-red-700">
          {mutationError}
        </p>
      )}

      {/* Footer — DA prep available (only when tokenization/DA is explicitly enabled) */}
      {digitalAssetEnabled && allReady ? (
        <div className="border-t border-emerald-100 bg-emerald-50/60 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">Optional Digital Asset Preparation</p>
          <p className="text-xs font-semibold text-gray-800">Required preparation inputs captured</p>
          <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
            Select an eligible immutable readiness snapshot in the Verified Asset Readiness card to assemble a frozen package for external professional or provider review. This is not legal, regulatory, or issuance approval.
          </p>
        </div>
      ) : digitalAssetEnabled ? (
        <div className="border-t border-gray-100 bg-indigo-50/30 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-0.5">Optional Digital Asset Preparation</p>
          <p className="text-[10px] text-gray-400">
            {tokenizationGaps.length} tokenization-specific input{tokenizationGaps.length === 1 ? '' : 's'} still need to be recorded or confirmed. General transaction completeness does not replace these inputs.
          </p>
        </div>
      ) : (
        <p className="border-t border-gray-100 px-5 py-3 text-[10px] text-gray-400">
          Transaction readiness reflects the completeness and organization of transaction information across all parties, documents, and verified facts.
        </p>
      )}
    </div>
  );
}

// ── RoomCopilot — floating button + side drawer ───────────────────────────────
// Persistent across all tabs. Self-fetches room state to pick context-appropriate chips.
function RoomCopilot({ propertyId }) {
  const [open, setOpen]           = useState(false);
  const [question, setQuestion]   = useState('');
  const [answer, setAnswer]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [showAllQ, setShowAllQ]   = useState(false);
  const [isEmpty, setIsEmpty]     = useState(true);
  const inputRef = useRef(null);

  // Self-fetch a lightweight indicator of whether the room has any extracted facts
  useEffect(() => {
    if (!propertyId) return;
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/transaction-record`,
      { headers: getRoomAuthHeaders(propertyId) })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const fields = Array.isArray(data?.fields) ? data.fields : [];
        setIsEmpty(fields.length === 0);
      })
      .catch(() => {});
  }, [propertyId]);

  // When the room is empty, surface action-oriented questions first
  const QUICK_PRIMARY = isEmpty
    ? [
        "What should I upload first?",
        "What will Kontra extract from an LOI?",
        "What should I do to start this deal?",
        "What's missing?",
      ]
    : [
        "What's happening with this transaction?",
        "What should I do next?",
        "What's blocking the transaction?",
        "What's missing?",
      ];
  const QUICK_SECONDARY = [
    "Who are we waiting on?",
    "What changed recently?",
    "Summarize this deal.",
    "How close is this to digital-asset preparation?",
  ];
  const quickQuestions = showAllQ ? [...QUICK_PRIMARY, ...QUICK_SECONDARY] : QUICK_PRIMARY;

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function ask(prompt = question) {
    const q = String(prompt || '').trim();
    if (!q || loading) return;
    setQuestion(q);
    setLoading(true);
    setAnswer('');
    try {
      const response = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/brain/ask`, {
        method: 'POST',
        headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ question: q }),
      });
      const data = response.ok ? await response.json() : null;
      setAnswer(data?.answer || 'I could not answer from the current transaction record.');
    } catch {
      setAnswer('Kontra could not reach the transaction workspace. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Kontra AI"
        className="fixed bottom-20 right-3 z-40 flex h-10 w-10 max-w-[calc(100vw-1.5rem)] items-center justify-center gap-2 rounded-full bg-[#800020] p-0 text-white shadow-xl transition hover:opacity-90 hover:shadow-2xl sm:bottom-6 sm:right-6 sm:h-auto sm:w-auto sm:py-3 sm:pl-4 sm:pr-5">
        <span className="text-sm" aria-hidden="true">✦</span>
        <span className="hidden text-sm font-semibold sm:inline">Kontra AI</span>
      </button>

      {/* Side drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Kontra AI">
          <div className="absolute inset-0 bg-black/25" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#800020] text-sm text-white" aria-hidden="true">✦</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Kontra AI</p>
                  <p className="text-[10px] text-gray-400">Transaction-aware guidance</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!answer && !loading && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Suggested questions</p>
                  <div className="flex flex-wrap gap-2">
                    {quickQuestions.map(prompt => (
                      <button key={prompt} type="button" onClick={() => ask(prompt)} disabled={loading}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 transition hover:border-[#800020] hover:text-[#800020] disabled:opacity-50">
                        {prompt}
                      </button>
                    ))}
                    {!showAllQ && (
                      <button type="button" onClick={() => setShowAllQ(true)}
                        className="rounded-full border border-dashed border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-400 transition hover:border-gray-400 hover:text-gray-600">
                        More →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {loading && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#800020]">✦</span>
                    <p className="text-xs text-gray-500">Thinking…</p>
                  </div>
                </div>
              )}

              {answer && !loading && (
                <div
                  className="max-h-[50vh] overflow-y-auto rounded-xl border border-[#eadde1] bg-[#fffafb] px-4 py-3"
                  aria-live="polite"
                  aria-label="Kontra AI answer"
                  tabIndex={0}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#800020] mb-1.5">Kontra AI</p>
                  <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{answer}</p>
                  <button onClick={() => { setAnswer(''); setQuestion(''); }}
                    className="mt-3 text-[10px] font-semibold text-gray-400 transition hover:text-gray-600">
                    Ask another question
                  </button>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 p-4 space-y-2">
              <form onSubmit={e => { e.preventDefault(); ask(); }} className="flex gap-2">
                <input
                  ref={inputRef}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Ask about this transaction…"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#800020]"
                />
                <button type="submit" disabled={loading || !question.trim()}
                  className="rounded-xl bg-[#800020] px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40">
                  {loading ? '…' : 'Ask'}
                </button>
              </form>
              <p className="text-[10px] text-gray-400">
                Operational guidance only · Kontra does not provide legal or regulatory verification
              </p>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

// ── Stage Lifecycle Bar ───────────────────────────────────────────────────────
// Adapated from the OperationsManagerView stage bar. Shows every effective stage
// (including settlement when enabled) as a horizontal progression. The current
// stage is highlighted; past stages show a checkmark; future stages are muted.
function StageLifecycleBar({
  stages = [],
  currentStageKey,
  compact = false,
  supportingDocumentPresent = null,
}) {
  if (stages.length === 0) return null;
  const currentIdx = Math.max(0, stages.findIndex(s => s.key === currentStageKey));
  return (
    <div className={`${compact ? 'mt-5 pt-4' : 'mt-4 pt-4'} border-t border-gray-100`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Transaction lifecycle</p>
        {compact && <p className="text-[10px] text-gray-400">Coordinator-reported · documents and confirmed facts are separate</p>}
      </div>
      <div className={`flex items-center ${compact ? 'gap-1' : 'items-start gap-1'}`}>
        {stages.map((s, i) => {
          const done   = i < currentIdx;
          const active = i === currentIdx;
          return (
            <React.Fragment key={s.key}>
              <div className={`min-w-0 flex-1 ${compact ? 'flex items-center gap-1.5' : 'flex flex-col items-center'}`}>
                <div className={`${compact ? 'h-2 w-2' : 'mb-1 h-6 w-6'} shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                  ${done   ? 'bg-[#800020] text-white'
                  : active ? 'ring-2 ring-[#800020] bg-white text-[#800020]'
                           : 'bg-gray-100 text-gray-300'}`}>
                  {!compact && (done ? '✓' : (s.icon || '·'))}
                </div>
                <p className={`${compact ? 'text-[10px]' : 'w-full px-0.5 text-[9px] text-center'} font-semibold leading-tight break-words
                  ${active ? 'text-[#800020]' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                  {s.label}
                </p>
              </div>
              {i < stages.length - 1 && (
                <div className={`${compact ? 'h-px flex-1' : 'mt-3 h-0.5 w-4'} shrink-0 rounded ${done ? 'bg-[#800020]' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {supportingDocumentPresent !== null && (
        <p className={`mt-2 text-[10px] ${supportingDocumentPresent ? 'text-gray-400' : 'font-medium text-amber-600'}`}>
          {supportingDocumentPresent
            ? 'Supporting documents are tracked separately from the coordinator-reported stage.'
            : 'Supporting document missing.'}
        </p>
      )}
    </div>
  );
}

function normalizeLifecycleStages(stages) {
  return (stages || []).map(stage =>
    /loi\s+(sent|submitted|signed)/i.test(String(stage.label || ''))
      ? { ...stage, label: 'LOI Executed' }
      : stage
  );
}

function getLifecycleEvidenceSections(stage) {
  if (!stage) return null;
  const text = `${stage.key || ''} ${stage.label || ''}`.toLowerCase();
  if (/\bnda\b|non[-\s]?disclosure/.test(text)) return ['nda', 'non_disclosure_agreement', 'non-disclosure_agreement'];
  if (/\bloi\b|letter of intent/.test(text)) return ['loi', 'letter_of_intent'];
  if (/due diligence|diligence|under review|review|approved|term sheet|structur/.test(text)) {
    return ['loi', 'letter_of_intent', 'purchase_agreement', 'definitive_agreement'];
  }
  if (/purchase agreement|purchase_agreement|definitive agreement/.test(text)) return ['purchase_agreement', 'definitive_agreement'];
  if (/closing|closed|funded|settlement|complete/.test(text)) return ['purchase_agreement', 'closing_statement', 'settlement_statement'];
  return null;
}

function getLifecycleAdvanceRecommendation(stages, currentStageIndex, analyses, hasBlockingIssues = false) {
  if (hasBlockingIssues) return null;
  if (!Array.isArray(stages) || currentStageIndex < 0 || currentStageIndex >= stages.length - 1) return null;
  const usableAnalyses = (analyses || []).filter(analysis =>
    !['failed', 'uploaded', 'processing', 'retrying'].includes(String(analysis.processing_status || '').toLowerCase())
      && analysis.analysis?.pending !== true
  );
  const uploadedSections = new Set(usableAnalyses.map(analysis => String(analysis.section || '').toLowerCase()));
  const laterStage = stages.slice(currentStageIndex + 1).find((stage) => {
    const evidenceSections = getLifecycleEvidenceSections(stage);
    return evidenceSections?.some(section => uploadedSections.has(String(section).toLowerCase()));
  });
  if (!laterStage) return null;
  const evidenceSections = getLifecycleEvidenceSections(laterStage) || [];
  const evidence = evidenceSections
    .filter(section => uploadedSections.has(String(section).toLowerCase()))
    .map(section => section.replace(/_/g, ' '));
  return {
    stage: laterStage,
    evidence,
    reason: evidence.length > 1
      ? `${evidence.slice(0, 2).join(' and ')} are already on file.`
      : `${evidence[0] || 'Supporting evidence'} is already on file.`,
  };
}

function getOpenIssueCount(conflicts = [], nextMilestoneBlockers = [], documentReviewCount = 0) {
  return conflicts.length + nextMilestoneBlockers.length + documentReviewCount;
}

const RECORD_EMPTY_VALUES = new Set(['', 'n/a', 'na', 'not applicable', 'not_applicable', 'unknown']);
const RECORD_CONFLICT_STATUSES = new Set(['conflicting', 'conflict', 'source_changed']);
const RECORD_AWAITING_STATUSES = new Set(['extracted', 'needs_review', 'awaiting', 'awaiting_confirmation']);
const DONE_DOCUMENT_STATUSES = new Set(['uploaded', 'approved', 'ai_complete', 'complete', 'completed']);

function hasMeaningfulRecordValue(field) {
  const value = String(field?.value_text || '').trim().toLowerCase();
  return !RECORD_EMPTY_VALUES.has(value) && field?.status !== 'not_applicable';
}

function normalizeRecordStatus(field) {
  const raw = String(field?.status || '').toLowerCase();
  if (RECORD_CONFLICT_STATUSES.has(raw)) return 'conflict';
  if (['verified', 'confirmed'].includes(raw) || field?.attention === 'source_changed') return 'confirmed';
  if (raw === 'not_applicable') return 'not_applicable';
  // Extracted, manually entered, and legacy captured rows all mean that a
  // candidate exists but a human has not confirmed it yet.
  if (RECORD_AWAITING_STATUSES.has(raw) || hasMeaningfulRecordValue(field)) return 'awaiting';
  return 'missing';
}

function hasDocumentReviewFinding(analysis) {
  const result = analysis?.analysis || {};
  const reviewStatuses = new Set(['review', 'needs_review', 'pending_review', 'needs_attention', 'attention']);
  const explicitReview = [
    analysis?.processing_status,
    result.status,
    result.review_status,
    result.reviewStatus,
    result.complianceStatus,
    result.document_status,
    result.documentStatus,
  ].some(value => reviewStatuses.has(String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')))
    || result.requires_human_review === true
    || result.needs_review === true
    || result.needsAttention === true
    || result.requiresHumanReview === true;
  if (explicitReview || analysis?.processing_status === 'failed') return true;

  const findingArrays = [
    result.redFlags,
    result.anomalies,
    result.coverageGaps,
    result.lifeSafetyFindings,
    result.scheduleBExceptions,
    result.discrepancies,
    result.paymentDiscrepancy,
    result.paymentDiscrepancies,
    result.reviewFindings,
    result.review_findings,
    result.findings,
    result.deficiencies,
    result.issues,
  ];
  return findingArrays.some(items => Array.isArray(items) && items.length > 0);
}

function normalizeRecordCategory(value, key = '', label = '') {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const keyCategory = String(key || '').split('.')[0].toLowerCase();
  const fieldText = `${key} ${label}`.toLowerCase();
  if (/(units?[\s_-]+(damaged|affected)|properties?[\s_-]+damaged)/.test(fieldText)) {
    return 'asset_identity';
  }
  if (/(additional[\s_-]+work[\s_-]+invoice|fund[\s_-]+release[\s_-]+request)/.test(fieldText)) {
    return 'financial';
  }
  const category = raw || keyCategory || 'transaction';
  if (['transaction', 'transaction_extra', 'terms', 'deal_terms'].includes(category)) return 'transaction';
  if (['asset', 'asset_identity', 'property', 'company', 'identity'].includes(category)) return 'asset_identity';
  if (['party', 'parties', 'counterparties', 'organization', 'organizer'].includes(category)) return 'parties';
  if (['ownership', 'beneficial_ownership', 'cap_table'].includes(category)) return 'beneficial_ownership';
  if (['finance', 'financial', 'financials', 'economics'].includes(category)) return 'financial';
  if (['legal', 'diligence', 'regulatory'].includes(category)) return 'legal';
  if (['approval', 'approvals', 'signoff'].includes(category)) return 'approvals';
  if (['hazard', 'incident', 'loss', 'event', 'timeline'].includes(category)) return 'transaction';
  if (['insurance', 'coverage', 'repairs', 'repair'].includes(category)) return 'financial';
  if (['document', 'documents', 'evidence'].includes(category)) return 'legal';
  const labelText = String(label || '').toLowerCase();
  if (/(repair|cost|amount|financial|insurance|coverage|proceeds|valuation)/.test(`${key} ${labelText}`)) return 'financial';
  if (/(incident|date|loss|event|deadline|closing|completion)/.test(`${key} ${labelText}`)) return 'transaction';
  return keyCategory || category;
}

const HAZARD_LOSS_OPERATIONAL_FIELDS = Object.freeze([
  {
    key: 'organization.investor_or_agency',
    label: 'Investor / agency',
    category: 'parties',
    workflowRequired: true,
    required: true,
    sources: ['Insurance Claim Documentation', 'Servicer Correspondence'],
    hint: 'The investor, agency, or servicer responsible for the loss review.',
  },
  {
    key: 'financial.borrower_funds_advanced',
    label: 'Borrower funds advanced',
    category: 'financial',
    workflowRequired: true,
    required: true,
    sources: ['Funding Request', 'Servicer Correspondence'],
    hint: 'Confirmed amount of borrower funds already advanced for the loss.',
  },
  {
    key: 'funding.request',
    label: 'Funding request',
    category: 'financial',
    workflowRequired: true,
    required: true,
    sources: ['Funding Request', 'Additional Work Invoice'],
    hint: 'The reimbursement or additional repair proceeds requested.',
  },
]);

function isHazardLossWorkspace(property, recordState = null, recordFields = []) {
  const text = [
    property?.name,
    property?.property_name,
    property?.type,
    property?.workspace_type,
    property?.property_type,
    property?.deal_type,
    property?.transaction_type,
    property?.description,
    property?.generated_proposal?.transaction_identity?.type,
    property?.generated_proposal?.transaction_identity?.label,
    property?.metadata_values?.description,
    property?.metadata_values?.transaction_type,
  ].filter(Boolean).join(' ').toLowerCase();
  const fields = [
    ...(Array.isArray(recordState?.fields) ? recordState.fields : []),
    ...(Array.isArray(recordState?.requiredFields) ? recordState.requiredFields : []),
    ...(Array.isArray(recordFields) ? recordFields : []),
  ];
  const fieldText = fields.map(field => [
    field?.key,
    field?.field_key,
    field?.definitionKey,
    field?.definition_key,
    field?.label,
    field?.display_label,
  ].filter(Boolean).join(' ')).join(' ').toLowerCase();
  return /\bfreddie\s*mac\b|\bhazard[\s-]+loss\b|\bcasualty\b|\binsurance\s+proceeds?\b|\brepair\s+(?:progress|funds?|proceeds?)\b/.test(text)
    || /\b(?:organization\.)?investor[_\s/]+or[_\s/]agency\b|\bfinancial\.(?:borrower[_\s]+funds[_\s]+advanced|borrower[_\s]+advanced[_\s]+funds)\b|\bfunding\.(?:request|fund[_\s]+release[_\s]+request)\b|\bfund[_\s]+release[_\s]+request\b|\bborrower[_\s]+funds[_\s]+advanced\b/.test(fieldText);
}

function getHazardLossOperationalFieldDefinitions(property, recordState = null, recordFields = []) {
  return isHazardLossWorkspace(property, recordState, recordFields)
    ? HAZARD_LOSS_OPERATIONAL_FIELDS.map(field => ({ ...field, renderable: true }))
    : [];
}

function recordStateFieldForDefinition(definition, recordState) {
  const definitions = [
    definition?.canonicalKey,
    definition?.key,
    definition?.definitionKey,
    definition?.aliasOf,
  ].filter(Boolean);
  const normalizeLabel = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
  const label = normalizeLabel(definition?.label);
  const definitionIdentities = new Set(definitions.map(normalizeAttentionFieldKey));
  const matches = [
    ...(Array.isArray(recordState?.requiredFields) ? recordState.requiredFields : []),
    ...(Array.isArray(recordState?.fields) ? recordState.fields : []),
  ].filter(field =>
    [...getRecordFieldIdentitySet(field)].some(identity => definitionIdentities.has(identity))
      || (label && normalizeLabel(field?.label || field?.display_label) === label)
  );
  const statusPriority = {
    confirmed: 0,
    verified: 0,
    source_changed: 1,
    conflict: 2,
    conflicting: 2,
    awaiting: 3,
    needs_review: 3,
    extracted: 3,
    missing: 4,
    not_applicable: 5,
  };
  return matches
    .slice()
    .sort((a, b) =>
      (statusPriority[normalizeRecordStatus(a)] ?? 6)
      - (statusPriority[normalizeRecordStatus(b)] ?? 6)
    )[0] || null;
}

function getRecordDefinitionState(definition, recordFields = [], recordState = null) {
  const canonicalDefinitionKey = definition?.canonicalKey || definition?.key;
  const authoritativeField = recordStateFieldForDefinition(definition, recordState);
  if (authoritativeField) {
    const status = normalizeRecordStatus(authoritativeField);
    return {
      definition,
      field: authoritativeField,
      fieldId: authoritativeField.fieldId || authoritativeField.id || null,
      value: authoritativeField.value || authoritativeField.value_text || '',
      status,
        attention: authoritativeField.attention || null,
    };
  }
  const keys = new Set([
    definition?.key,
    definition?.definitionKey,
    definition?.aliasOf,
    definition?.canonicalKey,
  ].filter(Boolean));
  const normalizeLabel = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
  const definitionLabel = normalizeLabel(definition?.label);
  const matches = recordFields.filter(field =>
    keys.has(field.field_key)
      || (definitionLabel && normalizeLabel(field.display_label) === definitionLabel)
  );
  const valueMatches = matches.filter(hasMeaningfulRecordValue);
  const conflict = valueMatches.find(field => ['conflicting', 'conflict'].includes(String(field.status || '').toLowerCase()));
  const confirmed = valueMatches.find(field => ['verified', 'confirmed', 'source_changed'].includes(String(field.status || '').toLowerCase()));
  const awaiting = valueMatches.find(field => RECORD_AWAITING_STATUSES.has(field.status));
  const selected = conflict || confirmed || awaiting || valueMatches[0] || matches[0] || null;
  return {
    definition,
    field: selected,
    fieldId: selected?.fieldId || selected?.id || null,
    value: selected?.value_text || '',
    status: conflict ? 'conflict' : confirmed ? 'confirmed' : awaiting ? 'awaiting'
      : selected && hasMeaningfulRecordValue(selected) ? 'awaiting' : 'missing',
    attention: selected?.status === 'source_changed' ? 'source_changed' : null,
  };
}

function getCurrentProvenanceGap(field, provenanceGaps = []) {
  const identities = new Set([
    field?.key,
    field?.field_key,
    field?.canonicalKey,
    field?.persistedKey,
    field?.definitionKey,
    field?.state?.key,
    field?.state?.field_key,
    field?.state?.field?.key,
    field?.state?.field?.field_key,
  ].filter(Boolean).map(normalizeAttentionFieldKey));
  const labels = new Set([
    field?.label,
    field?.display_label,
    field?.state?.label,
    field?.state?.field?.label,
    field?.state?.field?.display_label,
  ].filter(Boolean).map(normalizeAttentionText));
  return (Array.isArray(provenanceGaps) ? provenanceGaps : []).find(gap => {
    const gapKey = gap?.field_key || gap?.fieldKey || gap?.key;
    const gapLabel = gap?.label || gap?.display_label;
    return (gapKey && identities.has(normalizeAttentionFieldKey(gapKey)))
      || (gapLabel && labels.has(normalizeAttentionText(gapLabel)));
  }) || null;
}

function getGeneratedProposal(property) {
  return property?.generated_proposal || property?.metadata_values?.generated_proposal || null;
}

function isGeneratedAiRoom(property) {
  return Array.isArray(getGeneratedProposal(property)?.transaction_record_fields);
}

function getEffectiveRecordSchemaKey(property, packId, pack) {
  return isGeneratedAiRoom(property)
    ? 'generated_ai'
    : resolveSchemaKey(packId, pack, property?.name || property?.property_name);
}

function getEffectiveRecordDefinitions(schemaKey, property, recordFields = [], recordState = null) {
  // Generated rooms have no reusable pack schema. Once the room exists, the
  // persisted record rows are the schema: this prevents the proposal JSON
  // from becoming a second source of field identity, category, or requiredness.
  if (schemaKey === 'generated_ai') {
    const persistedFields = (recordState?.fields?.length ? recordState.fields : recordFields)
      .filter(field => field?.field_key || field?.key)
      .map(field => {
        const approvedDefinitionKey = field.definitionKey ||
          field.definition_key ||
          recordState?.requiredFields?.find(required =>
            required?.key === (field.key || field.field_key)
              || required?.persistedKey === (field.key || field.field_key)
          )?.definitionKey ||
          field.key || field.field_key;
        return {
        ...field,
        definitionKey: approvedDefinitionKey,
        // Keep the approved definition key visible for legacy generated
        // rooms, while canonicalKey remains the durable database identity.
        key: approvedDefinitionKey,
        canonicalKey: field.key || field.field_key,
        persistedKey: field.key || field.field_key,
        label: field.label || field.display_label || field.field_key,
        category: normalizeRecordCategory(field.category || field.field_category, field.key || field.field_key),
        workflowRequired: field.required !== false && field.is_required !== false,
        required: field.required !== false && field.is_required !== false,
        renderable: field.renderable !== false,
        summaryPriority: field.summaryPriority || 'key',
        };
      })
      .filter(field => field.renderable !== false);
    const canonicalFields = (recordState?.requiredFields || [])
      .filter(field => field?.key || field?.persistedKey || field?.field_key || field?.definitionKey)
      .map(field => {
        const key = field.key || field.persistedKey || field.field_key || field.definitionKey;
        return {
          ...field,
          key,
          definitionKey: field.definitionKey || key,
          canonicalKey: field.canonicalKey || field.persistedKey || field.field_key || key,
          persistedKey: field.persistedKey || field.field_key || key,
          label: field.label || field.display_label || key,
          category: normalizeRecordCategory(
            field.category || field.field_category,
            key,
            field.label || field.display_label,
          ),
          workflowRequired: field.required !== false && field.isRequired !== false,
          required: true,
          renderable: field.renderable !== false,
        };
      })
      .filter(field => field.renderable !== false);
    if (persistedFields.length > 0) {
      const persistedIdentities = new Set(
        persistedFields.flatMap(field => [
          field.key,
          field.canonicalKey,
          field.persistedKey,
          field.definitionKey,
        ].filter(Boolean).map(normalizeAttentionFieldKey)),
      );
      return [
        ...persistedFields,
        ...canonicalFields.filter(field => ![
          field.key,
          field.canonicalKey,
          field.persistedKey,
          field.definitionKey,
        ].filter(Boolean).map(normalizeAttentionFieldKey)
          .some(identity => persistedIdentities.has(identity))),
      ];
    }
    if (canonicalFields.length > 0) return canonicalFields;
    // Pre-migration compatibility only. New rooms always take the branch
    // above because materialization creates one row per approved field.
    const generatedFields = getGeneratedProposal(property)?.transaction_record_fields;
    if (Array.isArray(generatedFields)) {
      return generatedFields
        .filter(field => field?.key && field?.label)
        .map(field => ({
          ...field,
          category: normalizeRecordCategory(field.category || field.field_category, field.key),
          canonicalKey: field.key,
          workflowRequired: field.required !== false,
          renderable: field.renderable !== false,
          summaryPriority: field.summaryPriority || 'key',
        }))
        .filter(field => field.renderable !== false);
    }
    return [];
  }
  return Object.values(getPackRecordSchema(schemaKey)).flat()
    .filter(field => field.renderable !== false);
}

function getRecordDateValue(property, recordFields = [], recordState = null, fallbackKeys = []) {
  const generated = isGeneratedAiRoom(property);
  const generatedKeys = new Set(
    (getGeneratedProposal(property)?.transaction_record_fields || [])
      .map(field => String(field?.key || '').toLowerCase())
      .filter(key => key.includes('date') && (key.includes('close') || key.includes('completion'))),
  );
  const keys = generated
    ? generatedKeys
    : new Set(fallbackKeys);
  if (keys.size === 0) return '';
  const stateField = recordState?.fields?.find(field =>
    keys.has(String(field.key || '').toLowerCase())
      && field.status !== 'not_applicable'
      && String(field.value || '').trim(),
  );
  if (stateField) return String(stateField.value);
  const recordField = recordFields.find(field =>
    keys.has(String(field.field_key || '').toLowerCase())
      && field.status !== 'not_applicable'
      && String(field.value_text || '').trim(),
  );
  return recordField?.value_text ? String(recordField.value_text) : '';
}

function getCoordinatorRecordFacts(schemaKey, property, recordFields = [], recordState = null) {
  const fields = getEffectiveRecordDefinitions(schemaKey, property, recordFields, recordState);
  if (schemaKey === 'generated_ai') {
    const prioritizedDefinitions = [
      ...fields.slice(0, 8),
      ...fields.filter(definition => {
        const state = getRecordDefinitionState(definition, recordFields, recordState);
        return ['confirmed', 'conflict', 'awaiting'].includes(state.status)
          && String(state.value || '').trim();
      }),
    ];
    const seen = new Set();
    return prioritizedDefinitions
      .filter(definition => {
        const key = definition.canonicalKey || definition.key;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(definition => ({
      ...getRecordDefinitionState(definition, recordFields, recordState),
      key: definition.key || definition.canonicalKey,
      label: definition.label || definition.key,
      }));
  }
  const economicKey = schemaKey === 'fundraising'
    ? 'financial.target_raise'
    : schemaKey === 'business_acquisition'
      ? 'transaction.purchase_price'
      : 'transaction.purchase_price';
  const preferredKeys = [
    economicKey,
    'transaction.value',
    'parties.buyer',
    'parties.seller',
    'transaction.deposit',
    'transaction.earnest_money',
    'transaction.closing_date',
    'asset.name',
    'asset.legal_name',
    'asset.address',
    'asset.jurisdiction',
    'parties.primary',
    'parties.secondary',
    'ownership.owner_name',
    'financial.revenue',
    'financial.ebitda',
    'financial.net_income',
  ];
  const definitions = [];
  const seen = new Set();
  [...preferredKeys, ...fields.filter(field => field.summaryPriority === 'key').map(field => field.canonicalKey || field.key)]
    .forEach(key => {
      const definition = fields.find(field => (field.canonicalKey || field.key) === key || field.key === key);
      if (!definition) return;
      const canonicalKey = definition.canonicalKey || definition.key;
      if (seen.has(canonicalKey)) return;
      seen.add(canonicalKey);
      definitions.push(definition);
    });
  return definitions.slice(0, 8).map(definition => ({
     ...getRecordDefinitionState(definition, recordFields, recordState),
    key: definition.canonicalKey || definition.key,
     label: schemaKey === 'fundraising' && (definition.canonicalKey || definition.key) === 'financial.target_raise'
       ? 'Transaction Value'
       : definition.label || definition.key,
  }));
}

function getDocumentRequirementStats(checklistItems = [], pack, property, analyses = []) {
  const sourceDocuments = checklistItems.length > 0
    ? checklistItems
    : (typeof pack?.getDocumentSchema === 'function'
      ? pack.getDocumentSchema(property?.property_type || property?.type)
      : (Array.isArray(pack?.documentSchema) ? pack.documentSchema : []));
  const requiredDocuments = sourceDocuments.filter(item => item.required);
  const receivedDocuments = requiredDocuments.filter(item =>
    DONE_DOCUMENT_STATUSES.has(String(item.status || '').toLowerCase())
      || item.uploaded === true
      || analyses.some(analysis => String(analysis.section || '').toLowerCase() === String(item.section || '').toLowerCase())
  );
  const reviewStatuses = new Set(['review', 'needs_review', 'pending_review', 'needs_attention', 'attention']);
  const reviewSections = new Set(
    analyses
      .filter(hasDocumentReviewFinding)
      .map(analysis => String(analysis.section || '').toLowerCase()),
  );
  const reviewDocuments = requiredDocuments.filter(item =>
    receivedDocuments.includes(item)
      && (
        reviewStatuses.has(String(item.status || '').toLowerCase().replace(/[\s-]+/g, '_'))
          || reviewSections.has(String(item.section || '').toLowerCase())
      )
  );
  const missingDocuments = requiredDocuments.filter(item => !receivedDocuments.includes(item));
  return {
    sourceDocuments,
    requiredDocuments,
    receivedDocuments,
    reviewDocuments,
    missingDocuments,
  };
}

function isStaleDocumentAction(action, documentStats) {
  const text = String(typeof action === 'string'
    ? action
    : (action?.text || action?.action || action?.item || action?.title || '')).trim().toLowerCase();
  if (!text || !/(request|upload|missing|provide|receive|document|file)/i.test(text)) return false;
  return documentStats.receivedDocuments.some(document => {
    const terms = [document.label, document.name, document.section]
      .filter(Boolean)
      .map(value => String(value).toLowerCase().replace(/[_-]+/g, ' '));
    return terms.some(term => term.length > 2 && text.includes(term));
  });
}

function filterLiveDocumentActions(actions = [], documentStats) {
  return (actions || []).filter(action => !isStaleDocumentAction(action, documentStats));
}

function normalizeAttentionText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeAttentionFieldKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return {
    'financial.borrower_advanced_funds': 'financial.borrower_funds_advanced',
    'financial.borrower_funds_advanced_amount': 'financial.borrower_funds_advanced',
    'transaction.investor_or_agency': 'organization.investor_or_agency',
    'parties.investor_or_agency': 'organization.investor_or_agency',
  }[key] || key;
}

function getRecordFieldIdentitySet(field) {
  return new Set([
    field?.key,
    field?.field_key,
    field?.canonicalKey,
    field?.persistedKey,
    field?.definitionKey,
  ].filter(Boolean).map(normalizeAttentionFieldKey));
}

function getCanonicalRecordFieldCandidates(recordState, recordFields = []) {
  const candidates = [
    ...(Array.isArray(recordState?.requiredFields) ? recordState.requiredFields : []),
    ...(Array.isArray(recordState?.fields) ? recordState.fields : []),
    ...(Array.isArray(recordFields) ? recordFields : []),
  ];
  const candidatesByIdentity = new Map();
  const statusPriority = {
    confirmed: 0,
    verified: 0,
    source_changed: 1,
    conflict: 2,
    conflicting: 2,
    awaiting: 3,
    needs_review: 3,
    extracted: 3,
    missing: 4,
    not_applicable: 5,
  };
  candidates.forEach(field => {
    const identities = getRecordFieldIdentitySet(field);
    const label = normalizeAttentionText(field?.label || field?.display_label);
    const identity = [...identities][0] || (label ? `label:${label}` : '');
    if (!identity) return;
    const current = candidatesByIdentity.get(identity);
    if (
      !current
      || (statusPriority[normalizeRecordStatus(field)] ?? 6)
        < (statusPriority[normalizeRecordStatus(current)] ?? 6)
    ) {
      candidatesByIdentity.set(identity, field);
    }
  });
  return [...candidatesByIdentity.values()];
}

function actionTextMentionsRecordField(action, field) {
  const actionValue = typeof action === 'string'
    ? action
    : [
      action?.title,
      action?.text,
      action?.action,
      action?.item,
      action?.reason,
      action?.note,
    ].filter(Boolean).join(' ');
  const text = normalizeAttentionText([
    actionValue,
  ].filter(Boolean).join(' '));
  if (!text) return false;
  const actionTokens = new Set(text.split(' '));
  const directMatch = [
    field?.label,
    field?.display_label,
    field?.key,
    field?.field_key,
    field?.definitionKey,
  ].filter(Boolean).some(value => {
    const label = normalizeAttentionText(value);
    if (!label) return false;
    if (` ${text} `.includes(` ${label} `)) return true;
    const tokens = label.split(' ').filter(token => token.length > 1);
    return tokens.length >= 2 && tokens.every(token => actionTokens.has(token));
  });
  if (directMatch) return true;

  // Briefing/task-engine actions were generated with several historical
  // phrasings for the hazard-loss fields. Match those semantic aliases to the
  // canonical field so a confirmed 9,000 value cannot leave an old
  // "advance borrower funds" action in the attention feed.
  const fieldKeys = [
    field?.key,
    field?.field_key,
    field?.canonicalKey,
    field?.persistedKey,
    field?.definitionKey,
  ].filter(Boolean).map(normalizeAttentionFieldKey);
  if (fieldKeys.includes('financial.borrower_funds_advanced')) {
    return /\b(?:borrower(?:s)?\s+)?(?:funds?|amount)\s+(?:already\s+)?advanc(?:e|ed|ing)\b/.test(text)
      || /\bborrower(?:s)?\s+advanc(?:e|ed|ing)\s+(?:funds?|amount)\b/.test(text)
      || /\badvanc(?:e|ed|ing)\s+(?:the\s+)?borrower(?:s)?\s+funds?\b/.test(text)
      || /\bborrower(?:s)?\s+out\s+of\s+pocket\b/.test(text);
  }
  if (fieldKeys.includes('funding.request')) {
    return /\b(?:funding|fund|repair)\s+(?:request|release|proceeds)\b/.test(text)
      || /\b(?:request|release|reimburse(?:ment)?)\s+(?:additional\s+)?(?:repair\s+)?(?:funds?|proceeds?)\b/.test(text);
  }
  return fieldKeys.includes('organization.investor_or_agency')
    && /\b(?:investor|agency)\b/.test(text)
    && /\b(?:add|identify|confirm|record|provide|select)\b/.test(text);
}

function isBorrowerFundsRecordAction(action) {
  const actionValue = typeof action === 'string'
    ? action
    : [
      action?.title,
      action?.text,
      action?.action,
      action?.item,
      action?.reason,
      action?.note,
    ].filter(Boolean).join(' ');
  const text = normalizeAttentionText(actionValue);
  if (!text) return false;
  return (
    /\bborrower\b.*\badvanc(?:e|ed|ing)\b.*\bfunds?\b/.test(text)
    || /\bborrower\b.*\bfunds?\b.*\badvanc(?:e|ed|ing)\b/.test(text)
    || /\badvanc(?:e|ed|ing)\b.*\bborrower\b.*\bfunds?\b/.test(text)
    || /\bborrower\b.*\bout\s+of\s+pocket\b/.test(text)
  );
}

function findCanonicalRecordFieldForAction(action, recordState, recordFields = []) {
  const candidates = getCanonicalRecordFieldCandidates(recordState, recordFields);
  const preferCurrentState = matches => matches
    .slice()
    .sort((a, b) => {
      const priority = status => {
        const normalized = normalizeRecordStatus({ status });
        return ({
        confirmed: 0,
        verified: 0,
        conflict: 1,
        conflicting: 1,
        source_changed: 1,
        awaiting: 2,
        needs_review: 2,
        extracted: 2,
        missing: 3,
        }[normalized] ?? 4);
      };
      return priority(a?.status) - priority(b?.status);
    })[0] || null;
  const explicitKeys = [
    action?.field_key,
    action?.fieldKey,
    action?.key,
    action?.canonicalKey,
    action?.persistedKey,
    action?.definitionKey,
  ].filter(Boolean).map(normalizeAttentionFieldKey);
  if (explicitKeys.length > 0) {
    const explicitMatches = candidates.filter(field => {
      const identities = getRecordFieldIdentitySet(field);
      return explicitKeys.some(key => identities.has(key));
    });
    if (explicitMatches.length > 0) return preferCurrentState(explicitMatches);
  }
  const textMatches = candidates.filter(field => actionTextMentionsRecordField(action, field));
  return textMatches.length > 0 ? preferCurrentState(textMatches) : null;
}

function filterStaleRecordActions(
  actions = [],
  recordState = null,
  recordFields = [],
  canonicalActionKeys = new Set(),
) {
  return (actions || []).filter(action => {
    const field = findCanonicalRecordFieldForAction(action, recordState, recordFields);
    if (!field) return true;
    const identities = getRecordFieldIdentitySet(field);
    const isResolved = normalizeRecordStatus(field) === 'confirmed';
    const hasCanonicalAction = [...identities].some(identity => canonicalActionKeys.has(identity));
    // Briefing text can contain an older extracted candidate. Once the
    // canonical field is confirmed, or once a canonical Review record action
    // exists for it, never render that stale candidate as a second action.
    return !isResolved && !hasCanonicalAction;
  });
}

function dedupeAttentionItems(items = []) {
  const seen = new Set();
  const seenFields = new Set();
  return items.filter(item => {
    const raw = String(item?.title || item?.text || '').trim().toLowerCase();
    const explicitField = [
      item?.field,
      item?.fieldKey,
      item?.field_key,
      item?.routeItem?.field,
      item?.routeItem?.fieldKey,
      item?.routeItem?.field_key,
    ].find(Boolean);
    const fieldKey = typeof explicitField === 'object'
      ? [...getRecordFieldIdentitySet(explicitField)][0]
      : normalizeAttentionFieldKey(explicitField);
    if (fieldKey) {
      if (seenFields.has(fieldKey)) return false;
      seenFields.add(fieldKey);
    }
    const key = /repair\s*cost/i.test(raw)
      ? 'repair-cost-discrepancy'
      : /discrepancy|conflict/.test(raw) && /repair|cost/.test(raw)
        ? 'repair-cost-discrepancy'
        : raw;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCanonicalAwaitingRecordFields(recordState) {
  if (!Array.isArray(recordState?.requiredFields)) return [];
  const fieldsByIdentity = new Map();
  recordState.requiredFields.forEach(field => {
    const identity = [...getRecordFieldIdentitySet(field)][0]
      || `label:${normalizeAttentionText(field?.label || field?.display_label)}`;
    if (!identity) return;
    const current = fieldsByIdentity.get(identity);
    const currentStatus = normalizeRecordStatus(current);
    const nextStatus = normalizeRecordStatus(field);
    if (!current || (currentStatus !== 'confirmed' && nextStatus === 'confirmed')) {
      fieldsByIdentity.set(identity, field);
    }
  });
  return [...fieldsByIdentity.values()].filter(field =>
    normalizeRecordStatus(field) === 'awaiting'
      && String(field.value ?? field.value_text ?? '').trim()
  );
}

function mergeTransactionRecordState(previous, incoming) {
  if (!incoming) return previous || null;
  if (!previous) return incoming;
  const merged = { ...previous, ...incoming };
  const arrayKeys = ['requiredFields', 'fields', 'unresolvedConflicts'];
  arrayKeys.forEach(key => {
    const incomingValue = incoming[key];
    // An empty array is an authoritative response too. Keeping the previous
    // projection here resurrects stale awaiting fields and conflicts after a
    // confirmation or a fresh empty record response.
    if (Array.isArray(incomingValue)) {
      merged[key] = incomingValue;
    }
  });
  ['schemaKey', 'requiredCount', 'confirmedCount', 'awaitingRequiredCount'].forEach(key => {
    if (incoming[key] == null && previous[key] != null) merged[key] = previous[key];
  });
  return merged;
}

function getCanonicalUnresolvedConflicts(recordState) {
  const source = Array.isArray(recordState?.unresolvedConflicts)
    ? recordState.unresolvedConflicts
    : [];
  const seen = new Set();
  return source.filter(conflict => {
    const key = conflict?.fieldKey || conflict?.field_key
      || conflict?.id
      || `${conflict?.label || conflict?.display_label || ''}:${conflict?.canonicalValue || conflict?.canonical_value || ''}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getNextMilestoneBlockers({
  stages = [],
  currentStageIndex = 0,
  checklistItems = [],
  analyses = [],
  pack,
  property,
  participantStates = [],
  briefing,
}) {
  const nextStage = stages[currentStageIndex + 1];
  if (!nextStage) return { nextStage: null, blockers: [] };
  const { requiredDocuments, receivedDocuments } = getDocumentRequirementStats(checklistItems, pack, property, analyses);
  const evidenceSections = getLifecycleEvidenceSections(nextStage) || [];
  const missingDocuments = requiredDocuments.filter(item => !receivedDocuments.includes(item));
  const nextStageDocuments = missingDocuments.filter(item =>
    evidenceSections.includes(String(item.section || '').toLowerCase()),
  );
  const blockers = nextStageDocuments.map(item => ({
    key: `next-doc-${item.id || item.section}`,
    text: `${item.label || item.name || 'Required document'} is needed before ${nextStage.label}`,
    detail: 'This requirement is tied to the next lifecycle milestone.',
    action: { label: 'Open Documents', onClick: () => {} },
    participantKey: (Array.isArray(item.assignedTo || item.assigned_to)
      ? (item.assignedTo || item.assigned_to)
      : [item.assignedTo || item.assigned_to].filter(Boolean))[0],
  }));
  const blockedRoles = new Set(blockers.map(blocker => blocker.participantKey).filter(Boolean));
  const nextStageParticipantRoles = new Set([
    ...(Array.isArray(nextStage.requiredRoles) ? nextStage.requiredRoles : []),
    ...(Array.isArray(nextStage.requiredRoleKeys) ? nextStage.requiredRoleKeys : []),
    ...(Array.isArray(nextStage.participantRoles) ? nextStage.participantRoles : []),
  ]);
  const participantRolesForMilestone = new Set([...blockedRoles, ...nextStageParticipantRoles]);
  participantStates
    .filter(state => state.required && !state.joined && participantRolesForMilestone.has(state.key))
    .forEach(state => blockers.push({
      key: `next-participant-${state.key}`,
      text: `${state.label} must be active before ${nextStage.label}`,
      detail: 'This participant owns a requirement for the next milestone.',
      action: { label: 'Open People', onClick: () => {} },
    }));

  // AI briefing text is advisory and can become stale after a participant or
  // document changes. Progression blockers must come from the durable
  // checklist and invitation-backed participant state above.
  return { nextStage, blockers };
}

function getRecentCoordinatorChanges(events = [], analyses = [], recordFields = []) {
  const meaningfulEventTypes = new Set([
    'doc_uploaded', 'document_uploaded', 'document_analyzed', 'analysis_complete',
    'stage_advanced', 'stage_advance', 'party_submitted', 'participant_joined',
    'invite_accepted', 'field_verified', 'transaction_record_verified',
    'source_changed', 'conflict_detected', 'vap_ready',
  ]);
  const changes = events
    .filter(event => meaningfulEventTypes.has(event.event_type))
    .map(event => ({
      id: `event-${event.id || `${event.event_type}-${event.created_at}`}`,
      type: event.event_type,
      text: event.description || ({
        doc_uploaded: 'A document was uploaded',
        document_uploaded: 'A document was uploaded',
        document_analyzed: 'A document was analyzed',
        analysis_complete: 'Document analysis completed',
        stage_advanced: 'The transaction stage changed',
        stage_advance: 'The transaction stage changed',
        party_submitted: 'A participant marked their work complete',
        participant_joined: 'A participant joined the workspace',
        invite_accepted: 'A participant accepted an invitation',
        field_verified: 'A Transaction Record fact was confirmed',
        transaction_record_verified: 'A Transaction Record fact was confirmed',
        source_changed: 'A source changed a recorded fact',
        conflict_detected: 'A Transaction Record conflict was detected',
        vap_ready: 'A verified package became available',
      }[event.event_type] || 'Transaction activity changed'),
      date: event.created_at,
    }))
    .filter(item => !/readiness updated from .* to .*/i.test(item.text));
  const fieldChanges = recordFields
    .filter(field => RECORD_CONFLICT_STATUSES.has(field.status) || field.status === 'verified')
    .map(field => ({
      id: `field-${field.id || field.field_key}`,
      type: field.status,
      text: field.status === 'verified'
        ? `${field.display_label || field.field_key} was confirmed`
        : `${field.display_label || field.field_key} needs conflict review`,
      date: field.updated_at || field.created_at,
    }));
  return [...changes, ...fieldChanges]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 5);
}

function KeyTransactionFacts({ facts = [], onTabChange, onOverviewAction }) {
  const statusConfig = {
    confirmed: { label: 'Confirmed', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    awaiting: { label: 'Awaiting confirmation', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
    conflict: { label: 'Conflict', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
    missing: { label: 'Not recorded', dot: 'bg-gray-300', text: 'text-gray-500', bg: 'bg-gray-50' },
  };
  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-5 py-5 sm:px-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Key Transaction Facts</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">Canonical values from the Transaction Record</p>
        </div>
        <button
          type="button"
          onClick={() => onOverviewAction?.({ type: 'record', field: facts[0] || { field_key: 'transaction' } })}
          className="text-[10px] font-bold text-[#800020]"
        >
          Review record →
        </button>
      </div>
      {facts.length === 0 ? (
        <p className="mt-4 text-xs text-gray-400">No key facts are recorded yet.</p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(fact => {
            const config = statusConfig[fact.status] || statusConfig.missing;
            return (
              <div key={fact.key} className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="break-words text-[10px] font-bold uppercase leading-snug tracking-wider text-gray-400 sm:truncate sm:leading-normal">{fact.label}</p>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`} />
                </div>
                <p className="mt-1 break-words text-sm font-semibold text-gray-900">
                  {fact.value || 'Not recorded'}
                </p>
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.bg} ${config.text}`}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TransactionConflictResolver({ propertyId, conflict, analyses = [], onResolved, onClose }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!conflict) return null;
  const sourceName = id => {
    const source = analyses.find(item => item.id === id);
    return source?.filename || source?.section || 'Source document';
  };
  const resolve = async valueText => {
    let ownerWriteToken = '';
    try { ownerWriteToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch {}
    if (!ownerWriteToken || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/conflicts/${conflict.id}/resolve`,
        {
          method: 'POST',
          headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ownerWriteToken, value_text: valueText }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'The conflict could not be resolved.');
      }
      await onResolved?.();
      onClose?.();
    } catch (resolveError) {
      setError(resolveError.message || 'The conflict could not be resolved.');
    } finally {
      setSaving(false);
    }
  };
  const options = [
    {
      value: conflict.canonicalValue || conflict.canonical_value || 'Not recorded',
      label: 'Current canonical value',
      source: sourceName(conflict.canonicalSourceDocId || conflict.canonical_source_doc_id),
      primary: true,
    },
    {
      value: conflict.conflictingValue || conflict.conflicting_value || 'Not recorded',
      label: 'Conflicting value',
      source: sourceName(conflict.conflictingSourceDocId || conflict.conflicting_source_doc_id),
      primary: false,
    },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-3 py-3 sm:items-center sm:px-5" role="dialog" aria-modal="true" aria-label="Resolve transaction record conflict">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">Transaction Record conflict</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">Resolve {conflict.label || 'Repair Costs'}</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">Choose the value that should remain authoritative for this transaction record.</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-gray-400" aria-label="Close conflict resolver">×</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {options.map(option => (
            <div key={`${option.label}-${option.value}`} className={`rounded-xl border p-3 ${option.primary ? 'border-[#800020]/30 bg-[#800020]/5' : 'border-gray-200 bg-gray-50'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{option.label}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{option.value}</p>
              <p className="mt-1 break-words text-[11px] text-gray-500">Source: {option.source}</p>
              <button type="button" onClick={() => resolve(option.value)} disabled={saving} className={`mt-3 w-full rounded-lg px-3 py-2 text-[11px] font-bold disabled:opacity-50 ${option.primary ? 'bg-[#800020] text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>
                {saving ? 'Saving…' : option.primary ? 'Keep canonical value' : 'Use this value'}
              </button>
            </div>
          ))}
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}

function TransactionBrief({
  propertyId,
  property,
  pack,
  packId,
  briefing,
  coordination,
  checklistItems = [],
  analyses = [],
  recordFields = [],
  recordState = null,
  readiness = null,
  stages = [],
  currentStage,
  currentStageIndex,
  events = [],
  loading,
  ownerToken,
  onTabChange,
  onRefresh,
  onOverviewAction,
}) {
  const [stageDecision, setStageDecision] = useState('');
  const [stageActionError, setStageActionError] = useState('');
  const [advancing, setAdvancing] = useState(false);

  const participantRows = Array.isArray(coordination?.submissions)
    ? coordination.submissions
    : (Array.isArray(coordination?.parties) ? coordination.parties : []);
  const participantRoles = getExternalParticipantRoles(pack, { isCoordinator: true });
  const requiredParticipantRoles = participantRoles.filter(role => role.required);
  const participantStatuses = resolveParticipantStates(participantRoles, {
    invites: coordination?.participantInvites || [],
    submissions: participantRows,
  });
  const participantProgressRoles = requiredParticipantRoles.length > 0 ? requiredParticipantRoles : participantRoles;
  const participantComplete = participantProgressRoles.filter(item =>
    participantStatuses.find(status => status.key === item.key)?.complete
  ).length;
  const documentStats = getDocumentRequirementStats(checklistItems, pack, property, analyses);
  const { nextStage: nextMilestone, blockers: nextMilestoneBlockers } = getNextMilestoneBlockers({
    stages,
    currentStageIndex,
    checklistItems,
    analyses,
    pack,
    property,
    participantStates: participantStatuses,
    briefing,
  });

  const generatedRoom = isGeneratedAiRoom(property);
  const canonicalRecordState = recordState || readiness?.transaction_record || null;
  const recordSchemaKey = canonicalRecordState?.schemaKey
    || getEffectiveRecordSchemaKey(property, packId, pack);
  const generatedRecordDefinitions = getEffectiveRecordDefinitions(
    recordSchemaKey,
    property,
    canonicalRecordState ? [] : recordFields,
    canonicalRecordState,
  );
  const requiredRecordFields = Array.isArray(canonicalRecordState?.requiredFields)
    ? canonicalRecordState.requiredFields
    : (recordSchemaKey === 'generated_ai'
      ? generatedRecordDefinitions
      : getRequiredRecordFields(recordSchemaKey));
  const confirmedRecordCount = canonicalRecordState
    ? (canonicalRecordState.confirmedCount || 0)
    : 0;
  const capturedAwaitingConfirmation = Array.isArray(canonicalRecordState?.requiredFields)
    ? canonicalRecordState.requiredFields.filter(field =>
      field.status === 'awaiting' && String(field.value ?? field.value_text ?? '').trim()
    )
    : [];
  // The Brief must not invent a second conflict projection. The canonical
  // unresolved list is also the source used by WhatNeedsAttention.
  const allConflicts = getCanonicalUnresolvedConflicts(canonicalRecordState);
  const recentChanges = getRecentCoordinatorChanges(events, analyses, recordFields);
  const goToRecord = field => {
    onOverviewAction?.({ type: 'record', field });
  };
  const hasBlockingIssues = allConflicts.length > 0 || nextMilestoneBlockers.length > 0;
  const stageRecommendation = getLifecycleAdvanceRecommendation(
    stages,
    currentStageIndex,
    analyses,
    hasBlockingIssues,
  );
  const openIssueCount = getOpenIssueCount(
    allConflicts,
    nextMilestoneBlockers,
    documentStats.reviewDocuments.length,
  );
  const recommendationItems = [
    ...(stageRecommendation && !hasBlockingIssues && stageDecision !== 'kept'
      ? [{
          key: 'stage',
          tone: 'blue',
          text: `Consider advancing from ${currentStage?.label || 'the current stage'} to ${stageRecommendation.stage.label}`,
          detail: stageRecommendation.reason,
          action: { label: 'Review stage', onClick: () => setStageDecision('review') },
        }]
      : []),
     ...allConflicts.slice(0, 2).map(field => ({
       key: `conflict-${field.fieldId || field.id || field.key || field.field_key}`,
      tone: 'red',
       text: `Resolve ${field.label || field.display_label || field.key || field.field_key}`,
       detail: field.attention === 'source_changed' || field.status === 'source_changed'
         ? 'A newer source changed the recorded value.'
         : 'Multiple sources disagree.',
      action: { label: 'Review record', onClick: () => goToRecord(field) },
    })),
    ...capturedAwaitingConfirmation.slice(0, 2).map(field => ({
       key: `confirm-${field.fieldId || field.id || field.key || field.field_key}`,
      tone: 'blue',
       text: `Confirm ${field.label || field.display_label || field.key || field.field_key}`,
       detail: `Kontra extracted “${field.value || field.value_text}”.`,
      action: { label: 'Review record', onClick: () => goToRecord(field) },
    })),
     ...documentStats.missingDocuments.slice(0, 3).map(item => ({
       key: `missing-document-${item.id || item.section}`,
       tone: 'amber',
       text: `Request ${item.label || item.name || 'required document'}`,
       detail: 'This required document has not been received yet.',
       action: { label: 'Open Documents', onClick: () => onTabChange?.('documents') },
     })),
  ].slice(0, 5);

  async function acceptStageRecommendation() {
    if (!stageRecommendation || !ownerToken || advancing) return;
    setAdvancing(true);
    setStageActionError('');
    try {
      const response = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/advance`, {
        method: 'POST',
        headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          stage: stageRecommendation.stage.key,
          ownerWriteToken: ownerToken,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Stage could not be advanced');
      }
      setStageDecision('accepted');
      await onRefresh?.();
    } catch (error) {
      setStageActionError(error.message || 'Stage could not be advanced');
    } finally {
      setAdvancing(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
        <div className="mt-3 h-6 w-64 animate-pulse rounded bg-gray-100" />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-xl bg-gray-50" />)}
        </div>
      </section>
    );
  }

  const isCreTransaction = packId === DEFAULT_PACK_ID
    || pack?.id === DEFAULT_PACK_ID
    || ['acquisition', 'refinance', 'construction', 'flag_conversion', 'sale', 'ground_lease'].includes(property?.deal_type);
  const transactionLabel = isCreTransaction
    ? 'Commercial Real Estate Acquisition'
    : (pack?.name || 'Transaction workspace');
  const toneClasses = {
    red: 'border-red-100 bg-red-50/60 text-red-700',
    amber: 'border-amber-100 bg-amber-50/60 text-amber-800',
    blue: 'border-blue-100 bg-blue-50/60 text-blue-700',
    gray: 'border-gray-100 bg-gray-50 text-gray-700',
  };

  return (
    <section className="rounded-2xl border border-[#eadde1] bg-[#fffafb] px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#800020]">Coordinator Transaction Brief</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">What needs a decision next</h2>
          <p className="mt-1 text-xs text-gray-500">{transactionLabel} · derived from the current workspace state</p>
        </div>
        <span className="rounded-full border border-[#e7cbd3] bg-white px-3 py-1 text-[10px] font-semibold text-[#800020]">
          {currentStage?.label || 'Stage not reported'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Documents</p>
          <div className="mt-1 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Received — uploaded</span>
              <span className="font-bold text-gray-900">
                {documentStats.requiredDocuments.length > 0
                  ? `${documentStats.receivedDocuments.length}/${documentStats.requiredDocuments.length}`
                  : analyses.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Needs review</span>
              <span className={`font-bold ${documentStats.reviewDocuments.length > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                {documentStats.reviewDocuments.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Missing/request needed</span>
              <span className={`font-bold ${documentStats.missingDocuments.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {documentStats.missingDocuments.length}
              </span>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Transaction Record</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {requiredRecordFields.length > 0 ? `${confirmedRecordCount} of ${requiredRecordFields.length} confirmed` : '—'}
          </p>
          <p className="text-[11px] text-gray-500">
            {requiredRecordFields.length > 0
              ? `${capturedAwaitingConfirmation.length} ${recordSchemaKey === 'generated_ai' ? 'generated' : 'required'} field${capturedAwaitingConfirmation.length === 1 ? '' : 's'} awaiting confirmation${recordSchemaKey === 'generated_ai' ? '' : (canonicalRecordState?.awaitingOptionalCount ? ` · ${canonicalRecordState.awaitingOptionalCount} optional` : '')}`
              : 'No required field schema configured'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Open Issues</p>
          <p className={`mt-1 text-lg font-bold ${nextMilestoneBlockers.length > 0 || allConflicts.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {openIssueCount}
          </p>
          <p className="text-[11px] text-gray-500">
            {documentStats.reviewDocuments.length > 0
              ? `${documentStats.reviewDocuments.length} document${documentStats.reviewDocuments.length === 1 ? '' : 's'} need review`
              : allConflicts.length > 0
              ? `${allConflicts.length} conflict${allConflicts.length === 1 ? '' : 's'}`
              : 'No conflicts recorded'}
            {documentStats.reviewDocuments.length > 0 && allConflicts.length > 0
              ? ` · ${allConflicts.length} conflict${allConflicts.length === 1 ? '' : 's'}`
              : ''}
            {nextMilestoneBlockers.length > 0
              ? ` · ${nextMilestoneBlockers.length} milestone blocker${nextMilestoneBlockers.length === 1 ? '' : 's'}`
              : ''}
            {nextMilestone
              ? ` · blocks ${nextMilestone.label}`
              : ' · no next milestone'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Participants</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {participantProgressRoles.length > 0 ? `${participantComplete} of ${participantProgressRoles.length} active` : '—'}
          </p>
          <p className="text-[11px] text-gray-500">
            {participantProgressRoles.length > 0 ? 'required participants active' : 'No external roles configured'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(230px,0.8fr)]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Prioritized recommendations</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {recommendationItems[0]?.text || 'Continue monitoring the transaction as new evidence arrives.'}
              </p>
            </div>
            {recommendationItems[0]?.action && (
               <button
                type="button"
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); recommendationItems[0].action.onClick?.(); }}
                 className="relative z-10 cursor-pointer shrink-0 rounded-lg bg-[#800020] px-3 py-2 text-[10px] font-bold text-white transition hover:opacity-90"
              >
                {recommendationItems[0].action.label}
              </button>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {recommendationItems.slice(0, 4).map(item => (
              <div key={item.key} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${toneClasses[item.tone] || toneClasses.gray}`}>
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{item.text}</p>
                  <p className="mt-0.5 break-words text-[11px] leading-snug opacity-75 sm:leading-normal">{item.detail}</p>
                </div>
                 <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); item.action.onClick?.(); }} className="relative z-10 cursor-pointer shrink-0 text-[10px] font-bold underline underline-offset-2">
                  {item.action.label}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Participant status</p>
             <button type="button" onClick={() => onTabChange?.('people')} className="relative z-10 cursor-pointer text-[10px] font-bold text-[#800020]">
              Open People →
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            {participantStatuses.slice(0, 4).map(item => (
              <div key={item.key} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-gray-600">{item.label}</span>
                <span className={`shrink-0 font-semibold ${item.complete ? 'text-emerald-600' : item.invited ? 'text-amber-600' : 'text-red-600'}`}>
                  {item.stateLabel}
                </span>
              </div>
            ))}
            {participantStatuses.length > 4 && <p className="text-[10px] text-gray-400">+{participantStatuses.length - 4} more participants</p>}
          </div>
        </div>
      </div>

      {nextMilestoneBlockers.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50/50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
              Blockers to {nextMilestone?.label || 'the next milestone'}
            </p>
            <span className="text-[10px] font-semibold text-red-600">{nextMilestoneBlockers.length}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {nextMilestoneBlockers.slice(0, 4).map(blocker => (
              <div key={blocker.key} className="flex items-center gap-2 text-xs text-red-800">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <span className="min-w-0 flex-1">{blocker.text}</span>
                 <button
                  type="button"
                  onClick={() => onTabChange?.(blocker.participantKey ? 'people' : 'documents')}
                   className="relative z-10 cursor-pointer shrink-0 text-[10px] font-bold underline underline-offset-2"
                >
                  {blocker.participantKey ? 'Open People' : 'Review'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {stageRecommendation && stageDecision !== 'kept' && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-blue-600">↗</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Stage recommendation — coordinator decision required</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                Evidence suggests {stageRecommendation.stage.label}
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                Current stage: {currentStage?.label || 'Not reported'} · {stageRecommendation.reason}
              </p>
              {stageActionError && <p className="mt-2 text-[11px] font-semibold text-red-600">{stageActionError}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                 <button
                  type="button"
                  onClick={acceptStageRecommendation}
                  disabled={advancing || !ownerToken}
                   className="relative z-10 cursor-pointer rounded-lg bg-[#800020] px-3 py-1.5 text-[10px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {advancing ? 'Advancing…' : `Accept → ${stageRecommendation.stage.label}`}
                </button>
                 <button
                  type="button"
                  onClick={() => { setStageDecision('kept'); setStageActionError(''); }}
                  disabled={advancing}
                   className="relative z-10 cursor-pointer rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                >
                  Keep current stage
                </button>
              </div>
              {!ownerToken && <p className="mt-2 text-[10px] text-amber-700">Owner authorization is required to accept a stage change.</p>}
            </div>
          </div>
        </div>
      )}
      {stageDecision === 'accepted' && (
        <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          Stage change accepted. The lifecycle and readiness sections are updating from the saved room state.
        </p>
      )}
      {stageDecision === 'kept' && (
        <p className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
          Keeping the current stage. Kontra will continue to show new evidence without changing it automatically.
        </p>
      )}

      <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Recent Changes</p>
        <p className="mt-1 text-xs text-gray-500">Meaningful activity since your last visit</p>
        {recentChanges.length === 0 ? (
          <p className="mt-3 text-xs text-gray-400">No recent uploads, joins, confirmations, conflicts, or stage changes.</p>
        ) : (
          <div className="mt-2 divide-y divide-gray-100">
            {recentChanges.slice(0, 4).map(change => (
              <div key={change.id} className="flex items-start justify-between gap-3 py-2 text-xs">
                <span className="min-w-0 break-words leading-snug text-gray-700 sm:leading-normal">{change.text}</span>
                {change.date && (
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {new Date(change.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export {
  getLifecycleAdvanceRecommendation,
  getNextMilestoneBlockers,
  getOpenIssueCount,
  hasDocumentReviewFinding,
  getDocumentRequirementStats,
  filterLiveDocumentActions,
  filterStaleRecordActions,
  actionTextMentionsRecordField,
  isBorrowerFundsRecordAction,
  normalizeRecordCategory,
  getTransactionRecordCategory,
  getHazardLossOperationalFieldDefinitions,
  dedupeAttentionItems,
  getCanonicalAwaitingRecordFields,
  getCanonicalUnresolvedConflicts,
  mergeTransactionRecordState,
  getRecordDefinitionState,
  getCurrentProvenanceGap,
  getCoordinatorRecordFacts,
  preparationDraftValue,
  preparationSaveConfirmation,
  preparationPdfConfirmation,
};

// ── Transaction Seal Summary (complete phase) ─────────────────────────────────
// Fetches the Transaction Seal record and displays a compact completed-state
// card. Replaces the readiness panel once the workspace is sealed.
function TransactionSealSummaryCard({ propertyId }) {
  const [seal, setSeal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/settlement/seal`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => setSeal(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-5 text-center text-xs text-gray-400 animate-pulse">
      Loading seal record…
    </section>
  );

  const completedDate = seal?.completed_at || seal?.sealed_at;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Transaction Complete ✓</p>
          <p className="mt-1 text-sm font-bold text-gray-900">Transaction Seal</p>
          {completedDate && (
            <p className="mt-0.5 text-xs text-gray-500">
              Completed {new Date(completedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {seal?.readiness_pct != null ? ` · ${Math.round(seal.readiness_pct)}% conditions verified` : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => window.open(`${API_BASE}/api/public/deal-room/${propertyId}/settlement/seal`, '_blank')}
          className="shrink-0 text-[11px] font-bold text-emerald-700 border border-emerald-200 bg-white rounded-lg px-3 py-1.5 hover:bg-emerald-50 transition whitespace-nowrap">
          View Seal Record
        </button>
      </div>
      {seal?.summary && (
        <p className="text-xs text-gray-600 leading-relaxed border-t border-emerald-100 pt-3">
          {seal.summary}
        </p>
      )}
      {!completedDate && (
        <p className="text-xs text-gray-500">Transaction has been completed.</p>
      )}
    </section>
  );
}

function formatDateOnlyLabel(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(month) - 1]} ${Number(day)}, ${year}`;
}

function daysUntilDateOnly(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((target - todayUtc) / (1000 * 60 * 60 * 24));
}

function ParticipantPeoplePanel({ pack, role, roleConfig }) {
  const roles = (pack?.roles || []).filter(item => item?.label);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-5 sm:px-7 border-b border-gray-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Transaction team</p>
        <h2 className="mt-1 text-lg font-bold text-gray-900">People in this workspace</h2>
        <p className="mt-1 text-sm text-gray-500">Roles are shown without exposing private invitation details.</p>
      </div>
      <div className="divide-y divide-gray-100">
        {roles.map(item => {
          const isYou = item.key === role;
          return (
            <div key={item.key} className="flex items-center gap-3 px-5 py-3.5 sm:px-7">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                style={{ background: `${item.color || '#800020'}15` }}
              >
                {item.icon || '👤'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                <p className="text-[11px] text-gray-400">{isYou ? 'Your role' : 'Transaction participant'}</p>
              </div>
              {isYou && (
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                  style={{ color: roleConfig.color, background: `${roleConfig.color}12` }}
                >
                  You
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ParticipantOverview({ propertyId, property, pack, role, roleConfig, onTabChange, refreshKey }) {
  const [checklistItems, setChecklistItems] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [stage, setStage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const headers = getRoomAuthHeaders(propertyId);
    Promise.all([
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/checklist`, { headers })
        .then(response => response.ok ? response.json() : { items: [] })
        .catch(() => ({ items: [] })),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`, { headers })
        .then(response => response.ok ? response.json() : { analyses: [] })
        .catch(() => ({ analyses: [] })),
      fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination`, { headers })
        .then(response => response.ok ? response.json() : {})
        .catch(() => ({})),
    ]).then(([checklist, analysisData, coordination]) => {
      if (cancelled) return;
      setChecklistItems(Array.isArray(checklist?.items) ? checklist.items : []);
      setAnalyses(Array.isArray(analysisData?.analyses) ? analysisData.analyses : []);
      setStage(coordination?.stage || '');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [propertyId, refreshKey]);

  const configuredItems = Array.isArray(pack?.documentSchema) ? pack.documentSchema : [];
  const sourceItems = checklistItems.length > 0 ? checklistItems : configuredItems;
  const normalizedRole = String(role || '').trim().toLowerCase().replace(/\s+/g, '_');
  const assignedItems = sourceItems.filter(item =>
    (item.assignedTo || []).some(assignedRole =>
      String(assignedRole || '').trim().toLowerCase().replace(/\s+/g, '_') === normalizedRole
    )
  );
  const uploadedSections = new Set(analyses.map(analysis => analysis.section));
  const uploadedCount = assignedItems.filter(item => uploadedSections.has(item.section)).length;
  const requiredItems = assignedItems.filter(item => item.required);
  const requiredUploadedCount = requiredItems.filter(item => uploadedSections.has(item.section)).length;
  const pendingItems = assignedItems.filter(item => !uploadedSections.has(item.section));
  const targetClose = property?.metadata_values?.target_close_date
    || property?.closing_date
    || property?.target_close_date
    || property?.close_date;
  const participantHasAction = pendingItems.length > 0;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-start gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{ background: `${roleConfig.color}15` }}
          >
            {roleConfig.icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Participant workspace</p>
            <h1 className="mt-1 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
              {property?.name || property?.property_name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {roleConfig.label} · Review the documents assigned to you
            </p>
            {stage && (
              <p className="mt-2 text-xs font-semibold text-gray-700">
                Current stage: <span className="font-bold text-[#800020]">{stage.replace(/_/g, ' ')}</span>
              </p>
            )}
            {targetClose && (
              <p className="mt-1 text-xs text-gray-500">Target close: {formatDateOnlyLabel(targetClose)}</p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Your document progress</p>
            <span className="text-xs font-bold text-gray-700">
              {loading ? 'Loading…' : `${uploadedCount} of ${assignedItems.length} uploaded`}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#800020] transition-all"
              style={{ width: `${assignedItems.length ? Math.round((uploadedCount / assignedItems.length) * 100) : 0}%` }}
            />
          </div>
          {requiredItems.length > 0 && (
            <p className="mt-2 text-[11px] text-gray-500">
              {requiredUploadedCount} of {requiredItems.length} required documents uploaded
            </p>
          )}
        </div>

        {!loading && !participantHasAction && (
          <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Nothing requires your action right now</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              {property?.name || property?.property_name} · {roleConfig.label} · {stage ? `Current stage: ${stage.replace(/_/g, ' ')}` : 'Stage not yet reported'}
              {targetClose ? ` · Target close ${formatDateOnlyLabel(targetClose)}` : ''}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              The coordinator will share any new files or requests assigned to your role.
            </p>
          </div>
        )}

        {!loading && pendingItems.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Still needed from you</p>
            <div className="mt-2 space-y-2">
              {pendingItems.slice(0, 4).map(item => (
                <div key={item.id || item.section} className="flex items-center gap-2.5 text-sm text-gray-700">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                  <span>{item.label || item.section}</span>
                  {item.required && <span className="text-[10px] font-semibold text-red-500">required</span>}
                </div>
              ))}
              {pendingItems.length > 4 && (
                <p className="text-[11px] text-gray-400">+{pendingItems.length - 4} more in Documents</p>
              )}
            </div>
          </div>
        )}

        {participantHasAction ? (
          <button
            type="button"
            onClick={() => onTabChange('documents')}
            className="mt-5 rounded-xl bg-[#800020] px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90"
          >
            Open my documents →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onTabChange('documents')}
            className="mt-5 text-[11px] font-semibold text-gray-500 underline underline-offset-2 hover:text-gray-700"
          >
            View shared documents
          </button>
        )}
      </section>
    </div>
  );
}

function formatSnapshotDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
}

function formatStoredSnapshotValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 'Not recorded';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function SnapshotInspectionModal({
  snapshot,
  snapshots = [],
  packageHistory = [],
  packageAction,
  ownerToken,
  onSelectSnapshot,
  onGeneratePackage,
  onOpenPackage,
  onClose,
}) {
  if (!snapshot) return null;

  // Everything below comes from the selected persisted JSON payload. In
  // particular, never replace these fields with the live readiness response.
  const payload = snapshot.snapshot && typeof snapshot.snapshot === 'object'
    ? snapshot.snapshot
    : {};
  const transactionRecord = payload.created_from?.transaction_record || {};
  const frozenFields = Array.isArray(transactionRecord.canonical_fields)
    ? transactionRecord.canonical_fields
    : (Array.isArray(transactionRecord.fields) ? transactionRecord.fields : []);
  const recordedReadiness = payload.created_from?.readiness || {};
  const digitalReadiness = payload.digital_asset_readiness || {};
  const recordedExceptions = Array.isArray(payload.created_from?.exceptions)
    ? payload.created_from.exceptions
    : [];
  const readinessExceptions = digitalReadiness.exceptions || {};
  const blockers = [
    ...(Array.isArray(readinessExceptions.incomplete_required_fields)
      ? readinessExceptions.incomplete_required_fields.map(item => ({
        label: item?.label || item?.field_key,
        detail: item?.state || 'required field incomplete',
      }))
      : []),
    ...(Array.isArray(readinessExceptions.unresolved_conflicts)
      ? readinessExceptions.unresolved_conflicts.map(item => ({
        label: item?.label || item?.field_key || 'Transaction Record conflict',
        detail: 'unresolved conflict',
      }))
      : []),
    ...(Array.isArray(digitalReadiness.approvals?.missing)
      ? digitalReadiness.approvals.missing.map(item => ({
        label: item?.label || item?.field_key || 'Required approval',
        detail: 'approval required',
      }))
      : []),
    ...(Array.isArray(digitalReadiness.provenance?.gaps)
      ? digitalReadiness.provenance.gaps.map(item => ({
        label: item?.label || item?.field_key || 'Confirmed field',
        detail: item?.requirement || 'provenance gap',
      }))
      : []),
  ].filter(item => item.label);
  const provenanceManifest = Array.isArray(payload.created_from?.provenance_manifest)
    ? payload.created_from.provenance_manifest
    : [];
  const confirmationHistory = Array.isArray(payload.created_from?.confirmation_history)
    ? payload.created_from.confirmation_history
    : [];
  const approvals = Array.isArray(payload.created_from?.approvals)
    ? payload.created_from.approvals
    : [];
  const settlementMode = payload.created_from?.settlement_mode
    || digitalReadiness.settlement_method?.mode
    || 'Not recorded';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/50 px-4 py-6 sm:py-10"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="w-full max-w-6xl overflow-hidden rounded-2xl border border-gray-200 bg-[#fcfbf8] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verified-asset-snapshot-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#800020]">
              Immutable Verified Asset record
            </p>
            <h2 id="verified-asset-snapshot-title" className="mt-1 text-lg font-bold text-gray-900">
              Snapshot v{snapshot.version}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Recorded {formatSnapshotDate(snapshot.timestamp || snapshot.created_at)}
              {snapshot.created_by ? ` · by ${snapshot.created_by}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {snapshot.eligibility_status === 'eligible' && (
              packageHistory.find(item => item.source_snapshot_id === snapshot.id)
                ? (
                  <button
                    type="button"
                    onClick={() => onOpenPackage?.(packageHistory.find(item => item.source_snapshot_id === snapshot.id))}
                    className="rounded-lg border border-[#800020] px-3 py-1.5 text-xs font-bold text-[#800020] hover:bg-[#800020]/5"
                  >
                    View generated package
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onGeneratePackage?.(snapshot)}
                    disabled={!ownerToken || packageAction?.loading}
                    className="rounded-lg bg-[#800020] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {packageAction?.loading ? 'Generating…' : 'Generate Digital Asset Package'}
                  </button>
                )
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close snapshot inspection"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-gray-200 bg-white px-4 py-4 lg:border-b-0 lg:border-r">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Snapshot history</p>
            {snapshots.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500">No stored snapshots.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {snapshots.map(item => {
                  const selected = item.id === snapshot.id || item.version === snapshot.version;
                  return (
                    <button
                      key={item.id || item.version}
                      type="button"
                      onClick={() => onSelectSnapshot?.(item)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        selected
                          ? 'border-[#800020] bg-[#800020]/5'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-900">v{item.version}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          item.eligibility_status === 'eligible'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.eligibility_status || 'ineligible'}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500">
                        {formatSnapshotDate(item.timestamp || item.created_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div className="max-h-[calc(100vh-150px)] overflow-y-auto px-5 py-5 sm:px-7">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</p>
                <p className="mt-1 text-xs font-bold capitalize text-gray-900">
                  {(snapshot.status || digitalReadiness.status || 'not recorded').replace(/_/g, ' ')}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Eligibility</p>
                <p className={`mt-1 text-xs font-bold ${
                  snapshot.eligibility_status === 'eligible' ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {snapshot.eligibility_status || (digitalReadiness.eligible ? 'eligible' : 'ineligible')}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Record counts</p>
                <p className="mt-1 text-xs font-bold text-gray-900">
                  {recordedReadiness.confirmed_count ?? transactionRecord.confirmed_count ?? 0}
                  {' / '}
                  {recordedReadiness.required_count ?? transactionRecord.required_count ?? 0} confirmed
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Settlement mode</p>
                <p className="mt-1 text-xs font-bold capitalize text-gray-900">{String(settlementMode).replace(/_/g, ' ')}</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Snapshot metadata</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Version {snapshot.version} · source state {formatSnapshotDate(snapshot.source_state_at || payload.source_state_at)}
                  </p>
                </div>
                {snapshot.snapshot_hash && (
                  <p className="max-w-full break-all text-[10px] text-gray-400">Hash: {snapshot.snapshot_hash}</p>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                This view is frozen to the persisted snapshot. Later Transaction Record edits do not change these values.
              </p>
              {snapshot.eligibility_status !== 'eligible' && (
                <p className="mt-2 text-[11px] font-semibold text-amber-700">
                  Package generation is available only for eligible snapshots.
                </p>
              )}
              {!ownerToken && snapshot.eligibility_status === 'eligible' && (
                <p className="mt-2 text-[11px] font-semibold text-amber-700">
                  Owner access is required to generate a package from this snapshot.
                </p>
              )}
              {packageAction?.message && (
                <p role={packageAction.error ? 'alert' : 'status'} className={`mt-2 text-[11px] ${packageAction.error ? 'text-red-600' : 'text-gray-600'}`}>
                  {packageAction.message}
                </p>
              )}
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Frozen canonical values</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {frozenFields.length} field{frozenFields.length === 1 ? '' : 's'} captured at recording time
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-gray-400">
                  {recordedReadiness.awaiting_count || 0} awaiting · {recordedReadiness.missing_count || 0} missing
                </span>
              </div>
              {frozenFields.length === 0 ? (
                <p className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
                  No canonical fields were stored in this snapshot.
                </p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_120px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:grid">
                    <span>Field</span><span>Frozen value</span><span>State</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {frozenFields.map((field, index) => (
                      <div key={field.field_id || field.field_key || `${field.label}-${index}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_120px] sm:gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{field.label || field.field_key || 'Unnamed field'}</p>
                          <p className="mt-0.5 break-all text-[10px] text-gray-400">{field.field_key || field.definition_key || 'No field key'}</p>
                        </div>
                        <p className="break-words text-xs text-gray-700">{formatStoredSnapshotValue(field.value)}</p>
                        <p className={`text-[10px] font-bold capitalize ${
                          field.confirmation?.confirmed ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                          {(field.current_state || 'missing').replace(/_/g, ' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Blockers and exceptions</p>
                <p className="mt-1 text-xs text-gray-500">
                  {blockers.length} blocker{blockers.length === 1 ? '' : 's'} at recording time · {recordedExceptions.length} exception record{recordedExceptions.length === 1 ? '' : 's'}
                </p>
                {blockers.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {blockers.map((item, index) => (
                      <li key={`${item.label}-${index}`} className="flex items-start gap-2 text-xs text-amber-900">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span><strong>{item.label}</strong> — {item.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-emerald-700">No blockers were recorded.</p>
                )}
                {recordedExceptions.length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    {recordedExceptions.map((item, index) => (
                      <p key={item.id || `${item.field_key}-${index}`} className="mt-1 text-[11px] text-gray-600">
                        {item.label || item.field_key || 'Exception'} · <span className="capitalize">{item.status || 'unresolved'}</span>
                        {item.resolution_note ? ` · ${item.resolution_note}` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Provenance and evidence</p>
                <p className="mt-1 text-xs text-gray-500">
                  {digitalReadiness.provenance?.intact ? 'Provenance intact' : `${digitalReadiness.provenance?.gaps?.length || 0} provenance gaps`}
                  {' · '}{provenanceManifest.length} field evidence entries
                </p>
                {provenanceManifest.length > 0 ? (
                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                    {provenanceManifest.map((item, index) => {
                      const source = item.provenance || {};
                      return (
                        <div key={item.field_key || index} className="rounded-lg bg-gray-50 px-3 py-2">
                          <p className="text-[11px] font-semibold text-gray-700">{item.field_key || 'Unnamed field'}</p>
                          <p className="mt-0.5 break-words text-[10px] text-gray-500">
                            {source.source_document_id || source.source_file_hash || source.source_type || 'No source recorded'}
                            {source.source_page != null ? ` · page ${source.source_page}` : ''}
                          </p>
                          {source.source_excerpt && (
                            <p className="mt-1 text-[10px] italic text-gray-400">“{source.source_excerpt}”</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-500">No provenance entries were recorded.</p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Approvals</p>
                <p className="mt-1 text-xs text-gray-500">
                  {digitalReadiness.approvals?.satisfied ? 'Required approvals satisfied' : `${digitalReadiness.approvals?.missing?.length || 0} required approval gaps`}
                  {' · '}{approvals.length} approval event{approvals.length === 1 ? '' : 's'} captured
                </p>
                {approvals.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {approvals.map((item, index) => (
                      <div key={`${item.field_id || 'approval'}-${item.created_at || index}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[10px] text-gray-600">
                        <span><strong>{item.action || 'approval'}</strong> · {item.actor_role || item.actor_email || 'actor not recorded'}</span>
                        <span>{formatSnapshotDate(item.created_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-500">No approval events were recorded.</p>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Confirmation history</p>
                <p className="mt-1 text-xs text-gray-500">
                  {confirmationHistory.length} evidence event{confirmationHistory.length === 1 ? '' : 's'} captured in this snapshot
                </p>
                {confirmationHistory.length > 0 ? (
                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                    {confirmationHistory.map((item, index) => (
                      <div key={`${item.field_id || item.field_key || 'event'}-${item.created_at || index}`} className="rounded-lg bg-gray-50 px-3 py-2">
                        <div className="flex flex-wrap justify-between gap-2 text-[10px] text-gray-600">
                          <span className="font-semibold">{item.event_type || 'record event'}</span>
                          <span>{formatSnapshotDate(item.created_at)}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-gray-500">
                          {item.field_key || item.field_id || 'Field not identified'}
                          {item.new_status ? ` · ${item.new_status}` : ''}
                          {item.actor_role || item.actor_email ? ` · ${item.actor_role || item.actor_email}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-500">No confirmation history was recorded.</p>
                )}
              </div>
            </div>

            {payload.disclosure && (
              <p className="mt-5 text-[10px] leading-relaxed text-gray-400">{payload.disclosure}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function preparationDraftValue(field) {
  const value = field?.value;
  if (field?.input_type === 'choice_with_detail') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { choice: value.choice || '', detail: value.detail || value.details || '' };
    }
    return { choice: value || '', detail: '' };
  }
  if (field?.input_type === 'multi_choice_with_detail') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return {
        choices: Array.isArray(value.choices) ? value.choices : [],
        detail: value.detail || value.details || '',
      };
    }
    return { choices: Array.isArray(value) ? value : value ? [value] : [], detail: '' };
  }
  return Array.isArray(value) ? value.join(', ') : (value || '');
}

function preparationSaveConfirmation({ revision, packageStatus, idempotent = false } = {}) {
  const revisionNumber = revision ?? '—';
  const status = String(packageStatus || 'needs_information').replace(/_/g, ' ');
  if (idempotent) {
    return `Already saved as Revision ${revisionNumber}. Package status: ${status}. No duplicate revision was created.`;
  }
  if (packageStatus === 'ready_for_provider_review') {
    return `Saved as Revision ${revisionNumber}. Package status: Ready for provider review.`;
  }
  return `Saved as Revision ${revisionNumber}. Package status: ${status}. Add the remaining named fields before provider review.`;
}

function preparationPdfConfirmation({ revision, created = true } = {}) {
  const revisionNumber = revision ?? '—';
  return created
    ? `Preparation PDF generated for Revision ${revisionNumber}.`
    : `PDF already exists for Revision ${revisionNumber}; no duplicate artifact was created.`;
}

function DigitalAssetPackageModal({
  propertyId,
  ownerToken,
  packageRecord,
  packages = [],
  onSelectPackage,
  onPackageUpdated,
  onClose,
}) {
  const [draft, setDraft] = useState({});
  const [saveState, setSaveState] = useState({ loading: false, error: false, message: '' });
  const [revisions, setRevisions] = useState([]);
  const [pdfArtifacts, setPdfArtifacts] = useState([]);
  const [pdfAction, setPdfAction] = useState({ loading: false, error: false, message: '', revisionId: null });
  const saveInFlightRef = useRef(false);
  const saveRequestIdRef = useRef(null);
  const pdfInFlightRef = useRef(false);
  const preserveSaveMessageRef = useRef(false);

  useEffect(() => {
    if (!packageRecord) {
      setDraft({});
      setRevisions([]);
      setPdfArtifacts([]);
      setPdfAction({ loading: false, error: false, message: '', revisionId: null });
      saveRequestIdRef.current = null;
      return;
    }
    setDraft(Object.fromEntries(
      Object.entries(packageRecord.package?.preparation_fields || {}).map(([key, field]) => [
        key,
        preparationDraftValue(field),
      ]),
    ));
    saveRequestIdRef.current = null;
    if (preserveSaveMessageRef.current) {
      preserveSaveMessageRef.current = false;
    } else {
      setSaveState({ loading: false, error: false, message: '' });
    }
  }, [packageRecord]);

  useEffect(() => {
    let cancelled = false;
    if (!packageRecord?.id || !propertyId) return undefined;
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/digital-asset-packages/${packageRecord.id}/revisions`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(response => response.ok ? response.json() : { revisions: [] })
      .then(data => {
        if (!cancelled) setRevisions(Array.isArray(data?.revisions) ? data.revisions : []);
      })
      .catch(() => {
        if (!cancelled) setRevisions([]);
      });
    return () => { cancelled = true; };
  }, [propertyId, packageRecord?.id, packageRecord?.revision]);

  useEffect(() => {
    let cancelled = false;
    if (!packageRecord?.id || !propertyId) return undefined;
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/digital-asset-packages/${packageRecord.id}/artifacts`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(response => response.ok ? response.json() : { artifacts: [] })
      .then(data => {
        if (!cancelled) setPdfArtifacts(Array.isArray(data?.artifacts) ? data.artifacts : []);
      })
      .catch(() => {
        if (!cancelled) setPdfArtifacts([]);
      });
    return () => { cancelled = true; };
  }, [propertyId, packageRecord?.id, packageRecord?.revision]);

  if (!packageRecord) return null;
  const payload = packageRecord.package && typeof packageRecord.package === 'object'
    ? packageRecord.package
    : {};
  const frozenReadiness = payload.frozen_readiness || {};
  const sourceSnapshot = payload.source_snapshot || {};
  const preparationFields = payload.preparation_fields || {};
  const summary = payload.human_summary || {};
  const frozenCanonicalFields = Array.isArray(frozenReadiness.canonical_fields)
    ? frozenReadiness.canonical_fields
    : [];
  const borrowerFundsField = frozenCanonicalFields.find(field =>
    /borrower funds|borrower_funds/i.test(`${field?.field_key || ''} ${field?.label || ''}`),
  );
  const missingPreparationNames = Array.isArray(summary.missing_preparation_field_names)
    ? summary.missing_preparation_field_names
    : (Array.isArray(summary.missing_preparation_fields) ? summary.missing_preparation_fields : []);
  const statusLabel = String(payload.package_status || 'needs_information')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

  function updateDraft(key, value) {
    saveRequestIdRef.current = null;
    setDraft(previous => ({ ...previous, [key]: value }));
    setSaveState(previous => previous.message
      ? { loading: false, error: false, message: '' }
      : previous);
  }

  function renderPreparationInput(key, field) {
    const inputType = field?.input_type || 'text';
    const disabled = !ownerToken || saveState.loading;
    const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#800020] focus:ring-1 focus:ring-[#800020]/20 disabled:bg-gray-50';
    if (inputType === 'choice_with_detail') {
      const value = draft[key] && typeof draft[key] === 'object'
        ? draft[key]
        : { choice: '', detail: '' };
      return (
        <div className="space-y-2">
          <select
            value={value.choice || ''}
            onChange={event => updateDraft(key, {
              ...value,
              choice: event.target.value,
              detail: event.target.value === 'other' ? (value.detail || '') : '',
            })}
            disabled={disabled}
            className={inputClass}
            aria-label={field?.label || key}
          >
            <option value="">Choose an option…</option>
            {(field?.choices || []).map(choice => (
              <option key={choice.value} value={choice.value}>{choice.label}</option>
            ))}
          </select>
          {value.choice === 'other' && (
            <input
              value={value.detail || ''}
              onChange={event => updateDraft(key, { ...value, detail: event.target.value })}
              disabled={disabled}
              className={inputClass}
              placeholder={field?.detail_placeholder || 'Add a short detail'}
              aria-label={field?.detail_label || `${field?.label || key} detail`}
            />
          )}
        </div>
      );
    }
    if (inputType === 'multi_choice_with_detail') {
      const value = draft[key] && typeof draft[key] === 'object'
        ? draft[key]
        : { choices: [], detail: '' };
      const selected = Array.isArray(value.choices) ? value.choices : [];
      return (
        <div className="space-y-2">
          <div className="grid gap-2">
            {(field?.choices || []).map(choice => (
              <label key={choice.value} className="flex items-start gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={selected.includes(choice.value)}
                  onChange={event => updateDraft(key, {
                    ...value,
                    choices: event.target.checked
                      ? [...selected, choice.value]
                      : selected.filter(item => item !== choice.value),
                    detail: !event.target.checked && choice.value === 'other' ? '' : (value.detail || ''),
                  })}
                  disabled={disabled}
                  className="mt-0.5 accent-[#800020]"
                  aria-label={choice.label}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </div>
          {(selected.includes('other') || selected.some(item => item !== 'none_identified')) && (
            <input
              value={value.detail || ''}
              onChange={event => updateDraft(key, { ...value, detail: event.target.value })}
              disabled={disabled}
              className={inputClass}
              placeholder={field?.detail_placeholder || 'Add context'}
              aria-label={field?.detail_label || `${field?.label || key} detail`}
            />
          )}
        </div>
      );
    }
    if (inputType === 'textarea') {
      return (
        <textarea
          value={draft[key] || ''}
          onChange={event => updateDraft(key, event.target.value)}
          rows={3}
          disabled={disabled}
          className={inputClass}
          aria-label={field?.label || key}
          placeholder={field?.placeholder || `Enter ${field?.label || key.replace(/_/g, ' ').toLowerCase()}`}
        />
      );
    }
    return (
      <input
        value={draft[key] || ''}
        onChange={event => updateDraft(key, event.target.value)}
        disabled={disabled}
        className={inputClass}
        aria-label={field?.label || key}
        placeholder={field?.placeholder || `Enter ${field?.label || key.replace(/_/g, ' ').toLowerCase()}`}
      />
    );
  }

  async function savePreparationFields() {
    if (!ownerToken || saveState.loading || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    const saveRequestId = saveRequestIdRef.current
      || globalThis.crypto?.randomUUID?.();
    if (!saveRequestId) {
      saveInFlightRef.current = false;
      setSaveState({
        loading: false,
        error: true,
        message: 'This browser could not create a save request ID. Please reload and try again.',
      });
      return;
    }
    saveRequestIdRef.current = saveRequestId;
    setSaveState({ loading: true, error: false, message: '' });
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/digital-asset-packages/${packageRecord.id}/preparation-fields`,
        {
          method: 'PATCH',
          headers: getRoomAuthHeaders(propertyId, {
            'Content-Type': 'application/json',
            'Idempotency-Key': saveRequestId,
          }),
          body: JSON.stringify({ ownerWriteToken: ownerToken, fields: draft }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Preparation fields could not be saved.');
      if (data.package) {
        preserveSaveMessageRef.current = true;
        onPackageUpdated?.(data.package);
      }
      if (data.revision) {
        setRevisions(previous => [
          {
            ...data.revision,
            package_status: data.revision.package_status
              || data.package?.package?.package_status
              || 'needs_information',
          },
          ...previous.filter(item => item.id !== data.revision.id),
        ]);
      }
      const revisionNumber = data.revision?.revision
        ?? data.package?.revision
        ?? '—';
      const nextStatus = data.revision?.package_status
        || data.package?.package?.package_status
        || 'needs_information';
      const replayed = data.idempotent === true || data.created === false;
      setSaveState({
        loading: false,
        error: false,
        message: preparationSaveConfirmation({
          revision: revisionNumber,
          packageStatus: nextStatus,
          idempotent: replayed,
        }),
      });
      saveRequestIdRef.current = null;
    } catch (error) {
      setSaveState({ loading: false, error: true, message: error.message });
    } finally {
      saveInFlightRef.current = false;
    }
  }

  function artifactForRevision(revision) {
    if (!revision?.id) return null;
    return pdfArtifacts.find(artifact => artifact.source_revision_id === revision.id)
      || pdfArtifacts.find(artifact =>
        Number(artifact.source_revision) === Number(revision.revision)
        && artifact.source_revision_hash === revision.package_hash,
      )
      || null;
  }

  async function generatePreparationPdf(revision) {
    if (!ownerToken || !revision?.id || pdfAction.loading || pdfInFlightRef.current) return;
    pdfInFlightRef.current = true;
    setPdfAction({ loading: true, error: false, message: '', revisionId: revision.id });
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/digital-asset-packages/${packageRecord.id}/revisions/${revision.id}/artifacts`,
        {
          method: 'POST',
          headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            ownerWriteToken: ownerToken,
            revision: revision.revision,
            sourceSnapshotId: revision.source_snapshot_id || packageRecord.source_snapshot_id,
            sourceSnapshotVersion: revision.source_snapshot_version || packageRecord.source_snapshot_version,
            sourceSnapshotHash: revision.source_snapshot_hash || packageRecord.source_snapshot_hash,
            packageHash: revision.package_hash,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Preparation PDF could not be generated.');
      if (data.artifact) {
        setPdfArtifacts(previous => [
          data.artifact,
          ...previous.filter(item => item.id !== data.artifact.id),
        ]);
      }
      setPdfAction({
        loading: false,
        error: false,
        revisionId: revision.id,
        message: preparationPdfConfirmation({
          revision: revision.revision,
          created: data.created !== false,
        }),
      });
    } catch (error) {
      setPdfAction({ loading: false, error: true, revisionId: revision.id, message: error.message });
    } finally {
      pdfInFlightRef.current = false;
    }
  }

  async function openPreparationPdf(artifact, mode = 'view') {
    if (!artifact?.id || pdfAction.loading) return;
    const popup = mode === 'view' ? window.open('', '_blank', 'noopener,noreferrer') : null;
    setPdfAction({ loading: true, error: false, message: '', revisionId: artifact.source_revision_id });
    try {
      const fallbackPath = `/api/public/deal-room/${encodeURIComponent(propertyId)}/digital-asset-packages/${encodeURIComponent(packageRecord.id)}/artifacts/${encodeURIComponent(artifact.id)}${mode === 'download' ? '?download=1' : ''}`;
      const path = mode === 'download' ? (artifact.download_path || fallbackPath) : (artifact.view_path || fallbackPath);
      const response = await fetch(`${API_BASE}${path}`, {
        headers: getRoomAuthHeaders(propertyId),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'The preparation PDF could not be opened.');
      }
      const url = URL.createObjectURL(await response.blob());
      if (mode === 'view' && popup) {
        popup.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        if (popup) popup.close();
        const anchor = document.createElement('a');
        anchor.href = url;
        if (mode === 'download') anchor.download = artifact.filename || 'digital-asset-preparation.pdf';
        anchor.target = '_blank';
        anchor.rel = 'noopener';
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
      }
      setPdfAction({
        loading: false,
        error: false,
        revisionId: artifact.source_revision_id,
        message: mode === 'download' ? 'PDF download started.' : 'PDF opened in a new tab.',
      });
    } catch (error) {
      if (popup) popup.close();
      setPdfAction({ loading: false, error: true, revisionId: artifact.source_revision_id, message: error.message });
    }
  }

  function exportPackageJson() {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `digital-asset-preparation-package-v${sourceSnapshot.version || 'latest'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/50 px-4 py-6 sm:py-10"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="w-full max-w-6xl overflow-hidden rounded-2xl border border-gray-200 bg-[#fcfbf8] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="digital-asset-package-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#800020]">
               Snapshot-bound preparation artifact
            </p>
            <h2 id="digital-asset-package-title" className="mt-1 text-lg font-bold text-gray-900">
              Digital Asset Preparation Package
            </h2>
            <p className="mt-1 text-xs text-gray-500">
               Source snapshot v{sourceSnapshot.version || '—'} · revision {packageRecord.revision ?? payload.package_revision ?? 0} · {formatSnapshotDate(packageRecord.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={exportPackageJson}
              className="rounded-lg bg-[#800020] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Digital Asset Preparation Package"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-gray-200 bg-white px-4 py-4 lg:border-b-0 lg:border-r">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Package history</p>
            {packages.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500">No stored packages.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {packages.map(item => {
                  const itemSnapshot = item.package?.source_snapshot || {};
                  const selected = item.id === packageRecord.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectPackage?.(item)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        selected
                          ? 'border-[#800020] bg-[#800020]/5'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-900">Package</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                           Snapshot v{item.source_snapshot_version || itemSnapshot.version || '—'} · r{item.revision ?? item.package?.package_revision ?? 0}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500">
                        {formatSnapshotDate(item.created_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div className="max-h-[calc(100vh-150px)] overflow-y-auto px-5 py-5 sm:px-7">
            <div className="rounded-xl border border-[#800020]/20 bg-[#800020]/5 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#800020]">Source snapshot</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">
                    Snapshot v{sourceSnapshot.version || '—'} · {sourceSnapshot.eligibility_status || 'not recorded'}
                  </p>
                  <p className="mt-1 break-all text-[10px] text-gray-500">
                    {sourceSnapshot.id || 'Snapshot ID not recorded'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Package status</p>
                  <p className="mt-1 text-xs font-bold capitalize text-gray-900">
                     {statusLabel}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-gray-600">
                {summary.headline || 'This artifact is frozen to the selected immutable readiness snapshot.'}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Frozen proof value</p>
                <p className="mt-1 text-xs font-bold text-gray-900">Borrower funds advanced</p>
                <p className="mt-1 text-base font-black text-emerald-800">
                  {borrowerFundsField ? formatStoredSnapshotValue(borrowerFundsField.value) : 'Not recorded'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Readiness</p>
                <p className="mt-1 text-xs font-bold capitalize text-gray-900">
                  {(frozenReadiness.status || 'not recorded').replace(/_/g, ' ')}
                </p>
                <p className="mt-1 text-[10px] text-gray-500">{summary.readiness || 'Counts not recorded'}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Provenance</p>
                <p className="mt-1 text-xs font-bold text-gray-900">{summary.provenance || 'Not recorded'}</p>
                <p className="mt-1 text-[10px] text-gray-500">
                  {frozenReadiness.provenance_evidence?.evidence_entry_count || 0} evidence entries
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Blockers</p>
                <p className="mt-1 text-xs font-bold text-gray-900">{summary.blockers || 'Not recorded'}</p>
                <p className="mt-1 text-[10px] text-gray-500">
                  {frozenReadiness.blockers_exceptions?.resolved ? 'Resolved' : 'Requires review'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Approvals / settlement</p>
                <p className="mt-1 text-xs font-bold text-gray-900">{summary.approvals || 'Not recorded'}</p>
                <p className="mt-1 text-[10px] capitalize text-gray-500">
                  {String(frozenReadiness.settlement_mode || 'Not recorded').replace(/_/g, ' ')}
                </p>
              </div>
            </div>

             <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
               <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Editable preparation inputs</p>
               <p className="mt-1 text-xs text-gray-500">
                 Owner-entered inputs are saved as append-only revisions. They never change the frozen source snapshot or the live Transaction Record.
               </p>
               {missingPreparationNames.length > 0 ? (
                 <p className="mt-3 text-xs font-semibold text-amber-800">
                   Missing required fields: {missingPreparationNames.join(', ')}
                 </p>
               ) : (
                 <p className="mt-3 text-xs font-semibold text-emerald-700">All required preparation fields are complete.</p>
               )}
               <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                 <div className="divide-y divide-gray-100">
                    {Object.entries(preparationFields).map(([key, field]) => (
                      <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_130px] sm:gap-3">
                       <span>
                          <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-800">
                            {field?.label || key.replace(/_/g, ' ')}
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                              field?.required
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {field?.required ? 'Required' : 'Optional'}
                            </span>
                          </span>
                          <span className="mt-1 block text-[10px] leading-relaxed text-gray-500">
                            {field?.guidance || field?.description}
                          </span>
                          {field?.inherited && (
                            <span className="mt-1 block text-[10px] font-semibold text-blue-700">
                              Inherited from {field?.source_field_key || field?.inherited_from?.field_key || 'the frozen Transaction Record'} — revise this preparation value if needed.
                            </span>
                          )}
                       </span>
                        {renderPreparationInput(key, field)}
                       <span className={`text-[10px] font-bold capitalize ${
                         field?.status === 'not_recorded' ? 'text-gray-400' : 'text-emerald-700'
                       }`}>
                          {(field?.status || 'not recorded').replace(/_/g, ' ')}
                       </span>
                      </div>
                   ))}
                 </div>
               </div>
               <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                 <p className="text-[10px] text-gray-400">
                   {ownerToken ? 'Owner authorization detected.' : 'Owner authorization is required to edit these fields.'}
                 </p>
                 <button
                   type="button"
                   onClick={savePreparationFields}
                   disabled={!ownerToken || saveState.loading}
                    aria-busy={saveState.loading}
                   className="rounded-lg bg-[#800020] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                 >
                   {saveState.loading ? 'Saving…' : 'Save preparation revision'}
                 </button>
               </div>
               {saveState.message && (
                 <p role="status" className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                   saveState.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                 }`}>
                   {saveState.message}
                 </p>
               )}
             </div>

             <div className="mt-5">
               <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Frozen source values</p>
               <p className="mt-1 text-xs text-gray-500">
                 Read-only values copied from Snapshot v{sourceSnapshot.version || '—'} at package generation. These are not preparation inputs.
               </p>
               <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/40">
                 <div className="divide-y divide-emerald-100">
                   {frozenCanonicalFields.map((field, index) => (
                     <div key={`${field?.field_key || 'frozen'}-${index}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:gap-3">
                       <p className="text-xs font-semibold text-gray-800">{field?.label || field?.field_key || 'Canonical field'}</p>
                       <p className="break-words text-xs text-gray-700">{formatStoredSnapshotValue(field?.value)}</p>
                     </div>
                   ))}
                 </div>
               </div>
             </div>

             <div className="mt-5">
               <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Preparation revision history</p>
               <p className="mt-1 text-xs text-gray-500">The original package stays immutable; each owner save adds a numbered revision.</p>
               {revisions.length > 0 ? (
                 <div className="mt-3 space-y-2">
                   {revisions.map(revision => (
                      <div key={revision.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-800">
                            Revision {revision.revision} · {String(revision.package_status || 'needs_information').replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {(revision.changed_fields || []).join(', ') || 'No field list'} · {formatSnapshotDate(revision.created_at)}
                          </span>
                        </div>
                        {artifactForRevision(revision) ? (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
                            <span className="text-[10px] font-semibold text-emerald-700">
                              PDF generated · {formatSnapshotDate(artifactForRevision(revision).generated_at)}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openPreparationPdf(artifactForRevision(revision), 'view')}
                                disabled={pdfAction.loading}
                                className="rounded-md border border-gray-300 px-2.5 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {pdfAction.loading && pdfAction.revisionId === revision.id ? 'Opening…' : 'View PDF'}
                              </button>
                              <button
                                type="button"
                                onClick={() => openPreparationPdf(artifactForRevision(revision), 'download')}
                                disabled={pdfAction.loading}
                                className="rounded-md border border-[#800020] px-2.5 py-1 text-[10px] font-bold text-[#800020] hover:bg-[#800020]/5 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Download PDF
                              </button>
                            </div>
                          </div>
                        ) : revision.package_status === 'ready_for_provider_review' ? (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
                            <span className="text-[10px] text-gray-500">
                              Ready revision; generating a PDF is a separate owner action.
                            </span>
                            <button
                              type="button"
                              onClick={() => generatePreparationPdf(revision)}
                              disabled={!ownerToken || pdfAction.loading}
                              className="rounded-md bg-[#800020] px-2.5 py-1.5 text-[10px] font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {pdfAction.loading && pdfAction.revisionId === revision.id
                                ? 'Generating…'
                                : 'Generate Preparation Package'}
                            </button>
                          </div>
                        ) : (
                          <p className="mt-2 border-t border-gray-100 pt-2 text-[10px] text-gray-400">
                            PDF generation unlocks when this revision is ready for provider review.
                          </p>
                        )}
                     </div>
                   ))}
                 </div>
               ) : (
                 <p className="mt-3 text-xs text-gray-400">No preparation revisions have been saved.</p>
               )}
                {!ownerToken && revisions.some(revision => revision.package_status === 'ready_for_provider_review') && (
                  <p className="mt-3 text-[10px] font-semibold text-amber-700">
                    Owner authorization is required to generate a preparation PDF.
                  </p>
                )}
                {pdfAction.message && (
                  <p role={pdfAction.error ? 'alert' : 'status'} className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                    pdfAction.error
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}>
                    {pdfAction.message}
                  </p>
                )}
             </div>

            <p className="mt-5 text-[10px] leading-relaxed text-gray-400">
              {summary.disclosure || 'Provider-neutral preparation data only. This is not issuance, custody, KYC/AML, settlement, or investment approval.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function VerifiedAssetReadinessCard({
  verifiedAssetReadiness,
  ownerToken,
  snapshotAction,
  snapshotHistory = [],
  packageHistory = [],
  packageAction,
  onRecordSnapshot,
  onOpenSnapshot,
  onOpenPackage,
  onGeneratePackage,
  onOpenProvenance,
}) {
  const isUnavailable = !verifiedAssetReadiness;
  const summary = verifiedAssetReadiness?.summary || {};
  const reasons = verifiedAssetReadiness?.reasons || {};
  const eligibility = verifiedAssetReadiness?.eligibility || 'unavailable';
  const readinessStatus = verifiedAssetReadiness?.status;
  const incompleteFields = Array.isArray(reasons.incomplete_required_fields)
    ? reasons.incomplete_required_fields
    : [];
  const unresolvedConflicts = Array.isArray(reasons.unresolved_conflicts)
    ? reasons.unresolved_conflicts
    : [];
  const missingApprovals = Array.isArray(reasons.missing_approvals)
    ? reasons.missing_approvals
    : [];
  const provenanceGaps = Array.isArray(reasons.provenance_gaps)
    ? reasons.provenance_gaps
    : [];
  const blockerLabels = [
    ...incompleteFields.map(item => item?.label || item?.field_key),
    ...unresolvedConflicts.map(item => item?.label || item?.field_key),
    ...missingApprovals.map(item => `${item?.label || item?.field_key} — approval required`),
    ...provenanceGaps.map(item =>
      `${item?.label || item?.field_key} — ${item?.source || item?.requirement || 'current provenance required'}`,
    ),
  ].filter(Boolean);
  const statusLabel = isUnavailable
    ? 'Loading or unavailable'
    : (readinessStatus || eligibility || 'in progress').replace(/_/g, ' ');
  const eligibilityLabel = eligibility === 'eligible'
    ? 'Eligible'
    : eligibility === 'unavailable'
      ? 'Unavailable'
      : 'In progress';
  const action = snapshotAction || { loading: false, message: '', error: false };

  return (
    <section className="rounded-2xl border border-[#d9d2c8] bg-[#fcfbf8] px-5 py-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#800020]">
            Verified Asset foundation
          </p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">Digital Asset Readiness</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">
            Provider-neutral preparation status derived from the canonical Transaction Record.
          </p>
          <p className="mt-2 text-[11px] font-semibold capitalize text-gray-700">
            Status: {statusLabel}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
          eligibility === 'eligible'
            ? 'bg-emerald-100 text-emerald-800'
            : eligibility === 'unavailable'
              ? 'bg-gray-200 text-gray-700'
              : 'bg-amber-100 text-amber-800'
        }`}>
          {eligibilityLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Canonical fields</p>
          <p className="mt-1 text-base font-black text-gray-900">
            {summary.confirmed_count || 0}
            <span className="text-xs font-semibold text-gray-400"> / {summary.required_count || 0} confirmed</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Open exceptions</p>
          <p className={`mt-1 text-base font-black ${
            (summary.unresolved_exception_count || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}>
            {summary.unresolved_exception_count || 0}
            <span className="text-xs font-semibold text-gray-400"> blockers</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Evidence readiness</p>
          <p className="mt-1 text-xs font-bold text-gray-700">
            {summary.provenance_intact ? 'Provenance intact' : `${summary.provenance_gap_count || 0} provenance gaps`}
          </p>
          <p className="mt-1 text-[10px] text-gray-400">
            {summary.approvals_satisfied
              ? 'Approvals satisfied'
              : `${summary.missing_approval_count || 0} approvals missing`}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Settlement mode</p>
          <p className="mt-1 text-xs font-bold capitalize text-gray-700">
            {verifiedAssetReadiness?.settlement_mode || 'Not recorded'}
          </p>
          <p className="mt-1 text-[10px] text-gray-400">
            {verifiedAssetReadiness?.latest_snapshot
              ? `Latest snapshot v${verifiedAssetReadiness.latest_snapshot.version}`
              : 'No snapshot recorded'}
          </p>
        </div>
      </div>

      {isUnavailable ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
          Readiness details are loading or currently unavailable. This card stays visible while Kontra reconnects to the readiness service.
        </div>
      ) : blockerLabels.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Current blockers and exceptions
          </p>
          <p className="mt-1 text-xs text-amber-900">
            {blockerLabels.slice(0, 3).join(' · ')}
            {blockerLabels.length > 3 ? ` · +${blockerLabels.length - 3} more` : ''}
          </p>
          {provenanceGaps.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {provenanceGaps.map(gap => (
                <button
                  key={gap.field_key || gap.label}
                  type="button"
                  onClick={() => onOpenProvenance?.(gap)}
                  disabled={!onOpenProvenance}
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-default disabled:opacity-60"
                >
                  Resolve {gap.label || gap.field_key} →
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-800">
          No canonical blockers or unresolved exceptions are currently reported.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">
            {ownerToken
              ? 'Owner session active — snapshots can be recorded.'
              : 'Owner session not available — sign in through My Deal Rooms to record a snapshot.'}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
            Recording preserves this exact readiness state, including any ineligible status. It does not generate a preparation package or bypass blockers.
          </p>
        </div>
        <button
          type="button"
          onClick={onRecordSnapshot}
          disabled={!ownerToken || action.loading}
          className="rounded-lg border border-[#800020] px-3 py-2 text-xs font-bold text-[#800020] transition hover:bg-[#800020] hover:text-white disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent disabled:hover:text-gray-400"
        >
          {action.loading ? 'Recording…' : 'Record readiness snapshot'}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <div>
          <p className="text-xs font-semibold text-gray-700">Immutable readiness history</p>
          <p className="mt-1 text-[10px] text-gray-400">
            {snapshotHistory.length > 0
              ? `${snapshotHistory.length} stored snapshot${snapshotHistory.length === 1 ? '' : 's'} · historical values remain frozen`
              : 'No readiness snapshots have been recorded yet.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenSnapshot?.(snapshotHistory[0])}
            disabled={snapshotHistory.length === 0}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            View latest snapshot
          </button>
          <button
            type="button"
            onClick={() => onOpenSnapshot?.(snapshotHistory[0])}
            disabled={snapshotHistory.length === 0}
            className="rounded-lg border border-[#800020] px-3 py-2 text-xs font-bold text-[#800020] hover:bg-[#800020] hover:text-white disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent disabled:hover:text-gray-400"
          >
            Snapshot history ({snapshotHistory.length})
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <div>
          <p className="text-xs font-semibold text-gray-700">Digital Asset Preparation Packages</p>
          <p className="mt-1 text-[10px] text-gray-400">
            {packageHistory.length > 0
              ? `${packageHistory.length} immutable package${packageHistory.length === 1 ? '' : 's'} stored · each tied to one snapshot`
              : 'Select an eligible snapshot above to generate the first package.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenPackage?.(packageHistory[0])}
            disabled={packageHistory.length === 0}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            View latest package
          </button>
          <button
            type="button"
            onClick={() => onOpenPackage?.(packageHistory[0])}
            disabled={packageHistory.length === 0}
            className="rounded-lg border border-[#800020] px-3 py-2 text-xs font-bold text-[#800020] hover:bg-[#800020] hover:text-white disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent disabled:hover:text-gray-400"
          >
            Package history ({packageHistory.length})
          </button>
        </div>
      </div>
      {packageAction?.message && (
        <p role={packageAction.error ? 'alert' : 'status'} className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
          packageAction.error
            ? 'border-red-100 bg-red-50 text-red-600'
            : 'border-gray-200 bg-white text-gray-600'
        }`}>
          {packageAction.message}
        </p>
      )}
      {action.message && (
        <p role="status" className={`mt-3 rounded-lg border px-3 py-2 text-xs ${action.error
          ? 'border-red-100 bg-red-50 text-red-600'
          : 'border-gray-200 bg-white text-gray-600'}`}>
          {action.message}
        </p>
      )}
    </section>
  );
}

function CoordinatorOverview({ propertyId, property, pack, packId, onTabChange, refreshKey }) {
  const [briefing, setBriefing]         = useState(null);
  const [coordination, setCoordination] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  const [events, setEvents]             = useState([]);
  const [analyses, setAnalyses]         = useState([]);
  const [stages, setStages]             = useState([]);
  const [recordFields, setRecordFields] = useState([]);
  const [recordState, setRecordState]   = useState(null);
  const [readiness, setReadiness]       = useState(null);
  const [verifiedAssetReadiness, setVerifiedAssetReadiness] = useState(null);
  const [snapshotHistory, setSnapshotHistory] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [snapshotAction, setSnapshotAction] = useState({ loading: false, message: '', error: false });
  const [packageHistory, setPackageHistory] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [packageAction, setPackageAction] = useState({ loading: false, message: '', error: false });
  const [loading, setLoading]           = useState(true);
  const [ownerToken, setOwnerToken]     = useState('');
  const [advancingStage, setAdvancingStage] = useState(false);
  const [stageActionError, setStageActionError] = useState('');
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [recordFocus, setRecordFocus] = useState(null);
  const loadSequence = useRef(0);

  useEffect(() => {
    try { setOwnerToken(localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''); } catch {}
  }, [propertyId]);

  const load = useCallback(async () => {
    if (!propertyId) return;
    // The coordinator shell is useful before secondary panels finish
    // hydrating. Keep the old loading prop for the brief's skeleton only, but
    // do not make the entire Overview wait for every endpoint in the fan-out.
    setLoading(false);
    const sequence = ++loadSequence.current;
    const headers = getRoomAuthHeaders(propertyId);
    const get = (path, fallback) => fetch(`${API_BASE}${path}`, { headers })
      .then(r => r.ok ? r.json() : fallback)
      .catch(() => fallback);
    const apply = (setter, transform = value => value) => data => {
      if (sequence === loadSequence.current) setter(transform(data));
    };

    get(`/api/public/deal-room/${propertyId}/brain/briefing`, null)
      .then(apply(setBriefing));
    get(`/api/public/deal-room/${propertyId}/coordination`, null)
      .then(apply(setCoordination));
    get(`/api/public/deal-room/${propertyId}/stages`, { stages: [] })
      .then(apply(
        setStages,
        stageData => normalizeLifecycleStages(
          Array.isArray(stageData?.stages) && stageData.stages.length >= 2
            ? stageData.stages
            : (pack.stages || []),
        ),
      ));
    get(`/api/public/deal-room/${propertyId}/transaction-record`, { fields: [] })
      .then(record => {
        if (sequence !== loadSequence.current) return;
        setRecordFields(Array.isArray(record?.fields) ? record.fields : []);
        // Always replace the projection when the record endpoint responds.
        // Keeping the first response allowed a slower readiness request to
        // leave Overview showing an older proposal-shaped state after confirm.
        if (record?.record_state) {
          setRecordState(previous => mergeTransactionRecordState(previous, record.record_state));
        }
      });
    get(`/api/public/deal-room/${propertyId}/readiness`, null)
      .then(data => {
        if (sequence !== loadSequence.current) return;
        setReadiness(data);
        if (data?.transaction_record) {
          setRecordState(previous => mergeTransactionRecordState(previous, data.transaction_record));
        }
      });
    get(`/api/public/deal-room/${propertyId}/verified-asset/readiness`, null)
      .then(apply(setVerifiedAssetReadiness));
    get(`/api/public/deal-room/${propertyId}/verified-asset/snapshots`, { snapshots: [] })
      .then(apply(
        setSnapshotHistory,
        snapshotData => Array.isArray(snapshotData?.snapshots) ? snapshotData.snapshots : [],
      ));
    get(`/api/public/deal-room/${propertyId}/digital-asset-packages`, { packages: [] })
      .then(apply(
        setPackageHistory,
        packageData => Array.isArray(packageData?.packages) ? packageData.packages : [],
      ));
    get(`/api/public/deal-room/${propertyId}/checklist`, { items: [] })
      .then(apply(setChecklistItems, checklist => Array.isArray(checklist?.items) ? checklist.items : []));
    get(`/api/public/deal-room/${propertyId}/events`, { events: [] })
      .then(apply(setEvents, eventData => Array.isArray(eventData?.events) ? eventData.events : []));
    get(`/api/public/deal-room/${propertyId}/analyses`, { analyses: [] })
      .then(apply(setAnalyses, analysisData => Array.isArray(analysisData?.analyses) ? analysisData.analyses : []));
  // refreshKey is intentionally included so any document upload (which bumps
  // analysesRefreshKey in DealRoomPage) immediately triggers a re-fetch here,
  // making the Snapshot and WhatNeedsAttention update without waiting 30s.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, pack, refreshKey, ownerToken]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const recordReadinessSnapshot = useCallback(async () => {
    if (!propertyId || !ownerToken || snapshotAction.loading) return;
    setSnapshotAction({ loading: true, message: '', error: false });
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/verified-asset/snapshots`,
        {
          method: 'POST',
          headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ownerWriteToken: ownerToken }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Snapshot could not be recorded.');
      }
      const snapshot = data.snapshot || {};
      const eligibility = snapshot.eligibility_status === 'eligible'
        ? 'eligible'
        : 'ineligible';
      setSnapshotAction({
        loading: false,
        error: false,
        message: data.created === false
          ? `No new snapshot was needed. Snapshot v${snapshot.version} already records this exact state as ${eligibility}.`
          : `New snapshot v${snapshot.version} recorded as ${eligibility}.`,
      });
      await load();
    } catch (error) {
      setSnapshotAction({ loading: false, error: true, message: error.message });
    }
  }, [propertyId, ownerToken, snapshotAction.loading, load]);

  const generateDigitalAssetPackage = useCallback(async snapshot => {
    if (!propertyId || !ownerToken || !snapshot?.id || packageAction.loading) return;
    setPackageAction({ loading: true, message: '', error: false });
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/digital-asset-packages`,
        {
          method: 'POST',
          headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            ownerWriteToken: ownerToken,
            snapshotId: snapshot.id,
            snapshotVersion: snapshot.version,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Package could not be generated.');
      const packageRecord = data.package;
      if (packageRecord) {
        setSelectedPackage(packageRecord);
        setSelectedSnapshot(null);
      }
      setPackageAction({
        loading: false,
        error: false,
        message: data.created === false
          ? `A package for snapshot v${snapshot.version} already exists.`
          : `Digital Asset Preparation Package generated from snapshot v${snapshot.version}.`,
      });
      await load();
    } catch (error) {
      setPackageAction({ loading: false, error: true, message: error.message });
    }
  }, [propertyId, ownerToken, packageAction.loading, load]);

  const updatePackageRecord = useCallback(updatedPackage => {
    if (!updatedPackage) return;
    setSelectedPackage(updatedPackage);
    setPackageHistory(previous => previous.map(item =>
      item.id === updatedPackage.id ? updatedPackage : item,
    ));
  }, []);

  const processingDocuments = analyses.filter(analysis =>
    ['uploaded', 'processing', 'retrying'].includes(analysis.processing_status)
      || analysis.analysis?.pending === true,
  );
  const failedDocuments = analyses.filter(analysis =>
    analysis.processing_status === 'failed',
  );
  const replacementDocuments = processingDocuments.filter(analysis =>
    analysis.is_replacement === true || (analysis.versionHistory || []).length > 1,
  );
  const processedImpact = analyses
    .filter(analysis => {
      const impact = analysis.analysis?.processing_impact;
      return impact && (Number(impact.overallDelta || 0) !== 0 || Number(impact.confirmedDelta || 0) > 0);
    })
    .slice(-3)
    .reverse();

  // Background extraction is durable, but it can finish after the upload
  // response. Poll only while a document is actively processing, then stop so
  // settled rooms return to the normal 30-second overview refresh.
  useEffect(() => {
    if (processingDocuments.length === 0) return undefined;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load, processingDocuments.length]);

  const currentStageKey   = coordination?.stage || stages[0]?.key;
  const currentStageIndex = Math.max(0, stages.findIndex(s => s.key === currentStageKey));
  const currentStage      = stages[currentStageIndex];
  const generatedRoom     = isGeneratedAiRoom(property);
  const closingDate = getRecordDateValue(
    property,
    recordFields,
    recordState || readiness?.transaction_record,
    ['transaction.closing_date'],
  ) || (!generatedRoom
    ? property?.metadata_values?.target_close_date
      || property?.closing_date
      || property?.target_close_date
      || property?.close_date
    : '');

  // Effective stages include settlement/complete when the room has settlement
  // capability enabled — uses the same getEffectiveStages() as OperationsManagerView.
  const effectiveStages = getEffectiveStages(
    packId || pack.packId || pack.id || DEFAULT_PACK_ID,
    property,
    stages,
  );
  const effectiveStageIndex = Math.max(0, effectiveStages.findIndex(stage => stage.key === currentStageKey));
  const nextLifecycleStage = effectiveStages[effectiveStageIndex + 1] || null;
  const milestoneEvidenceSections = getLifecycleEvidenceSections(currentStage);
  const documentStats = getDocumentRequirementStats(checklistItems, pack, property, analyses);
  const supportingDocumentPresent = milestoneEvidenceSections
    ? analyses.some(analysis => milestoneEvidenceSections.includes(analysis.section))
      || (documentStats.requiredDocuments.length > 0 && documentStats.missingDocuments.length === 0)
    : null;

  // Readiness phase drives which panel appears in position 3 of the Overview.
  const readinessPhase = (() => {
    const k = (currentStageKey || '').toLowerCase();
    if (!k)                                          return 'transaction';
    if (k.includes('complete') || k.includes('funded')) return 'complete';
    if (k.includes('settlement'))                    return 'settlement';
    if (k.includes('clos'))                          return 'closing';
    return 'transaction';
  })();

  // This only changes the embedded Transaction Record section's optional
  // preparation guidance. The dedicated readiness card is always visible.
  const digitalAssetEnabled = isDigitalAssetLayerEnabled(property, pack);

  const canonicalRecordState = recordState || readiness?.transaction_record || null;
  const readinessPct = canonicalRecordState?.requiredCount > 0
    ? Math.round((canonicalRecordState.confirmedCount / canonicalRecordState.requiredCount) * 100)
    : (readiness?.transaction_readiness?.overall_pct ?? null);
  const readinessStatus = canonicalRecordState?.requiredCount > 0
    ? (readinessPct >= 80 ? 'Closing Ready'
      : readinessPct >= 55 ? 'Needs Review'
        : readinessPct === 0 ? 'Getting Started' : 'Needs Attention')
    : (readiness?.transaction_readiness?.status
      || (readinessPct === 0 ? 'Getting Started' : 'Building'));
  const recordSchemaKey = canonicalRecordState?.schemaKey
    || getEffectiveRecordSchemaKey(property, packId, pack);
  const overviewAction = useCallback((action = {}) => {
    if (action.type === 'conflict' && action.conflict) {
      setSelectedConflict(action.conflict);
      return;
    }
    if (action.type === 'tab') {
      onTabChange?.(action.tab);
      return;
    }
    if (action.type === 'record') {
      onTabChange?.('overview');
      const requestedKeys = [
        ...(Array.isArray(action.keys) ? action.keys : []),
        action.field?.key,
        action.field?.field_key,
        action.field?.canonicalKey,
        action.field?.persistedKey,
        action.field?.definitionKey,
      ].filter(Boolean);
      const keys = [...new Set(requestedKeys)];
      const requestedLabels = [
        action.label,
        action.field?.label,
        action.field?.display_label,
      ].filter(Boolean).map(value => String(value).trim().toLowerCase());
      const fieldKey = keys[0] || '';
      setRecordFocus({
        key: fieldKey,
        keys,
        label: requestedLabels[0] || '',
        autoEdit: Boolean(action.autoEdit),
        nonce: Date.now(),
      });
      const category = getTransactionRecordCategory({ ...action.field, field_key: fieldKey });
      const revealRecordCategory = (attempt = 0) => {
        const target = document.getElementById(`transaction-record-category-${category}`);
        if (target) {
          const toggle = target.querySelector('button');
          if (toggle?.getAttribute('aria-expanded') !== 'true') toggle?.click();
          const fieldTarget = keys
            .map(key => document.getElementById(`transaction-record-field-${encodeURIComponent(key)}`))
            .find(Boolean)
            || (requestedLabels.length > 0
              ? [...document.querySelectorAll('[data-transaction-record-field]')].find(element =>
                requestedLabels.includes(String(element.dataset.transactionRecordLabel || '').trim().toLowerCase())
              )
              : null);
          if (fieldTarget) fieldTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else if (attempt < 24) window.setTimeout(() => revealRecordCategory(attempt + 1), 50);
          else target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        // Transaction Details Panel hydrates after the Overview action feed.
        // Wait for that async content instead of dropping the user's action
        // when the old fixed delay happens before the category is mounted.
        if (attempt < 24) {
          window.setTimeout(() => revealRecordCategory(attempt + 1), 50);
        }
      };
      revealRecordCategory();
    }
  }, [onTabChange]);
  // The API's record_state includes the resolved schema, aliases, and the
  // not-applicable denominator. Use it as the single source for every Overview
  // count; the frontend schema is only a pre-load fallback.
  const generatedRecordDefinitions = getEffectiveRecordDefinitions(recordSchemaKey, property, recordFields, canonicalRecordState);
  const requiredRecordFields = canonicalRecordState?.requiredFields?.length
    ? canonicalRecordState.requiredFields
    : (recordSchemaKey === 'generated_ai'
      ? generatedRecordDefinitions
      : getRequiredRecordFields(recordSchemaKey));
  const confirmedRequiredCount = canonicalRecordState?.requiredFields?.length
    ? canonicalRecordState.confirmedCount
    : requiredRecordFields.filter(field =>
      getRecordDefinitionState(field, recordFields, canonicalRecordState).status === 'confirmed'
    ).length;
  const capturedRequiredCount = canonicalRecordState?.requiredFields?.length
    ? canonicalRecordState.awaitingRequiredCount
    : requiredRecordFields.filter(definition => {
      return getRecordDefinitionState(definition, recordFields, canonicalRecordState).status === 'awaiting';
    }).length;
  const keyFacts = getCoordinatorRecordFacts(recordSchemaKey, property, recordFields, canonicalRecordState);
  const lifecycleDateLabel = isGeneratedAiRoom(property) ? 'Target completion' : 'Target close';

  async function advanceLifecycleStage() {
    if (!ownerToken || !nextLifecycleStage || advancingStage) return;
    setAdvancingStage(true);
    setStageActionError('');
    try {
      const response = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/advance`, {
        method: 'POST',
        headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          stage: nextLifecycleStage.key,
          ownerWriteToken: ownerToken,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = [];
        if (Array.isArray(data?.unmet_fields) && data.unmet_fields.length > 0) {
          details.push(`Unconfirmed: ${data.unmet_fields.map(key => String(key).replace(/^(transaction|financial)\./, '').replace(/_/g, ' ')).join(', ')}`);
        }
        if (Number(data?.unresolved_conflicts || 0) > 0) {
          details.push(`Unresolved Transaction Record conflicts: ${data.unresolved_conflicts}`);
        }
        throw new Error([data?.message || data?.error || 'Stage could not be advanced', ...details].join(' · '));
      }
      await load();
    } catch (error) {
      setStageActionError(error.message || 'Stage could not be advanced');
    } finally {
      setAdvancingStage(false);
    }
  }

  return (
    <div className="space-y-5">
      {(processingDocuments.length > 0 || failedDocuments.length > 0 || processedImpact.length > 0) && (
        <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4 sm:px-7">
          {processingDocuments.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">↻</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {replacementDocuments.length === 1
                    ? 'Replacement document processing'
                    : replacementDocuments.length > 1
                      ? `${replacementDocuments.length} replacement documents processing`
                      : processingDocuments.length === 1
                        ? 'Document processing in progress'
                        : `${processingDocuments.length} documents processing`}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {replacementDocuments.length > 0
                    ? `${replacementDocuments.map(analysis => analysis.filename || analysis.section).join(', ')} is replacing an earlier version. The new evidence will refresh the Transaction Record automatically.`
                    : 'The Overview will update automatically when extraction completes.'}
                </p>
              </div>
            </div>
          )}
          {failedDocuments.length > 0 && (
            <div className={`${processingDocuments.length > 0 ? 'mt-3 border-t border-gray-100 pt-3' : ''} flex items-start gap-3`}>
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">!</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {failedDocuments.length === 1 ? 'Document processing needs attention' : `${failedDocuments.length} documents need attention`}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {failedDocuments[0]?.failure_reason || 'Try uploading the original digital file again.'}
                </p>
              </div>
            </div>
          )}
          {processedImpact.map(analysis => {
            const impact = analysis.analysis.processing_impact;
            const delta = Number(impact.overallDelta || 0);
            return (
              <div key={analysis.id} className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
                <span className="font-semibold text-gray-800">{analysis.filename || analysis.section}</span>
                {' '}updated Record Verification from {Math.round(impact.before?.overall || 0)}% to {Math.round(impact.after?.overall || 0)}%
                {delta !== 0 && <span className={`ml-1 font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>({delta > 0 ? '+' : ''}{delta} pts)</span>}
                {Number(impact.confirmedDelta || 0) > 0 && <span className="ml-1 text-gray-500">· {impact.confirmedDelta} field{impact.confirmedDelta === 1 ? '' : 's'} confirmed</span>}
              </div>
            );
          })}
        </section>
      )}
      {/* One decision layer: identity, authoritative readiness, next actions,
          lifecycle, and the structured record all live in one command center. */}
      <section className="rounded-2xl border border-gray-200 bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Overview</p>
            <h1 className="mt-1 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
              {property?.name || property?.property_name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {[
                currentStage?.label,
                closingDate && `${lifecycleDateLabel} ${formatDateOnlyLabel(closingDate)}`,
              ].filter(Boolean).join(' · ') || pack.name}
            </p>
          </div>
          {currentStage && (
            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600">
              Stage {currentStageIndex + 1} of {stages.length}
            </span>
          )}
        </div>

        <div className="mt-5">
          <TransactionBrief
            propertyId={propertyId}
            property={property}
            pack={pack}
            packId={packId}
            briefing={briefing}
            coordination={coordination}
            checklistItems={checklistItems}
            analyses={analyses}
            recordFields={recordFields}
            recordState={canonicalRecordState}
            conflicts={readiness?.conflicts || canonicalRecordState?.unresolvedConflicts || []}
            readiness={readiness}
            stages={stages}
            currentStage={currentStage}
            currentStageIndex={currentStageIndex}
            events={events}
            loading={loading}
            ownerToken={ownerToken}
            onTabChange={onTabChange}
            onOverviewAction={overviewAction}
            onRefresh={load}
          />
        </div>

        <div className="mt-6 grid gap-6 border-t border-gray-100 pt-5 lg:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {readinessPhase === 'complete' ? 'Transaction complete' : 'Record Verification'}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight text-gray-900">
                {readinessPct == null ? '—' : `${Math.round(readinessPct)}%`}
              </span>
              <span className="text-xs font-semibold text-gray-500">{readinessStatus}</span>
            </div>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-400">
              Completeness and confirmation of the structured Transaction Record — not a measure of overall transaction readiness.
            </p>
            {requiredRecordFields.length > 0 && (
              <div className="mt-2 space-y-0.5 text-[11px] text-gray-500">
                <p>{confirmedRequiredCount} of {requiredRecordFields.length} required fields confirmed</p>
                 <p>{capturedRequiredCount} required field{capturedRequiredCount === 1 ? '' : 's'} awaiting confirmation
                   {canonicalRecordState?.awaitingOptionalCount ? ` · ${canonicalRecordState.awaitingOptionalCount} optional` : ''}</p>
              </div>
            )}
          </div>

          <WhatNeedsAttention
            briefing={briefing}
             analyses={analyses}
            recordFields={recordFields}
            recordState={canonicalRecordState}
            conflicts={readiness?.conflicts || canonicalRecordState?.unresolvedConflicts || []}
            checklistItems={checklistItems}
            events={events}
            coordination={coordination}
            pack={pack}
            packId={packId}
            property={property}
            loading={loading}
            onTabChange={onTabChange}
            propertyId={propertyId}
            isCoordinator
            compact
            onOverviewAction={overviewAction}
            onRefresh={load}
          />
        </div>

        <div className="mt-5">
         <KeyTransactionFacts facts={keyFacts} onTabChange={onTabChange} onOverviewAction={overviewAction} />
        </div>

        <TransactionDetailsPanel
          propertyId={propertyId}
          property={property}
          pack={pack}
          recordFields={recordFields}
          recordState={canonicalRecordState}
          onSaved={load}
        />
        <StageLifecycleBar
          stages={effectiveStages}
          currentStageKey={currentStageKey}
          compact
          supportingDocumentPresent={supportingDocumentPresent}
        />
        <div className="mt-4 border-t border-gray-100 pt-4">
          {nextLifecycleStage ? (
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Lifecycle action
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Next stage:{' '}
                  <span className="font-semibold text-gray-900">
                    {nextLifecycleStage.icon && `${nextLifecycleStage.icon} `}
                    {nextLifecycleStage.label}
                  </span>
                </p>
                {stageActionError && (
                  <p role="alert" className="mt-1 text-[11px] font-semibold text-red-600">
                    {stageActionError}
                  </p>
                )}
              </div>
              {ownerToken ? (
                <button
                  type="button"
                  onClick={advanceLifecycleStage}
                  disabled={advancingStage}
                  className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: '#800020' }}
                >
                  {advancingStage ? 'Advancing…' : `Advance to ${nextLifecycleStage.label} →`}
                </button>
              ) : (
                <p className="shrink-0 text-right text-[10px] font-semibold text-amber-700">
                  Open this room from My Deal Rooms to verify owner access.
                </p>
              )}
            </div>
          ) : effectiveStages.length > 0 ? (
            <p className="text-xs font-semibold text-emerald-700">
              Transaction reached its final lifecycle stage: {effectiveStages[effectiveStageIndex]?.label}.
            </p>
          ) : null}
        </div>

        <div className="mt-6 border-t border-gray-100 pt-5">
          {readinessPhase === 'settlement' && (
            <SettlementReadinessPanel
              propertyId={propertyId}
              property={property}
              ownerWriteToken={ownerToken}
              isCoordinator
            />
          )}
          {readinessPhase === 'complete' && (
            <TransactionSealSummaryCard propertyId={propertyId} />
          )}
          <DigitalAssetReadinessSection
            propertyId={propertyId}
             property={property}
            recordFields={recordFields}
            recordState={canonicalRecordState}
            readiness={readiness}
             provenanceGaps={verifiedAssetReadiness?.reasons?.provenance_gaps || []}
             ownerToken={ownerToken}
            onTabChange={onTabChange}
            schemaKey={recordSchemaKey}
            readinessPhase={readinessPhase}
            digitalAssetEnabled={digitalAssetEnabled}
            embedded
            onRecordUpdated={load}
            focusRequest={recordFocus}
          />
        </div>
      </section>
      <VerifiedAssetReadinessCard
        verifiedAssetReadiness={verifiedAssetReadiness}
        ownerToken={ownerToken}
        snapshotHistory={snapshotHistory}
        snapshotAction={snapshotAction}
        packageHistory={packageHistory}
        packageAction={packageAction}
        onRecordSnapshot={recordReadinessSnapshot}
        onOpenSnapshot={setSelectedSnapshot}
        onGeneratePackage={generateDigitalAssetPackage}
        onOpenPackage={setSelectedPackage}
        onOpenProvenance={gap => overviewAction({
          type: 'record',
          field: {
            key: gap?.field_key,
            field_key: gap?.field_key,
            label: gap?.label,
          },
          keys: [gap?.field_key].filter(Boolean),
        })}
      />
      <SnapshotInspectionModal
        snapshot={selectedSnapshot}
        snapshots={snapshotHistory}
        packageHistory={packageHistory}
        packageAction={packageAction}
        ownerToken={ownerToken}
        onSelectSnapshot={setSelectedSnapshot}
        onGeneratePackage={generateDigitalAssetPackage}
        onOpenPackage={setSelectedPackage}
        onClose={() => setSelectedSnapshot(null)}
      />
      <DigitalAssetPackageModal
        propertyId={propertyId}
        ownerToken={ownerToken}
        packageRecord={selectedPackage}
        packages={packageHistory}
        onSelectPackage={setSelectedPackage}
        onPackageUpdated={updatePackageRecord}
        onClose={() => setSelectedPackage(null)}
      />
      <TransactionConflictResolver
        propertyId={propertyId}
        conflict={selectedConflict}
        analyses={analyses}
        onResolved={load}
        onClose={() => setSelectedConflict(null)}
      />
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
      // Inject settlement/complete stages when settlement capability is active.
      const rawStages = Array.isArray(stageData?.stages) && stageData.stages.length >= 2
        ? stageData.stages
        : (pack.stages || []);
      setStages(getEffectiveStages(stageData?.packId || DEFAULT_PACK_ID, property, rawStages));
      setEvents(evData?.events || []);
      setChecklistItems(Array.isArray(ckData?.items) ? ckData.items : []);
      setDataLoading(false);
    });
  }, [propertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ───────────────────────────────────────────────────────────
  const ROLE_META_OM = Object.fromEntries((pack.roles || []).map(r => [r.key, r]));
  const docCount        = Object.values(coordination?.docsByRole || {}).reduce((a, b) => a + b, 0);
  const partyRows       = Array.isArray(coordination?.submissions)
    ? coordination.submissions
    : (Array.isArray(coordination?.parties) ? coordination.parties : []);
  const participantStatesForOverview = resolveParticipantStates(
    getExternalParticipantRoles(pack, { isCoordinator: true }),
    {
      invites: coordination?.participantInvites || [],
      submissions: partyRows,
    },
  );
  const submittedRoles  = new Set(
    participantStatesForOverview.filter(state => state.complete).map(state => state.key),
  );
  const requiredRoles   = getExternalParticipantRoles(pack, { isCoordinator: true })
    .filter(roleMeta => roleMeta.required)
    .map(roleMeta => roleMeta.key);
  const inviteSentCount = events.filter(e => e.event_type === 'invite_sent').length;

  const currentStageKey = coordination?.stage || stages[0]?.key;
  const currentStageIdx = Math.max(0, stages.findIndex(s => s.key === currentStageKey));
  const currentStageData = stages[currentStageIdx];

  const docSchema       = pack.getDocumentSchema?.(property?.property_type || property?.type) || [];
  const requiredDocCount = docSchema.filter(d => d.required).length;
  const openBlockers    = (briefing?.risks || briefing?.open_items || []).length;
  const generatedRoom  = isGeneratedAiRoom(property);
  const closingDate    = getRecordDateValue(
    property,
    [],
    null,
    ['transaction.closing_date'],
  ) || (!generatedRoom
    ? property?.metadata_values?.target_close_date
      || property?.closing_date
      || property?.target_close_date
      || property?.close_date
    : '');
  const lifecycleDateLabel = generatedRoom ? 'Target completion' : 'Target close';
  const daysToClose     = closingDate ? daysUntilDateOnly(closingDate) : null;

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
  // Digital-asset preparation is now a progressive Overview action. Keep the
  // legacy data-derived flag for backend compatibility, but do not let it turn
  // the coordinator home into a tokenization/settings workflow.
  const isTokenization = false;
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
  const liveDocumentStats = getDocumentRequirementStats(checklistItems, pack, property, analyses);
  const actionCards = filterLiveDocumentActions(rawActions, liveDocumentStats)
    .slice(0, 5).map((a, i) => ({
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
    const { requiredDocuments, receivedDocuments } = getDocumentRequirementStats(
      checklistItems,
      pack,
      property,
      analyses,
    );
    if (requiredDocuments.length > 0) {
      return requiredDocuments.filter(item => !receivedDocuments.includes(item));
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
  const invitableRoles = getExternalParticipantRoles(pack, { isCoordinator: true });
  const participantRows = participantStatesForOverview.map(state => {
    const sub = state.submission;
    const lastEv  = [...events].reverse().find(e =>
      (e.metadata?.role === state.key || e.actor_role === state.key) && e.created_at
    );
    const lastActivity = lastEv
      ? new Date(lastEv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—';
    const status = state.stateLabel;
    const statusStyle =
      state.state === 'joined'  ? { color: '#16a34a', bg: '#f0fdf4' }
      : state.state === 'invited' ? { color: '#6b7280', bg: '#f9fafb' }
      :                            { color: '#9ca3af', bg: '#f9fafb' };
    return { ...state, status, lastActivity, statusStyle, submitted: !!sub };
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

  // ── Inline Transaction Readiness score ────────────────────────────────────
  // Computed from data already in scope — drives the header badge in Area 3
  // and controls whether the Settlement panel is shown (progressive disclosure).
  const _rDocScore = requiredDocCount > 0
    ? Math.min(100, Math.round((docCount / requiredDocCount) * 100))
    : Math.min(70, docCount * 14);
  const _rNonCoord = participantRows.filter(r => !r.canManage);
  const _rSubmitted = _rNonCoord.filter(r => r.submitted || submittedRoles.has(r.key)).length;
  const _rPartScore = _rNonCoord.length > 0 ? Math.round((_rSubmitted / _rNonCoord.length) * 100) : 0;
  const _rBlockScore = briefing ? (openBlockers === 0 ? 100 : Math.max(0, 100 - openBlockers * 30)) : 0;
  const overallReadiness = briefLoading ? null
    : Math.round(_rDocScore * 0.45 + _rPartScore * 0.35 + _rBlockScore * 0.20);
  // Settlement capability: determine whether the full Settlement Readiness panel
  // should be shown in place of the legacy Closing & Handoff panel.
  // SettlementReadinessPanel takes over when the workspace is in the settlement
  // or complete stage AND settlement capability is active.
  const packIdForCaps = resolvePackId(property) || DEFAULT_PACK_ID;
  const settlementCaps = getCapabilities(packIdForCaps, property);
  const isInSettlement = isInSettlementPhase(currentStageKey) && settlementCaps.settlement;
  const isComplete = currentStageKey === 'complete';
  const showSettlementReadiness = settlementCaps.settlement && (isInSettlement || isComplete);
  // Progressive disclosure: show legacy Closing & Handoff only when NOT already in settlement/complete stage
  const showSettlementPanel = !showSettlementReadiness && overallReadiness != null && (
    overallReadiness >= 75 || (stages.length > 0 && currentStageIdx >= stages.length - 2)
  );

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
                  {lifecycleDateLabel}: {formatDateOnlyLabel(closingDate)}
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

      {/* Legacy token economics intentionally stays out of the launch Overview. */}
      {false && isTokenization && (() => {
        function fmtCurrency(raw) {
          const n = Number(raw);
          if (!raw || isNaN(n)) return null;
          if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
          if (n >= 1_000)     return `$${n.toLocaleString()}`;
          return `$${n}`;
        }
        // raise_target is the new structured field; raise_amount is the legacy METADATA_FIELDS key — support both
        const kpis = [
          { label: 'Raise Target',    value: fmtCurrency(metaValues.raise_target || metaValues.raise_amount),  field: 'raise_target'   },
          { label: 'Token Price',     value: fmtCurrency(metaValues.token_price),                              field: 'token_price'    },
          { label: 'Min Investment',  value: fmtCurrency(metaValues.min_investment),                           field: 'min_investment' },
          { label: 'Asset Type',      value: metaValues.asset_type || null,                                    field: 'asset_type'     },
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
      {false && isTokenization && (() => {
        const mv = metaValues;
        // Support both new structured fields (token_name, total_supply, raise_target) and
        // legacy free-text fields (total_token_supply, raise_amount) for backward compat.
        const totalSupply   = mv.total_supply    || mv.total_token_supply;
        const raiseTarget   = mv.raise_target    || mv.raise_amount;
        const hasOwnership  = mv.token_name || mv.token_symbol || totalSupply || mv.asset_valuation || mv.pct_tokenized;
        if (!hasOwnership) return null;

        // Parse cap table rows (stored as JSON string)
        let capRows = [];
        try { const r = JSON.parse(mv.cap_table_rows); if (Array.isArray(r)) capRows = r; } catch {}

        const fmtNum = (v) => v ? Number(v).toLocaleString() : null;
        const fmtCur = (v) => {
          const n = Number(v);
          if (!v || isNaN(n)) return null;
          if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
          return `$${n.toLocaleString()}`;
        };

        const ownershipKpis = [
          mv.token_name   && { label: 'Token',          value: `${mv.token_name}${mv.token_symbol ? ` (${mv.token_symbol})` : ''}` },
          totalSupply     && { label: 'Total Supply',   value: fmtNum(totalSupply) },
          mv.asset_valuation && { label: 'Asset Value', value: fmtCur(mv.asset_valuation) },
          mv.pct_tokenized   && { label: '% Tokenized', value: `${mv.pct_tokenized}%`     },
          raiseTarget        && { label: 'Raise Target', value: fmtCur(raiseTarget)        },
        ].filter(Boolean);

        if (ownershipKpis.length === 0 && capRows.length === 0) return null;
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
            {ownershipKpis.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {ownershipKpis.map((kpi, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl px-3 py-3 text-center">
                    <p className="text-sm font-black text-gray-900 mb-0.5 truncate">{kpi.value}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{kpi.label}</p>
                  </div>
                ))}
              </div>
            )}
            {capRows.length > 0 && (
              <div className={ownershipKpis.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Cap Table</p>
                <div className="space-y-1.5">
                  {capRows.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-gray-900 flex-1">{r.name}</span>
                      <span className="text-gray-400">{r.role}</span>
                      <span className="font-semibold text-gray-700 w-10 text-right">{r.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
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
      {false && isTokenization && (() => {
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
            Operations Manager
          </p>
          <p className="text-base font-bold text-gray-900">
            Here is what needs attention next.
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

      {/* ── Area 3: Transaction progress + live readiness score ─────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Transaction Progress</p>
          {overallReadiness != null && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  color:      overallReadiness >= 80 ? '#16a34a' : overallReadiness >= 55 ? '#d97706' : '#dc2626',
                  background: overallReadiness >= 80 ? '#f0fdf4' : overallReadiness >= 55 ? '#fffbeb' : '#fef2f2',
                }}>
                {overallReadiness >= 80 ? 'Closing Ready' : overallReadiness >= 55 ? 'In Progress' : 'Needs Attention'}
              </span>
              <span className="text-base font-black"
                style={{ color: overallReadiness >= 80 ? '#16a34a' : overallReadiness >= 55 ? '#d97706' : '#dc2626' }}>
                {overallReadiness}%
              </span>
            </div>
          )}
        </div>
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
        {false && isTokenization && (
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

      {/* ── Settlement Readiness Panel — settlement/complete stage with capability active ─ */}
      {/* Replaces the legacy Closing & Handoff panel when the coordinator has advanced
          the workspace to the settlement stage and settlement capability is on. */}
      {showSettlementReadiness && (
        <SettlementReadinessPanel
          propertyId={propertyId}
          property={property}
          isCoordinator={true}
        />
      )}

      {/* ── Closing & Handoff — progressive disclosure (≥75% ready or final stages) ─ */}
      {/* Shown in closing/funded stages as pre-settlement preparation. Replaced by
          SettlementReadinessPanel once the workspace enters the settlement stage. */}
      {showSettlementPanel && (
        <SettlementPanel
          propertyId={propertyId}
          property={property}
          isAtFinalStage={stages.length > 0 && currentStageIdx >= stages.length - 1}
        />
      )}


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
  const [participantRole, setParticipantRole] = useState(null);
  const role = accessRole || participantRole || (participantSession ? "guest" : requestedRole);

  // Public demos open directly into the production coordinator workspace.
  // The former welcome overlay was part of the retired presentation flow.
  const [showDemoIntro, setShowDemoIntro] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [apiProperty, setApiProperty] = useState(null);
  const [loadingApi, setLoadingApi] = useState(true);
  const [hasOwnerToken, setHasOwnerToken] = useState(() => {
    try { return Boolean(localStorage.getItem(`kontra_owner_token_${propertyId}`)); } catch { return false; }
  });
  const [packLoadError, setPackLoadError] = useState("");
  // packReady: true once the custom pack for this room is registered in the
  // client-side PACKS registry. Demo rooms always use a built-in pack so it
  // starts true; live rooms wait for ensureWorkflowPackLoaded to resolve.
  const [packReady, setPackReady] = useState(
    DEMO_ROOM_IDS.has(propertyId) || !!DEMO_PROPERTIES[propertyId],
  );
  const [analysesRefreshKey, setAnalysesRefreshKey] = useState(0);
  const [activeTab, setActiveTabRaw] = useState('overview');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  // Wrap tab setter to emit analytics
  const setActiveTab = useCallback((tab) => {
    setActiveTabRaw(tab);
    trackEvent('workspace_tab_viewed', { tab, workspace_id: propertyId });
  }, [propertyId]);
  // Pack correction: set when AI thinks the stored pack is wrong for this room
  const [packSuggestion, setPackSuggestion] = useState(null); // { suggestedPack, currentPack }
  const [repackLoading, setRepackLoading] = useState(false);

  const onAnalysisSaved = () => setAnalysesRefreshKey(k => k + 1);
  const handleParticipantUnlocked = useCallback((unlock) => {
    const sessionToken = typeof unlock === "string" ? unlock : unlock?.sessionToken;
    if (!sessionToken) return;
    if (typeof unlock === "object" && unlock.roleKey) {
      setParticipantRole(unlock.roleKey);
    }
    setParticipantSession(sessionToken);
  }, []);

  // Track workspace page view on load
  useEffect(() => {
    trackEvent('workspace_viewed', { workspace_id: propertyId });
  }, [propertyId]);

  // Try to fetch custom deal room from API
  useEffect(() => {
    // The legacy static sample properties are intentionally client-only, but
    // public demo rooms consume seeded API fixtures so the coordinator shell
    // receives the real pack-specific workspace payload.
    if (DEMO_PROPERTIES[propertyId] && !DEMO_ROOM_IDS.has(propertyId)) {
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

  // Checkout success stores the owner credential before redirecting here. Keep
  // the coordinator boundary tied to that credential, not to ?role=owner.
  useEffect(() => {
    try {
      setHasOwnerToken(Boolean(localStorage.getItem(`kontra_owner_token_${propertyId}`)));
    } catch {}
  }, [propertyId]);

  // After a room loads, ask AI whether the stored pack matches the transaction.
  // Only runs for coordinator view of live (non-demo) rooms with a standard built-in pack.
  // Custom ws_* packs are always intentional — never suggest a change for those.
  useEffect(() => {
    if (!apiProperty || DEMO_ROOM_IDS.has(propertyId) || DEMO_PROPERTIES[propertyId]) return;
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

  const isDemo = DEMO_ROOM_IDS.has(propertyId);

  // Resolve property: use a local demo shell first, then merge the complete
  // API payload as soon as it arrives, then derive from the slug for unknown
  // rooms.
  const demoProperty = DEMO_PROPERTIES[propertyId];
  const demoRoomShell = DEMO_ROOM_SHELLS[propertyId];
  const isCustom = isDemo || !demoProperty;

  // Build display property object
  let property = demoRoomShell || demoProperty;
  if (apiProperty) {
    const sample = generateDemoData(apiProperty);
    property = {
      ...(demoRoomShell || {}),
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

  // Which Workflow Pack powers this deal room. Public demos deliberately use
  // the same pack-specific configuration as a fresh production room.
  // Resolution (deal_type inference wins over the stored workflow_pack_id
  // column) lives in one shared place — lib/workflowPacks.resolvePackId —
  // so every page that needs a room's pack (this page, checkout success,
  // invite links, etc.) agrees, instead of duplicating/drifting logic.
  const packId = isDemo
    ? ({
        'kontra-demo': 'cre_acquisition',
        'kontra-demo-biz': 'business_acquisition',
        'kontra-demo-fundraising': 'fundraising',
      }[propertyId] || DEFAULT_PACK_ID)
    : resolvePackId(apiProperty);
  const pack = getWorkflowPack(packId);
  const isCREPack       = packId === DEFAULT_PACK_ID;
  const isTokenization  = isDigitalAssetLayerEnabled(apiProperty, pack);
  const isTokenizationRelevant = TOKENIZATION_RELEVANT_TYPES.has(apiProperty?.deal_type)
    || pack?.id === 'tokenization'
    || pack?.transactionType === 'tokenization';

  // This hook must run on the PIN-gate render and the unlocked render alike.
  // Calling it below the gate's early return triggers React error #310
  // ("Rendered more hooks than during the previous render").
  usePageTitle(property?.name || property?.property_name);

  if (inviteToken && !participantSession) {
    return (
      <DealRoomPinGate
        propertyId={propertyId}
        role={requestedRole}
        inviteToken={inviteToken}
        onUnlocked={handleParticipantUnlocked}
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

  // Ownership/session semantics are authoritative. Role metadata is only a
  // fallback for legacy owner links and packs whose primary role is explicitly
  // non-invitable; a canManage flag alone must not turn an external participant
  // into the workspace owner.
  const isOwnerAccess = property?.access?.mode === 'owner';
  const isCoordinator = isDemo || isOwnerAccess
    || (hasOwnerToken && role === 'owner')
    || (
      property?.access?.mode !== 'participant'
      && hasOwnerToken
      && roleConfig?.canManage === true
      && roleConfig?.invitable !== true
    );

  // The "Outstanding Items" grid (risk/compliance/property panels) still
  // hardcodes CRE concepts (NOI, DSCR, occupancy) inside the panels
  // themselves, but *which* panels a pack supports is now pack-driven:
  // roleConfig.sections says which sections a role wants to see, the pack's
  // `outstandingItemsSections` says which ones it actually has. Business
  // Acquisition declares none, so the grid is naturally empty for it.
  const visibleOutstandingSections = (roleConfig.sections || []).filter(
    (s) => pack.outstandingItemsSections?.includes(s)
  );

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
  if (loadingApi && isCustom && !isDemo) {
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

  // Every resolved deal-room URL uses the current workspace shell. The
  // property.isCustom flag is retained for data/panel behavior, but must not
  // select the retired welcome/activity/checklist layout.
  const isCurrentWorkspace = Boolean(property);

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
            One deal room coordinates every participant, stage, and deadline — from kickoff to close.
          </p>
          <ul className="text-left space-y-3 mb-8">
            {[
              "Coordinates all participants from one deal room",
              "AI reviews every document and surfaces flags",
              "Tracks what's missing and who needs to act",
              "Prepares a clear package for external review",
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
          <div className="max-w-5xl mx-auto flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-start gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0 bg-green-100">
                🔑
              </div>
              <div>
                <p className="break-words text-xs font-semibold leading-snug text-green-900">Deal room active — invite participants and upload documents to begin</p>
                <p className="break-words text-[10px] leading-snug text-green-600">Secure role-based access for every participant · AI analyzes each file as it's uploaded</p>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
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
            <span className="shrink-0 rounded-full border border-gray-200 bg-white/70 px-3 py-1.5 text-[10px] font-semibold text-gray-500">
              Role-scoped access
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
            <span className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-gray-500">
              Role-scoped access
            </span>
          </div>
        </div>
      )}

      {/* Workspace tab nav — coordinator view of live paid rooms only */}
      {isCurrentWorkspace && (
        <WorkspaceTabNav
          activeTab={activeTab}
          onChange={setActiveTab}
          isCoordinator={isCoordinator}
          isDemo={isDemo}
        />
      )}

       <div className="relative z-10 isolate pointer-events-auto max-w-5xl mx-auto px-6 py-8">

        {isCurrentWorkspace ? (

          /* ── Shared workspace layout ───────────────────────────────────── */
          <>
            {/* Floating AI button — persists across all coordinator tabs */}
            {isCoordinator && <RoomCopilot propertyId={pid} />}

            {activeTab === 'overview' && (
              isCoordinator ? (
                <CoordinatorOverview
                    propertyId={pid}
                    property={property}
                    pack={pack}
                    packId={packId}
                    onTabChange={setActiveTab}
                    refreshKey={analysesRefreshKey}
                  />
              ) : (
                <ParticipantOverview
                  propertyId={pid}
                  property={property}
                  pack={pack}
                  role={role}
                  roleConfig={roleConfig}
                  onTabChange={setActiveTab}
                  refreshKey={analysesRefreshKey}
                />
              )
            )}

            {activeTab === 'documents' && (
              <>
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
                    onPeople={() => setActiveTab('people')}
                  />
                </div>
              </>
            )}

            {activeTab === 'people' && isCoordinator && (
              <ParticipantsPanel
                roomId={pid}
                packId={packId}
                isV2={!!property.auth_v2_enabled}
                isCoordinator={isCoordinator}
                readOnly={isDemo}
                coordinatorRole={isCoordinator ? (
                  pack.roles?.find(r => r.canManage === true) || {
                    key: 'deal_coordinator',
                    icon: '🏢',
                    label: 'Deal Owner',
                    color: '#800020',
                  }
                ) : null}
              />
            )}

            {activeTab === 'people' && !isCoordinator && (
              <ParticipantPeoplePanel pack={pack} role={role} roleConfig={roleConfig} />
            )}

            {activeTab === 'settings' && isCoordinator && (
              <div className="space-y-4">
                <TransactionDetailsPanel propertyId={pid} property={property} pack={pack} />
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
            {false && property.isCustom && isTokenization && !isCoordinator && (() => {
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
                <TasksPanel propertyId={pid} role={role} onTabChange={setActiveTab} authHeaders={getRoomAuthHeaders(pid)} />
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

