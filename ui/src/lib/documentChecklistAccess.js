const COORDINATOR_PERMISSIONS = [
  "manageStages",
  "manageParticipants",
  "manageSettings",
];

export function normalizeChecklistRoleKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function hasAuthenticatedCoordinatorAccess(access) {
  if (access?.mode === "owner" || access?.mode === "coordinator") return true;
  if (access?.mode !== "participant") return false;

  return COORDINATOR_PERMISSIONS.some(
    permission => access.permissions?.[permission] === true,
  );
}

export function resolveDocumentChecklistView({
  items,
  role,
  access,
  isDemo = false,
  demoRoleCanManage = false,
} = {}) {
  const allItems = Array.isArray(items) ? items : [];
  const isCoordinator = hasAuthenticatedCoordinatorAccess(access)
    || (isDemo === true && demoRoleCanManage === true);
  const normalizedRole = normalizeChecklistRoleKey(role);
  const myItems = normalizedRole
    ? allItems.filter(item =>
      (Array.isArray(item.assignedTo) ? item.assignedTo : []).some(
        assignedRole => normalizeChecklistRoleKey(assignedRole) === normalizedRole,
      )
    )
    : [];

  return {
    isCoordinator,
    myItems,
    template: isCoordinator ? allItems : myItems,
  };
}