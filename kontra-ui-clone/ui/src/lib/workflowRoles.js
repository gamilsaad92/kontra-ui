// Shared workspace-role semantics.
//
// A role can be excluded from invitation requirements for two different
// reasons: built-in packs explicitly mark the owner as non-invitable, while
// builder-created packs may only mark the managing role with canManage=true.
// Keep that distinction in one place so People, Overview, and record-derived
// participant state agree about who the workspace owner already satisfies.

export function isCoordinatorRole(role) {
  return role?.invitable === false
    || (role?.canManage === true && role?.invitable !== true);
}

export function resolveCoordinatorRole(pack, {
  isCoordinator = false,
  coordinatorRole = null,
} = {}) {
  const roles = Array.isArray(pack?.roles) ? pack.roles : [];
  if (coordinatorRole?.key) return coordinatorRole;

  // In an authenticated owner session, management authority takes precedence
  // over invite metadata. A builder may accidentally leave invitable=true on
  // its first/managing role, but that role is still fulfilled by the owner.
  if (isCoordinator) {
    const managingRole = roles.find(role => role?.canManage === true);
    if (managingRole) return managingRole;
  }

  const metadataRole = roles.find(isCoordinatorRole);
  if (metadataRole) return metadataRole;

  // Owner/session semantics are authoritative even when an old custom pack
  // omitted coordinator metadata. This mirrors the People fallback row.
  if (isCoordinator) {
    return {
      key: 'deal_coordinator',
      label: 'Deal Owner',
      shortLabel: 'Deal Owner',
      icon: '🏢',
      color: '#800020',
      canManage: true,
      invitable: false,
    };
  }

  return null;
}

export function getCoordinatorRoleKeys(pack, options = {}) {
  const roles = Array.isArray(pack?.roles) ? pack.roles : [];
  const keys = new Set(roles.filter(isCoordinatorRole).map(role => role.key));
  const resolved = resolveCoordinatorRole(pack, options);
  if (resolved?.key) keys.add(resolved.key);
  return keys;
}

export function getExternalParticipantRoles(pack, options = {}) {
  const roles = Array.isArray(pack?.roles) ? pack.roles : [];
  const coordinatorKeys = getCoordinatorRoleKeys(pack, options);
  return roles.filter(role =>
    role.invitable === true
      && !role.legacyOnly
      && !coordinatorKeys.has(role.key)
      && !isCoordinatorRole(role)
  );
}

export function isRoleSatisfiedByWorkspaceOwner(role, options = {}) {
  if (!options.isCoordinator || !role) return false;
  return getCoordinatorRoleKeys(options.pack, options).has(role.key)
    || isCoordinatorRole(role);
}
