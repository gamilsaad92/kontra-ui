"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const accessModuleUrl = pathToFileURL(path.join(__dirname, "roomOwnerAccess.mjs"));
const dealRoomPagePath = path.join(__dirname, "../pages/public/DealRoomPage.jsx");

test("server-confirmed owner access enables owner actions without a legacy browser token", async () => {
  const { hasServerConfirmedRoomOwnerAccess } = await import(accessModuleUrl);

  assert.equal(
    hasServerConfirmedRoomOwnerAccess({ access: { mode: "owner" } }),
    true,
  );
});

test("missing, participant, and stale room access do not enable owner actions", async () => {
  const { hasServerConfirmedRoomOwnerAccess } = await import(accessModuleUrl);

  assert.equal(hasServerConfirmedRoomOwnerAccess(null), false);
  assert.equal(hasServerConfirmedRoomOwnerAccess({}), false);
  assert.equal(
    hasServerConfirmedRoomOwnerAccess({ access: { mode: "participant" } }),
    false,
  );
});

test("lifecycle action distinguishes missing access from readiness blockers", async () => {
  const { getLifecycleActionState } = await import(accessModuleUrl);

  assert.deepEqual(
    getLifecycleActionState({ hasOwnerAccess: false, lifecycleEligible: true }),
    { showOwnerAccessWarning: true, showAdvanceControl: false },
  );
  assert.deepEqual(
    getLifecycleActionState({ hasOwnerAccess: true, lifecycleEligible: false }),
    { showOwnerAccessWarning: false, showAdvanceControl: false },
  );
  assert.deepEqual(
    getLifecycleActionState({ hasOwnerAccess: true, lifecycleEligible: true }),
    { showOwnerAccessWarning: false, showAdvanceControl: true },
  );
});

test("lifecycle UI wires the authorization warning and advance control separately", () => {
  const source = fs.readFileSync(dealRoomPagePath, "utf8");

  assert.match(source, /getLifecycleActionState\(\{\s*hasOwnerAccess,\s*lifecycleEligible:\s*lifecycleGate\.eligible/s);
  assert.match(source, /lifecycleActionState\.showAdvanceControl/);
  assert.match(source, /lifecycleActionState\.showOwnerAccessWarning/);
});

test("snapshot and lifecycle actions use cookies rather than owner-token request bodies", () => {
  const source = fs.readFileSync(dealRoomPagePath, "utf8");
  const snapshotStart = source.indexOf("const recordReadinessSnapshot");
  const snapshotEnd = source.indexOf("const generateDigitalAssetPackage", snapshotStart);
  const lifecycleStart = source.indexOf("async function advanceLifecycleStage()");
  const lifecycleEnd = source.indexOf("\n  return (", lifecycleStart);
  assert.notEqual(snapshotStart, -1);
  assert.notEqual(lifecycleStart, -1);

  const snapshotAction = source.slice(snapshotStart, snapshotEnd);
  const lifecycleAction = source.slice(lifecycleStart, lifecycleEnd);

  for (const action of [snapshotAction, lifecycleAction]) {
    assert.match(action, /credentials:\s*'include'/);
    assert.doesNotMatch(action, /ownerWriteToken/);
    assert.match(action, /hasOwnerAccess/);
  }
});
