'use strict';

async function loadCustomPackDocuments(supabase, packId) {
  if (!String(packId || '').startsWith('ws_')) return null;

  try {
    const { data, error } = await supabase
      .from('custom_workflow_packs')
      .select('config')
      .eq('id', packId)
      .maybeSingle();
    if (error || !Array.isArray(data?.config?.documents)) return null;

    return data.config.documents
      .map((document, index) => {
        const section = document?.section || document?.id || `document_${index + 1}`;
        const assignedTo = Array.isArray(document?.assignedTo)
          ? document.assignedTo
          : document?.assignedRole
            ? [document.assignedRole]
            : [];
        return {
          ...document,
          id: document?.id || section,
          section,
          label: document?.label || document?.name || section.replace(/_/g, ' '),
          assignedTo: assignedTo
            .map(role => String(role || '').trim().replace(/\s+/g, '_'))
            .filter(Boolean),
        };
      })
      .filter(document => document.section);
  } catch (error) {
    console.warn('[checklist] custom pack schema lookup failed:', error.message);
    return null;
  }
}

function buildReadTimeChecklistItems(canonical) {
  if (!Array.isArray(canonical)) return null;
  return canonical.map((document, index) => ({
    id: document.id || document.section,
    section: document.section,
    label: document.label,
    required: !!document.required,
    ai: !!document.ai,
    assignedTo: Array.isArray(document.assignedTo) ? document.assignedTo : [],
    category: document.category || 'General',
    isCustom: false,
    sortOrder: index,
    status: 'missing',
  }));
}

async function resolveRoomChecklist(room, supabase) {
  const savedChecklist = Array.isArray(room?.checklist_items) ? room.checklist_items : [];
  if (savedChecklist.length > 0) return savedChecklist;

  const canonical = await loadCustomPackDocuments(supabase, room?.workflow_pack_id);
  return buildReadTimeChecklistItems(canonical) || [];
}

module.exports = {
  buildReadTimeChecklistItems,
  loadCustomPackDocuments,
  resolveRoomChecklist,
};
