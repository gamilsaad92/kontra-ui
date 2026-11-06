function firstText(...values) {
  return values.find(value => value != null && String(value).trim())?.toString().trim() || '';
}

export function getTransactionRecordEvidence(field, analyses = []) {
  const source = field?.field || field || {};
  const documentId = firstText(
    source.source_document_id,
    source.sourceDocumentId,
    source.source_doc_id,
    source.sourceDocId,
  );
  const analysis = documentId
    ? analyses.find(item => String(item?.id || item?.document_id || '') === documentId)
    : null;
  const documentName = firstText(
    source.source_document_name,
    source.sourceDocumentName,
    source.source_document,
    source.source_file,
    source.filename,
    analysis?.filename,
    analysis?.document_name,
  );
  const excerpt = firstText(source.source_excerpt, source.sourceExcerpt);
  const page = source.source_page ?? source.sourcePage ?? null;
  const available = Boolean(documentId || documentName || excerpt || page != null);

  return { available, documentId, documentName, excerpt, page };
}

export async function verifyTransactionRecordField({
  apiBase = '',
  propertyId,
  fieldId,
  approveProvenance = false,
  fetchImpl = globalThis.fetch,
}) {
  const base = String(apiBase || '').replace(/\/+$/, '');
  const response = await fetchImpl(
    `${base}/api/public/deal-room/${encodeURIComponent(propertyId)}/transaction-record/fields/${encodeURIComponent(fieldId)}/verify`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approveProvenance: approveProvenance === true }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 401
      ? 'Your owner session is unavailable or expired. Sign in again to confirm this field.'
      : response.status === 403
        ? (data.message || 'Your owner session does not have permission to confirm this field.')
        : (data.message || data.error || 'The Transaction Record field could not be confirmed.');
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function getOriginalDocumentUrl({
  apiBase = '',
  propertyId,
  documentId,
  fetchImpl = globalThis.fetch,
}) {
  const base = String(apiBase || '').replace(/\/+$/, '');
  const response = await fetchImpl(
    `${base}/api/public/deal-room/${encodeURIComponent(propertyId)}/document/${encodeURIComponent(documentId)}/url`,
    { credentials: 'include' },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) {
    const message = response.status === 401
      ? 'Your room session is unavailable or expired. Sign in again to open this document.'
      : response.status === 403
        ? (data.message || 'Your room session does not have permission to open this document.')
        : (data.error || 'The original document is not available.');
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}
