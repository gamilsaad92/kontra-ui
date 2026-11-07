export function hasServerConfirmedRoomOwnerAccess(property) {
  return property?.access?.mode === 'owner';
}

export function getLifecycleActionState({ hasOwnerAccess, lifecycleEligible }) {
  return {
    showOwnerAccessWarning: !hasOwnerAccess,
    showAdvanceControl: Boolean(hasOwnerAccess && lifecycleEligible),
  };
}
