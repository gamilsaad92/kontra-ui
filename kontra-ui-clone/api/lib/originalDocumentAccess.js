const ORIGINAL_DOCUMENT_SELECT = 'id, property_id, section, filename, storage_path, is_active, superseded_at';
const LEGACY_DOCUMENT_SELECT = 'id, property_id, section, filename, storage_path';

function isMissingDocumentVersionColumns(error) {
  const message = String(error?.message || '');
  return /is_active|superseded_at|schema cache|column .* does not exist/i.test(message);
}

async function loadOriginalDocument(client, propertyId, documentId) {
  let result = await client
    .from('deal_analyses')
    .select(ORIGINAL_DOCUMENT_SELECT)
    .eq('id', documentId)
    .eq('property_id', propertyId)
    .maybeSingle();

  // Older valid uploads have storage_path but may predate migration 019.
  // Retry only the missing version metadata projection; the path remains
  // server-resolved from this same deal_analyses row.
  if (result.error && isMissingDocumentVersionColumns(result.error)) {
    result = await client
      .from('deal_analyses')
      .select(LEGACY_DOCUMENT_SELECT)
      .eq('id', documentId)
      .eq('property_id', propertyId)
      .maybeSingle();
  }

  return result;
}

module.exports = {
  LEGACY_DOCUMENT_SELECT,
  ORIGINAL_DOCUMENT_SELECT,
  isMissingDocumentVersionColumns,
  loadOriginalDocument,
};