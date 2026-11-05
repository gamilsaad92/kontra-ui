export function hasServerConfirmedRoomOwnerAccess(property) {
  return property?.access?.mode === 'owner';
}
