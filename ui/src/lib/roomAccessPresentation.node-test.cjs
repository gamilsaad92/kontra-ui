"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const helperUrl = pathToFileURL(path.join(__dirname, "roomAccessPresentation.mjs"));

test("participant access keeps the corresponding participant workspace over a legacy owner token", async () => {
  const { isCoordinatorRoomView, roomRoleFromAccess } = await import(helperUrl);
  for (const role of ["buyer", "seller", "legal_advisor", "financial_advisor", "custom_reviewer"]) {
    const access = { mode: "participant", role };
    const visibleRole = roomRoleFromAccess(access);
    assert.equal(visibleRole, role);
    assert.equal(isCoordinatorRoomView({
      access,
      hasOwnerToken: true,
      role: visibleRole,
      roleConfig: { canManage: true, invitable: false },
    }), false);
  }
});

test("switching back to owner access intentionally restores the Coordinator workspace", async () => {
  const { isCoordinatorRoomView, roomRoleFromAccess } = await import(helperUrl);
  const participantAccess = { mode: "participant", role: "buyer" };
  assert.equal(isCoordinatorRoomView({
    access: participantAccess,
    hasOwnerToken: true,
    role: "buyer",
  }), false);

  const ownerAccess = { mode: "owner" };
  const ownerRole = roomRoleFromAccess(ownerAccess);
  assert.equal(ownerRole, "deal_coordinator");
  assert.equal(isCoordinatorRoomView({
    access: ownerAccess,
    role: ownerRole,
  }), true);
});
