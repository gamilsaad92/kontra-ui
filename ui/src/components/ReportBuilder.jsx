import React, { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { API_BASE } from "../lib/apiBase";
import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Select, Textarea } from "./ui";
import { kontraTheme, cx } from "../theme/kontraTheme";
import { useAiReportAgent } from "../hooks/useAiReportAgent";

const AI_STEPS = ["Proposal", "Review", "Run"];
const API_BASE_URL = API_BASE;

function Stepper({ currentStep }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="AI flow steps">
      {AI_STEPS.map((step, index) => (
        <span
          key={step}
          className={cx(
            "rounded-full px-3 py-1 text-xs font-semibold",
            index === currentStep
              ? "bg-red-600 text-white"
              : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          )}
        >
          {step}
        </span>
      ))}
    </div>
  );
}

function buildCsv(rows) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const escapeValue = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const header = columns.join(",");
  const body = rows
    .map((row) => columns.map((col) => escapeValue(row[col])).join(","))
    .join("\n");
  return [header, body].join("\n");
}

export default function ReportBuilder() {
 const [name, setName] = useState("");
  const [table, setTable] = useState("");
  const [available, setAvailable] = useState([]);
 const [selectedFields, setSelectedFields] = useState([]);
  const [jsonSpecText, setJsonSpecText] = useState("{}");
  const [groupBy, setGroupBy] = useState("");
  const [viz, setViz] = useState("table");
  const [rows, setRows] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [schedule, setSchedule] = useState("daily");
  const [saved, setSaved] = useState([]);
  const [jsonError, setJsonError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const aiAgent = useAiReportAgent(API_BASE);
  const builderRef = useRef(null);

  useEffect(() => {
    if (!table) return;
    fetch(`${API_BASE}/api/reports/fields?table=${table}`)
       .then((res) => res.json())
      .then((data) => setAvailable(data.fields || []))
      .catch(() => setAvailable([]));
  }, [table]);

  useEffect(() => {
    fetch(`${API_BASE}/api/reports/saved`)
      .then(res => res.json())
      .then(data => setSaved(data.reports || []));
  }, [message]);

  useEffect(() => {
    if (aiAgent.state.status !== "applied") return;
    builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const timer = setTimeout(() => {
      aiAgent.clearApplied();
    }, 2500);
    return () => clearTimeout(timer);
  }, [aiAgent.clearApplied, aiAgent.state.status]);

  const isPromptValid = aiAgent.state.description.trim().length >= 8;
  const aiDisabled = aiAgent.state.status === "loading";
  const proposal = aiAgent.state.proposal;
  const proposalSpec = proposal?.spec || null;
  const warnings = proposal?.warnings || [];

  const currentStep = useMemo(() => {
    if (aiAgent.state.status === "applied") return 2;
    if (proposal) return 1;
    return 0;
  }, [aiAgent.state.status, proposal]);

  const proposedFields = useMemo(() => {
    if (!proposalSpec?.fields) return [];
    if (Array.isArray(proposalSpec.fields)) return proposalSpec.fields;
    if (typeof proposalSpec.fields === "string") {
      return proposalSpec.fields.split(",").map((field) => field.trim()).filter(Boolean);
    }
    return [];
  }, [proposalSpec]);

  const parseFilters = () => {
    try {
      const parsed = JSON.parse(jsonSpecText || "{}");
      setJsonError("");
      return parsed;
    } catch (err) {
      setJsonError("Report spec must be valid JSON.");
      return null;
    }
  };

  const handleValidateJson = () => {
    const parsed = parseFilters();
    if (parsed) {
      setMessage("Report spec JSON is valid.");
    }
  };

  const validateBuilderInputs = ({ requireName = false, requireEmail = false } = {}) => {
    const errors = {};
    if (!table) errors.table = "Select a table to run a report.";
  if (!selectedFields.length) errors.fields = "Pick at least one field.";
    if (requireName && !name) errors.name = "Add a report name before saving.";
    if (requireEmail && !email) errors.email = "Enter an email for scheduling.";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

   const runReport = async () => {
    setIsRunning(true);
    setMessage("");
    setError("");

    try {
       // Build spec safely from current UI state
      const spec = {
        spec_version: 1,
        table: table?.trim() || "",
        select: Array.isArray(selectedFields) ? selectedFields : [],
        groupBy: groupBy?.trim() ? [groupBy.trim()] : [],
        ...(() => {
          // JSON editor content is optional; merge only if valid
          if (!jsonSpecText?.trim()) return {};
          try {
            const parsed = JSON.parse(jsonSpecText);
            return parsed && typeof parsed === "object" ? parsed : {};
          } catch {
            throw new Error("Invalid JSON in Report Spec editor.");
          }
        })(),
      };

      if (!spec.table) throw new Error("Table is required.");
      if (!spec.select?.length) throw new Error("Select at least 1 field.");

      const res = await fetch(`${API_BASE_URL}/api/reports/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
       });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Report run failed.");

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMessage(`Report ran in ${data.durationMs ?? "?"}ms`);
    } catch (err) {
     setRows([]);
      setError(err?.message || "Unexpected error running report.");
    } finally {
      setIsRunning(false);
    }
  };

  const runAiReport = async () => {
    if (!proposal?.spec) return;
    try {
       const selectedHooks = Object.entries(aiAgent.state.hooks)
        .filter(([, enabled]) => enabled)
        .map(([action_type]) => action_type);
      const res = await fetch(`${API_BASE}/api/reports/ai/run`, {
          method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
             spec: proposal.spec,
          approved: aiAgent.state.approval,
          explanation: proposal.explanation,
          confidence: proposal.confidence,
          include_executive_summary: aiAgent.state.includeSummary,
          selectedAutomationHooks: selectedHooks,
        }),
      });
       const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "Failed to run AI report");
        return;
      }
      setRows(data.rows || []);
        setMessage(`AI report ran in ${data.durationMs ?? "?"}ms`);
    } catch (err) {
       setMessage("Failed to run AI report");
    }
  };

  const saveAiReport = async () => {
    if (!proposal?.spec) return;
    if (!validateBuilderInputs({ requireName: true })) return;
    try {
      const res = await fetch(`${API_BASE}/api/reports/ai/save`, {
         method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
         spec: proposal.spec,
          approved: aiAgent.state.approval,
          explanation: proposal.explanation,
          confidence: proposal.confidence,
        }),
      });
     if (res.ok) setMessage("AI report saved");
      else {
        const data = await res.json();
          setMessage(data.message || "Failed to save AI report");
      }
    } catch {
     setMessage("Failed to save AI report");
    }
  };

  const save = async () => {
       if (!validateBuilderInputs({ requireName: true })) return;
    const parsedFilters = parseFilters();
    if (!parsedFilters) return;
    try {
      const res = await fetch(`${API_BASE}/api/reports/save`, {
         method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          table,
           fields: selectedFields.join(","),
          filters: parsedFilters,
          groupBy,
        }),
      });
     if (res.ok) setMessage("Saved");
      else setMessage("Failed to save");
    } catch {
      setMessage("Failed to save");
    }
  };

  const scheduleReport = async () => {
        if (!validateBuilderInputs({ requireEmail: true })) return;
    const parsedFilters = parseFilters();
    if (!parsedFilters) return;
    try {
      const res = await fetch(`${API_BASE}/api/reports/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
        schedule,
          table,
            fields: selectedFields.join(","),
          filters: parsedFilters,
        }),
      });
       if (res.ok) setMessage("Scheduled");
      else setMessage("Failed to schedule");
    } catch {
      setMessage("Failed to schedule");
    }
  };

  const sendTestEmail = async () => {
    setMessage("Test email queued.");
  };

  const handleApplyProposal = () => {
    if (!proposalSpec) return;
    setTable(proposalSpec.table || "");
     setSelectedFields(proposedFields);
    setGroupBy(proposalSpec.groupBy || "");
    setJsonSpecText(JSON.stringify(proposalSpec.filters || {}, null, 2));
    aiAgent.markApplied();
  };

  const handleExportCsv = () => {
    if (!rows.length) return;
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name || "report"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
      setMessage("Results copied to clipboard.");
    } catch (err) {
      setMessage("Unable to copy results.");
    }
  };

  const onDragStart = (field) => (e) => {
    e.dataTransfer.setData("text/plain", field);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const field = e.dataTransfer.getData("text/plain");
   if (field && !selectedFields.includes(field)) {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const removeField = (fieldToRemove) => {
    setSelectedFields(selectedFields.filter((field) => field !== fieldToRemove));
  };

  const resultsColumns = rows.length ? Object.keys(rows[0]) : [];

  return (
      <div className={cx("space-y-6", kontraTheme.textPrimary)}>
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className={cx("text-sm", kontraTheme.textMuted)}>
          Build AI-assisted and custom reports with Kontra styling and smart validation.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>AI Report Agent</CardTitle>
            <p className={cx("text-sm", kontraTheme.textMuted)}>
              Describe the report you want and let Kontra draft the spec.
            </p>
          </div>
          <Stepper currentStep={currentStep} />
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="ai-prompt">
                AI prompt
              </label>
              <Textarea
                id="ai-prompt"
                rows={4}
                placeholder="Describe the report you want"
                value={aiAgent.state.description}
                onChange={(e) => aiAgent.setField("description", e.target.value)}
                disabled={aiDisabled}
              />
              <p className={cx("text-xs", kontraTheme.textMuted)}>
                Example: “Open repairs aging by property manager last 30 days”.
              </p>
              {!isPromptValid && aiAgent.state.description.length > 0 && (
                <p className="text-xs text-red-500">Prompt must be at least 8 characters.</p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="ai-domain">
                  Domain
                </label>
                <Select
                  id="ai-domain"
                  value={aiAgent.state.role}
                  onChange={(e) => aiAgent.setField("role", e.target.value)}
                  disabled={aiDisabled}
                >
                  <option value="Servicing">Servicing</option>
                  <option value="Risk">Risk</option>
                  <option value="Capital Markets">Capital Markets</option>
                  <option value="Compliance">Compliance</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="ai-outlook">
                  Outlook
                </label>
                <Select
                  id="ai-outlook"
                  value={aiAgent.state.outlook}
                  onChange={(e) => aiAgent.setField("outlook", e.target.value)}
                  disabled={aiDisabled}
                >
                  <option value="">Descriptive</option>
                  <option value="30">Predictive 30</option>
                  <option value="60">Predictive 60</option>
                  <option value="90">Predictive 90</option>
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm" htmlFor="ai-summary">
              <input
               id="ai-summary"
                type="checkbox"
                 className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                checked={aiAgent.state.includeSummary}
                onChange={(e) => aiAgent.setField("includeSummary", e.target.checked)}
                disabled={aiDisabled}
              />
              Generate executive summary
            </label>
          
            <Button
              variant="primary"
              onClick={aiAgent.requestProposal}
              disabled={aiDisabled || !isPromptValid}
            >
              {aiAgent.state.status === "loading" ? "Generating proposal..." : "Generate AI Proposal"}
            </Button>
          </div>
      
          <div className={cx("rounded-xl border p-4 space-y-4", kontraTheme.border, kontraTheme.mutedSurface)}>
            {aiAgent.state.status === "error" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <div className="flex items-center justify-between gap-2">
                  <span>{aiAgent.state.error}</span>
                  <Button variant="ghost" size="sm" onClick={aiAgent.requestProposal}>
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {aiAgent.state.status === "applied" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                Proposal applied to builder.
              </div>
            )}

            {!proposal && aiAgent.state.status !== "loading" && (
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Provide a prompt to generate a proposal preview.
              </div>
            )}

            {aiAgent.state.status === "loading" && (
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="h-2 w-24 rounded-full bg-slate-300/60 dark:bg-slate-700/60" />
                <div className="h-2 w-40 rounded-full bg-slate-300/60 dark:bg-slate-700/60" />
                <div>Generating proposal...</div>
              </div>
            )}

            {proposal && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info" className="bg-slate-900 text-white">
                    Confidence {(proposal.confidence * 100).toFixed(0)}%
                  </Badge>
                  <Badge variant="outline" className="border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    Warnings {warnings.length}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <p>{proposal.explanation}</p>
                  {proposal.executiveSummary && <p>{proposal.executiveSummary}</p>}
                </div>

                {warnings.length > 0 && (
                  <ul className="list-disc list-inside text-sm text-amber-600 dark:text-amber-300">
                    {warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                )}

                <details className="rounded-lg border border-slate-200 bg-white/70 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/70">
                  <summary className="cursor-pointer font-medium">Preview diff</summary>
                  <div className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                    <p>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Table:</span>{" "}
                      {table || "—"} → {proposalSpec?.table || "—"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Fields:</span>{" "}
                     {(selectedFields.length ? selectedFields.join(", ") : "—") || "—"} →{" "}
                      {proposedFields.length ? proposedFields.join(", ") : "—"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Group by:</span>{" "}
                      {groupBy || "—"} → {proposalSpec?.groupBy || "—"}
                    </p>
                  </div>
                </details>

                <Button variant="secondary" onClick={handleApplyProposal}>
                  Apply to builder
                </Button>

                {(proposal.automationHooks || []).length > 0 && (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">Suggested automation hooks</p>
                    <div className="space-y-2">
                      {proposal.automationHooks.map((hook) => (
                        <label key={hook.action_type} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                            checked={Boolean(aiAgent.state.hooks[hook.action_type])}
                            onChange={(e) => aiAgent.toggleHook(hook.action_type, e.target.checked)}
                          />
                          {hook.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm" htmlFor="ai-approval">
                  <input
                    id="ai-approval"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    checked={aiAgent.state.approval}
                    onChange={(e) => aiAgent.setApproval(e.target.checked)}
                  />
                  I approve this AI proposal for execution or saving.
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={runAiReport} disabled={!aiAgent.state.approval}>
                    Run AI report
                  </Button>
                  <Button variant="secondary" onClick={saveAiReport} disabled={!aiAgent.state.approval}>
                    Save AI report
                  </Button>
                </div>
              </div>
              )}
          </div>
        </CardContent>
      </Card>

      <Card ref={builderRef}>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Custom Report Builder</CardTitle>
            <p className={cx("text-sm", kontraTheme.textMuted)}>
              Configure tables, filters, and visualization options.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" htmlFor="viz">
              Visualization
            </label>
            <Select id="viz" className="w-32" value={viz} onChange={(e) => setViz(e.target.value)}>
              <option value="table">Table</option>
              <option value="bar">Bar</option>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="report-name">
                Report name
              </label>
              <Input
                id="report-name"
                placeholder="Quarterly servicing rollup"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {validationErrors.name && <p className="text-xs text-red-500">{validationErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="table-name">
                Table
              </label>
              <Input
                id="table-name"
                placeholder="servicing_events"
                value={table}
                onChange={(e) => setTable(e.target.value)}
              />
              {validationErrors.table && <p className="text-xs text-red-500">{validationErrors.table}</p>}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="report-spec">
                  Report Spec (JSON)
                </label>
                <Button variant="ghost" size="sm" onClick={handleValidateJson}>
                  Validate JSON
                </Button>
              </div>
               <Textarea
                id="report-spec"
                rows={4}
                className={jsonError ? "border-red-500" : ""}
                  placeholder='{"filters": {"status": "open"}, "order": ["-created_at"]}'
                value={jsonSpecText}
                onChange={(e) => setJsonSpecText(e.target.value)}
              />
              {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="group-by">
                Group by
              </label>
              <Input
                id="group-by"
                placeholder="property_manager"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              />
            </div>
          </div>
 
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Available Fields</h4>
              <div
                className={cx(
                  "rounded-xl border p-3 min-h-[140px] space-y-2",
                  kontraTheme.border,
                  kontraTheme.mutedSurface
                )}
              >
                {available.length === 0 && (
                  <p className={cx("text-sm", kontraTheme.textMuted)}>Select a table to load fields.</p>
                )}
                {available.map((field) => (
                  <div
                    key={field}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                    draggable
                    onDragStart={onDragStart(field)}
                  >
                    {field}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Selected Fields</h4>
              <div
                className={cx(
                  "rounded-xl border p-3 min-h-[140px] space-y-2",
                  kontraTheme.border,
                  kontraTheme.mutedSurface
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
              >
            {selectedFields.length === 0 && (
                  <p className={cx("text-sm", kontraTheme.textMuted)}>Drag fields here to build your report.</p>
                )}
                 {selectedFields.map((field) => (
                  <div
                    key={field}
                    className="flex items-center justify-between rounded-lg bg-red-50 px-2 py-1 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200"
                  >
                    <span>{field}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(field)}
                      aria-label={`Remove ${field}`}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
                 {validationErrors.fields && <p className="text-xs text-red-500">{validationErrors.fields}</p>}
            </div>
          </div>
 
          <div className="rounded-xl border p-4 space-y-3">
            <h4 className="text-sm font-semibold">Scheduling</h4>
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto_auto]">
              <div>
                <label className="text-sm font-medium" htmlFor="schedule-email">
                  Email
                </label>
                <Input
                  id="schedule-email"
                  placeholder="reports@kontra.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {validationErrors.email && <p className="text-xs text-red-500">{validationErrors.email}</p>}
              </div>
               <div>
                <label className="text-sm font-medium" htmlFor="schedule-frequency">
                  Frequency
                </label>
                <Select
                  id="schedule-frequency"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="ghost" onClick={sendTestEmail} disabled={!email}>
                  Send test email
                </Button>
              </div>
              <div className="flex items-end">
                <Button variant="secondary" onClick={scheduleReport}>
                  Schedule
                </Button>
              </div>
            </div>
          </div>
           </CardContent>

        <CardFooter className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-white/90 dark:bg-slate-900/90">
          <p className={cx("text-sm", kontraTheme.textMuted)}>Ready to run or save?</p>
          <div className="flex flex-wrap gap-2">
                   <Button variant="primary" onClick={runReport} disabled={isRunning}>
              {isRunning ? "Running..." : "Run"}
            </Button>
            <Button variant="secondary" onClick={save}>
              Save
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Results</CardTitle>
            <p className={cx("text-sm", kontraTheme.textMuted)}>
              Review output and export in your preferred format.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={handleExportCsv} disabled={!rows.length}>
              Export CSV
            </Button>
            <Button variant="ghost" onClick={handleCopyJson} disabled={!rows.length}>
              Copy as JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {viz === "table" && rows.length > 0 && (
            <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    {resultsColumns.map((column) => (
                      <th key={column} className="px-3 py-2 text-left font-semibold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr
                      key={`row-${rowIndex}`}
                      className="border-b border-slate-200 last:border-b-0 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >
                      {resultsColumns.map((column) => {
                        const value = row[column];
                        const display = value === null || value === undefined ? "" : String(value);
                        return (
                          <td key={`${column}-${rowIndex}`} className="px-3 py-2">
                            <div className="max-w-[240px] truncate" title={display}>
                              {display}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viz === "table" && rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-300">
              <span className="text-2xl">📭</span>
              <p>No rows returned.</p>
            </div>
          )}

          {viz === "bar" && rows.length > 0 && groupBy && (
            <div className="h-72 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows}>
                  <XAxis dataKey={groupBy} />
                  <YAxis />
                  <Tooltip />
                <Bar dataKey={selectedFields[0]} fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {saved.length > 0 && (
         <Card>
          <CardHeader>
            <CardTitle>Saved Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-sm">
              {saved.map((report) => (
                <li key={report.id}>{report.name}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

              {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
          {message}
        </div>
      )}
    </div>
  );
}
