export function roomRoleFromAccess(access) {
  if (access?.mode === 'owner') return 'deal_coordinator';
  if (access?.mode === 'participant' && access.role) return access.role;
  return null;
}

export function isCoordinatorRoomView({
  isDemo = false,
  access,
  hasOwnerToken = false,
  role,
  roleConfig,
}) {
  if (isDemo) return true;
  // A verified participant session is authoritative for the visible workspace,
  // even if the tab also has a legacy owner token or a coordinator-like role key.
  if (access?.mode === 'participant') return false;
  return access?.mode === 'owner'
    || (hasOwnerToken && role === 'owner')
    || (
      hasOwnerToken
      && roleConfig?.canManage === true
      && roleConfig?.invitable !== true
    );
}
