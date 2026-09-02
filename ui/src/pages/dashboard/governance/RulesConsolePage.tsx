/**
 * Rules & Policy Engine Console
 *
 * Admin-facing UI for creating, reviewing, approving, and managing
 * policy rules that enforce business logic across all portals without
 * code changes. Rules are evaluated server-side via /api/rules/evaluate.
 */

import { useCallback, useEffect, useState } from "react";
import { request } from "../../../lib/http";

// ── Types ──────────────────────────────────────────────────────
type RuleStatus = "draft" | "pending_review" | "approved" | "published" | "archived" | "emergency";
type Severity = "critical" | "high" | "medium" | "low" | "info";
type Category =
  | "servicing"
  | "compliance"
  | "tokenization"
  | "governance"
  | "investor_eligibility"
  | "document_requirements"
  | "jurisdiction";
type ConditionOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "contains" | "exists";
type ActionType = "block" | "require_approval" | "notify" | "flag" | "warn" | "allow";

interface Condition {
  field: string;
  operator: ConditionOp;
  value: string;
}
interface Action {
  type: ActionType;
  message?: string;
  approver_role?: string;
  label?: string;
  recipients?: string;
  rule_name?: string;
}

interface Rule {
  id: string;
  name: string;
  description?: string;
  category: Category;
  rule_key: string;
  jurisdictions: string[];
  loan_types: string[];
  token_types: string[];
  workflow_stages: string[];
  conditions: Condition[];
  condition_logic: "AND" | "OR";
  actions: Action[];
  severity: Severity;
  source_reference?: string;
  effective_date: string;
  end_date?: string;
  status: RuleStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  event_type: string;
  rule_id?: string;
  rule_version?: number;
  actor_id?: string;
  context?: Record<string, unknown>;
  result?: Record<string, unknown>;
  portal?: string;
  created_at: string;
}

interface Approval {
  id: string;
  rule_id: string;
  rule_version: number;
  submitted_at: string;
  policy_rules: Rule;
}

interface SimResult {
  simulated: boolean;
  allowed: boolean;
  blocked: boolean;
  matched_rules: Array<{ id: string; name: string; version: number; severity: Severity }>;
  actions: Action[];
}

// ── Constants ──────────────────────────────────────────────────
const CATEGORIES: { value: Category; label: string }[] = [
  { value: "servicing", label: "Servicing" },
  { value: "compliance", label: "Compliance" },
  { value: "tokenization", label: "Tokenization" },
  { value: "governance", label: "Governance" },
  { value: "investor_eligibility", label: "Investor Eligibility" },
  { value: "document_requirements", label: "Document Requirements" },
  { value: "jurisdiction", label: "Jurisdiction" },
];

const SEVERITIES: { value: Severity; label: string; color: string }[] = [
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "low", label: "Low", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "info", label: "Info", color: "bg-slate-100 text-slate-500 border-slate-300" },
];

const STATUS_STYLES: Record<RuleStatus, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-300",
  pending_review: "bg-amber-100 text-amber-700 border-amber-300",
  approved: "bg-blue-100 text-blue-700 border-blue-300",
  published: "bg-emerald-100 text-emerald-700 border-emerald-300",
  archived: "bg-slate-100 text-slate-400 border-slate-200",
  emergency: "bg-red-100 text-red-700 border-red-300",
};

const STATUS_LABELS: Record<RuleStatus, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Approved",
  published: "Live",
  archived: "Archived",
  emergency: "⚡ Emergency",
};

const CONDITION_OPS: { value: ConditionOp; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "ne", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "≥ (at least)" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "≤ (at most)" },
  { value: "in", label: "is one of" },
  { value: "nin", label: "is not one of" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "exists" },
];

const ACTION_TYPES: { value: ActionType; label: string; desc: string }[] = [
  { value: "block", label: "Block", desc: "Deny the operation" },
  { value: "require_approval", label: "Require Approval", desc: "Escalate to reviewer" },
  { value: "warn", label: "Warn", desc: "Alert but allow" },
  { value: "notify", label: "Notify", desc: "Send notification" },
  { value: "flag", label: "Flag", desc: "Tag the record" },
  { value: "allow", label: "Allow", desc: "Explicit whitelist" },
];

// ── Small UI primitives ────────────────────────────────────────
function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      {children}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITIES.find((x) => x.value === severity);
  return <Badge className={s?.color ?? ""}>{s?.label ?? severity}</Badge>;
}

function StatusBadge({ status }: { status: RuleStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status] ?? status}</Badge>;
}

function Inp({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500 ${className}`}
      {...props}
    />
  );
}

function Sel({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-red-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// ── Rule Editor Modal ──────────────────────────────────────────
function RuleEditorModal({ rule, onClose, onSaved }: { rule?: Rule | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [category, setCategory] = useState<Category>(rule?.category ?? "servicing");
  const [severity, setSeverity] = useState<Severity>(rule?.severity ?? "medium");
  const [sourceRef, setSourceRef] = useState(rule?.source_reference ?? "");
  const [conditionLogic, setConditionLogic] = useState<"AND" | "OR">(rule?.condition_logic ?? "AND");
  const [conditions, setConditions] = useState<Condition[]>(
    rule?.conditions?.length ? rule.conditions : [{ field: "", operator: "eq", value: "" }]
  );
  const [actions, setActions] = useState<Action[]>(
    rule?.actions?.length ? rule.actions : [{ type: "block", message: "" }]
  );
  const [jurisdictions, setJurisdictions] = useState((rule?.jurisdictions ?? []).join(", "));
  const [loanTypes, setLoanTypes] = useState((rule?.loan_types ?? []).join(", "));
  const [workflowStages, setWorkflowStages] = useState((rule?.workflow_stages ?? []).join(", "));
  const [effectiveDate, setEffectiveDate] = useState(
    rule?.effective_date ? rule.effective_date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ruleKey = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const addCondition = () => setConditions((c) => [...c, { field: "", operator: "eq", value: "" }]);
  const removeCondition = (i: number) => setConditions((c) => c.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, patch: Partial<Condition>) =>
    setConditions((c) => c.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const addAction = () => setActions((a) => [...a, { type: "block", message: "" }]);
  const removeAction = (i: number) => setActions((a) => a.filter((_, idx) => idx !== i));
  const updateAction = (i: number, patch: Partial<Action>) =>
    setActions((a) => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const save = async () => {
    if (!name || !category) {
      setErr("Name and category are required");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const body = {
        name,
        description,
        category,
        rule_key: ruleKey,
        severity,
        source_reference: sourceRef,
        condition_logic: conditionLogic,
        conditions: conditions.filter((c) => c.field),
        actions: actions.filter((a) => a.type),
        jurisdictions: jurisdictions
          ? jurisdictions
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        loan_types: loanTypes
          ? loanTypes
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        workflow_stages: workflowStages
          ? workflowStages
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        effective_date: new Date(effectiveDate).toISOString(),
        change_note: changeNote || undefined,
      };

      if (rule) {
        await request("PUT", `/api/rules/${rule.id}`, body);
      } else {
        await request("POST", `/api/rules`, body);
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Save failed";
      setErr(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm px-4 py-8">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{rule ? "Edit Rule" : "Create New Rule"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Rule Name *</label>
              <Inp value={name} onChange={(e) => setName(e.target.value)} placeholder="Maximum LTV for Bridge Loans" />
              {name && (
                <p className="text-xs text-slate-400 mt-1">
                  key: <code className="font-mono text-slate-600">{ruleKey}</code>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Category *</label>
              <Sel value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Sel>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Severity</label>
              <Sel value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Sel>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Description</label>
              <Inp
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When does this rule apply and why?"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Source / Regulation Reference</label>
              <Inp
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                placeholder="12 CFR 1024.17, Dodd-Frank §1026…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Effective Date</label>
              <Inp type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
          </div>

          {/* Scope */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Scope (leave blank = applies to all)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Jurisdictions</label>
                <Inp
                  value={jurisdictions}
                  onChange={(e) => setJurisdictions(e.target.value)}
                  placeholder="US-CA, US-TX, GLOBAL"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Loan Types</label>
                <Inp
                  value={loanTypes}
                  onChange={(e) => setLoanTypes(e.target.value)}
                  placeholder="bridge, cre, multifamily"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Workflow Stages</label>
                <Inp
                  value={workflowStages}
                  onChange={(e) => setWorkflowStages(e.target.value)}
                  placeholder="origination, servicing"
                />
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Conditions (IF)</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">Logic:</span>
                <Sel
                  value={conditionLogic}
                  onChange={(e) => setConditionLogic(e.target.value as "AND" | "OR")}
                  className="!w-auto px-2 py-1 text-xs"
                >
                  <option value="AND">AND — all must match</option>
                  <option value="OR">OR — any must match</option>
                </Sel>
                <button
                  onClick={addCondition}
                  className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded"
                >
                  + Add Condition
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                  <Inp
                    className="flex-1 !w-auto"
                    placeholder="loan.ltv_ratio"
                    value={c.field}
                    onChange={(e) => updateCondition(i, { field: e.target.value })}
                  />
                  <Sel
                    className="!w-36"
                    value={c.operator}
                    onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionOp })}
                  >
                    {CONDITION_OPS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Sel>
                  <Inp
                    className="flex-1 !w-auto"
                    placeholder="0.80"
                    value={c.value}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                  />
                  <button onClick={() => removeCondition(i)} className="text-slate-400 hover:text-red-500 text-lg leading-none shrink-0">
                    ×
                  </button>
                </div>
              ))}
              {conditions.length === 0 && (
                <p className="text-xs text-slate-400 italic px-1">No conditions — rule fires unconditionally</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Actions (THEN)</p>
              <button
                onClick={addAction}
                className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded"
              >
                + Add Action
              </button>
            </div>
            <div className="space-y-2">
              {actions.map((a, i) => (
                <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sel
                      className="!w-56"
                      value={a.type}
                      onChange={(e) => updateAction(i, { type: e.target.value as ActionType })}
                    >
                      {ACTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label} — {t.desc}
                        </option>
                      ))}
                    </Sel>
                    <button onClick={() => removeAction(i)} className="text-slate-400 hover:text-red-500 text-lg leading-none ml-auto shrink-0">
                      ×
                    </button>
                  </div>
                  {(a.type === "block" || a.type === "warn") && (
                    <Inp
                      placeholder="Message shown to user…"
                      value={a.message ?? ""}
                      onChange={(e) => updateAction(i, { message: e.target.value })}
                    />
                  )}
                  {a.type === "notify" && (
                    <Inp
                      placeholder="Recipients: servicer, lender_admin, borrower…"
                      value={a.recipients ?? ""}
                      onChange={(e) => updateAction(i, { recipients: e.target.value })}
                    />
                  )}
                  {a.type === "require_approval" && (
                    <Sel
                      value={a.approver_role ?? "lender_admin"}
                      onChange={(e) => updateAction(i, { approver_role: e.target.value })}
                    >
                      <option value="lender_admin">Lender Admin</option>
                      <option value="platform_admin">Platform Admin</option>
                      <option value="asset_manager">Asset Manager</option>
                    </Sel>
                  )}
                  {a.type === "flag" && (
                    <Inp
                      placeholder="Flag label (e.g. HIGH_RISK_LTV)"
                      value={a.label ?? ""}
                      onChange={(e) => updateAction(i, { label: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {rule && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Change Note (optional)</label>
              <Inp
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="What changed and why? (saved in version history)"
              />
            </div>
          )}

          {err && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-700 hover:bg-red-600 text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : rule ? "Save Changes" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Simulation Panel ───────────────────────────────────────────
function SimulatorPanel() {
  const [contextJson, setContextJson] = useState(
    '{\n  "loan": {\n    "ltv_ratio": 0.85,\n    "type": "bridge",\n    "amount": 5000000\n  },\n  "borrower": {\n    "credit_score": 680\n  }\n}'
  );
  const [category, setCategory] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setErr(null);
    setResult(null);
    try {
      let context: unknown;
      try {
        context = JSON.parse(contextJson);
      } catch {
        throw new Error("Invalid JSON in context");
      }
      const body: Record<string, unknown> = { context };
      if (category) body.category = category;
      if (ruleId) body.rule_id = ruleId;
      const res = await request<SimResult>("POST", "/api/rules/simulate", body);
      setResult(res);
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message ?? "Simulation failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Context JSON — the data to evaluate rules against
          </label>
          <textarea
            value={contextJson}
            onChange={(e) => setContextJson(e.target.value)}
            rows={12}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-emerald-300 font-mono placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Filter Category</label>
            <Sel value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Sel>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Specific Rule ID</label>
            <Inp value={ruleId} onChange={(e) => setRuleId(e.target.value)} placeholder="UUID (optional)" />
          </div>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="w-full py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {running ? "Running…" : "▶  Run Simulation"}
        </button>
        {err && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Result</label>
        {result ? (
          <div className="space-y-3">
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                result.blocked
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              <span className="text-2xl">{result.blocked ? "🚫" : "✅"}</span>
              <div>
                <p className="font-semibold text-sm">{result.blocked ? "BLOCKED" : "ALLOWED"}</p>
                <p className="text-xs opacity-70">{result.matched_rules?.length ?? 0} rules matched</p>
              </div>
            </div>

            {(result.matched_rules ?? []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Matched Rules</p>
                <div className="space-y-1.5">
                  {result.matched_rules.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-xs border border-slate-200">
                      <SeverityBadge severity={r.severity} />
                      <span className="text-slate-700 flex-1 font-medium">{r.name}</span>
                      <span className="text-slate-400">v{r.version}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(result.actions ?? []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Actions Triggered</p>
                <div className="space-y-1.5">
                  {result.actions.map((a, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-xs border border-slate-200">
                      <span
                        className={`font-mono font-bold ${
                          a.type === "block"
                            ? "text-red-600"
                            : a.type === "warn"
                            ? "text-amber-600"
                            : "text-slate-600"
                        }`}
                      >
                        {a.type.toUpperCase()}
                      </span>
                      {a.message && <span className="text-slate-500 ml-2">— {a.message}</span>}
                      {a.label && <span className="text-slate-500 ml-2">— {a.label}</span>}
                      {a.rule_name && <span className="text-slate-400 ml-2 text-xs">({a.rule_name})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Raw Response</p>
              <pre className="bg-slate-900 text-emerald-300 rounded-lg p-3 text-xs overflow-auto max-h-40 font-mono">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="h-64 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
            <p className="text-slate-400 text-sm">Run a simulation to see results</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
const TABS = ["Rules", "Pending Approval", "Audit Log", "Simulator"] as const;
type Tab = (typeof TABS)[number];

export default function RulesConsolePage() {
  const [activeTab, setActiveTab] = useState<Tab>("Rules");

  // Rules list
  const [rules, setRules] = useState<Rule[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRules, setLoadingRules] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editingRule, setEditingRule] = useState<Rule | null | undefined>(undefined); // undefined=closed, null=new

  // Approval queue
  const [pending, setPending] = useState<Approval[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [approvalAction, setApprovalAction] = useState<{ ruleId: string; approvalId: string; action: "approve" | "reject" } | null>(null);
  const [approvalNote, setApprovalNote] = useState("");

  // Audit log
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Action state
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const d = await request<{ rules: Rule[]; total: number }>("GET", `/api/rules?${params}`);
      setRules(d.rules ?? []);
      setTotal(d.total ?? 0);
    } catch {
      setRules([]);
    } finally {
      setLoadingRules(false);
    }
  }, [categoryFilter, statusFilter, search]);

  const loadPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const d = await request<Approval[]>("GET", "/api/rules/pending");
      setPending(d ?? []);
    } catch {
      setPending([]);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const d = await request<{ entries: AuditEntry[] }>("GET", "/api/rules/audit?limit=100");
      setAuditLog(d.entries ?? []);
    } catch {
      setAuditLog([]);
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);
  useEffect(() => {
    if (activeTab === "Pending Approval") loadPending();
  }, [activeTab, loadPending]);
  useEffect(() => {
    if (activeTab === "Audit Log") loadAudit();
  }, [activeTab, loadAudit]);

  const ruleAction = async (ruleId: string, action: string, body?: Record<string, unknown>) => {
    const key = ruleId + action;
    setActioning(key);
    setActionErr(null);
    try {
      await request("POST", `/api/rules/${ruleId}/${action}`, body);
      await loadRules();
      await loadPending();
    } catch (e: unknown) {
      setActionErr((e as { message?: string })?.message ?? "Action failed");
    } finally {
      setActioning(null);
    }
  };

  const stats = {
    total: rules.length,
    live: rules.filter((r) => r.status === "published" || r.status === "emergency").length,
    pending: rules.filter((r) => r.status === "pending_review").length,
    draft: rules.filter((r) => r.status === "draft").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Rules & Policy Engine</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configure operating logic without code changes. All rules are enforced server-side across every portal
            and workflow stage.
          </p>
        </div>
        <button
          onClick={() => setEditingRule(null)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium shadow-sm"
        >
          + New Rule
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Rules", value: stats.total, color: "text-slate-700" },
          { label: "Live / Active", value: stats.live, color: "text-emerald-600" },
          { label: "Pending Review", value: stats.pending, color: "text-amber-600" },
          { label: "Draft", value: stats.draft, color: "text-slate-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-400 font-medium">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? "rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white"
                : "rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
            }
          >
            {tab}
            {tab === "Pending Approval" && pending.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-amber-500 text-white text-xs rounded-full">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {actionErr && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{actionErr}</div>
      )}

      {/* ── RULES TAB ─────────────────────────────────────────── */}
      {activeTab === "Rules" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search rules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            >
              <option value="">All Status</option>
              {(["draft", "pending_review", "approved", "published", "archived", "emergency"] as RuleStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {loadingRules ? (
              <div className="py-16 text-center text-slate-400 text-sm animate-pulse">Loading rules…</div>
            ) : rules.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-slate-500 font-medium">No rules found</p>
                <p className="text-slate-400 text-sm mt-1">
                  {categoryFilter || statusFilter || search
                    ? "Try adjusting your filters"
                    : "Get started by creating your first policy rule"}
                </p>
                {!categoryFilter && !statusFilter && !search && (
                  <button
                    onClick={() => setEditingRule(null)}
                    className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg"
                  >
                    + Create First Rule
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60">
                  <tr>
                    {["Rule", "Category", "Severity", "Status", "Version", "Effective Date", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 truncate max-w-48">{rule.name}</p>
                        {rule.source_reference && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-48">{rule.source_reference}</p>
                        )}
                        {rule.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-48">{rule.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                          {CATEGORIES.find((c) => c.value === rule.category)?.label ?? rule.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={rule.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={rule.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">v{rule.version}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {rule.effective_date
                          ? new Date(rule.effective_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rule.status === "draft" && (
                            <>
                              <button
                                onClick={() => setEditingRule(rule)}
                                className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-100 text-slate-600"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => ruleAction(rule.id, "submit")}
                                disabled={actioning === rule.id + "submit"}
                                className="text-xs px-2 py-1 border border-amber-200 rounded hover:bg-amber-50 text-amber-700 disabled:opacity-50"
                              >
                                Submit for Review
                              </button>
                            </>
                          )}
                          {rule.status === "approved" && (
                            <button
                              onClick={() => ruleAction(rule.id, "publish")}
                              disabled={actioning === rule.id + "publish"}
                              className="text-xs px-2 py-1 border border-emerald-300 rounded hover:bg-emerald-50 text-emerald-700 disabled:opacity-50"
                            >
                              Publish
                            </button>
                          )}
                          {(rule.status === "published" || rule.status === "emergency") && (
                            <button
                              onClick={() => ruleAction(rule.id, "archive")}
                              disabled={actioning === rule.id + "archive"}
                              className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-50"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-xs text-slate-400 text-right">
            {total} total rule{total !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* ── PENDING APPROVAL TAB ──────────────────────────────── */}
      {activeTab === "Pending Approval" && (
        <div className="space-y-3">
          {loadingPending ? (
            <div className="py-16 text-center text-slate-400 text-sm animate-pulse">Loading queue…</div>
          ) : pending.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl py-20 text-center shadow-sm">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-slate-500 font-medium">Approval queue is empty</p>
              <p className="text-slate-400 text-sm mt-1">All rules have been reviewed</p>
            </div>
          ) : (
            pending.map((item) => {
              const rule = item.policy_rules;
              const isActing = approvalAction?.approvalId === item.id;
              return (
                <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-slate-900">{rule?.name}</p>
                        <SeverityBadge severity={rule?.severity ?? "medium"} />
                        <span className="text-xs text-slate-400 font-mono">v{item.rule_version}</span>
                        {rule?.category && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {CATEGORIES.find((c) => c.value === rule.category)?.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{rule?.description ?? "No description provided"}</p>
                      {rule?.source_reference && (
                        <p className="text-xs text-slate-400 mt-1">Ref: {rule.source_reference}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        Submitted{" "}
                        {new Date(item.submitted_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setApprovalAction({ ruleId: rule.id, approvalId: item.id, action: "approve" });
                          setApprovalNote("");
                        }}
                        className="px-3 py-1.5 text-sm border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 font-medium"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => {
                          setApprovalAction({ ruleId: rule.id, approvalId: item.id, action: "reject" });
                          setApprovalNote("");
                        }}
                        className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>

                  {isActing && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                      <input
                        type="text"
                        placeholder={
                          approvalAction?.action === "reject"
                            ? "Rejection reason (required for audit trail)…"
                            : "Approval note (optional)…"
                        }
                        value={approvalNote}
                        onChange={(e) => setApprovalNote(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setApprovalAction(null)}
                          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            await ruleAction(rule.id, approvalAction!.action, { note: approvalNote });
                            setApprovalAction(null);
                          }}
                          className={`px-4 py-1.5 text-sm rounded-lg text-white font-medium ${
                            approvalAction?.action === "approve"
                              ? "bg-emerald-600 hover:bg-emerald-500"
                              : "bg-red-600 hover:bg-red-500"
                          }`}
                        >
                          Confirm {approvalAction?.action === "approve" ? "Approval" : "Rejection"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── AUDIT LOG TAB ─────────────────────────────────────── */}
      {activeTab === "Audit Log" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {loadingAudit ? (
            <div className="py-16 text-center text-slate-400 text-sm animate-pulse">Loading audit log…</div>
          ) : auditLog.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-4xl mb-3">📜</div>
              <p className="text-slate-500 font-medium">No audit entries yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  {["Event", "Rule ID", "Version", "Portal", "Timestamp"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-mono font-semibold ${
                          entry.event_type.includes("block") ||
                          entry.event_type.includes("emergency") ||
                          entry.event_type.includes("reject")
                            ? "text-red-600"
                            : entry.event_type.includes("publish") || entry.event_type.includes("approve")
                            ? "text-emerald-600"
                            : entry.event_type.includes("submit")
                            ? "text-amber-600"
                            : "text-slate-600"
                        }`}
                      >
                        {entry.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                      {entry.rule_id ? entry.rule_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                      {entry.rule_version ? `v${entry.rule_version}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{entry.portal ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(entry.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── SIMULATOR TAB ─────────────────────────────────────── */}
      {activeTab === "Simulator" && <SimulatorPanel />}

      {/* Rule Editor Modal */}
      {editingRule !== undefined && (
        <RuleEditorModal rule={editingRule} onClose={() => setEditingRule(undefined)} onSaved={loadRules} />
      )}
    </div>
  );
}
