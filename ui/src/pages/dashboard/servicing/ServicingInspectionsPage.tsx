import { useCallback, useMemo, useState } from "react";

type Classification = "ILS" | "LS" | "PLS" | "DM";
type FindingStatus = "pending" | "accepted" | "overridden" | "escalated" | "needs_evidence" | "resolved";
type SeverityLevel = "critical" | "high" | "medium" | "low";

type ActivityEntry = {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  note?: string;
};

type Finding = {
  id: string;
  location: string;
  description: string;
  severity: SeverityLevel;
  aiClassification: Classification;
  aiConfidence: number;
  aiRationale: string;
  aiFactors: string[];
  aiRecommendedAction: string;
  humanOverride?: Classification;
  status: FindingStatus;
  isRecurring: boolean;
  priorFindingNote?: string;
  photos: { label: string; url: string }[];
  actionRequired: string;
  activityLog: ActivityEntry[];
};

const MOCK_FINDINGS: Finding[] = [
  {
    id: "F-001",
    location: "Building 3 — Stairwell B, 3rd Floor",
    description:
      "Fire-exit door blocked by stacked pallets and construction debris. Door cannot be fully opened. No signage visible.",
    severity: "critical",
    aiClassification: "ILS",
    aiConfidence: 0.94,
    aiRationale:
      "A blocked fire-exit door in an occupied stairwell meets the definition of Imminent Life Safety. The obstruction prevents egress and directly violates NFPA 101 Life Safety Code §7.2. Any delay in remediation creates immediate occupant risk.",
    aiFactors: [
      "Door obstructed >50% — egress impossible under emergency conditions",
      "Stairwell is primary vertical egress for floors 3–5",
      "Construction materials (combustible pallets) compound fire risk",
      "No visible corrective action notice posted",
    ],
    aiRecommendedAction:
      "Immediate removal of obstruction required. Do not release draw funds until site re-inspection confirms clearance. Notify borrower and GC in writing within 24 hours.",
    status: "pending",
    isRecurring: true,
    priorFindingNote: "Same stairwell cited for clutter in Q2 inspection (Finding F-089). Not resolved.",
    photos: [
      { label: "Stairwell door — blocked", url: "#" },
      { label: "Debris pile — close-up", url: "#" },
    ],
    actionRequired: "Clear obstruction, re-inspect, hold draw",
    activityLog: [],
  },
  {
    id: "F-002",
    location: "Roof — Mechanical Penthouse",
    description:
      "HVAC unit condenser coils show severe corrosion. Refrigerant lines have visible cracks at elbow joints. Possible refrigerant leak — odor detected during inspection.",
    severity: "high",
    aiClassification: "LS",
    aiConfidence: 0.81,
    aiRationale:
      "Refrigerant exposure in an occupied mechanical space qualifies as Life Safety under ASHRAE 15 Safety Standard. Cracked lines in a pressurized system represent an active hazard requiring immediate assessment by a licensed HVAC engineer.",
    aiFactors: [
      "Visible fractures at 2 elbow joints — pressure integrity compromised",
      "Corrosion rating exceeds threshold for active service (Grade 3+)",
      "Odor consistent with refrigerant (R-410A) present at time of inspection",
      "Penthouse HVAC serves floors 4–7 — shutdown may affect life-safety systems",
    ],
    aiRecommendedAction:
      "Engage licensed HVAC engineer within 48 hours. Pressure test all lines. Tag unit out of service if leak confirmed. Escrow 125% of estimated repair cost before next draw.",
    status: "pending",
    isRecurring: false,
    photos: [
      { label: "Condenser coils — corrosion", url: "#" },
      { label: "Elbow joint crack — annotated", url: "#" },
      { label: "Refrigerant line — overview", url: "#" },
    ],
    actionRequired: "HVAC engineer assessment, potential escrow hold",
    activityLog: [],
  },
  {
    id: "F-003",
    location: "Unit 214 — Bathroom",
    description:
      "Subfloor soft spots around toilet base. Possible water intrusion from failed wax ring. Subfloor appears compromised but not yet fully failed.",
    severity: "high",
    aiClassification: "PLS",
    aiConfidence: 0.72,
    aiRationale:
      "Compromised subfloor around plumbing fixtures carries a Potential Life Safety designation. While not an immediate threat, structural failure of the subfloor during occupancy could cause injury. Water intrusion also creates mold conditions. Confidence is moderate because visual inspection cannot confirm full subfloor extent without destructive testing.",
    aiFactors: [
      "Soft spot radius ~18\" — exceeds threshold for deferred-only classification",
      "Toilet fixture shows lateral play indicating base connection failure",
      "Moisture reading: 38% at subfloor — elevated",
      "Unit is occupied — continued use increases failure probability",
    ],
    aiRecommendedAction:
      "Temporary unit restriction or occupant notice. Schedule destructive assessment within 7 days. Include remediation estimate in next draw package.",
    status: "accepted",
    isRecurring: false,
    photos: [
      { label: "Bathroom floor — affected area", url: "#" },
      { label: "Moisture meter reading", url: "#" },
    ],
    actionRequired: "Schedule assessment, occupant notice",
    activityLog: [
      {
        id: "log-1",
        timestamp: "2025-04-01T14:22:00Z",
        user: "J. Okafor (Senior Reviewer)",
        action: "Accepted AI classification",
        note: "Confirmed PLS. Instructed borrower to notify Unit 214 occupant.",
      },
    ],
  },
  {
    id: "F-004",
    location: "Parking Structure — Level P2",
    description:
      "Concrete spalling on column C-7 with exposed rebar. Spall depth approximately 2\". No active structural movement observed. Area not cordoned off.",
    severity: "medium",
    aiClassification: "PLS",
    aiConfidence: 0.61,
    aiRationale:
      "Exposed rebar in a parking structure column is classified as Potential Life Safety. While current structural capacity likely remains adequate, accelerated corrosion of exposed rebar can reduce column capacity over time. The lack of cordoning increases pedestrian exposure.",
    aiFactors: [
      "Exposed rebar length ~14\" — active corrosion pathway open",
      "Spall depth 2\" — into structural concrete, not just surface",
      "Column C-7 carries load from two bays above",
      "No barrier or protective coating applied",
    ],
    aiRecommendedAction:
      "Engage structural engineer for column evaluation within 30 days. Immediate: cordon 10' radius. Include patch repair in scope-of-work for next draw.",
    status: "overridden",
    isRecurring: true,
    priorFindingNote: "Column C-7 spalling noted in Q3 inspection. Prior classification was DM — reviewer is upgrading.",
    photos: [
      { label: "Column C-7 — spall", url: "#" },
      { label: "Exposed rebar — close-up", url: "#" },
    ],
    actionRequired: "Structural engineer, cordon area",
    activityLog: [
      {
        id: "log-2",
        timestamp: "2025-04-02T09:15:00Z",
        user: "M. Reyes (Lead Inspector)",
        action: "Overrode AI classification: DM → PLS",
        note: "Prior inspection classified as DM. No remediation occurred. Upgrading to PLS given rebar exposure and recurring nature.",
      },
    ],
  },
  {
    id: "F-005",
    location: "Common Area — Lobby, 1st Floor",
    description:
      "Lobby ceiling tile replacement 60% complete. Missing tiles expose mechanical conduit. Paint finish on new drywall not complete. No hazard observed.",
    severity: "low",
    aiClassification: "DM",
    aiConfidence: 0.89,
    aiRationale:
      "Incomplete cosmetic and finish work without structural, mechanical, or safety implications is classified as Deferred Maintenance. Exposed conduit does not present an electrical hazard as no live wiring is exposed. Work stoppage appears weather-related per GC note.",
    aiFactors: [
      "No structural elements affected",
      "Exposed conduit is low-voltage (data/comms) — no electrical risk",
      "GC completion note on file — targeting 2-week completion",
      "No occupant access to affected ceiling zone",
    ],
    aiRecommendedAction:
      "No hold required. Include completion verification in next scheduled inspection. Confirm GC timeline in draw meeting.",
    status: "resolved",
    isRecurring: false,
    photos: [
      { label: "Lobby ceiling — incomplete tiles", url: "#" },
      { label: "Exposed conduit — overview", url: "#" },
    ],
    actionRequired: "Verify completion at next inspection",
    activityLog: [
      {
        id: "log-3",
        timestamp: "2025-04-02T11:30:00Z",
        user: "J. Okafor (Senior Reviewer)",
        action: "Resolved",
        note: "GC confirmed completion by April 10. No draw hold required. Will verify at next site visit.",
      },
    ],
  },
  {
    id: "F-006",
    location: "Unit 308 — Electrical Panel",
    description:
      "Panel cover missing. Live breakers exposed. Double-tapped breakers on circuits 4, 6, and 12. Panel rated 100A but service entry appears to be 150A.",
    severity: "critical",
    aiClassification: "LS",
    aiConfidence: 0.91,
    aiRationale:
      "An open electrical panel with exposed live breakers in an occupied unit meets the Life Safety definition. Double-tapping on multiple circuits creates fire risk under load. The amperage mismatch between service entry and panel rating may cause breaker failure under peak demand.",
    aiFactors: [
      "Panel cover absent — live breakers directly accessible",
      "Unit 308 is occupied — immediate occupant exposure",
      "3 double-tapped circuits — NEC 408.41 violation",
      "Service entry amperage exceeds panel rating by 50A",
    ],
    aiRecommendedAction:
      "Immediate temporary panel cover (safety lock). Licensed electrician inspection within 24 hours. Draw hold on all electrical scope items until remediated and reinspected.",
    status: "escalated",
    isRecurring: false,
    photos: [
      { label: "Panel — cover removed", url: "#" },
      { label: "Double-tap breakers 4, 6, 12", url: "#" },
      { label: "Service entry — amperage label", url: "#" },
    ],
    actionRequired: "Immediate electrician, draw hold on electrical scope",
    activityLog: [
      {
        id: "log-4",
        timestamp: "2025-04-02T16:45:00Z",
        user: "M. Reyes (Lead Inspector)",
        action: "Escalated to Senior Reviewer",
        note: "Escalating due to occupied unit and live exposure. Recommended draw hold on all electrical scope items.",
      },
    ],
  },
];

const classificationConfig: Record<Classification, { label: string; bg: string; text: string; border: string; dot: string }> = {
  ILS: { label: "Imminent Life Safety", bg: "bg-brand-100", text: "text-brand-800", border: "border-brand-300", dot: "bg-brand-500" },
  LS:  { label: "Life Safety",          bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300", dot: "bg-orange-500" },
  PLS: { label: "Potential Life Safety", bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", dot: "bg-amber-500" },
  DM:  { label: "Deferred Maintenance", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", dot: "bg-slate-400" },
};

const severityOrder: Record<Classification, number> = { ILS: 0, LS: 1, PLS: 2, DM: 3 };

const statusConfig: Record<FindingStatus, { label: string; bg: string; text: string }> = {
  pending:        { label: "Pending",         bg: "bg-amber-100",  text: "text-amber-800" },
  accepted:       { label: "Accepted",        bg: "bg-emerald-100", text: "text-emerald-800" },
  overridden:     { label: "Overridden",      bg: "bg-violet-100", text: "text-violet-800" },
  escalated:      { label: "Escalated",       bg: "bg-brand-100",    text: "text-brand-800" },
  needs_evidence: { label: "Needs Evidence",  bg: "bg-blue-100",   text: "text-blue-800" },
  resolved:       { label: "Resolved",        bg: "bg-slate-100",  text: "text-slate-600" },
};

function ClassificationBadge({ code, size = "sm" }: { code: Classification; size?: "xs" | "sm" }) {
  const cfg = classificationConfig[code];
  const px = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${px} ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {code}
    </span>
  );
}

function StatusBadge({ status }: { status: FindingStatus }) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "text-emerald-700" : pct >= 65 ? "text-amber-700" : "text-slate-500";
  return <span className={`text-xs font-semibold ${color}`}>{pct}% confidence</span>;
}

function SummaryHeader({ findings }: { findings: Finding[] }) {
  const total = findings.length;
  const unresolved = findings.filter((f) => f.status !== "resolved").length;
  const aiFlag = findings.filter((f) => ["ILS", "LS"].includes(f.aiClassification) && f.status === "pending").length;
  const pending = findings.filter((f) => f.status === "pending").length;
  const hasILS = findings.some((f) => f.aiClassification === "ILS");
  const hasLS = findings.some((f) => f.aiClassification === "LS");
  const riskLabel = hasILS ? "Critical" : hasLS ? "High" : "Moderate";
  const riskColor = hasILS ? "text-brand-700 bg-brand-50 border-brand-200" : hasLS ? "text-orange-700 bg-orange-50 border-orange-200" : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Inspection Report</p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900">Riverside Commons — Phase II</h2>
            <p className="text-xs text-slate-500">Inspection date: April 1, 2025 &nbsp;·&nbsp; Loan #204 &nbsp;·&nbsp; Reviewer: J. Okafor</p>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${riskColor}`}>
            <span className="h-2 w-2 rounded-full bg-current opacity-60" />
            {riskLabel} Risk
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4">
        {[
          { label: "Total Findings", value: total, color: "text-slate-900" },
          { label: "Unresolved", value: unresolved, color: "text-amber-700" },
          { label: "AI Flagged (ILS/LS)", value: aiFlag, color: "text-brand-700" },
          { label: "Pending Review", value: pending, color: "text-violet-700" },
        ].map((stat) => (
          <div key={stat.label} className="px-5 py-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiNarrativeSummary({ findings }: { findings: Finding[] }) {
  const [open, setOpen] = useState(true);
  const ils = findings.filter((f) => f.aiClassification === "ILS");
  const ls = findings.filter((f) => f.aiClassification === "LS");
  const recurring = findings.filter((f) => f.isRecurring);

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">AI</span>
          <span className="text-sm font-semibold text-violet-900">AI Inspection Summary</span>
        </div>
        <span className="text-xs text-violet-500">{open ? "Collapse ▲" : "Expand ▼"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-violet-200 px-5 py-4 text-sm text-violet-900">
          <p>
            This inspection identified <strong>{findings.length} findings</strong> across{" "}
            <strong>{ils.length} Imminent Life Safety</strong>, <strong>{ls.length} Life Safety</strong>, and{" "}
            <strong>{findings.filter((f) => f.aiClassification === "PLS").length} Potential Life Safety</strong> categories.
          </p>
          {ils.length > 0 && (
            <div className="rounded-lg border border-brand-200 bg-white px-4 py-3">
              <p className="font-semibold text-brand-800">Imminent Life Safety — Immediate Action Required</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-brand-700">
                {ils.map((f) => (
                  <li key={f.id}>{f.location}: {f.description.slice(0, 80)}…</li>
                ))}
              </ul>
            </div>
          )}
          {recurring.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-white px-4 py-3">
              <p className="font-semibold text-amber-800">Recurring Issues ({recurring.length})</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-amber-700">
                {recurring.map((f) => (
                  <li key={f.id}><strong>{f.id}</strong> — {f.location}: previously cited, unresolved</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-violet-600">
            Compared to prior inspection: 2 findings are recurring (F-001, F-004). Overall risk level has increased from <strong>Moderate</strong> to <strong>Critical</strong> due to new ILS finding in Stairwell B.
          </p>
        </div>
      )}
    </div>
  );
}

type FilterType = "all" | Classification | FindingStatus;

function FindingQueue({
  findings,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: {
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: FilterType;
  onFilterChange: (f: FilterType) => void;
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "ILS", value: "ILS" },
    { label: "LS", value: "LS" },
    { label: "PLS", value: "PLS" },
    { label: "DM", value: "DM" },
    { label: "Pending", value: "pending" },
    { label: "Escalated", value: "escalated" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        placeholder="Search findings…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
      <div className="flex flex-wrap gap-1">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onFilterChange(f.value)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
              filter === f.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {findings.length} finding{findings.length !== 1 ? "s" : ""} · sorted by urgency
      </p>
      <div className="space-y-2">
        {findings.map((finding) => {
          const cfg = classificationConfig[finding.aiClassification];
          const isSelected = finding.id === selectedId;
          return (
            <button
              key={finding.id}
              type="button"
              onClick={() => onSelect(finding.id)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                isSelected
                  ? "border-slate-900 bg-slate-900 text-white shadow-md"
                  : `border-slate-200 bg-white hover:border-slate-400 ${cfg.border}`
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
                    <span className={`text-[10px] font-bold uppercase ${isSelected ? "text-white/70" : cfg.text}`}>
                      {cfg.label}
                    </span>
                    {finding.isRecurring && (
                      <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${isSelected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                        RECURRING
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-xs font-semibold leading-snug ${isSelected ? "text-white" : "text-slate-800"}`}>
                    {finding.location}
                  </p>
                  <p className={`mt-0.5 line-clamp-2 text-[10px] leading-snug ${isSelected ? "text-white/60" : "text-slate-500"}`}>
                    {finding.description}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] font-bold ${isSelected ? "text-white/70" : "text-slate-400"}`}>
                    {finding.id}
                  </span>
                  <StatusBadge status={finding.status} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FindingDetail({
  finding,
  onAction,
}: {
  finding: Finding;
  onAction: (id: string, action: string, note?: string, override?: Classification) => void;
}) {
  const [overrideMode, setOverrideMode] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState<Classification>(finding.aiClassification);
  const [noteInput, setNoteInput] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const cfg = classificationConfig[finding.aiClassification];

  const performAction = (action: string, override?: Classification) => {
    onAction(finding.id, action, noteInput || undefined, override);
    setActionFeedback(
      action === "accepted" ? "Classification accepted and logged." :
      action === "overridden" ? `Classification overridden to ${override}.` :
      action === "escalated" ? "Finding escalated to senior reviewer." :
      action === "needs_evidence" ? "More evidence requested." :
      action === "resolved" ? "Finding marked as resolved." :
      "Task created."
    );
    setOverrideMode(false);
    setNoteInput("");
    setTimeout(() => setActionFeedback(null), 3000);
  };

  return (
    <div className="space-y-5">
      <div className={`rounded-xl border-l-4 ${cfg.border} border border-slate-200 bg-white p-5 shadow-sm`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400">{finding.id}</span>
              <ClassificationBadge code={finding.aiClassification} />
              <StatusBadge status={finding.status} />
              {finding.isRecurring && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  RECURRING ISSUE
                </span>
              )}
            </div>
            <h3 className="mt-2 text-base font-semibold text-slate-900">{finding.location}</h3>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
            finding.severity === "critical" ? "bg-brand-100 text-brand-700" :
            finding.severity === "high" ? "bg-orange-100 text-orange-700" :
            finding.severity === "medium" ? "bg-amber-100 text-amber-700" :
            "bg-slate-100 text-slate-600"
          }`}>
            {finding.severity} severity
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-700 leading-relaxed">{finding.description}</p>

        {finding.isRecurring && finding.priorFindingNote && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <strong>Prior Finding:</strong> {finding.priorFindingNote}
          </div>
        )}

        {finding.photos.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Evidence / Photos</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {finding.photos.map((photo) => (
                <a
                  key={photo.label}
                  href={photo.url}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-white transition"
                >
                  <span>📷</span> {photo.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white">AI</span>
          <p className="text-sm font-semibold text-violet-900">AI Classification & Rationale</p>
          <ConfidencePill value={finding.aiConfidence} />
        </div>
        <div className="mb-3 flex items-center gap-2">
          <ClassificationBadge code={finding.aiClassification} />
          <span className="text-xs text-violet-700">{classificationConfig[finding.aiClassification].label}</span>
        </div>
        <p className="text-sm text-violet-900 leading-relaxed">{finding.aiRationale}</p>
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Factors Considered</p>
          <ul className="mt-2 space-y-1.5">
            {finding.aiFactors.map((factor, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-violet-800">
                <span className="mt-0.5 text-violet-400">→</span>
                {factor}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 rounded-lg border border-violet-300 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">AI Recommended Action</p>
          <p className="mt-1 text-sm text-slate-800">{finding.aiRecommendedAction}</p>
        </div>
      </div>

      {actionFeedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          ✓ {actionFeedback}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-800">Reviewer Decision</p>

        <div className="mb-3">
          <textarea
            placeholder="Add a note (optional)…"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
          />
        </div>

        {overrideMode ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-700">Select override classification:</p>
            <div className="flex flex-wrap gap-2">
              {(["ILS", "LS", "PLS", "DM"] as Classification[]).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelectedOverride(cls)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    selectedOverride === cls
                      ? `${classificationConfig[cls].bg} ${classificationConfig[cls].text} ${classificationConfig[cls].border} border`
                      : "border-slate-200 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {cls} — {classificationConfig[cls].label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => performAction("overridden", selectedOverride)}
                className="rounded-lg bg-violet-700 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800 transition"
              >
                Confirm Override
              </button>
              <button
                type="button"
                onClick={() => setOverrideMode(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => performAction("accepted")}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
            >
              Accept AI Classification
            </button>
            <button
              type="button"
              onClick={() => setOverrideMode(true)}
              className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100 transition"
            >
              Override
            </button>
            <button
              type="button"
              onClick={() => performAction("escalated")}
              className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition"
            >
              Escalate
            </button>
            <button
              type="button"
              onClick={() => performAction("needs_evidence")}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition"
            >
              Request Evidence
            </button>
            <button
              type="button"
              onClick={() => performAction("resolved")}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
            >
              Resolve
            </button>
            <button
              type="button"
              onClick={() => performAction("task_created")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Create Follow-up Task
            </button>
          </div>
        )}
      </div>

      {finding.activityLog.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Activity Log</p>
          <div className="space-y-3">
            {finding.activityLog.map((entry) => (
              <div key={entry.id} className="flex gap-3 text-sm">
                <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-slate-300" />
                <div>
                  <p className="text-xs text-slate-500">
                    {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    &nbsp;·&nbsp;<strong className="text-slate-700">{entry.user}</strong>
                  </p>
                  <p className="text-sm font-medium text-slate-800">{entry.action}</p>
                  {entry.note && <p className="text-xs text-slate-500 mt-0.5">{entry.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ServicingInspectionsPage() {
  const [findings, setFindings] = useState<Finding[]>(MOCK_FINDINGS);
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_FINDINGS[0]?.id ?? null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const filteredFindings = useMemo(() => {
    let list = [...findings].sort((a, b) => severityOrder[a.aiClassification] - severityOrder[b.aiClassification]);
    if (filter !== "all") {
      list = list.filter(
        (f) =>
          f.aiClassification === filter ||
          f.status === filter
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.location.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [findings, filter, search]);

  const selectedFinding = useMemo(
    () => filteredFindings.find((f) => f.id === selectedId) ?? filteredFindings[0] ?? null,
    [filteredFindings, selectedId]
  );

  const handleAction = useCallback(
    (id: string, action: string, note?: string, override?: Classification) => {
      setFindings((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const newStatus: FindingStatus =
            action === "accepted" ? "accepted" :
            action === "overridden" ? "overridden" :
            action === "escalated" ? "escalated" :
            action === "needs_evidence" ? "needs_evidence" :
            action === "resolved" ? "resolved" :
            f.status;

          const logEntry: ActivityEntry = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            user: "J. Okafor (Senior Reviewer)",
            action:
              action === "accepted" ? "Accepted AI classification" :
              action === "overridden" ? `Overrode classification to ${override}` :
              action === "escalated" ? "Escalated to senior reviewer" :
              action === "needs_evidence" ? "Requested additional evidence" :
              action === "resolved" ? "Marked as resolved" :
              "Created follow-up task",
            note: note || undefined,
          };

          return {
            ...f,
            status: newStatus,
            humanOverride: action === "overridden" ? override : f.humanOverride,
            activityLog: [...f.activityLog, logEntry],
          };
        })
      );
    },
    []
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Inspection Review Workstation</h2>
        <p className="text-sm text-slate-500">
          AI-native inspection workflow — classify findings, override, escalate, and log decisions.
        </p>
      </div>

      <SummaryHeader findings={findings} />
      <AiNarrativeSummary findings={findings} />

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <FindingQueue
            findings={filteredFindings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
          />
        </aside>

        <main>
          {selectedFinding ? (
            <FindingDetail finding={selectedFinding} onAction={handleAction} />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
              Select a finding to review.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
