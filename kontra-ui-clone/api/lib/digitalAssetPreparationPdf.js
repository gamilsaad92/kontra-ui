'use strict';

const crypto = require('crypto');
const PDFDocument = require('pdfkit');

const PREPARATION_PDF_BUCKET = 'deal-documents';
const PREPARATION_PDF_SCHEMA = 'kontra.digital-asset-preparation-pdf';
const PREPARATION_PDF_VERSION = '1.0.0';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function displayValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

function displayDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function displayStatus(value) {
  return String(value || 'Not recorded').replace(/_/g, ' ');
}

function writeHeading(doc, text, level = 1) {
  doc.moveDown(level === 1 ? 0.75 : 0.35);
  doc.font('Helvetica-Bold').fontSize(level === 1 ? 14 : 10).fillColor('#800020').text(text);
  doc.moveDown(0.15);
  doc.font('Helvetica').fontSize(9).fillColor('#1f2937');
}

function writeLabelValue(doc, label, value) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text(`${label}: `, { continued: true });
  doc.font('Helvetica').fontSize(9).fillColor('#111827').text(displayValue(value));
  doc.moveDown(0.12);
}

function writeBullet(doc, label, value) {
  doc.font('Helvetica').fontSize(8.5).fillColor('#374151').text(`• ${label}: `, { continued: true });
  doc.font('Helvetica').fontSize(8.5).fillColor('#111827').text(displayValue(value));
}

function writeList(doc, items, emptyText = 'None recorded.') {
  if (!Array.isArray(items) || items.length === 0) {
    doc.font('Helvetica').fontSize(8.5).fillColor('#4b5563').text(emptyText);
    return;
  }
  items.forEach(item => {
    const label = item?.label || item?.field_key || item?.field_id || item?.action || 'Recorded item';
    const detail = item?.detail
      || item?.state
      || item?.requirement
      || item?.resolution_note
      || item?.status
      || item?.source
      || '';
    writeBullet(doc, label, detail || displayValue(item));
  });
}

function writePreparationField(doc, fieldKey, field = {}) {
  const label = field.label || fieldKey.replace(/_/g, ' ');
  const metadata = [
    field.required ? 'Required' : 'Optional',
    displayStatus(field.status),
    field.origin || 'preparation_input',
  ].join(' · ');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(label);
  doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text(`${fieldKey} · ${metadata}`);
  doc.font('Helvetica').fontSize(8.5).fillColor('#111827').text(`Value: ${displayValue(field.value)}`);
  if (field.inherited_from?.field_key || field.source_field_key) {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#4b5563').text(
      `Source: ${field.source_field_key || field.inherited_from.field_key}`,
    );
  }
  doc.moveDown(0.22);
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
      || 'Provider-neutral preparation data only. Kontra does not issue, sell, recommend, custody, perform KYC/AML, transfer, trade, or settle digital assets.';

    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 48,
      compress: false,
      info: {
        Title: 'Digital Asset Preparation Package',
        Author: 'Kontra',
        Subject: 'Provider-neutral preparation package for external provider review',
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

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#800020').text('Digital Asset Preparation Package');
    doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text('Provider-neutral readiness and external review preparation artifact');
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(
      'This document is generated from one immutable readiness snapshot and one saved preparation revision.',
    );

    writeHeading(doc, 'Artifact identity');
    writeLabelValue(doc, 'Property / room', propertyId);
    writeLabelValue(doc, 'Package ID', packageId);
    writeLabelValue(doc, 'Source snapshot ID', sourceSnapshot.id);
    writeLabelValue(doc, 'Source snapshot version', sourceSnapshot.version);
    writeLabelValue(doc, 'Source snapshot hash', sourceSnapshot.snapshot_hash);
    writeLabelValue(doc, 'Preparation revision ID', revisionId);
    writeLabelValue(doc, 'Preparation revision number', revisionNumber);
    writeLabelValue(doc, 'Preparation revision timestamp', displayDate(revisionCreatedAt));
    writeLabelValue(doc, 'Preparation revision hash', revisionHash);
    writeLabelValue(doc, 'Artifact hash', artifactHash);

    writeHeading(doc, 'Readiness and eligibility');
    writeLabelValue(doc, 'Snapshot eligibility', sourceSnapshot.eligibility_status);
    writeLabelValue(doc, 'Frozen readiness eligibility', frozenReadiness.eligible);
    writeLabelValue(doc, 'Frozen readiness status', frozenReadiness.status);
    writeLabelValue(doc, 'Preparation package status', payload.package_status);
    writeLabelValue(doc, 'Snapshot timestamp', displayDate(sourceSnapshot.recorded_at || frozenReadiness.snapshot_timestamp));
    writeLabelValue(doc, 'Readiness counts', summary.readiness || frozenReadiness.readiness);

    writeHeading(doc, 'Frozen canonical transaction facts');
    if (canonicalFields.length === 0) {
      doc.font('Helvetica').fontSize(8.5).fillColor('#4b5563').text('No canonical transaction facts were recorded.');
    } else {
      canonicalFields.forEach(field => {
        writeLabelValue(doc, field.label || field.field_key || 'Canonical field', field.value);
        doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text(
          `${field.field_key || field.definition_key || 'No field key'} · state: ${displayStatus(field.current_state || field.status)}`,
        );
        if (field.provenance) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6b7280').text(
            `Evidence: ${displayValue(field.provenance)}`,
          );
        }
        doc.moveDown(0.18);
      });
    }

    writeHeading(doc, 'Provenance and evidence summary');
    writeLabelValue(doc, 'Provenance intact', provenance.intact);
    writeLabelValue(doc, 'Provenance gaps', provenance.gap_count);
    writeLabelValue(doc, 'Evidence entries', provenance.evidence_entry_count);
    writeList(doc, provenance.manifest, 'No provenance manifest entries were recorded.');

    writeHeading(doc, 'Blockers and exceptions');
    writeLabelValue(doc, 'Blocking item count', blockers.blocking_count);
    writeLabelValue(doc, 'All blockers resolved', blockers.resolved);
    writeLabelValue(doc, 'Incomplete required fields', blockers.incomplete_required_fields);
    writeLabelValue(doc, 'Unresolved conflicts', blockers.unresolved_conflicts);
    writeLabelValue(doc, 'Missing approvals', blockers.missing_approvals);
    writeLabelValue(doc, 'Provenance gaps', blockers.provenance_gaps);
    writeList(doc, blockers.recorded_exceptions, 'No recorded exceptions.');

    writeHeading(doc, 'Approvals and settlement summary');
    writeLabelValue(doc, 'Required approvals satisfied', approvals.satisfied);
    writeLabelValue(doc, 'Missing approval count', approvals.missing_count);
    writeLabelValue(doc, 'Approval events', approvals.event_count);
    writeLabelValue(doc, 'Settlement mode', frozenReadiness.settlement_mode);
    writeList(doc, approvals.manifest, 'No approval events were recorded.');

    writeHeading(doc, 'Preparation inputs');
    Object.entries(preparationFields).forEach(([fieldKey, field]) => writePreparationField(doc, fieldKey, field));

    writeHeading(doc, 'Provider-neutral disclaimer');
    doc.font('Helvetica').fontSize(8.5).fillColor('#4b5563').text(disclosure, { lineGap: 2 });
    doc.moveDown(0.35);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6b7280').text(
      'External providers and qualified professionals must perform their own review. This artifact does not constitute issuance, an offer, a recommendation, legal advice, regulatory approval, or settlement execution.',
      { lineGap: 2 },
    );

    doc.end();
  });
}

function hashPreparationPdf(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = {
  PREPARATION_PDF_BUCKET,
  PREPARATION_PDF_SCHEMA,
  PREPARATION_PDF_VERSION,
  buildPreparationPdfBuffer,
  hashPreparationPdf,
  displayValue,
};