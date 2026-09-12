'use strict';

function normalizeAssignmentRole(role) {
  return String(role || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function assignedRoles(item) {
  return new Set(
    (Array.isArray(item?.assignedTo) ? item.assignedTo : [])
      .map(normalizeAssignmentRole)
      .filter(Boolean),
  );
}

function checklistItemKey(item) {
  return String(item?.section || item?.id || '').trim();
}

/**
 * Returns only role assignments that became newly relevant in a checklist save.
 * Persisted checklist assignments are intentionally compared as explicit values;
 * workflow-pack fallbacks are not treated as new mutations.
 */
function getNewlyAssignedChecklistEntries(previousItems = [], nextItems = [], options = {}) {
  const hasPersistedBaseline = Array.isArray(previousItems) && previousItems.length > 0;
  const previousByKey = new Map(
    (Array.isArray(previousItems) ? previousItems : [])
      .map(item => [checklistItemKey(item), assignedRoles(item)]),
  );

  return (Array.isArray(nextItems) ? nextItems : [])
    .map(item => {
      const key = checklistItemKey(item);
      if (!key) return null;
      // A legacy room may have no persisted checklist yet. Its first save can
      // contain the seeded workflow schema, but those canonical assignments
      // are not new participant work. Custom rows are explicit mutations and
      // remain eligible for the first-save notification.
      if (!hasPersistedBaseline && options.onlyExplicitCustomOnEmptyBaseline && item.isCustom !== true) {
        return null;
      }
      const previousRoles = previousByKey.get(key) || new Set();
      const newlyAssignedRoles = [...assignedRoles(item)]
        .filter(role => !previousRoles.has(role));
      if (newlyAssignedRoles.length === 0) return null;
      return {
        id: item.id || key,
        section: item.section || key,
        label: String(item.label || item.name || key).trim(),
        required: item.required === true,
        newlyAssignedRoles,
      };
    })
    .filter(Boolean);
}

module.exports = {
  normalizeAssignmentRole,
  getNewlyAssignedChecklistEntries,
};