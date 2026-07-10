// ── Generic Workflow Pack factory ────────────────────────────────────────────
//
// Business Acquisition and Fundraising both turned out to need the exact
// same machinery underneath their different data (roles/stages/documents):
// generic health scoring, generic AI-fact extraction driven purely by each
// document's declared `aiExtraction.metrics`, and a generic dashboard. This
// factory is that machinery, extracted once so:
//   1. Existing hand-written packs can build on it instead of duplicating it
//      (see businessAcquisition.js / fundraising.js).
//   2. A *runtime-defined* custom pack (built through the Workflow Pack
//      Builder UI, persisted as JSON, no .js file written by a developer)
//      can be constructed from nothing but data by calling
//      `createGenericPack(config)` with that JSON — this is what makes the
//      "customer builds their own pack" workflow possible.
//
// Domain-specific dashboard judgement (e.g. "EBITDA margin badge" vs "runway
// badge") is intentionally NOT required — a pack can optionally override
// `getIntelligenceBadge` / `getIntelligenceHighlight` / `getSnapshotStats` /
// `getSnapshotFlag` / `getExtraCompletenessIssues` for curated behavior, but
// if omitted, sensible generic defaults are derived purely from each
// document's `aiExtraction.metrics` — no per-pack code required.

const DEFAULT_DOLLAR_METRIC_PATTERN = /revenue|ebitda|sde|mrr|arr|burn|capital|adjustments|income|expenses|price|amount/i;

function defaultHumanizeMetricKey(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bSde\b/, "SDE")
    .replace(/\bYoy\b/, "YoY")
    .replace(/\bMrr\b/, "MRR")
    .replace(/\bArr\b/, "ARR")
    .replace(/\bEbitda\b/, "EBITDA")
    .replace(/\bPct\b/, "%");
}

export function createGenericPack(config) {
  const {
    id,
    name,
    description,
    roles,
    stages,
    documentSchema,
    nextStage: nextStageOverride,
    advanceLabel: advanceLabelOverride,
    outstandingItemsSections = [],
    intelligenceSections: intelligenceSectionsOverride,
    dollarMetricPattern = DEFAULT_DOLLAR_METRIC_PATTERN,
    humanizeMetricKey = defaultHumanizeMetricKey,
    getIntelligenceBadge: getIntelligenceBadgeOverride,
    getIntelligenceHighlight: getIntelligenceHighlightOverride,
    getSnapshotStats: getSnapshotStatsOverride,
    getSnapshotFlag: getSnapshotFlagOverride,
    getExtraCompletenessIssues,
  } = config;

  // ── Roles ──────────────────────────────────────────────────────────────
  function getRole(key) {
    return roles.find(r => r.key === key) || null;
  }
  function getRoleLabel(key, { short = false } = {}) {
    const r = getRole(key);
    if (!r) return key;
    return short ? (r.shortLabel || r.label) : r.label;
  }

  // ── Stages ─────────────────────────────────────────────────────────────
  // If a pack doesn't provide explicit transition maps, derive them from
  // the stage array's declared order — purely data-driven.
  const stageKeys = stages.map(s => s.key);
  const nextStage = nextStageOverride || Object.fromEntries(
    stageKeys.slice(0, -1).map((k, i) => [k, stageKeys[i + 1]])
  );
  const advanceLabel = advanceLabelOverride || Object.fromEntries(
    stageKeys.slice(0, -1).map((k, i) => [k, `Move to ${stages[i + 1].label}`])
  );

  // ── Document schema ────────────────────────────────────────────────────
  function getDocumentSchema(_dealSubtype) {
    return documentSchema;
  }

  function findDoc(section) {
    return documentSchema.find(d => d.section === section);
  }

  // ── Generic AI-fact extraction: driven entirely by each doc's declared
  // aiExtraction.metrics — no per-metric-name code needed for a new pack. ──
  function getInlineFacts(analysis, section) {
    if (!analysis || typeof analysis !== "object" || analysis.pending) return [];
    const doc = findDoc(section);
    const metricDefs = doc?.aiExtraction?.metrics;
    const metrics = analysis.metrics;
    if (!metricDefs || !metrics) return [];

    return Object.keys(metricDefs)
      .filter(key => metrics[key] != null)
      .map(key => ({
        label: humanizeMetricKey(key),
        value: dollarMetricPattern.test(key)
          ? `$${Number(metrics[key]).toLocaleString()}`
          : `${metrics[key]}${/pct|percent|growth|margin/i.test(key) ? "%" : ""}`,
        type: "neutral",
      }));
  }

  function getCompletenessIssues(analysis, section) {
    if (!analysis || typeof analysis !== "object") return [];
    const issues = [];
    (analysis.risk_flags || []).forEach(flag => issues.push({ text: flag, sev: "Moderate" }));
    if (getExtraCompletenessIssues) {
      issues.push(...(getExtraCompletenessIssues(analysis, section) || []));
    }
    return issues;
  }

  const factColors = {
    good: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
    warn: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
    neutral: { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
  };

  const aiUploadEndpoints = Object.fromEntries(
    documentSchema.filter(d => d.ai).map(d => [d.section, "/api/ai/analyze-document"])
  );
  const trackSections = new Set(documentSchema.map(d => d.section));

  // ── Dashboard ──────────────────────────────────────────────────────────
  const aiDocs = documentSchema.filter(d => d.ai && d.aiExtraction);
  const intelligenceSections = intelligenceSectionsOverride || aiDocs.map((d, i) => ({
    key: d.section,
    icon: "📊",
    label: d.label,
    color: ["#16a34a", "#2563eb", "#7c3aed", "#d97706"][i % 4],
  }));

  // Generic default: no domain judgement without an override — a custom
  // pack simply won't show a colored badge until curated logic is added.
  function getIntelligenceBadge(section, analysis) {
    if (getIntelligenceBadgeOverride) return getIntelligenceBadgeOverride(section, analysis);
    return null;
  }

  // Generic default: surface the first two declared metrics for that
  // section, formatted generically — no domain-specific phrasing.
  function getIntelligenceHighlight(section, analysis) {
    if (getIntelligenceHighlightOverride) return getIntelligenceHighlightOverride(section, analysis);
    if (!analysis) return null;
    const doc = findDoc(section);
    const metricDefs = doc?.aiExtraction?.metrics;
    const metrics = analysis.metrics || {};
    if (!metricDefs) return null;
    const parts = Object.keys(metricDefs)
      .filter(key => metrics[key] != null)
      .slice(0, 2)
      .map(key => `${humanizeMetricKey(key)}: ${dollarMetricPattern.test(key) ? `$${Number(metrics[key]).toLocaleString()}` : metrics[key]}`);
    return parts.length ? parts.join(" · ") : null;
  }

  // Generic default: roll up every AI-extracted metric across all sections
  // into a flat stat list — a custom pack gets a working dashboard with
  // zero curated code.
  function getSnapshotStats(bySection) {
    if (getSnapshotStatsOverride) return getSnapshotStatsOverride(bySection);
    const stats = [];
    for (const doc of aiDocs) {
      const metricDefs = doc.aiExtraction.metrics;
      const metrics = bySection[doc.section]?.metrics || {};
      for (const key of Object.keys(metricDefs)) {
        if (metrics[key] == null) continue;
        stats.push({
          label: humanizeMetricKey(key),
          value: dollarMetricPattern.test(key)
            ? `$${Number(metrics[key]).toLocaleString()}`
            : `${metrics[key]}${/pct|percent|growth|margin/i.test(key) ? "%" : ""}`,
        });
      }
    }
    return stats;
  }

  function getSnapshotFlag(bySection) {
    if (getSnapshotFlagOverride) return getSnapshotFlagOverride(bySection);
    return null;
  }

  // ── Health scoring ─────────────────────────────────────────────────────
  // Identical formula for every generic pack: required docs in, required
  // parties in, no submissions stuck needing revision.
  function computeHealth(analyses, submissions) {
    const bySection = {};
    for (const a of analyses) {
      if (!bySection[a.section]) bySection[a.section] = a.analysis;
    }

    const requiredRoles = roles.filter(r => r.required).map(r => r.key);
    const submittedRoles = new Set(submissions.map(s => s.role));
    let score = 100;
    const actions = [];

    const requiredDocs = documentSchema.filter(d => d.required);
    for (const doc of requiredDocs) {
      if (!bySection[doc.section]) {
        score -= 12;
        actions.push({ sev: "error", icon: "📄", text: `${doc.label} not yet uploaded` });
      }
    }

    for (const roleKey of requiredRoles) {
      const role = getRole(roleKey);
      if (role?.needsDocs && !submittedRoles.has(roleKey)) {
        score -= 8;
        actions.push({ sev: "warn", icon: role.icon, text: `Awaiting: ${role.shortLabel || role.label}` });
      }
    }

    const needsRevision = submissions.filter(s => s.status === "needs_revision").length;
    if (needsRevision > 0) {
      score -= needsRevision * 5;
      actions.push({ sev: "warn", icon: "✏️", text: `${needsRevision} submission${needsRevision > 1 ? "s" : ""} need revision` });
    }

    score = Math.max(0, Math.min(100, score));
    if (actions.length === 0) {
      actions.push({ sev: "ok", icon: "✅", text: "All required documents and parties are in good standing" });
    }

    return { score, actions };
  }

  // ── Onboarding checklist ("Step 2 — Populate your deal room") ────────────
  // Built-in packs (CRE/Business Acquisition/Fundraising) hand-write these
  // for a polished, deal-specific narrative. A custom pack built through the
  // Workflow Pack Builder UI can optionally do the same (config.onboardingSteps),
  // but if it doesn't, derive a sensible default straight from the pack's own
  // document checklist + roles so it never falls back to another pack's copy.
  function defaultOnboardingSteps() {
    const steps = documentSchema.slice(0, 3).map(doc => ({
      icon: "📄",
      title: `Add ${doc.label.toLowerCase()}`,
      desc: doc.ai
        ? "AI reviews it automatically and surfaces key details."
        : "Upload it to keep this deal room moving.",
    }));
    const docUploaderRole = roles.find(r => r.needsDocs && r.key !== roles[0]?.key);
    if (docUploaderRole) {
      steps.push({
        icon: docUploaderRole.icon || "📨",
        title: `Invite the ${docUploaderRole.label.toLowerCase()}`,
        desc: "Send their role-specific link above so their documents land directly in this room.",
      });
    }
    return steps;
  }

  return {
    id,
    name,
    description,
    checklistTitle: config.checklistTitle || `${name} Checklist`,
    onboardingSteps: config.onboardingSteps?.length ? config.onboardingSteps : defaultOnboardingSteps(),
    roles,
    stages,
    nextStage,
    advanceLabel,
    getDocumentSchema,
    getInlineFacts,
    getCompletenessIssues,
    factColors,
    aiUploadEndpoints,
    trackSections,
    computeHealth,
    getRole,
    getRoleLabel,
    outstandingItemsSections,
    intelligenceSections,
    getIntelligenceBadge,
    getIntelligenceHighlight,
    getSnapshotStats,
    getSnapshotFlag,
  };
}

export default createGenericPack;
