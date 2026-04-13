import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheckIcon,
  ScaleIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  CubeTransparentIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  PlusIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  InformationCircleIcon,
  SparklesIcon,
  BuildingLibraryIcon,
  BeakerIcon,
  FunnelIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  EyeIcon,
  ClockIcon,
  TagIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

// ── Category definitions ──────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: "freddie_mac",
    label: "Freddie Mac",
    description: "GSE multifamily seller/servicer guide requirements — inspection, covenant, annual review, insurance standards.",
    icon: BuildingLibraryIcon,
    color: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
    source_agency: "freddie_mac",
    rule_count: 10,
  },
  {
    id: "fannie_mae",
    label: "Fannie Mae",
    description: "DUS lender obligations — DSCR maintenance, LTV limits, delinquency reporting to Fannie Mae within 5 days.",
    icon: BuildingLibraryIcon,
    color: { bg: "bg-indigo-50", border: "border-indigo-200", icon: "text-indigo-600", badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
    source_agency: "fannie_mae",
    rule_count: 3,
  },
  {
    id: "hazard_loss",
    label: "Hazard Loss",
    description: "Insurance proceeds holdback, PSA investor notification thresholds, post-repair inspection requirements, contractor bid limits.",
    icon: ShieldCheckIcon,
    color: { bg: "bg-red-50", border: "border-red-200", icon: "text-red-600", badge: "bg-red-100 text-red-700", dot: "bg-red-500" },
    source_agency: "freddie_mac",
    rule_count: 4,
  },
  {
    id: "watchlist",
    label: "Watchlist",
    description: "Delinquency triggers, DSCR breakeven thresholds, reserve depletion monitoring, risk classification criteria.",
    icon: EyeIcon,
    color: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
    source_agency: "freddie_mac",
    rule_count: 4,
  },
  {
    id: "reserve",
    label: "Reserve Triggers",
    description: "Minimum reserve balance requirements (3-month PITI), replenishment deadlines, CapEx disbursement approval thresholds.",
    icon: BanknotesIcon,
    color: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
    source_agency: "freddie_mac",
    rule_count: 3,
  },
  {
    id: "maturity",
    label: "Maturity Extension",
    description: "90-day notice requirements, performing DSCR floor for extensions (1.10x), 24-month maximum extension cap.",
    icon: ClockIcon,
    color: { bg: "bg-violet-50", border: "border-violet-200", icon: "text-violet-600", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
    source_agency: "lender",
    rule_count: 4,
  },
  {
    id: "token_transfer",
    label: "Token Transfer",
    description: "Tokenization eligibility (DSCR/LTV/current), 90-day post-origination lock-up, annual appraisal verification.",
    icon: CubeTransparentIcon,
    color: { bg: "bg-cyan-50", border: "border-cyan-200", icon: "text-cyan-600", badge: "bg-cyan-100 text-cyan-700", dot: "bg-cyan-500" },
    source_agency: "platform",
    rule_count: 5,
  },
  {
    id: "lender_specific",
    label: "Lender-Specific",
    description: "Custom lender policies — draw limits, quarterly risk reviews, cross-default portfolio triggers.",
    icon: AdjustmentsHorizontalIcon,
    color: { bg: "bg-rose-50", border: "border-rose-200", icon: "text-rose-600", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
    source_agency: "lender",
    rule_count: 3,
  },
];

// ── Agent → Rule dependency map ───────────────────────────────────────────────

const AGENT_RULES = [
  {
    agent: "Inspection Agent", id: "inspection_agent", color: "bg-amber-100 text-amber-800",
    rules: [
      { rule_id: "GSE-INSP-01", category: "freddie_mac", type: "triggers_on" },
      { rule_id: "GSE-INSP-02", category: "freddie_mac", type: "evaluates" },
      { rule_id: "DRAW-HOLD-CRIT", category: "freddie_mac", type: "blocks_on" },
      { rule_id: "FREDDIE-5.3.2", category: "freddie_mac", type: "evaluates" },
    ],
  },
  {
    agent: "Hazard Loss Agent", id: "hazard_loss_agent", color: "bg-red-100 text-red-800",
    rules: [
      { rule_id: "HAZARD-HOLD-50PCT", category: "hazard_loss", type: "triggers_on" },
      { rule_id: "HAZARD-PSA-NOTIFY", category: "hazard_loss", type: "triggers_on" },
      { rule_id: "HAZARD-INSPECT-REQ", category: "hazard_loss", type: "blocks_on" },
    ],
  },
  {
    agent: "Surveillance Agent", id: "surveillance_agent", color: "bg-violet-100 text-violet-800",
    rules: [
      { rule_id: "WATCH-DQ90", category: "watchlist", type: "triggers_on" },
      { rule_id: "WATCH-DSCR-SUB", category: "watchlist", type: "triggers_on" },
      { rule_id: "WATCH-RESERVE-DEP", category: "watchlist", type: "evaluates" },
    ],
  },
  {
    agent: "Compliance Agent", id: "compliance_agent", color: "bg-emerald-100 text-emerald-800",
    rules: [
      { rule_id: "FREDDIE-ANNUAL", category: "freddie_mac", type: "evaluates" },
      { rule_id: "FREDDIE-INS-MIN", category: "freddie_mac", type: "evaluates" },
      { rule_id: "CFPB-LOSS-MIT-REQ", category: "compliance", type: "evaluates" },
    ],
  },
  {
    agent: "Covenant Agent", id: "covenant_agent", color: "bg-rose-100 text-rose-800",
    rules: [
      { rule_id: "COV-DSCR-01", category: "freddie_mac", type: "triggers_on" },
      { rule_id: "COV-CURE-30", category: "compliance", type: "triggers_on" },
      { rule_id: "PSA-INVESTOR-NOTIFY", category: "freddie_mac", type: "triggers_on" },
      { rule_id: "COV-OCC-MIN", category: "freddie_mac", type: "evaluates" },
    ],
  },
  {
    agent: "Tokenization Agent", id: "tokenization_agent", color: "bg-cyan-100 text-cyan-800",
    rules: [
      { rule_id: "TOKEN-DSCR-MIN", category: "token_transfer", type: "blocks_on" },
      { rule_id: "TOKEN-LTV-MAX", category: "token_transfer", type: "blocks_on" },
      { rule_id: "TOKEN-CURRENT", category: "token_transfer", type: "blocks_on" },
      { rule_id: "TOKEN-AUDIT", category: "token_transfer", type: "evaluates" },
    ],
  },
];

// ── Rule evaluator panel ──────────────────────────────────────────────────────

const QUICK_RULES = [
  { id: "COV-DSCR-01", label: "DSCR Covenant", placeholder: "1.08", unit: "x" },
  { id: "WATCH-DQ90", label: "Delinquency Days", placeholder: "94", unit: "days" },
  { id: "HAZARD-HOLD-50PCT", label: "Insurance Proceeds", placeholder: "150000", unit: "USD" },
  { id: "TOKEN-LTV-MAX", label: "LTV Ratio", placeholder: "72", unit: "%" },
  { id: "MAT-EXT-PERFORMING", label: "Extension DSCR", placeholder: "1.10", unit: "x" },
  { id: "RESERVE-CAPEX-APPROVAL", label: "CapEx Disbursement", placeholder: "30000", unit: "USD" },
];

const DEMO_AUDIT = [
  { rule_id: "COV-DSCR-01", agent: "Covenant Agent", loan: "LN-0094", result: "triggered", source: "hardcoded_fallback", ts: "2026-04-11T10:00:00Z" },
  { rule_id: "GSE-INSP-01", agent: "Inspection Agent", loan: "LN-3301", result: "triggered", source: "hardcoded_fallback", ts: "2026-04-11T14:12:00Z" },
  { rule_id: "TOKEN-DSCR-MIN", agent: "Tokenization Agent", loan: "LN-2847", result: "clear", source: "hardcoded_fallback", ts: "2026-04-10T11:00:00Z" },
  { rule_id: "FREDDIE-ANNUAL", agent: "Compliance Agent", loan: "LN-2847", result: "clear", source: "hardcoded_fallback", ts: "2026-04-10T09:30:00Z" },
  { rule_id: "WATCH-DQ90", agent: "Surveillance Agent", loan: "LN-7734", result: "triggered", source: "hardcoded_fallback", ts: "2026-04-08T08:10:00Z" },
  { rule_id: "HAZARD-HOLD-50PCT", agent: "Hazard Loss Agent", loan: "LN-5578", result: "triggered", source: "hardcoded_fallback", ts: "2026-04-08T10:05:00Z" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  triggers_on: { label: "triggers on", color: "text-red-600 bg-red-50 border-red-100" },
  evaluates:   { label: "evaluates",   color: "text-blue-600 bg-blue-50 border-blue-100" },
  blocks_on:   { label: "blocks on",   color: "text-orange-600 bg-orange-50 border-orange-100" },
};

const CATEGORY_COLOR: Record<string, string> = {
  freddie_mac: "bg-blue-100 text-blue-700",
  fannie_mae: "bg-indigo-100 text-indigo-700",
  hazard_loss: "bg-red-100 text-red-700",
  watchlist: "bg-amber-100 text-amber-700",
  reserve: "bg-emerald-100 text-emerald-700",
  maturity: "bg-violet-100 text-violet-700",
  token_transfer: "bg-cyan-100 text-cyan-700",
  lender_specific: "bg-rose-100 text-rose-700",
  compliance: "bg-gray-100 text-gray-700",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-gray-900" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function CategoryCard({ cat, onClick }: { cat: typeof CATEGORIES[number]; onClick: () => void }) {
  const Icon = cat.icon;
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl border ${cat.color.border} shadow-sm p-4 text-left hover:shadow-md transition-shadow group`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${cat.color.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${cat.color.icon}`} />
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cat.color.badge}`}>{cat.rule_count} rules</span>
      </div>
      <p className="text-sm font-bold text-gray-900 mb-1">{cat.label}</p>
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{cat.description}</p>
      <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-gray-700 transition-colors">
        <span>View rules</span>
        <ChevronRightIcon className="w-3 h-3" />
      </div>
    </button>
  );
}

function RuleEvaluator() {
  const [selectedRule, setSelectedRule] = useState(QUICK_RULES[0]);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const evaluate = async () => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rules/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ context: { value: Number(value) || value }, category: undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        // Demo result
        setResult({
          demo: true,
          allowed: Number(value) >= 1.25,
          matched_rules: [{ name: selectedRule.label, version: 1 }],
          rule_id: selectedRule.id,
          value: Number(value),
        });
      }
    } catch (_) {
      const thresholds: Record<string, number> = {
        "COV-DSCR-01": 1.25, "WATCH-DQ90": 90, "HAZARD-HOLD-50PCT": 100000, "TOKEN-LTV-MAX": 75, "MAT-EXT-PERFORMING": 1.10, "RESERVE-CAPEX-APPROVAL": 25000,
      };
      const ops: Record<string, string> = { "COV-DSCR-01": ">=", "WATCH-DQ90": ">=", "HAZARD-HOLD-50PCT": ">", "TOKEN-LTV-MAX": "<=", "MAT-EXT-PERFORMING": ">=", "RESERVE-CAPEX-APPROVAL": ">" };
      const threshold = thresholds[selectedRule.id] || 1;
      const op = ops[selectedRule.id] || ">=";
      const numVal = Number(value);
      let passes = false;
      if (op === ">=") passes = numVal >= threshold;
      else if (op === ">") passes = numVal > threshold;
      else if (op === "<=") passes = numVal <= threshold;
      setResult({ demo: true, allowed: passes, rule_id: selectedRule.id, value: numVal, threshold, policy_source: "hardcoded_fallback" });
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <BeakerIcon className="w-5 h-5 text-[#800020]" />
        <h3 className="text-sm font-bold text-gray-900">Live Rule Evaluator</h3>
        <span className="px-2 py-0.5 rounded-full bg-[#800020]/10 text-[#800020] text-xs font-semibold">Admin Tool</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Test any rule against a value without affecting live data. Agents query this same engine before every recommendation.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Rule</label>
          <select
            value={selectedRule.id}
            onChange={(e) => { setSelectedRule(QUICK_RULES.find((r) => r.id === e.target.value) || QUICK_RULES[0]); setResult(null); }}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30"
          >
            {QUICK_RULES.map((r) => <option key={r.id} value={r.id}>{r.id} — {r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Value to Test ({selectedRule.unit})</label>
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => { setValue(e.target.value); setResult(null); }}
              onKeyDown={(e) => e.key === "Enter" && evaluate()}
              placeholder={selectedRule.placeholder}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30"
            />
            <button
              onClick={evaluate}
              disabled={!value.trim() || loading}
              className="px-4 py-2 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a] disabled:opacity-40 transition-colors"
            >
              {loading ? "..." : "Test"}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className={`p-4 rounded-xl border ${result.allowed !== false ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            {result.allowed !== false
              ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
              : <XCircleIcon className="w-5 h-5 text-red-500" />}
            <span className={`text-sm font-bold ${result.allowed !== false ? "text-emerald-700" : "text-red-700"}`}>
              {result.allowed !== false ? "Rule CLEAR — passes threshold" : "Rule TRIGGERED — threshold breached"}
            </span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p><span className="font-semibold">Rule:</span> {result.rule_id}</p>
            <p><span className="font-semibold">Value tested:</span> {result.value} {selectedRule.unit}</p>
            {result.threshold && <p><span className="font-semibold">Threshold:</span> {result.threshold} {selectedRule.unit}</p>}
            <p><span className="font-semibold">Policy source:</span>{" "}
              <span className={result.policy_source === "db_rule" ? "text-emerald-600 font-semibold" : "text-amber-600"}>
                {result.policy_source === "db_rule" ? "✓ DB Rule (live)" : result.demo ? "Demo mode" : "Fallback registry"}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PolicyEnginePage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const totalRules = CATEGORIES.reduce((acc, c) => acc + c.rule_count, 0);
  const criticalCount = 6;
  const pendingApproval = 0;

  return (
    <div className="min-h-screen bg-[#f9f8f6] p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ScaleIcon className="w-5 h-5 text-[#800020]" />
              <span className="text-xs font-semibold text-[#800020] uppercase tracking-wider">Phase 3 · Regulatory Intelligence Layer</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Policy Engine</h1>
            <p className="text-sm text-gray-500 mt-1">
              Admin-controlled rule registry. Every AI agent queries this engine before making any recommendation or action.
              Rules support versioning, effective dates, severity levels, source references, and override permissions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/governance/rules"
              className="flex items-center gap-2 px-4 py-2.5 bg-[#800020] text-white text-sm font-semibold rounded-xl hover:bg-[#6a001a] transition-colors"
            >
              <PencilSquareIcon className="w-4 h-4" /> Manage Rules
            </a>
          </div>
        </div>

        {/* Phase 3 info banner */}
        <div className="mt-5 p-4 bg-[#800020]/5 border border-[#800020]/15 rounded-xl flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-[#800020] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#800020]">Configurable Without Code Changes</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Administrators update rules through the Manage Rules console. The Policy Engine evaluates each rule with a 3-tier priority:
              <strong> (1) Org-level override</strong> → <strong>(2) Published DB rule</strong> → <strong>(3) Fallback registry</strong>.
              Every evaluation is logged to the audit trail. Rule changes take effect immediately at the next effective date with zero code deployments.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Rules" value={totalRules} sub="across all categories" color="text-gray-900" />
          <StatCard label="Categories" value={CATEGORIES.length} sub="regulatory domains" color="text-gray-900" />
          <StatCard label="Critical Rules" value={criticalCount} sub="require immediate action" color="text-red-600" />
          <StatCard label="Pending Review" value={pendingApproval} sub="in approval queue" color="text-amber-600" />
          <StatCard label="Agents Connected" value={6} sub="querying engine in real-time" color="text-[#800020]" />
          <StatCard label="Policy Source" value="3-Tier" sub="override → DB → fallback" color="text-emerald-600" />
        </div>

        {/* Category Grid + Evaluator */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Category Cards */}
          <div className="xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Rule Categories</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter categories..."
                    className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30 w-44"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {CATEGORIES
                .filter((c) => !searchTerm || c.label.toLowerCase().includes(searchTerm.toLowerCase()) || c.description.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((cat) => (
                  <CategoryCard
                    key={cat.id}
                    cat={cat}
                    onClick={() => window.location.href = `/governance/rules?category=${cat.id}`}
                  />
                ))}
            </div>

            {/* Rule lifecycle explainer */}
            <div className="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Rule Lifecycle & Override System</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Lifecycle States</p>
                  <div className="space-y-1.5">
                    {[
                      { state: "Draft", desc: "Created by admin, not yet active", color: "bg-gray-100 text-gray-600" },
                      { state: "Pending Review", desc: "Submitted for maker-checker approval", color: "bg-amber-100 text-amber-700" },
                      { state: "Approved", desc: "Approved, awaiting publish date", color: "bg-blue-100 text-blue-700" },
                      { state: "Published", desc: "Live — agents evaluate against this rule", color: "bg-emerald-100 text-emerald-700" },
                      { state: "Emergency", desc: "Platform admin bypass — immediate effect", color: "bg-red-100 text-red-700" },
                      { state: "Archived", desc: "Superseded — retained for audit", color: "bg-gray-50 text-gray-400" },
                    ].map((s) => (
                      <div key={s.state} className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.color} shrink-0`}>{s.state}</span>
                        <span className="text-xs text-gray-500">{s.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Override Permissions</p>
                  <div className="space-y-2">
                    {[
                      { type: "Threshold Override", desc: "Change numeric threshold for this org", role: "lender_admin" },
                      { type: "Disable Rule", desc: "Exempt this org from a rule temporarily", role: "platform_admin" },
                      { type: "Severity Downgrade", desc: "Change critical → high for this org", role: "lender_admin" },
                      { type: "Approval Path", desc: "Customize who approves triggered actions", role: "lender_admin" },
                    ].map((o) => (
                      <div key={o.type} className="p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-xs font-semibold text-gray-700">{o.type}</p>
                          <span className="px-1.5 py-0.5 rounded bg-[#800020]/10 text-[#800020] text-xs font-mono">{o.role}</span>
                        </div>
                        <p className="text-xs text-gray-500">{o.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Evaluator + Audit */}
          <div className="space-y-5">
            {/* Live Rule Evaluator */}
            <RuleEvaluator />

            {/* Evaluation Source Indicator */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Evaluation Priority Chain</p>
              <div className="space-y-2">
                {[
                  { priority: "1", label: "Org Override", desc: "Custom override for this org", color: "bg-[#800020] text-white", badge: "Highest" },
                  { priority: "2", label: "Published DB Rule", desc: "Live rule from kontra_rules table", color: "bg-emerald-500 text-white", badge: "Standard" },
                  { priority: "3", label: "Fallback Registry", desc: "Hardcoded baseline (always available)", color: "bg-amber-500 text-white", badge: "Fallback" },
                ].map((tier) => (
                  <div key={tier.priority} className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-lg">
                    <div className={`w-6 h-6 rounded-full ${tier.color} flex items-center justify-center shrink-0`}>
                      <span className="text-xs font-bold">{tier.priority}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-800">{tier.label}</p>
                        <span className="text-xs text-gray-400">{tier.badge}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{tier.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Agent → Rule Dependency Map */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Agent → Rule Dependencies</h2>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <p className="text-xs text-gray-500">
                Every AI agent queries the policy engine before making a recommendation. This map shows which rules each agent evaluates.
                Changing a rule immediately affects all agents that depend on it.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Agent</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Rules Used</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Rule Count</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENT_RULES.map((agent, i) => (
                    <tr key={agent.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${agent.color}`}>{agent.agent}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {agent.rules.map((rule) => {
                            const typeInfo = TYPE_LABELS[rule.type];
                            return (
                              <div key={rule.rule_id} className="flex items-center gap-1">
                                <span className="text-xs font-mono font-semibold text-gray-700">{rule.rule_id}</span>
                                <span className={`px-1.5 py-0.5 rounded border text-xs ${typeInfo?.color}`}>{typeInfo?.label}</span>
                                <span className={`px-1.5 py-0.5 rounded text-xs ${CATEGORY_COLOR[rule.category] || "bg-gray-100 text-gray-600"}`}>{rule.category}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-gray-700">{agent.rules.length}</span>
                          <span className="text-xs text-gray-400">rules</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Rule Evaluations Audit Feed */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Rule Evaluations</h2>
            <a href="/governance/rules" className="text-xs text-[#800020] font-semibold hover:underline flex items-center gap-1">
              Full audit log <ArrowRightIcon className="w-3 h-3" />
            </a>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {DEMO_AUDIT.map((entry, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  {entry.result === "triggered"
                    ? <XCircleIcon className="w-4 h-4 text-red-500 shrink-0" />
                    : <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-gray-800">{entry.rule_id}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{entry.agent}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs font-mono text-gray-500">{entry.loan}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Source: <span className="text-amber-600 font-medium">{entry.source}</span></p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${entry.result === "triggered" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {entry.result}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(entry.ts).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Audit entries show <span className="font-semibold text-amber-600">"hardcoded_fallback"</span> as source until DB rules are seeded.
            Run <span className="font-mono text-gray-600">seed-phase3-regulatory-rules.sql</span> to populate live DB rules.
          </p>
        </div>
      </div>
    </div>
  );
}
