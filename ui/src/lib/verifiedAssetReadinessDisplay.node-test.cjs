"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const moduleUrl = pathToFileURL(path.join(__dirname, "verifiedAssetReadinessDisplay.mjs"));
const pagePath = path.join(__dirname, "../pages/public/DealRoomPage.jsx");

function response(overrides = {}) {
  return {
    eligibility: "eligible",
    status: "ready_for_external_review",
    summary: {
      confirmed_count: 29,
      required_count: 29,
      unresolved_exception_count: 0,
      provenance_intact: true,
      provenance_gap_count: 0,
      approvals_satisfied: true,
      missing_approval_count: 0,
    },
    reasons: {
      incomplete_required_fields: [],
      unresolved_conflicts: [],
      missing_approvals: [],
      provenance_gaps: [],
    },
    ...overrides,
  };
}

test("missing or failed readiness data is unavailable, not zero or eligible", async () => {
  const { getVerifiedAssetReadinessDisplay } = await import(moduleUrl);
  for (const options of [
    { requestStatus: "unavailable", requestError: "Readiness endpoint returned 503." },
    { requestStatus: "ready", readiness: null },
  ]) {
    const view = getVerifiedAssetReadinessDisplay(options);
    assert.equal(view.state, "unavailable");
    assert.equal(view.counts, null);
    assert.equal(view.clean, false);
    assert.equal(view.eligibilityLabel, "Unavailable");
  }
});

test("loading readiness has no zero counts or eligibility claim", async () => {
  const { getVerifiedAssetReadinessDisplay } = await import(moduleUrl);
  const view = getVerifiedAssetReadinessDisplay({ requestStatus: "loading" });
  assert.equal(view.state, "loading");
  assert.equal(view.counts, null);
  assert.equal(view.clean, false);
  assert.match(view.message, /loading/i);
});

test("malformed readiness response is unavailable", async () => {
  const { getVerifiedAssetReadinessDisplay, isVerifiedAssetReadinessResponse } = await import(moduleUrl);
  const malformed = { eligibility: "eligible", status: "ready", summary: { confirmed_count: 0 } };
  assert.equal(isVerifiedAssetReadinessResponse(malformed), false);
  assert.equal(
    getVerifiedAssetReadinessDisplay({ readiness: malformed, requestStatus: "ready" }).state,
    "unavailable",
  );
});

test("ineligible readiness with an unresolved conflict never shows a clean message", async () => {
  const { getVerifiedAssetReadinessDisplay } = await import(moduleUrl);
  const data = response({
    eligibility: "ineligible",
    status: "preparation_incomplete",
    summary: {
      ...response().summary,
      confirmed_count: 28,
      unresolved_exception_count: 1,
    },
    reasons: {
      ...response().reasons,
      unresolved_conflicts: [{ field_key: "transaction.closing_date", label: "Target Closing Date" }],
    },
  });
  const view = getVerifiedAssetReadinessDisplay({
    readiness: data,
    requestStatus: "ready",
  });
  assert.equal(view.eligibilityLabel, "Ineligible");
  assert.equal(view.summary.confirmed_count, 28);
  assert.equal(view.summary.required_count, 29);
  assert.equal(view.blockerLabels[0], "Target Closing Date");
  assert.equal(view.clean, false);
});

test("valid readiness with incomplete required fields shows actual blockers", async () => {
  const { getVerifiedAssetReadinessDisplay } = await import(moduleUrl);
  const data = response({
    eligibility: "ineligible",
    status: "preparation_incomplete",
    summary: {
      ...response().summary,
      confirmed_count: 0,
      unresolved_exception_count: 29,
    },
    reasons: {
      ...response().reasons,
      incomplete_required_fields: Array.from({ length: 29 }, (_, index) => ({
        field_key: `transaction.required_${index}`,
        label: index === 0 ? "Purchase Price" : `Required field ${index + 1}`,
      })),
    },
  });
  const view = getVerifiedAssetReadinessDisplay({ readiness: data, requestStatus: "ready" });
  assert.equal(view.summary.confirmed_count, 0);
  assert.equal(view.summary.required_count, 29);
  assert.equal(view.blockerLabels[0], "Purchase Price");
  assert.equal(view.blockerLabels.length, 29);
  assert.equal(view.clean, false);
});

test("eligible response shows clean status only when the backend reports no exceptions", async () => {
  const { getVerifiedAssetReadinessDisplay } = await import(moduleUrl);
  const view = getVerifiedAssetReadinessDisplay({
    readiness: response(),
    requestStatus: "ready",
  });
  assert.equal(view.state, "ready");
  assert.equal(view.eligibilityLabel, "Eligible");
  assert.equal(view.summary.confirmed_count, 29);
  assert.equal(view.summary.required_count, 29);
  assert.equal(view.clean, true);
});

test("readiness messaging distinguishes the optional layer being enabled or disabled", async () => {
  const { getVerifiedAssetReadinessDisplay } = await import(moduleUrl);
  for (const [digitalAssetEnabled, title, eligibilityName] of [
    [true, "Digital Asset Readiness", "Digital Asset snapshot"],
    [false, "Verified Asset Record", "Verified Asset snapshot"],
  ]) {
    const unavailable = getVerifiedAssetReadinessDisplay({
      requestStatus: "unavailable",
      digitalAssetEnabled,
    });
    assert.equal(unavailable.title, title);
    assert.equal(unavailable.eligibilityName, eligibilityName);
    assert.equal(unavailable.clean, false);

    const ineligible = getVerifiedAssetReadinessDisplay({
      readiness: response({
        eligibility: "ineligible",
        status: "preparation_incomplete",
        summary: {
          ...response().summary,
          unresolved_exception_count: 1,
        },
        reasons: {
          ...response().reasons,
          unresolved_conflicts: [{ field_key: "transaction.closing_date", label: "Target Closing Date" }],
        },
      }),
      requestStatus: "ready",
      digitalAssetEnabled,
    });
    assert.equal(ineligible.title, title);
    assert.equal(ineligible.eligibilityName, eligibilityName);
    assert.equal(ineligible.eligibilityLabel, "Ineligible");
    assert.equal(ineligible.blockerLabels[0], "Target Closing Date");
    assert.equal(ineligible.clean, false);
  }
});

test("Overview sends readiness failures to the card instead of silently substituting an empty response", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /setVerifiedAssetReadinessRequest\(\{\s*status: 'loading'/);
  assert.match(source, /setVerifiedAssetReadinessRequest\(\{\s*status: 'unavailable'/);
  assert.match(source, /isVerifiedAssetReadinessResponse\(data\)/);
  assert.match(source, /display\.state === 'unavailable'/);
  assert.match(source, /!display\.clean/);
  assert.match(source, /summary \? summary\.confirmed_count : '—'/);
  assert.match(source, /Recording preserves this exact Verified Asset state, including an ineligible status/);
  assert.match(source, /const response = await fetch\([\s\S]*?\/verified-asset\/snapshots/);
});
