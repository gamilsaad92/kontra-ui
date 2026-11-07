function normalizeRole(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getEffectiveChecklistItems(savedItems = [], schemaItems = []) {
  const templates = new Map();
  for (const item of schemaItems) {
    if (item.id) templates.set(`id:${item.id}`, item);
    if (item.section) templates.set(`section:${item.section}`, item);
  }

  return (Array.isArray(savedItems) ? savedItems : []).map((item) => {
    if (Array.isArray(item.assignedTo) && item.assignedTo.length > 0) return item;
    const template =
      (item.id && templates.get(`id:${item.id}`)) ||
      (item.section && templates.get(`section:${item.section}`));
    return {
      ...item,
      assignedTo: Array.isArray(template?.assignedTo) ? template.assignedTo : [],
    };
  });
}

export function getChecklistItemsForRole(savedItems, role, schemaItems = []) {
  const roleKey = normalizeRole(role);
  if (!roleKey) return [];
  return getEffectiveChecklistItems(savedItems, schemaItems).filter((item) =>
    (item.assignedTo || []).some((assignedRole) => normalizeRole(assignedRole) === roleKey)
  );
}
