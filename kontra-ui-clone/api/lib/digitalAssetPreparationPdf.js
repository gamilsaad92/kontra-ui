'use strict';

const crypto = require('crypto');
const PDFDocument = require('pdfkit');

const PREPARATION_PDF_BUCKET = 'deal-documents';
const PREPARATION_PDF_SCHEMA = 'kontra.digital-asset-preparation-pdf';
const PREPARATION_PDF_VERSION = '1.0.0';
const ARTIFACT_HASH_PLACEHOLDER = '.'.repeat(64);
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

const COLORS = {
  navy: '#24364b',
  burgundy: '#800020',
  teal: '#147d83',
  ink: '#17202a',
  muted: '#5c6875',
  line: '#d7e0e5',
  pale: '#f2f6f7',
  paleBlue: '#edf3f7',
  white: '#ffffff',
};

const LABELS = {
  'organization.investor_or_agency': 'Investor or agency',
  manual_confirmation_history: 'Manual confirmation history',
  document_history: 'Document history',
  manual_confirmation: 'Manual confirmation',
  provider_confirmation: 'Provider confirmation',
  transaction_record: 'Transaction record',
  transaction_record_context: 'Transaction record context',
  source_document_id: 'Source document',
  source_file_hash: 'Source file hash',
  source_page: 'Page',
  source_type: 'Source type',
  evidence_id: 'Evidence reference ID',
  reference_id: 'Reference ID',
  created_at: 'Recorded date',
  updated_at: 'Updated date',
  extracted_at: 'Extraction date',
};

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasValue);
  if (typeof value === 'object') {
    return Object.entries(value).some(([key, item]) => key !== 'detail' || hasValue(item))
      && Object.values(value).some(hasValue);
  }
  return true;
}

function humanizeKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (LABELS[raw]) return LABELS[raw];
  const parts = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1));
  return parts.join(' — ');
}

function humanizeToken(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return LABELS[raw] || raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatHumanValue(value) {
  if (!hasValue(value)) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.filter(hasValue).map(formatHumanValue).filter(Boolean).join('; ');
  }
  if (typeof value === 'object') {
    if (hasValue(value.choice)) {
      const choice = humanizeToken(value.choice);
      const detail = hasValue(value.detail || value.details)
        ? formatHumanValue(value.detail || value.details)
        : '';
      return detail ? `${choice} — ${detail}` : choice;
    }
    if (Array.isArray(value.choices)) {
      const choices = value.choices.map(humanizeToken).filter(Boolean).join('; ');
      const detail = hasValue(value.detail || value.details)
        ? formatHumanValue(value.detail || value.details)
        : '';
      return detail ? `${choices} — ${detail}` : choices;
    }
    return Object.entries(value)
      .filter(([, item]) => hasValue(item))
      .map(([key, item]) => `${humanizeKey(key)}: ${formatHumanValue(item)}`)
      .join('; ');
  }
  return String(value);
}

function displayDate(value) {
  if (!hasValue(value)) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })} UTC`;
}

function displayStatus(value) {
  return humanizeToken(value || '');
}

function displaySourceType(value) {
  return displayStatus(value);
}

function formatHashForPdf(value) {
  const hash = formatHumanValue(value);
  if (!hash || hash.length <= 16) return hash;
  return hash.match(/.{1,16}/g).join('\n');
}

function writeHeading(doc, text, level = 1) {
  doc.moveDown(level === 1 ? 0.65 : 0.3);
  doc.font('Helvetica-Bold')
    .fontSize(level === 1 ? 14 : 10)
    .fillColor(level === 1 ? COLORS.burgundy : COLORS.navy)
    .text(text);
  doc.moveDown(0.12);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
}

function writeLabelValue(doc, label, value, { allowEmpty = false } = {}) {
  const formatted = formatHumanValue(value);
  if (!formatted && !allowEmpty) return false;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.muted).text(`${label}: `, { continued: true });
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink).text(formatted || '—');
  doc.moveDown(0.1);
  return true;
}

function writeNote(doc, text, color = COLORS.muted) {
  if (!hasValue(text)) return;
  doc.font('Helvetica').fontSize(8.5).fillColor(color).text(String(text), { lineGap: 2 });
  doc.moveDown(0.12);
}

function ensureSpace(doc, height = 40) {
  if (doc.y + height <= PAGE_HEIGHT - MARGIN - 20) return;
  doc.addPage();
}

function writeTable(doc, columns, rows, { emptyText = 'No records were provided.' } = {}) {
  const usableRows = (Array.isArray(rows) ? rows : [])
    .map(row => columns.map(column => formatHumanValue(row?.[column.key])))
    .filter(row => row.some(Boolean));
  if (usableRows.length === 0) {
    writeNote(doc, emptyText);
    return;
  }

  const headerHeight = 25;
  const cellPadding = 6;
  const drawRow = (values, rowIndex, header = false) => {
    const heights = values.map((value, index) => {
      const width = columns[index].width - (cellPadding * 2);
      doc.font(header ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(header ? 7.5 : 7.4);
      return Math.max(18, doc.heightOfString(value || '', { width, lineGap: 1 }) + (cellPadding * 2));
    });
    const rowHeight = header ? headerHeight : Math.max(...heights);
    ensureSpace(doc, rowHeight + 4);
    const top = doc.y;
    let left = MARGIN;
    values.forEach((value, index) => {
      const column = columns[index];
      doc.rect(left, top, column.width, rowHeight)
        .fillAndStroke(header ? COLORS.navy : (rowIndex % 2 ? COLORS.pale : COLORS.white), COLORS.line);
      doc.font(header ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(header ? 7.5 : 7.4)
        .fillColor(header ? COLORS.white : COLORS.ink)
        .text(value || '', left + cellPadding, top + cellPadding, {
          width: column.width - (cellPadding * 2),
          height: rowHeight - (cellPadding * 2),
          lineGap: 1,
        });
      left += column.width;
    });
    doc.y = top + rowHeight;
  };

  drawRow(columns.map(column => column.label), 0, true);
  usableRows.forEach((row, index) => drawRow(row, index, false));
  doc.moveDown(0.18);
}

function provenanceForField(field, manifest = []) {
  const manifestEntry = (Array.isArray(manifest) ? manifest : [])
    .find(entry => entry?.field_key === field?.field_key);
  const manifestProvenance = manifestEntry?.provenance
    && typeof manifestEntry.provenance === 'object'
    ? manifestEntry.provenance
    : manifestEntry;
  return {
    ...(manifestProvenance || {}),
    ...(field?.provenance || {}),
  };
}

function provenanceRow(field, manifest = []) {
  const provenance = provenanceForField(field, manifest);
  const confirmation = field?.confirmation || {};
  const sourceDocument = provenance.source_document_name
    || provenance.source_document
    || provenance.source_doc_id
    || provenance.source_document_id;
  const sourceDocumentVersion = provenance.source_document_version || provenance.source_doc_version;
  const sourceReference = provenance.evidence_id
    || provenance.reference_id
    || provenance.source_reference_id
    || provenance.source_file_hash
    || field?.field_id;
  return {
    field: field?.label || humanizeKey(field?.field_key || field?.definition_key),
    frozen_value: field?.value,
    source_type: displaySourceType(provenance.source_type || provenance.source),
    source_document: sourceDocument
      ? `${sourceDocument}${sourceDocumentVersion ? ` (v${sourceDocumentVersion})` : ''}`
      : '',
    page: provenance.source_page ?? provenance.page,
    date: displayDate(
      confirmation.verified_at
        || confirmation.confirmed_at
        || provenance.confirmed_at
        || provenance.extracted_at
        || provenance.extraction_date,
    ),
    evidence_reference: sourceReference,
  };
}

function canonicalSummaryRows(canonicalFields) {
  return (Array.isArray(canonicalFields) ? canonicalFields : [])
    .filter(field => hasValue(field?.value))
    .map(field => ({
      field: field.label || humanizeKey(field.field_key || field.definition_key),
      frozen_value: field.value,
      status: displayStatus(field.current_state || field.status),
    }));
}

function preparationRows(preparationFields) {
  return Object.entries(preparationFields || {})
    .filter(([, field]) => hasValue(field?.value))
    .map(([fieldKey, field]) => ({
      field: field?.label || humanizeKey(fieldKey),
      value: field.value,
      origin: field.inherited
        ? 'Inherited from verified transaction record'
        : (field.origin === 'preparation_input' ? 'Owner-provided preparation input' : displayStatus(field.origin)),
      status: displayStatus(field.status),
    }));
}

function uniqueExceptions(blockers = {}) {
  const entries = [
    ...(Array.isArray(blockers.recorded_exceptions) ? blockers.recorded_exceptions : []),
    ...(Array.isArray(blockers.resolved_conflicts) ? blockers.resolved_conflicts : []),
  ];
  const seen = new Set();
  return entries.filter(entry => {
    const identity = entry?.id
      || [
        entry?.field_key,
        entry?.status,
        formatHumanValue(entry?.canonical_value),
        formatHumanValue(entry?.conflicting_value),
        formatHumanValue(entry?.resolution_value),
      ].join('|');
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function exceptionRows(exceptions) {
  return exceptions.map(exception => ({
    field: exception.label || humanizeKey(exception.field_key || exception.field_id),
    status: displayStatus(exception.status || (exception.resolved_at ? 'resolved' : 'unresolved')),
    detail: exception.resolution_note
      || (hasValue(exception.resolution_value)
        ? `Resolution: ${formatHumanValue(exception.resolution_value)}`
        : hasValue(exception.conflicting_value)
          ? `Conflicting value: ${formatHumanValue(exception.conflicting_value)}`
          : ''),
    resolved_by: exception.resolved_by,
    resolved_at: displayDate(exception.resolved_at),
  }));
}

function blockerRows(blockers) {
  const groups = [
    ['Incomplete required field', blockers.incomplete_required_fields],
    ['Unresolved conflict', blockers.unresolved_conflicts],
    ['Missing approval', blockers.missing_approvals],
    ['Provenance gap', blockers.provenance_gaps],
  ];
  return groups.flatMap(([type, items]) => (Array.isArray(items) ? items : []).map(item => ({
    type,
    item: item?.label || humanizeKey(item?.field_key || item?.field_id || item?.action),
    detail: item?.requirement || item?.detail || item?.source || item?.status,
  })));
}

function approvalRows(approvals) {
  return (Array.isArray(approvals?.manifest) ? approvals.manifest : [])
    .filter(hasValue)
    .map(approval => ({
      action: displayStatus(approval.action),
      field: approval.label || humanizeKey(approval.field_key || approval.field_id),
      actor: approval.actor_role || approval.actor_email,
      date: displayDate(approval.created_at || approval.approved_at),
      reference: approval.evidence_id || approval.reference_id,
    }));
}

function historyRows(payload) {
  const history = payload?.frozen_snapshot?.created_from?.confirmation_history;
  return (Array.isArray(history) ? history : [])
    .filter(hasValue)
    .map(event => ({
      date: displayDate(event.created_at || event.createdAt),
      field: humanizeKey(event.field_key || event.field_id),
      event: displayStatus(event.event_type || event.eventType),
      actor: event.actor_role || event.actor_email,
      source_document: event.source_doc_id || event.source_document_id,
      page: event.source_page,
      reference: event.source_file_hash || event.evidence_id || event.reference_id,
    }));
}

function replaceBuffer(buffer, search, replacement) {
  if (!search.length || search.length !== replacement.length) return buffer;
  const output = Buffer.from(buffer);
  let offset = 0;
  while (offset <= output.length - search.length) {
    const index = output.indexOf(search, offset);
    if (index === -1) break;
    replacement.copy(output, index);
    offset = index + replacement.length;
  }
  return output;
}

function hashPreparationPdf(buffer, displayedArtifactHash = null) {
  let hashable = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  if (/^[a-f0-9]{64}$/i.test(String(displayedArtifactHash || ''))) {
    const hash = String(displayedArtifactHash);
    for (let index = 0; index < hash.length; index += 16) {
      const encodedHashChunk = Buffer.from(hash.slice(index, index + 16), 'utf8').toString('hex');
      const encodedPlaceholderChunk = Buffer.from(
        ARTIFACT_HASH_PLACEHOLDER.slice(index, index + 16),
        'utf8',
      ).toString('hex');
      hashable = replaceBuffer(
        hashable,
        Buffer.from(encodedHashChunk),
        Buffer.from(encodedPlaceholderChunk),
      );
    }
  }
  return crypto.createHash('sha256').update(hashable).digest('hex');
}

function buildPreparationPdfBuffer({
  propertyId,
  packageId,
  packagePayload,
  revisionId,
  revisionNumber,
  revisionCreatedAt,
  revisionHash,
  artifactHash = null,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!packagePayload || typeof packagePayload !== 'object') {
      reject(new Error('A stored preparation package payload is required.'));
      return;
    }

    const payload = clone(packagePayload);
    const sourceSnapshot = payload.source_snapshot || {};
    const frozenReadiness = payload.frozen_readiness || {};
    const preparationFields = payload.preparation_fields || {};
    const summary = payload.human_summary || {};
    const provenance = frozenReadiness.provenance_evidence || {};
    const blockers = frozenReadiness.blockers_exceptions || {};
    const approvals = frozenReadiness.approvals || {};
    const canonicalFields = Array.isArray(frozenReadiness.canonical_fields)
      ? frozenReadiness.canonical_fields
      : [];
    const disclosure = summary.disclosure
      || 'Provider-neutral preparation data only. Kontra coordinates and prepares information for external review; it does not issue, sell, recommend, custody, perform KYC/AML, transfer, trade, or settle digital assets.';
    const exceptions = uniqueExceptions(blockers);
    const blockerItems = blockerRows(blockers);

    const doc = new PDFDocument({
      size: 'LETTER',
      margin: MARGIN,
      compress: false,
      info: {
        Title: 'Digital Asset Preparation Package',
        Author: 'Kontra',
        Subject: 'Provider-neutral preparation package for external provider review',
        CreationDate: new Date(
          revisionCreatedAt
            || sourceSnapshot.recorded_at
            || payload.generated_at
            || '2000-01-01T00:00:00.000Z',
        ),
        Keywords: [
          sourceSnapshot.id,
          sourceSnapshot.snapshot_hash,
          revisionId,
          revisionHash,
          packageId,
        ].filter(Boolean).join(' '),
      },
    });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    let pageNumber = 1;
    const addPageChrome = () => {
      doc.save();
      doc.rect(MARGIN, 30, CONTENT_WIDTH, 3).fill(COLORS.teal);
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
        .text('KONTRA  /  DIGITAL ASSET PREPARATION', MARGIN, 37, { width: CONTENT_WIDTH / 2 });
      doc.text(`External review artifact  ·  Page ${pageNumber}`, MARGIN + CONTENT_WIDTH / 2, 37, {
        width: CONTENT_WIDTH / 2,
        align: 'right',
      });
      doc.restore();
    };
    doc.on('pageAdded', () => {
      pageNumber += 1;
      addPageChrome();
    });
    addPageChrome();

    doc.font('Helvetica-Bold').fontSize(21).fillColor(COLORS.navy)
      .text('Digital Asset Preparation Package');
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
      .text('Provider-neutral readiness and external review artifact');
    doc.moveDown(0.22);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
      .text('Prepared from one immutable readiness snapshot and one saved preparation revision. This document is intended to support review by qualified external providers and professionals.');

    writeHeading(doc, 'Package identity and status');
    writeTable(doc, [
      { label: 'Package', key: 'package' , width: 92 },
      { label: 'Status', key: 'status', width: 130 },
      { label: 'Revision', key: 'revision', width: 70 },
      { label: 'Revision date', key: 'revision_date', width: 115 },
      { label: 'Artifact hash', key: 'artifact_hash', width: 109 },
    ], [{
      package: packageId,
      status: displayStatus(payload.package_status),
      revision: revisionNumber,
      revision_date: displayDate(revisionCreatedAt),
      artifact_hash: formatHashForPdf(artifactHash),
    }], { emptyText: 'Package identity was not recorded.' });
    writeLabelValue(doc, 'Property / room', propertyId);
    writeLabelValue(doc, 'Preparation revision ID', revisionId);
    writeLabelValue(doc, 'Preparation revision hash', revisionHash);

    writeHeading(doc, 'Source immutable snapshot');
    writeTable(doc, [
      { label: 'Snapshot ID', key: 'id', width: 145 },
      { label: 'Version', key: 'version', width: 60 },
      { label: 'Eligibility', key: 'eligibility', width: 95 },
      { label: 'Recorded date', key: 'recorded_at', width: 110 },
      { label: 'Snapshot hash', key: 'hash', width: 106 },
    ], [{
      id: sourceSnapshot.id,
      version: sourceSnapshot.version,
      eligibility: displayStatus(sourceSnapshot.eligibility_status),
      recorded_at: displayDate(sourceSnapshot.recorded_at || frozenReadiness.snapshot_timestamp),
      hash: sourceSnapshot.snapshot_hash,
    }], { emptyText: 'Source snapshot metadata was not recorded.' });
    writeNote(doc, 'All verified facts and review references in this artifact are frozen to this snapshot. Later changes to the live Transaction Record do not alter this package.');

    writeHeading(doc, 'Verified transaction and asset summary');
    writeTable(doc, [
      { label: 'Field', key: 'field', width: 175 },
      { label: 'Frozen value', key: 'frozen_value', width: 245 },
      { label: 'Verified state', key: 'status', width: 96 },
    ], canonicalSummaryRows(canonicalFields), { emptyText: 'No verified transaction or asset facts were recorded.' });

    writeHeading(doc, 'Digital Asset Preparation fields');
    writeTable(doc, [
      { label: 'Preparation field', key: 'field', width: 155 },
      { label: 'Prepared value', key: 'value', width: 225 },
      { label: 'Source / origin', key: 'origin', width: 90 },
      { label: 'Status', key: 'status', width: 46 },
    ], preparationRows(preparationFields), { emptyText: 'No preparation fields with values were recorded.' });
    if (Array.isArray(summary.missing_preparation_field_names) && summary.missing_preparation_field_names.length > 0) {
      writeNote(doc, `Information still required: ${summary.missing_preparation_field_names.join('; ')}`, COLORS.burgundy);
    }

    writeHeading(doc, 'Readiness, approvals, blockers and exceptions');
    writeTable(doc, [
      { label: 'Readiness status', key: 'status', width: 155 },
      { label: 'Eligible', key: 'eligible', width: 70 },
      { label: 'Canonical fields', key: 'canonical', width: 100 },
      { label: 'Provenance', key: 'provenance', width: 95 },
      { label: 'Approvals', key: 'approvals', width: 96 },
    ], [{
      status: displayStatus(frozenReadiness.status),
      eligible: frozenReadiness.eligible,
      canonical: summary.readiness || frozenReadiness.readiness,
      provenance: provenance.intact ? 'Intact' : `${provenance.gap_count || 0} gap(s)`,
      approvals: approvals.satisfied ? 'Satisfied' : `${approvals.missing_count || 0} missing`,
    }], { emptyText: 'Readiness status was not recorded.' });
    writeLabelValue(doc, 'Snapshot eligibility status', displayStatus(sourceSnapshot.eligibility_status));
    writeLabelValue(doc, 'Preparation package status', displayStatus(payload.package_status));
    writeLabelValue(doc, 'Settlement method', displayStatus(frozenReadiness.settlement_mode));
    writeLabelValue(doc, 'Blocking item count', blockers.blocking_count);
    writeLabelValue(doc, 'All blockers resolved', blockers.resolved);
    writeLabelValue(doc, 'Evidence entries', provenance.evidence_entry_count);
    writeLabelValue(doc, 'Required approval events', approvals.event_count);

    if (blockerItems.length > 0) {
      writeHeading(doc, 'Open blockers and exceptions', 2);
      writeTable(doc, [
        { label: 'Category', key: 'type', width: 125 },
        { label: 'Item', key: 'item', width: 190 },
        { label: 'Review detail', key: 'detail', width: 201 },
      ], blockerItems);
    } else {
      writeNote(doc, 'No unresolved blockers, conflicts, approval gaps, or provenance gaps were recorded.', COLORS.teal);
    }

    if (exceptions.length > 0) {
      writeHeading(doc, 'Exception and resolution register', 2);
      writeTable(doc, [
        { label: 'Field', key: 'field', width: 125 },
        { label: 'Status', key: 'status', width: 78 },
        { label: 'Resolution / detail', key: 'detail', width: 185 },
        { label: 'Resolved by', key: 'resolved_by', width: 75 },
        { label: 'Resolved date', key: 'resolved_at', width: 53 },
      ], exceptionRows(exceptions));
    }

    writeHeading(doc, 'Approvals and review record');
    writeTable(doc, [
      { label: 'Action', key: 'action', width: 95 },
      { label: 'Field / scope', key: 'field', width: 155 },
      { label: 'Reviewer', key: 'actor', width: 115 },
      { label: 'Date', key: 'date', width: 95 },
      { label: 'Reference', key: 'reference', width: 56 },
    ], approvalRows(approvals), { emptyText: 'No approval events were recorded.' });

    writeHeading(doc, 'Provider-neutral disclaimer');
    writeNote(doc, disclosure);
    writeNote(doc, 'External providers and qualified professionals must perform their own review. This artifact does not constitute issuance, an offer, a recommendation, legal advice, regulatory approval, KYC/AML completion, custody, or settlement execution.');

    doc.addPage();
    writeHeading(doc, 'Evidence & Provenance Appendix');
    writeNote(doc, 'The following tables present the frozen provenance projection in a human-readable format. The complete machine-readable provenance, evidence manifest, confirmation history, and audit records remain preserved in the underlying package payload.');
    writeTable(doc, [
      { label: 'Field', key: 'field', width: 86 },
      { label: 'Frozen value', key: 'frozen_value', width: 100 },
      { label: 'Source type', key: 'source_type', width: 72 },
      { label: 'Source document', key: 'source_document', width: 90 },
      { label: 'Page', key: 'page', width: 34 },
      { label: 'Confirmation / extraction date', key: 'date', width: 82 },
      { label: 'Evidence / reference ID', key: 'evidence_reference', width: 52 },
    ], canonicalFields
      .filter(field => hasValue(field?.value))
      .map(field => provenanceRow(field, provenance.manifest)), {
      emptyText: 'No canonical fields with frozen values were recorded.',
    });

    const manifestRows = (Array.isArray(provenance.manifest) ? provenance.manifest : [])
      .filter(hasValue)
      .map(entry => {
        const entryField = canonicalFields.find(field => field?.field_key === entry?.field_key);
        const row = provenanceRow(entryField || {
          field_key: entry.field_key,
          label: humanizeKey(entry.field_key),
          value: entry.value,
          provenance: entry.provenance || entry,
        }, []);
        return {
          field: row.field,
          source_type: row.source_type,
          source_document: row.source_document,
          page: row.page,
          evidence_reference: row.evidence_reference,
        };
      });
    if (manifestRows.length > 0) {
      writeHeading(doc, 'Evidence reference register', 2);
      writeTable(doc, [
        { label: 'Field', key: 'field', width: 170 },
        { label: 'Source type', key: 'source_type', width: 105 },
        { label: 'Source document', key: 'source_document', width: 105 },
        { label: 'Page', key: 'page', width: 45 },
        { label: 'Evidence / reference ID', key: 'evidence_reference', width: 91 },
      ], manifestRows);
    }

    const confirmationRows = historyRows(payload);
    if (confirmationRows.length > 0) {
      writeHeading(doc, 'Confirmation and extraction history', 2);
      writeTable(doc, [
        { label: 'Date', key: 'date', width: 86 },
        { label: 'Field', key: 'field', width: 115 },
        { label: 'Event', key: 'event', width: 95 },
        { label: 'Actor', key: 'actor', width: 82 },
        { label: 'Source document', key: 'source_document', width: 78 },
        { label: 'Page', key: 'page', width: 32 },
        { label: 'Reference', key: 'reference', width: 28 },
      ], confirmationRows);
    }

    doc.end();
  });
}

module.exports = {
  ARTIFACT_HASH_PLACEHOLDER,
  PREPARATION_PDF_BUCKET,
  PREPARATION_PDF_SCHEMA,
  PREPARATION_PDF_VERSION,
  buildPreparationPdfBuffer,
  hashPreparationPdf,
  displayValue: formatHumanValue,
};