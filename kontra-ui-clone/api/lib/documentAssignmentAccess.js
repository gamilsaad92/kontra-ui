function normalizeDocumentRole(role) {
  return String(role || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function hasDocumentRole(roles, role) {
  const normalizedRole = normalizeDocumentRole(role);
  return Array.isArray(roles)
    && roles.some(assignedRole => normalizeDocumentRole(assignedRole) === normalizedRole);
}

// A persisted assignment is authoritative for that checklist row. Pack
// assignments are only a fallback for rows created before assignedTo was
// persisted. This same rule must be used for reads, uploads, and comments.
function getChecklistItemAssignedRoles(item, assignments = null, customAssignments = null) {
  const section = item?.section || item?.id;
  const explicit = Array.isArray(item?.assignedTo)
    ? item.assignedTo.filter(Boolean)
    : [];
  if (explicit.length > 0) return explicit;
  if (customAssignments && Object.prototype.hasOwnProperty.call(customAssignments, section)) {
    return customAssignments[section] || [];
  }
  return assignments?.[section] || [];
}

function getAssignedSectionsFromChecklist(items, role, assignments = null, customAssignments = null) {
  const sections = new Set();
  for (const item of items || []) {
    const section = item?.section || item?.id;
    if (!section) continue;
    if (hasDocumentRole(getChecklistItemAssignedRoles(item, assignments, customAssignments), role)) {
      sections.add(section);
    }
  }
  return sections;
}

module.exports = {
  normalizeDocumentRole,
  hasDocumentRole,
  getChecklistItemAssignedRoles,
  getAssignedSectionsFromChecklist,
};