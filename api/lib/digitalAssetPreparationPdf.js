'use strict';

const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const KONTRA_LOGO = require('./kontraLogo');

const PREPARATION_PDF_BUCKET = 'deal-documents';
const PREPARATION_PDF_SCHEMA = 'kontra.digital-asset-preparation-pdf';
const PREPARATION_PDF_VERSION = '1.0.0';
const ARTIFACT_HASH_PLACEHOLDER = '.'.repeat(64);
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

const COLORS = {
  navy: '#0f172a',
  burgundy: '#800020',
  ink: '#17202a',
  brandRed: '#e5484d',
  muted: '#64748b',
  line: '#e5e7eb',
  subtleLine: '#f1f5f9',
  pale: '#f8fafc',
  paleRed: '#fdecec',
  paleGreen: '#f0fdf4',
  paleAmber: '#fffbeb',
  amber: '#f59e0b',
  green: '#16a34a',
  darkGreen: '#166534',
  paleBlue: '#eff6ff',
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

function isCurrencyField(fieldKey, label) {
  return /amount|cost|price|value|funds|proceeds|revenue|ebitda|loan|debt|equity|capital|rent|budget|income|expense|consideration|valuation|cash|invoice|repairs?\s+completed|fund\s+release\s+request/i
    .test(`${fieldKey || ''} ${label || ''}`);
}

function isPercentageField(fieldKey, label) {
  return /percent|percentage|rate|yield|ownership|share|margin|interest/i
    .test(`${fieldKey || ''} ${label || ''}`);
}

function numericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[$,%\s,]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value) {
  const numeric = numericValue(value);
  if (numeric === null) return formatHumanValue(value);
  return `$${numeric.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;
}

function formatPercentage(value) {
  const numeric = numericValue(value);
  if (numeric === null) return formatHumanValue(value);
  const source = String(value);
  const percentage = source.includes('%') || Math.abs(numeric) > 1 || numeric === 0
    ? numeric
    : numeric * 100;
  return `${percentage.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function formatDisplayValue(value, { fieldKey = '', label = '' } = {}) {
  if (!hasValue(value)) return '';
  if (isPercentageField(fieldKey, label)) return formatPercentage(value);
  if (isCurrencyField(fieldKey, label)) return formatCurrency(value);
  return formatHumanValue(value);
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
  })}`;
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
  doc.x = MARGIN;
  doc.moveDown(level === 1 ? 0.35 : 0.22);
  const headingY = doc.y;
  if (level === 1) {
    doc.roundedRect(MARGIN, headingY + 2, 4, 14, 2).fill(COLORS.burgundy);
  }
  doc.font('Helvetica-Bold')
    .fontSize(level === 1 ? 13 : 9.5)
    .fillColor(level === 1 ? COLORS.navy : COLORS.burgundy)
    .text(text, MARGIN + (level === 1 ? 11 : 0), headingY, {
      width: CONTENT_WIDTH - (level === 1 ? 11 : 0),
    });
  doc.y = headingY + (level === 1 ? 20 : 15);
  doc.x = MARGIN;
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
}

function writeLabelValue(doc, label, value, { allowEmpty = false } = {}) {
  const formatted = formatHumanValue(value);
  if (!formatted && !allowEmpty) return false;
  doc.x = MARGIN;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.muted)
    .text(`${label}: `, MARGIN, doc.y, { continued: true, width: CONTENT_WIDTH });
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink)
    .text(formatted || '—', { width: CONTENT_WIDTH });
  doc.moveDown(0.1);
  doc.x = MARGIN;
  return true;
}

function writeNote(doc, text, color = COLORS.muted) {
  if (!hasValue(text)) return;
  doc.x = MARGIN;
  doc.font('Helvetica').fontSize(8).fillColor(color)
    .text(String(text), MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 2 });
  doc.moveDown(0.16);
  doc.x = MARGIN;
}

function statusTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (/not eligible|ineligible|not recorded|not ready|not satisfied|missing|block|unresolved|incomplete|exception|gap|error|rejected/.test(normalized)) {
    return { text: COLORS.burgundy, fill: COLORS.paleRed, accent: COLORS.brandRed };
  }
  if (/warning|warn|pending|review|attention|partial|in progress/.test(normalized)) {
    return { text: '#92400e', fill: COLORS.paleAmber, accent: COLORS.amber };
  }
  if (/eligible|confirmed|recorded|satisfied|intact|ready|approved|resolved|complete/.test(normalized)) {
    return { text: COLORS.darkGreen, fill: COLORS.paleGreen, accent: COLORS.green };
  }
  return { text: COLORS.navy, fill: COLORS.pale, accent: COLORS.muted };
}

function writeMetricCards(doc, items, { columns = 4, startY = doc.y, height = 67, gap = 8 } = {}) {
  const rows = Math.ceil(items.length / columns);
  const width = (CONTENT_WIDTH - (gap * (columns - 1))) / columns;
  items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + column * (width + gap);
    const y = startY + row * (height + gap);
    const tone = item.tone && item.tone !== 'neutral'
      ? statusTone(item.tone === 'success' ? 'complete' : item.tone === 'critical' ? 'blocker' : item.tone)
      : statusTone(item.value);
    doc.roundedRect(x, y, width, height, 5)
      .fillAndStroke(item.tone === 'neutral' ? COLORS.white : tone.fill, COLORS.line);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted)
      .text(item.label.toUpperCase(), x + 10, y + 10, { width: width - 20 });
    doc.font('Helvetica-Bold').fontSize(item.valueSize || 14).fillColor(item.color || tone.text)
      .text(formatHumanValue(item.value) || '—', x + 10, y + 27, {
        width: width - 20,
        height: height - 35,
        lineGap: 1,
      });
    if (item.detail) {
      doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted)
        .text(item.detail, x + 10, y + height - 15, { width: width - 20 });
    }
  });
  const totalHeight = rows * height + Math.max(0, rows - 1) * gap;
  doc.y = startY + totalHeight;
  doc.x = MARGIN;
  return totalHeight;
}

function writeCallout(doc, title, body, tone = 'neutral') {
  const palette = tone === 'success'
    ? { fill: COLORS.paleGreen, border: '#bbf7d0', accent: COLORS.green, text: COLORS.darkGreen }
    : tone === 'critical'
      ? { fill: COLORS.paleRed, border: '#fecaca', accent: COLORS.brandRed, text: COLORS.burgundy }
      : tone === 'warning'
        ? { fill: COLORS.paleAmber, border: '#fde68a', accent: COLORS.amber, text: '#92400e' }
      : { fill: COLORS.pale, border: COLORS.line, accent: COLORS.muted, text: COLORS.navy };
  const bodyText = String(body || '');
  doc.font('Helvetica').fontSize(8);
  const bodyHeight = Math.max(18, doc.heightOfString(bodyText, { width: CONTENT_WIDTH - 34, lineGap: 2 }));
  const height = 28 + bodyHeight;
  const y = doc.y;
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 5).fillAndStroke(palette.fill, palette.border);
  doc.rect(MARGIN, y, 4, height).fill(palette.accent);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(palette.text)
    .text(title, MARGIN + 14, y + 9, { width: CONTENT_WIDTH - 28 });
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.ink)
    .text(bodyText, MARGIN + 14, y + 22, { width: CONTENT_WIDTH - 28, lineGap: 2 });
  doc.y = y + height + 10;
  doc.x = MARGIN;
}

function writeKeyValueGrid(doc, items, { columns = 2, rowHeight = 40, gap = 8 } = {}) {
  const width = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const startY = doc.y;
  items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + column * (width + gap);
    const y = startY + row * (rowHeight + gap);
    doc.roundedRect(x, y, width, rowHeight, 4).fillAndStroke(item.fill || COLORS.white, COLORS.line);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted)
      .text(item.label.toUpperCase(), x + 10, y + 8, { width: width - 20 });
    doc.font('Helvetica').fontSize(item.valueSize || 8.5).fillColor(item.color || COLORS.ink)
      .text(formatHumanValue(item.value) || '—', x + 10, y + 21, {
        width: width - 20,
        height: rowHeight - 25,
        lineGap: 1,
      });
  });
  const rows = Math.ceil(items.length / columns);
  doc.y = startY + rows * rowHeight + Math.max(0, rows - 1) * gap;
  doc.x = MARGIN;
}

function drawKLockup(doc, logoImage) {
  const x = MARGIN;
  doc.image(logoImage, x, 31, { width: 96, height: 24 });
}

function ensureSpace(doc, height = 40) {
  if (doc.y + height <= PAGE_HEIGHT - MARGIN - 20) return;
  doc.addPage();
}

function writeTable(doc, columns, rows, {
  emptyText = 'No records were provided.',
  keepTogether = false,
} = {}) {
  const usableRows = (Array.isArray(rows) ? rows : [])
    .map(row => columns.map(column => column.format
      ? column.format(row?.[column.key], row)
      : formatHumanValue(row?.[column.key])))
    .filter(row => row.some(Boolean));
  if (usableRows.length === 0) {
    writeNote(doc, emptyText);
    return;
  }

  const headerHeight = 23;
  const cellPadding = 6;
  const fontForCell = (column, header) => (
    header ? 'Helvetica-Bold' : (column.font || 'Helvetica')
  );
  const rowHeightFor = (values, header = false) => {
    const heights = values.map((value, index) => {
      const width = columns[index].width - (cellPadding * 2);
      doc.font(fontForCell(columns[index], header))
        .fontSize(header ? 7.2 : 7.2);
      return Math.max(17, doc.heightOfString(value || '', { width, lineGap: 1 }) + (cellPadding * 2));
    });
    return header ? headerHeight : Math.max(...heights);
  };
  if (keepTogether) {
    const estimatedHeight = headerHeight
      + usableRows.reduce((height, row) => height + rowHeightFor(row), 0)
      + 12;
    ensureSpace(doc, estimatedHeight);
  }
  const drawRow = (values, rowIndex, header = false) => {
    const rowHeight = rowHeightFor(values, header);
    ensureSpace(doc, rowHeight + 4);
    const top = doc.y;
    let left = MARGIN;
    const rowFill = header ? COLORS.navy : (rowIndex % 2 ? COLORS.pale : COLORS.white);
    doc.rect(MARGIN, top, CONTENT_WIDTH, rowHeight).fill(rowFill);
    values.forEach((value, index) => {
      const column = columns[index];
      doc.font(fontForCell(column, header))
        .fontSize(header ? 7.2 : 7.2)
        .fillColor(header ? COLORS.white : COLORS.ink)
        .text(value || '', left + cellPadding, top + cellPadding, {
          width: column.width - (cellPadding * 2),
          height: rowHeight - (cellPadding * 2),
          lineGap: 1,
        });
      left += column.width;
    });
    doc.moveTo(MARGIN, top + rowHeight)
      .lineTo(MARGIN + CONTENT_WIDTH, top + rowHeight)
      .lineWidth(header ? 0.7 : 0.35)
      .strokeColor(header ? COLORS.navy : COLORS.line)
      .stroke();
    doc.y = top + rowHeight;
    doc.x = MARGIN;
  };

  drawRow(columns.map(column => column.label), 0, true);
  usableRows.forEach((row, index) => drawRow(row, index, false));
  doc.moveDown(0.18);
  doc.x = MARGIN;
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
  const sourceDocumentText = sourceDocument
    ? `${sourceDocument}${sourceDocumentVersion ? ` (v${sourceDocumentVersion})` : ''}${provenance.source_page ?? provenance.page ? ` · Page ${provenance.source_page ?? provenance.page}` : ''}`
    : displaySourceType(provenance.source_type || provenance.source);
  return {
    field: field?.label || humanizeKey(field?.field_key || field?.definition_key),
    frozen_value: formatDisplayValue(field?.value, {
      fieldKey: field?.field_key || field?.definition_key,
      label: field?.label,
    }),
    source: sourceDocumentText,
    evidence_reference: formatHashForPdf(sourceReference),
    date: displayDate(
      confirmation.verified_at
        || confirmation.confirmed_at
        || provenance.confirmed_at
        || provenance.extracted_at
        || provenance.extraction_date,
    ),
  };
}

function canonicalSummaryRows(canonicalFields) {
  return (Array.isArray(canonicalFields) ? canonicalFields : [])
    .map(field => ({
      field: field.label || humanizeKey(field.field_key || field.definition_key),
      frozen_value: hasValue(field?.value)
        ? formatDisplayValue(field.value, {
          fieldKey: field.field_key || field.definition_key,
          label: field.label,
        })
        : 'Not recorded',
      status: displayStatus(field.current_state || field.status) || 'Not recorded',
    }));
}

function preparationRows(preparationFields) {
  return Object.entries(preparationFields || {})
    .filter(([, field]) => hasValue(field?.value))
    .map(([fieldKey, field]) => ({
      field: field?.label || humanizeKey(fieldKey),
      value: formatDisplayValue(field.value, {
        fieldKey,
        label: field?.label,
      }),
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
        ? `Resolution: ${formatDisplayValue(exception.resolution_value, {
          fieldKey: exception.field_key,
          label: exception.label,
        })}`
        : hasValue(exception.conflicting_value)
          ? `Conflicting value: ${formatDisplayValue(exception.conflicting_value, {
            fieldKey: exception.field_key,
            label: exception.label,
          })}`
          : ''),
    resolved_by: displayStatus(exception.resolved_by),
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

function provenanceRows(canonicalFields, manifest) {
  const fields = Array.isArray(canonicalFields) ? canonicalFields : [];
  const manifestEntries = Array.isArray(manifest) ? manifest : [];
  const rows = [];
  const seen = new Set();

  fields.forEach(field => {
    if (!hasValue(field?.value)) return;
    const key = field?.field_key || field?.definition_key || field?.label;
    if (key) seen.add(key);
    rows.push(provenanceRow(field, manifestEntries));
  });

  manifestEntries.forEach(entry => {
    const key = entry?.field_key || entry?.field_id || entry?.label;
    if (!key || seen.has(key) || !hasValue(entry?.value)) return;
    rows.push(provenanceRow({
      field_key: entry.field_key || entry.field_id,
      label: entry.label,
      value: entry.value,
      provenance: entry.provenance || entry,
    }, []));
    seen.add(key);
  });

  return rows;
}

function approvalSummary(approvals) {
  const manifestCount = Array.isArray(approvals?.manifest) ? approvals.manifest.length : 0;
  const eventCount = Number.isFinite(Number(approvals?.event_count))
    ? Number(approvals.event_count)
    : manifestCount;
  if (approvals?.satisfied) {
    return `Required approvals satisfied — ${eventCount} approval events recorded.`;
  }
  const missingCount = Number.isFinite(Number(approvals?.missing_count))
    ? Number(approvals.missing_count)
    : 0;
  return `Required approvals incomplete — ${missingCount} approval gap(s); ${eventCount} approval events recorded.`;
}

function technicalRows({
  packageHash,
  packageId,
  revisionId,
  revisionHash,
  sourceSnapshot,
  artifactHash,
}) {
  return [
    { label: 'Package hash', value: packageHash },
    { label: 'Preparation revision hash', value: revisionHash },
    { label: 'Immutable snapshot hash', value: sourceSnapshot.snapshot_hash },
    { label: 'PDF artifact hash', value: artifactHash },
    { label: 'Package ID', value: packageId },
    { label: 'Preparation revision ID', value: revisionId },
    { label: 'Snapshot ID', value: sourceSnapshot.id },
  ].filter(row => hasValue(row.value));
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
    const disclosure = summary.disclosure || 'Provider-neutral preparation data only.';
    const standardDisclosure = 'Kontra prepares and verifies transaction information for external review but does not issue, sell, recommend, custody, perform KYC/AML, transfer, trade, or settle digital assets.';
    const disclosureText = /does not issue/i.test(disclosure)
      ? disclosure
      : `${disclosure} ${standardDisclosure}`;
    const exceptions = uniqueExceptions(blockers);
    const blockerItems = blockerRows(blockers);
    const recordedBlockerCount = Number(blockers.blocking_count);
    const openBlockerCount = Number.isFinite(recordedBlockerCount)
      ? Math.max(blockerItems.length, recordedBlockerCount)
      : blockerItems.length;

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

    const logoImage = doc.openImage(KONTRA_LOGO);
    logoImage.embed(doc);
    let pageNumber = 1;
    const addPageChrome = () => {
      doc.save();
      doc.rect(MARGIN, 28, CONTENT_WIDTH, 2).fill(COLORS.burgundy);
      drawKLockup(doc, logoImage);
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
        .text('DIGITAL ASSET PREPARATION', MARGIN + 132, 37, { width: 160 });
      doc.text(`External Review Artifact · Page ${pageNumber}`, MARGIN + CONTENT_WIDTH / 2, 37, {
        width: CONTENT_WIDTH / 2,
        align: 'right',
      });
      doc.restore();
      doc.x = MARGIN;
    };
    doc.on('pageAdded', () => {
      pageNumber += 1;
      addPageChrome();
    });
    addPageChrome();

    const startNextPage = () => {
      doc.addPage();
      doc.y = 76;
      doc.x = MARGIN;
    };

    doc.y = 76;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.burgundy)
      .text('EXTERNAL REVIEW ARTIFACT', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.28);
    doc.font('Helvetica-Bold').fontSize(25).fillColor(COLORS.navy)
      .text('Digital Asset Preparation', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
      .text('Provider-neutral package for qualified external review', MARGIN, doc.y + 3, {
        width: CONTENT_WIDTH,
      });
    doc.y += 36;
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
      .text('Prepared from one immutable readiness snapshot and one saved preparation revision. This artifact organizes verified transaction data and owner-provided preparation inputs for independent external review.', MARGIN, doc.y, {
        width: CONTENT_WIDTH,
        lineGap: 2,
      });

    writeHeading(doc, 'Executive summary');
    writeMetricCards(doc, [
      { label: 'Eligibility', value: frozenReadiness.eligible ? 'Eligible' : 'Not eligible', valueSize: 12 },
      { label: 'Verified Record', value: summary.readiness || frozenReadiness.readiness || 'Not recorded', valueSize: 11 },
      { label: 'Provenance', value: provenance.intact ? 'Intact' : `${provenance.gap_count || 0} gap(s)`, valueSize: 12 },
      {
        label: 'Open Blockers',
        value: openBlockerCount === 0 ? 'None' : openBlockerCount,
        valueSize: openBlockerCount === 0 ? 11 : 14,
        color: openBlockerCount === 0 ? COLORS.darkGreen : COLORS.burgundy,
        tone: openBlockerCount === 0 ? 'success' : 'critical',
      },
      {
        label: 'Source Snapshot',
        value: sourceSnapshot.version == null ? 'Not recorded' : `v${sourceSnapshot.version}`,
        valueSize: 13,
        detail: sourceSnapshot.id || undefined,
      },
    ], { columns: 3, height: 64, gap: 8 });

    writeHeading(doc, 'Package metadata');
    writeKeyValueGrid(doc, [
      { label: 'Property / transaction', value: propertyId, valueSize: 9 },
      { label: 'Package status', value: displayStatus(payload.package_status), color: statusTone(payload.package_status).text },
      { label: 'Preparation revision', value: revisionNumber ?? 'Not recorded' },
      { label: 'Revision date', value: displayDate(revisionCreatedAt) || 'Not recorded' },
      { label: 'Generated', value: displayDate(revisionCreatedAt || sourceSnapshot.recorded_at) || 'Not recorded' },
      { label: 'Settlement method', value: displayStatus(frozenReadiness.settlement_mode) || 'Not recorded', valueSize: 9 },
    ], { rowHeight: 43 });
    writeNote(doc, 'The complete frozen canonical Transaction Record is presented on page 2. Later changes to the live record do not alter this package.');

    startNextPage();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.burgundy)
      .text('01 / FROZEN RECORD', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.navy)
      .text('Frozen canonical Transaction Record', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.16);
    writeNote(doc, 'Read-only values captured in the selected immutable readiness snapshot. Verification state is shown for every recorded field.');
    writeTable(doc, [
      { label: 'Canonical field', key: 'field', width: 172 },
      { label: 'Frozen value', key: 'frozen_value', width: 252 },
      { label: 'State', key: 'status', width: 92 },
    ], canonicalSummaryRows(canonicalFields), {
      emptyText: 'No canonical Transaction Record fields were recorded.',
    });
    writeCallout(doc, 'Snapshot boundary', `Snapshot version ${sourceSnapshot.version ?? 'not recorded'} · ${displayDate(sourceSnapshot.recorded_at || frozenReadiness.snapshot_timestamp) || 'recorded date not available'}. Values and evidence references on this page are frozen.`, 'neutral');

    startNextPage();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.burgundy)
      .text('02 / PREPARATION INPUTS', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.navy)
      .text('Digital Asset Preparation fields', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.16);
    writeNote(doc, 'These values are owner-provided preparation inputs or values inherited from the verified Transaction Record. They support external review and do not represent an issuance or settlement decision.');
    writeTable(doc, [
      { label: 'Preparation field', key: 'field', width: 136 },
      { label: 'Prepared value', key: 'value', width: 224 },
      { label: 'Origin', key: 'origin', width: 100 },
      { label: 'Status', key: 'status', width: 56 },
    ], preparationRows(preparationFields), {
      emptyText: 'No preparation fields with values were recorded.',
    });
    if (Array.isArray(summary.missing_preparation_field_names) && summary.missing_preparation_field_names.length > 0) {
      writeCallout(doc, 'Information still required', summary.missing_preparation_field_names.join('; '), 'critical');
    } else {
      writeCallout(doc, 'Preparation inputs', 'No missing required preparation fields were recorded in this revision.', 'success');
    }
    writeNote(doc, 'Jurisdiction denotes legal geography. Regulation D/S belongs under Security Offering Structure when applicable.', COLORS.muted);

    startNextPage();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.burgundy)
      .text('03 / VERIFICATION & EXCEPTIONS', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.navy)
      .text('Verification, approvals & exceptions', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.16);
    writeMetricCards(doc, [
      { label: 'Readiness status', value: displayStatus(frozenReadiness.status) || 'Not recorded', valueSize: 10 },
      { label: 'Approvals', value: approvals.satisfied ? 'Satisfied' : `${approvals.missing_count || 0} missing`, valueSize: 10 },
      { label: 'Evidence entries', value: provenance.evidence_entry_count ?? 0, valueSize: 14 },
      { label: 'Blocking items', value: blockerItems.length + (Number(blockers.blocking_count) || 0), valueSize: 14 },
    ], { columns: 4, height: 60, gap: 7 });
    writeCallout(doc, 'Approval review', approvalSummary(approvals), approvals.satisfied ? 'success' : 'critical');
    writeHeading(doc, 'Open blockers', 2);
    if (blockerItems.length > 0) {
      writeTable(doc, [
        { label: 'Category', key: 'type', width: 120 },
        { label: 'Item', key: 'item', width: 176 },
        { label: 'Review detail', key: 'detail', width: 220 },
      ], blockerItems);
    } else {
      writeCallout(doc, 'Clear for review', 'No unresolved blockers, conflicts, approval gaps, or provenance gaps were recorded.', 'success');
    }
    writeHeading(doc, 'Approval record', 2);
    writeTable(doc, [
      { label: 'Action', key: 'action', width: 94 },
      { label: 'Field', key: 'field', width: 168 },
      { label: 'Actor', key: 'actor', width: 106 },
      { label: 'Date', key: 'date', width: 76 },
      { label: 'Reference', key: 'reference', width: 72 },
    ], approvalRows(approvals), { emptyText: 'No approval manifest entries were recorded.' });
    if (exceptions.length > 0) {
      writeHeading(doc, 'Exception and resolution history', 2);
      writeTable(doc, [
        { label: 'Field', key: 'field', width: 100 },
        { label: 'Status', key: 'status', width: 68 },
        { label: 'Resolution / detail', key: 'detail', width: 178 },
        { label: 'Resolved by', key: 'resolved_by', width: 78 },
        { label: 'Date', key: 'resolved_at', width: 92 },
      ], exceptionRows(exceptions));
    }
    writeNote(doc, 'The underlying package preserves the complete approval history, confirmation history, evidence records, and immutable audit trail.', COLORS.muted);

    const evidenceRows = provenanceRows(canonicalFields, provenance.manifest);
    const evidenceMidpoint = Math.ceil(evidenceRows.length / 2);
    startNextPage();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.burgundy)
      .text('04 / EVIDENCE APPENDIX', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.navy)
      .text('Evidence & Provenance Appendix', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.16);
    writeNote(doc, 'Supporting evidence references for the frozen values. Source document and page are combined when available; long references are line-broken for readability.');
    writeTable(doc, [
      { label: 'Field', key: 'field', width: 110 },
      { label: 'Frozen value', key: 'frozen_value', width: 138 },
      { label: 'Source', key: 'source', width: 120 },
      { label: 'Evidence reference', key: 'evidence_reference', width: 80 },
      { label: 'Verified date', key: 'date', width: 68 },
    ], evidenceRows.slice(0, evidenceMidpoint), {
      emptyText: 'No frozen provenance entries were recorded.',
    });
    writeNote(doc, `Appendix segment 1 of 2 · ${evidenceRows.length} total provenance entries.`, COLORS.muted);

    startNextPage();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.burgundy)
      .text('05 / EVIDENCE APPENDIX · CONTINUED', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.navy)
      .text('Evidence & Provenance Appendix', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.16);
    writeTable(doc, [
      { label: 'Field', key: 'field', width: 110 },
      { label: 'Frozen value', key: 'frozen_value', width: 138 },
      { label: 'Source', key: 'source', width: 120 },
      { label: 'Evidence reference', key: 'evidence_reference', width: 80 },
      { label: 'Verified date', key: 'date', width: 68 },
    ], evidenceRows.slice(evidenceMidpoint), {
      emptyText: 'No additional frozen provenance entries were recorded.',
    });
    writeHeading(doc, 'Evidence event history', 2);
    writeTable(doc, [
      { label: 'Date', key: 'date', width: 66 },
      { label: 'Field', key: 'field', width: 116 },
      { label: 'Event', key: 'event', width: 98 },
      { label: 'Actor', key: 'actor', width: 82 },
      { label: 'Source document', key: 'source_document', width: 100 },
      { label: 'Page / reference', key: 'reference', width: 54 },
    ], historyRows(payload), { emptyText: 'No evidence event history was recorded.' });
    writeNote(doc, `Appendix segment 2 of 2 · ${evidenceRows.length} total provenance entries.`, COLORS.muted);

    startNextPage();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.burgundy)
      .text('06 / TECHNICAL INTEGRITY', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.navy)
      .text('Technical integrity & provider-neutral use', MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.2);
    writeCallout(doc, 'Artifact integrity', 'Identifiers and hashes below bind this PDF to the selected preparation package, revision, and immutable readiness snapshot.', 'neutral');
    writeTable(doc, [
      { label: 'Identifier or hash', key: 'label', width: 180 },
      {
        label: 'Recorded value',
        key: 'value',
        width: 336,
        font: 'Courier',
        format: (value, row) => /hash/i.test(row?.label || '')
          ? formatHashForPdf(value)
          : formatHumanValue(value),
      },
    ], technicalRows({
      packageHash: payload.package_hash,
      packageId,
      revisionId,
      revisionHash,
      sourceSnapshot,
      artifactHash,
    }), { keepTogether: true });
    writeHeading(doc, 'Provider-neutral disclaimer');
    writeNote(doc, disclosureText);
    writeNote(doc, 'External providers and qualified professionals must perform their own review and make their own legal, regulatory, investment, KYC/AML, custody, transfer, trading, and settlement determinations. This artifact is not an offer, recommendation, approval, or execution instruction.');
    writeNote(doc, 'Kontra coordinates, verifies, and prepares information for review; it does not issue, sell, recommend, custody, transfer, trade, or settle digital assets.', COLORS.burgundy);

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