// This is the persisted JSONB payload. Do not merge live readiness or
    // Transaction Record state into it when inspecting historical snapshots.
    snapshot: frozenSnapshot,
  };
}

app.get('/api/public/deal-room/:propertyId/verified-asset/snapshots', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('verified_asset_snapshots')
      .select('id, version, eligibility_status, source_state_at, snapshot_hash, snapshot, created_by, created_at')
      .eq('property_id', req.params.propertyId)
      .order('version', { ascending: false });
    if (error) {
      if (verifiedAssetSnapshotsUnavailable(error)) {
        return res.status(503).json({ error: 'Verified Asset snapshots are not available until migration 024 is applied.' });
      }
      throw error;
    }
    res.json({ snapshots: (data || []).map(presentStoredVerifiedAssetSnapshot) });
  } catch (err) {
    console.error('[verified-asset/snapshots GET]', err.message);
    res.status(500).json({ error: 'Failed to load Verified Asset snapshots' });
  }
});

app.get('/api/public/deal-room/:propertyId/verified-asset/snapshots/:version', async (req, res) => {
  const version = Number(req.params.version);
  if (!Number.isInteger(version) || version < 1) {
    return res.status(400).json({ error: 'Snapshot version must be a positive integer.' });
  }
  try {
    const { data, error } = await supabase
      .from('verified_asset_snapshots')
      .select('id, version, eligibility_status, source_state_at, snapshot_hash, snapshot, created_by, created_at')
      .eq('property_id', req.params.propertyId)
      .eq('version', version)
      .maybeSingle();
    if (error) {
      if (verifiedAssetSnapshotsUnavailable(error)) {
        return res.status(503).json({ error: 'Verified Asset snapshots are not available until migration 024 is applied.' });
      }
      throw error;
    }
    if (!data) return res.status(404).json({ error: `Snapshot v${version} not found.` });
    res.json({ snapshot: presentStoredVerifiedAssetSnapshot(data) });
  } catch (err) {
    console.error('[verified-asset/snapshot GET]', err.message);
    res.status(500).json({ error: 'Failed to load Verified Asset snapshot' });
  }
});

// Live status for the existing transaction experience. This does not create a
// snapshot: creation is an explicit, immutable append operation.
app.get('/api/public/deal-room/:propertyId/verified-asset/readiness', async (req, res) => {
  try {
    const context = await getVerifiedAssetSnapshotContext(req.params.propertyId);
    if (!context) return res.status(404).json({ error: 'room not found' });
    const { data: latest, error } = await supabase
      .from('verified_asset_snapshots')
      .select('id, version, eligibility_status, source_state_at, snapshot_hash, created_at')
      .eq('property_id', req.params.propertyId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (verifiedAssetSnapshotsUnavailable(error)) {
        return res.status(503).json({ error: 'Verified Asset snapshots are not available until migration 024 is applied.' });
      }
      throw error;
    }
    res.json({
      eligibility: context.snapshot.digital_asset_readiness.eligible ? 'eligible' : 'ineligible',
      status: context.snapshot.digital_asset_readiness.status,
      summary: {
        confirmed_count: context.snapshot.created_from.readiness.confirmed_count || 0,
        required_count: context.snapshot.created_from.readiness.required_count || 0,
        unresolved_exception_count: context.snapshot.digital_asset_readiness.exceptions.unresolved_conflicts.length
          + context.snapshot.digital_asset_readiness.exceptions.incomplete_required_fields.length
          + context.snapshot.digital_asset_readiness.approvals.missing.length
          + context.snapshot.digital_asset_readiness.provenance.gaps.length,
        provenance_intact: context.snapshot.digital_asset_readiness.provenance.intact,
        provenance_gap_count: context.snapshot.digital_asset_readiness.provenance.gaps.length,
        approvals_satisfied: context.snapshot.digital_asset_readiness.approvals.satisfied,
        missing_approval_count: context.snapshot.digital_asset_readiness.approvals.missing.length,
      },
      reasons: {
        incomplete_required_fields: context.snapshot.digital_asset_readiness.exceptions.incomplete_required_fields,
        unresolved_conflicts: context.snapshot.digital_asset_readiness.exceptions.unresolved_conflicts,
        missing_approvals: context.snapshot.digital_asset_readiness.approvals.missing,
        provenance_gaps: context.snapshot.digital_asset_readiness.provenance.gaps,
      },
      latest_snapshot: latest || null,
      settlement_mode: context.state.room.settlement_mode || null,
      disclosure: context.snapshot.disclosure,
    });
  } catch (err) {
    console.error('[verified-asset/readiness]', err.message);
    res.status(500).json({ error: 'Failed to calculate Verified Asset readiness' });
  }
});

// Provider-neutral JSON export for downstream review and future adapters. This
// is derived live from the canonical Transaction Record and its existing
// evidence tables; it does not create a snapshot or call an external provider.
app.get('/api/public/deal-room/:propertyId/verified-asset/readiness/export', async (req, res) => {
  try {
    const context = await getVerifiedAssetSnapshotContext(req.params.propertyId);
    if (!context) return res.status(404).json({ error: 'room not found' });
    const snapshot = context.snapshot;
    return res.json({
      schema: 'kontra.digital-asset-readiness-export',
      schema_version: '1.0.0',
      property_id: req.params.propertyId,
      source: {
        workflow_pack: context.state.packId || null,
        transaction_record_schema: context.state.recordState?.schemaKey || null,
        state_at: snapshot.source_state_at || null,
        current_stage: context.state.stage || null,
      },
      verified_asset: snapshot.verified_asset,
      digital_asset_readiness: snapshot.digital_asset_readiness,
      disclosure: snapshot.disclosure,
    });
  } catch (err) {
    console.error('[verified-asset/readiness/export]', err.message);
    return res.status(500).json({ error: 'Failed to export Digital Asset Readiness' });
  }
});

// Append a new immutable snapshot. Identical canonical state returns the
// existing version; any changed source state gets a new version.
app.post('/api/public/deal-room/:propertyId/verified-asset/snapshots', async (req, res) => {
  const { propertyId } = req.params;
  const { ownerWriteToken } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');
  try {
    const context = await getVerifiedAssetSnapshotContext(propertyId);
    if (!context) return res.status(404).json({ error: 'room not found' });
    const snapshot = context.snapshot;
    const { data: existing, error: existingError } = await supabase
      .from('verified_asset_snapshots')
      .select('id, version, eligibility_status, source_state_at, snapshot_hash, snapshot, created_by, created_at')
      .eq('property_id', propertyId)
      .eq('snapshot_hash', snapshot.snapshot_hash)
      .maybeSingle();
    if (existingError) {
      if (verifiedAssetSnapshotsUnavailable(existingError)) {
        return res.status(503).json({ error: 'Verified Asset snapshots are not available until migration 024 is applied.' });
      }
      throw existingError;
    }
    if (existing) return res.json({ created: false, snapshot: existing });

    const { data: last, error: lastError } = await supabase
      .from('verified_asset_snapshots')
      .select('version')
      .eq('property_id', propertyId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) {
      if (verifiedAssetSnapshotsUnavailable(lastError)) {
        return res.status(503).json({ error: 'Verified Asset snapshots are not available until migration 024 is applied.' });
      }
      throw lastError;
    }
    const version = Number(last?.version || 0) + 1;
    const payload = {
      property_id: propertyId,
      version,
      snapshot_hash: snapshot.snapshot_hash,
      eligibility_status: snapshot.digital_asset_readiness.eligible ? 'eligible' : 'ineligible',
      source_state_at: snapshot.source_state_at,
      snapshot,
      created_by: access.email || context.state.room.customer_email || null,
    };
    const { data: created, error: insertError } = await supabase
      .from('verified_asset_snapshots')
      .insert(payload)
      .select('id, version, eligibility_status, source_state_at, snapshot_hash, snapshot, created_by, created_at')
      .single();
    if (insertError) {
      // A concurrent writer may have appended the same immutable state.
      if (/duplicate key|unique constraint/i.test(insertError.message || '')) {
        const { data: concurrent } = await supabase
          .from('verified_asset_snapshots')
          .select('id, version, eligibility_status, source_state_at, snapshot_hash, snapshot, created_by, created_at')
          .eq('property_id', propertyId)
          .eq('snapshot_hash', snapshot.snapshot_hash)
          .maybeSingle();
        if (concurrent) return res.json({ created: false, snapshot: concurrent });
      }
      throw insertError;
    }
    logEvent(propertyId, 'verified_asset_snapshot_created', 'owner', access.email || null,
      `Verified Asset snapshot v${version} created`,
      { version, eligibility: payload.eligibility_status, snapshot_hash: snapshot.snapshot_hash });
    res.status(201).json({ created: true, snapshot: created });
  } catch (err) {
    console.error('[verified-asset/snapshots]', err.message);
    if (verifiedAssetSnapshotsUnavailable(err)) {
      return res.status(503).json({ error: 'Verified Asset snapshots are not available until migration 024 is applied.' });
    }
    res.status(500).json({ error: 'Failed to create Verified Asset snapshot' });
  }
});

function packageRouteError(status, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = status;
  error.code = code;
  error.details = details;
  return error;
}

async function getSelectedVerifiedAssetSnapshot(propertyId, snapshotId, snapshotVersion) {
  if (!snapshotId && snapshotVersion == null) {
    throw packageRouteError(
      400,
      'SNAPSHOT_REQUIRED',
      'Select one eligible immutable readiness snapshot before generating a package.',
    );
  }
  let query = supabase.from('verified_asset_snapshots')
    .select('id, version, eligibility_status, source_state_at, snapshot_hash, snapshot, created_by, created_at')
    .eq('property_id', propertyId);
  if (snapshotId) query = query.eq('id', snapshotId);
  else query = query.eq('version', Number(snapshotVersion));
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (verifiedAssetSnapshotsUnavailable(error)) {
      throw packageRouteError(
        503,
        'SNAPSHOTS_UNAVAILABLE',
        'Verified Asset snapshots are not available until migration 024 is applied.',
      );
    }
    throw error;
  }
  if (!data) {
    throw packageRouteError(404, 'SNAPSHOT_NOT_FOUND', 'The selected readiness snapshot was not found.');
  }
  if (snapshotVersion != null && Number(data.version) !== Number(snapshotVersion)) {
    throw packageRouteError(409, 'SNAPSHOT_MISMATCH', 'The selected snapshot ID and version do not match.');
  }
  if (
    data.eligibility_status !== 'eligible'
    || data.snapshot?.digital_asset_readiness?.eligible !== true
  ) {
    throw packageRouteError(
      409,
      'SNAPSHOT_NOT_ELIGIBLE',
      `Digital Asset Packages can only be generated from an eligible readiness snapshot. Snapshot v${data.version} is ineligible.`,
      { snapshot_version: data.version, eligibility_status: data.eligibility_status },
    );
  }
  return data;
}

async function createDigitalAssetPreparationPackage(propertyId, access, {
  snapshotId,
  snapshotVersion,
} = {}) {
  const snapshot = await getSelectedVerifiedAssetSnapshot(propertyId, snapshotId, snapshotVersion);
  const { data: existing, error: existingError } = await supabase
    .from('digital_asset_preparation_packages')
    .select('id, property_id, source_snapshot_id, source_snapshot_version, source_snapshot_hash, package_hash, package, created_by, created_at')
    .eq('property_id', propertyId)
    .eq('source_snapshot_id', snapshot.id)
    .maybeSingle();
  if (existingError) {
    if (digitalAssetPackagesUnavailable(existingError)) {
      throw packageRouteError(
        503,
        'PACKAGES_UNAVAILABLE',
        'Digital Asset Preparation Packages are not available until migration 025 is applied.',
      );
    }
    throw existingError;
  }
  if (existing) {
    return { created: false, package: await presentStoredDigitalAssetPackageWithLatestRevision(existing) };
  }

  const packagePayload = buildDigitalAssetPreparationPackage({
    propertyId,
    snapshotRow: snapshot,
  });
  const { data: created, error: insertError } = await supabase
    .from('digital_asset_preparation_packages')
    .insert({
      property_id: propertyId,
      source_snapshot_id: snapshot.id,
      source_snapshot_version: snapshot.version,
      source_snapshot_hash: snapshot.snapshot_hash,
      package_hash: packagePayload.package_hash,
      package: packagePayload,
      created_by: access.email || null,
    })
    .select('id, property_id, source_snapshot_id, source_snapshot_version, source_snapshot_hash, package_hash, package, created_by, created_at')
    .single();
  if (insertError) {
    if (/duplicate key|unique constraint/i.test(insertError.message || '')) {
      const { data: concurrent } = await supabase
        .from('digital_asset_preparation_packages')
        .select('id, property_id, source_snapshot_id, source_snapshot_version, source_snapshot_hash, package_hash, package, created_by, created_at')
        .eq('property_id', propertyId)
        .eq('source_snapshot_id', snapshot.id)
        .maybeSingle();
      if (concurrent) {
        return { created: false, package: await presentStoredDigitalAssetPackageWithLatestRevision(concurrent) };
      }
    }
    if (digitalAssetPackagesUnavailable(insertError)) {
      throw packageRouteError(
        503,
        'PACKAGES_UNAVAILABLE',
        'Digital Asset Preparation Packages are not available until migration 025 is applied.',
      );
    }
    throw insertError;
  }

  logEvent(
    propertyId,
    'digital_asset_preparation_package_created',
    'owner',
    access.email || null,
    `Digital Asset Preparation Package generated from readiness snapshot v${snapshot.version}`,
    {
      package_id: created.id,
      source_snapshot_id: snapshot.id,
      source_snapshot_version: snapshot.version,
      package_hash: packagePayload.package_hash,
    },
  );
  return { created: true, package: await presentStoredDigitalAssetPackageWithLatestRevision(created) };
}

const DIGITAL_ASSET_PACKAGE_SELECT = 'id, property_id, source_snapshot_id, source_snapshot_version, source_snapshot_hash, package_hash, package, created_by, created_at';
const DIGITAL_ASSET_PACKAGE_REVISION_SELECT = 'id, package_id, property_id, revision, source_snapshot_id, source_snapshot_version, source_snapshot_hash, package_hash, package, changed_fields, created_by, created_at';
const DIGITAL_ASSET_PREPARATION_PDF_ARTIFACT_SELECT = 'id, package_id, property_id, source_snapshot_id, source_snapshot_version, source_snapshot_hash, source_revision_id, source_revision, source_revision_hash, artifact_hash, storage_bucket, storage_path, filename, content_type, generated_by, generated_at';
const PREPARATION_SAVE_REQUEST_ID_MAX_LENGTH = 128;

function digitalAssetPackageRevisionsUnavailable(error) {
  const message = String(error?.message || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /digital_asset_preparation_package_revisions.*(?:does not exist|schema cache|not found)/i.test(message)
    || /(?:relation|table).*digital_asset_preparation_package_revisions/i.test(message);
}

function digitalAssetPreparationPdfArtifactsUnavailable(error) {
  const message = String(error?.message || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /digital_asset_preparation_pdf_artifacts.*(?:does not exist|schema cache|not found)/i.test(message)
    || /(?:relation|table).*digital_asset_preparation_pdf_artifacts/i.test(message);
}

function presentDigitalAssetPreparationPdfArtifact(row) {
  if (!row) return null;
  return {
    id: row.id,
    package_id: row.package_id,
    property_id: row.property_id,
    source_snapshot_id: row.source_snapshot_id,
    source_snapshot_version: row.source_snapshot_version,
    source_snapshot_hash: row.source_snapshot_hash,
    source_revision_id: row.source_revision_id,
    source_revision: row.source_revision,
    source_revision_hash: row.source_revision_hash,
    artifact_hash: row.artifact_hash,
    schema: PREPARATION_PDF_SCHEMA,
    artifact_version: PREPARATION_PDF_VERSION,
    filename: row.filename,
    content_type: row.content_type || 'application/pdf',
    generated_by: row.generated_by,
    generated_at: row.generated_at,
  };
}

async function getStoredDigitalAssetPreparationPdfArtifact(propertyId, packageId, revisionId) {
  const { data, error } = await supabase
    .from('digital_asset_preparation_pdf_artifacts')
    .select(DIGITAL_ASSET_PREPARATION_PDF_ARTIFACT_SELECT)
    .eq('property_id', propertyId)
    .eq('package_id', packageId)
    .eq('source_revision_id', revisionId)
    .maybeSingle();
  if (error) {
    if (digitalAssetPreparationPdfArtifactsUnavailable(error)) {
      throw packageRouteError(
        503,
        'PDF_ARTIFACTS_UNAVAILABLE',
        'Preparation PDF artifacts are not available until migration 027 is applied.',
      );
    }
    throw error;
  }
  return data || null;
}

async function getPreparationRevisionForPdf(propertyId, packageId, revisionId, revisionNumber) {
  if (!revisionId) {
    throw packageRouteError(400, 'PREPARATION_REVISION_REQUIRED', 'Select one saved preparation revision.');
  }
  const { data: packageRow, error: packageError } = await supabase
    .from('digital_asset_preparation_packages')
    .select(DIGITAL_ASSET_PACKAGE_SELECT)
    .eq('property_id', propertyId)
    .eq('id', packageId)
    .maybeSingle();
  if (packageError) {
    if (digitalAssetPackagesUnavailable(packageError)) {
      throw packageRouteError(
        503,
        'PACKAGES_UNAVAILABLE',
        'Digital Asset Preparation Packages are not available until migration 025 is applied.',
      );
    }
    throw packageError;
  }
  if (!packageRow) {
    throw packageRouteError(404, 'PACKAGE_NOT_FOUND', 'The Digital Asset Preparation Package was not found.');
  }

  const { data: revision, error: revisionError } = await supabase
    .from('digital_asset_preparation_package_revisions')
    .select(DIGITAL_ASSET_PACKAGE_REVISION_SELECT)
    .eq('property_id', propertyId)
    .eq('package_id', packageId)
    .eq('id', revisionId)
    .maybeSingle();
  if (revisionError) {
    if (digitalAssetPackageRevisionsUnavailable(revisionError)) {
      throw packageRouteError(
        503,
        'PACKAGE_REVISIONS_UNAVAILABLE',
        'Package editing is not available until migration 026 is applied.',
      );
    }
    throw revisionError;
  }
  if (!revision) {
    throw packageRouteError(404, 'PREPARATION_REVISION_NOT_FOUND', 'The selected preparation revision was not found.');
  }
  if (revisionNumber != null && Number(revision.revision) !== Number(revisionNumber)) {
    throw packageRouteError(409, 'PREPARATION_REVISION_MISMATCH', 'The selected revision ID and number do not match.');
  }

  const revisionPayload = revision.package && typeof revision.package === 'object'
    ? revision.package
    : {};
  if (revisionPayload.package_status !== 'ready_for_provider_review') {
    throw packageRouteError(
      409,
      'PREPARATION_REVISION_NOT_READY',
      `Preparation Revision ${revision.revision} must be ready for provider review before a PDF can be generated.`,
    );
  }
  if (
    revision.source_snapshot_id !== packageRow.source_snapshot_id
    || Number(revision.source_snapshot_version) !== Number(packageRow.source_snapshot_version)
    || revision.source_snapshot_hash !== packageRow.source_snapshot_hash
    || revision.package_id !== packageRow.id
  ) {
    throw packageRouteError(
      409,
      'PREPARATION_SOURCE_BINDING_INVALID',
      'The saved preparation revision is not bound to the package source snapshot.',
    );
  }

  const snapshot = await getSelectedVerifiedAssetSnapshot(
    propertyId,
    revision.source_snapshot_id,
    revision.source_snapshot_version,
  );
  if (
    snapshot.snapshot_hash !== revision.source_snapshot_hash
    || snapshot.snapshot_hash !== packageRow.source_snapshot_hash
  ) {
    throw packageRouteError(
      409,
      'PREPARATION_SNAPSHOT_BINDING_INVALID',
      'The preparation revision does not match the persisted readiness snapshot hash.',
    );
  }
  return { packageRow, revision, snapshot };
}

function artifactStoragePath(propertyId, packageId, revision, packageHash) {
  const safe = value => String(value || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `digital-asset-preparation/${safe(propertyId)}/${safe(packageId)}/revision-${Number(revision)}-${safe(packageHash)}.pdf`;
}

async function getLatestDigitalAssetPackageRevision(packageId) {
  const { data, error } = await supabase
    .from('digital_asset_preparation_package_revisions')
    .select(DIGITAL_ASSET_PACKAGE_REVISION_SELECT)
    .eq('package_id', packageId)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (digitalAssetPackageRevisionsUnavailable(error)) return null;
    throw error;
  }
  return data || null;
}

function normalizePreparationSaveRequestId(value) {
  const requestId = String(value || '').trim();
  if (!requestId || requestId.length > PREPARATION_SAVE_REQUEST_ID_MAX_LENGTH) {
    throw packageRouteError(
      400,
      'PREPARATION_SAVE_REQUEST_ID_REQUIRED',
      'A unique preparation save request ID is required. Please try saving again.',
    );
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(requestId)) {
    throw packageRouteError(
      400,
      'INVALID_PREPARATION_SAVE_REQUEST_ID',
      'The preparation save request ID is invalid. Please try saving again.',
    );
  }
  return requestId;
}

async function getDigitalAssetPackageRevisionByRequestId(packageId, requestId) {
  const { data, error } = await supabase
    .from('digital_asset_preparation_package_revisions')
    .select(DIGITAL_ASSET_PACKAGE_REVISION_SELECT)
    .eq('package_id', packageId)
    .contains('package', { save_request_id: requestId })
    .order('revision', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (digitalAssetPackageRevisionsUnavailable(error)) return null;
    throw error;
  }
  return data || null;
}

function presentStoredDigitalAssetPackageRevision(packageRow, revision) {
  return presentStoredDigitalAssetPackage({
    ...packageRow,
    package: revision.package,
    package_hash: revision.package_hash,
    revision: revision.revision,
    revision_id: revision.id,
    created_by: revision.created_by || packageRow.created_by,
    created_at: revision.created_at || packageRow.created_at,
  });
}

async function presentStoredDigitalAssetPackageWithLatestRevision(row) {
  const revision = await getLatestDigitalAssetPackageRevision(row.id);
  if (!revision) return presentStoredDigitalAssetPackage(row);
  return presentStoredDigitalAssetPackage({
    ...row,
    package: revision.package,
    package_hash: revision.package_hash,
    revision: revision.revision,
    revision_id: revision.id,
    created_by: revision.created_by || row.created_by,
    created_at: revision.created_at || row.created_at,
  });
}

function normalizePreparationUpdates(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw packageRouteError(400, 'PREPARATION_FIELDS_REQUIRED', 'Provide preparation fields as an object.');
  }
  const updates = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!Object.prototype.hasOwnProperty.call(PREPARATION_FIELD_DEFINITIONS, key)) {
      throw packageRouteError(400, 'UNKNOWN_PREPARATION_FIELD', `Preparation field "${key}" is not supported.`);
    }
    const serializedValue = JSON.stringify(value);
    if (serializedValue && serializedValue.length > 10000) {
      throw packageRouteError(400, 'PREPARATION_FIELD_TOO_LONG', `Preparation field "${key}" is too long.`);
    }
    try {
      updates[key] = normalizePreparationValueForField(key, value, { strict: true });
    } catch (error) {
      throw packageRouteError(
        400,
        'INVALID_PREPARATION_FIELD',
        `Preparation field "${key}" is invalid: ${error.message}`,
      );
    }
  }
  if (Object.keys(updates).length === 0) {
    throw packageRouteError(400, 'PREPARATION_FIELDS_REQUIRED', 'Provide at least one preparation field to save.');
  }
  return updates;
}

app.get('/api/public/deal-room/:propertyId/digital-asset-packages', async (req, res) => {
  const access = await getRoomAccessContext(req, req.params.propertyId);
  if (access.mode === 'anonymous') return accessDenied(res);
  try {
    const { data, error } = await supabase
      .from('digital_asset_preparation_packages')
      .select(DIGITAL_ASSET_PACKAGE_SELECT)
      .eq('property_id', req.params.propertyId)
      .order('created_at', { ascending: false });
    if (error) {
      if (digitalAssetPackagesUnavailable(error)) {
        return res.status(503).json({
          error: 'PACKAGES_UNAVAILABLE',
          message: 'Digital Asset Preparation Packages are not available until migration 025 is applied.',
        });
      }
      throw error;
    }
    const packages = await Promise.all(
      (data || []).map(presentStoredDigitalAssetPackageWithLatestRevision),
    );
    return res.json({ packages });
  } catch (err) {
    console.error('[digital-asset-packages GET]', err.message);
    return res.status(500).json({ error: 'Failed to load Digital Asset Preparation Packages' });
  }
});

app.get('/api/public/deal-room/:propertyId/digital-asset-packages/by-snapshot/:snapshotId', async (req, res) => {
  const access = await getRoomAccessContext(req, req.params.propertyId);
  if (access.mode === 'anonymous') return accessDenied(res);
  try {
    const { data, error } = await supabase
      .from('digital_asset_preparation_packages')
      .select(DIGITAL_ASSET_PACKAGE_SELECT)
      .eq('property_id', req.params.propertyId)
      .eq('source_snapshot_id', req.params.snapshotId)
      .maybeSingle();
    if (error) {
      if (digitalAssetPackagesUnavailable(error)) {
        return res.status(503).json({
          error: 'PACKAGES_UNAVAILABLE',
          message: 'Digital Asset Preparation Packages are not available until migration 025 is applied.',
        });
      }
      throw error;
    }
    if (!data) {
      return res.status(404).json({
        error: 'PACKAGE_NOT_FOUND',
        message: 'No Digital Asset Preparation Package has been generated from this snapshot.',
      });
    }
    return res.json({ package: await presentStoredDigitalAssetPackageWithLatestRevision(data) });
  } catch (err) {
    console.error('[digital-asset-package by snapshot GET]', err.message);
    return res.status(500).json({ error: 'Failed to load Digital Asset Preparation Package' });
  }
});

app.get('/api/public/deal-room/:propertyId/digital-asset-packages/:packageId', async (req, res) => {
  const access = await getRoomAccessContext(req, req.params.propertyId);
  if (access.mode === 'anonymous') return accessDenied(res);
  try {
    const { data, error } = await supabase
      .from('digital_asset_preparation_packages')
      .select(DIGITAL_ASSET_PACKAGE_SELECT)
      .eq('property_id', req.params.propertyId)
      .eq('id', req.params.packageId)
      .maybeSingle();
    if (error) {
      if (digitalAssetPackagesUnavailable(error)) {
        return res.status(503).json({
          error: 'PACKAGES_UNAVAILABLE',
          message: 'Digital Asset Preparation Packages are not available until migration 025 is applied.',
        });
      }
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Digital Asset Preparation Package not found.' });
    return res.json({ package: await presentStoredDigitalAssetPackageWithLatestRevision(data) });
  } catch (err) {
    console.error('[digital-asset-package GET]', err.message);
    return res.status(500).json({ error: 'Failed to load Digital Asset Preparation Package' });
  }
});

app.get('/api/public/deal-room/:propertyId/digital-asset-packages/:packageId/revisions', async (req, res) => {
  const access = await getRoomAccessContext(req, req.params.propertyId);
  if (access.mode === 'anonymous') return accessDenied(res);
  try {
    const { data, error } = await supabase
      .from('digital_asset_preparation_package_revisions')
      .select(DIGITAL_ASSET_PACKAGE_REVISION_SELECT)
      .eq('package_id', req.params.packageId)
      .eq('property_id', req.params.propertyId)
      .order('revision', { ascending: false });
    if (error) {
      if (digitalAssetPackageRevisionsUnavailable(error)) {
        return res.status(503).json({
          error: 'PACKAGE_REVISIONS_UNAVAILABLE',
          message: 'Package editing is not available until migration 026 is applied.',
        });
      }
      throw error;
    }
    return res.json({
      revisions: (data || []).map(revision => ({
        id: revision.id,
        package_id: revision.package_id,
        revision: revision.revision,
        source_snapshot_id: revision.source_snapshot_id,
        source_snapshot_version: revision.source_snapshot_version,
        source_snapshot_hash: revision.source_snapshot_hash,
        package_hash: revision.package_hash,
        changed_fields: revision.changed_fields || [],
        created_by: revision.created_by,
        created_at: revision.created_at,
        package_status: revision.package?.package_status || 'needs_information',
      })),
    });
  } catch (err) {
    console.error('[digital-asset-package revisions GET]', err.message);
    return res.status(500).json({ error: 'Failed to load Digital Asset Preparation Package revisions' });
  }
});

app.get('/api/public/deal-room/:propertyId/digital-asset-packages/:packageId/artifacts', async (req, res) => {
  const { propertyId, packageId } = req.params;
  const access = await getRoomAccessContext(req, propertyId);
  if (access.mode === 'anonymous') return accessDenied(res);
  try {
    const { data: packageRow, error: packageError } = await supabase
      .from('digital_asset_preparation_packages')
      .select('id')
      .eq('property_id', propertyId)
      .eq('id', packageId)
      .maybeSingle();
    if (packageError) {
      if (digitalAssetPackagesUnavailable(packageError)) {
        return res.status(503).json({
          error: 'PACKAGES_UNAVAILABLE',
          message: 'Digital Asset Preparation Packages are not available until migration 025 is applied.',
        });
      }
      throw packageError;
    }
    if (!packageRow) return res.status(404).json({ error: 'PACKAGE_NOT_FOUND', message: 'The package was not found.' });

    const { data, error } = await supabase
      .from('digital_asset_preparation_pdf_artifacts')
      .select(DIGITAL_ASSET_PREPARATION_PDF_ARTIFACT_SELECT)
      .eq('property_id', propertyId)
      .eq('package_id', packageId)
      .order('source_revision', { ascending: false });
    if (error) {
      if (digitalAssetPreparationPdfArtifactsUnavailable(error)) {
        return res.status(503).json({
          error: 'PDF_ARTIFACTS_UNAVAILABLE',
          message: 'Preparation PDF artifacts are not available until migration 027 is applied.',
        });
      }
      throw error;
    }
    return res.json({
      artifacts: (data || []).map(row => ({
        ...presentDigitalAssetPreparationPdfArtifact(row),
        view_path: `/api/public/deal-room/${encodeURIComponent(propertyId)}/digital-asset-packages/${encodeURIComponent(packageId)}/artifacts/${encodeURIComponent(row.id)}`,
        download_path: `/api/public/deal-room/${encodeURIComponent(propertyId)}/digital-asset-packages/${encodeURIComponent(packageId)}/artifacts/${encodeURIComponent(row.id)}?download=1`,
      })),
    });
  } catch (err) {
    console.error('[digital-asset-preparation-pdf artifacts GET]', err.message);
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.code, message: err.message, details: err.details });
    return res.status(500).json({ error: 'Failed to load preparation PDF artifacts' });
  }
});

app.post('/api/public/deal-room/:propertyId/digital-asset-packages/:packageId/revisions/:revisionId/artifacts', async (req, res) => {
  const { propertyId, packageId, revisionId } = req.params;
  const { ownerWriteToken } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can generate a preparation PDF.');

  try {
    const {
      revision: requestedRevision,
      sourceSnapshotId,
      sourceSnapshotVersion,
      sourceSnapshotHash,
      packageHash,
    } = req.body || {};
    const resolved = await getPreparationRevisionForPdf(
      propertyId,
      packageId,
      revisionId,
      requestedRevision,
    );
    const { packageRow, revision } = resolved;

    if (
      sourceSnapshotId !== packageRow.source_snapshot_id
      || Number(sourceSnapshotVersion) !== Number(packageRow.source_snapshot_version)
      || sourceSnapshotHash !== packageRow.source_snapshot_hash
      || packageHash !== revision.package_hash
    ) {
      throw packageRouteError(
        409,
        'PREPARATION_ARTIFACT_REFERENCE_MISMATCH',
        'The requested PDF references do not match the exact package revision and readiness snapshot.',
      );
    }

    const existing = await getStoredDigitalAssetPreparationPdfArtifact(propertyId, packageId, revision.id);
    if (existing) {
      return res.json({
        created: false,
        idempotent: true,
        artifact: presentDigitalAssetPreparationPdfArtifact(existing),
      });
    }

    const pdfArguments = {
      propertyId,
      packageId,
      packagePayload: revision.package,
      revisionId: revision.id,
      revisionNumber: revision.revision,
      revisionCreatedAt: revision.created_at,
      revisionHash: revision.package_hash,
    };
    // The displayed hash is a self-reference. Hash a fixed-width placeholder
    // projection, then render the final PDF with that digest. Verification
    // normalizes the same display field before hashing.
    const hashTemplate = await buildPreparationPdfBuffer({
      ...pdfArguments,
      artifactHash: ARTIFACT_HASH_PLACEHOLDER,
    });
    const artifactHash = hashPreparationPdf(hashTemplate);
    const pdfBuffer = await buildPreparationPdfBuffer({
      ...pdfArguments,
      artifactHash,
    });
    const filename = `digital-asset-preparation-${propertyId}-revision-${revision.revision}.pdf`
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = artifactStoragePath(propertyId, packageId, revision.revision, revision.package_hash);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PREPARATION_PDF_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (uploadError) {
      const afterUploadError = await getStoredDigitalAssetPreparationPdfArtifact(propertyId, packageId, revision.id);
      if (afterUploadError) {
        return res.json({
          created: false,
          idempotent: true,
          artifact: presentDigitalAssetPreparationPdfArtifact(afterUploadError),
        });
      }
      throw uploadError;
    }

    const { data: created, error: insertError } = await supabase
      .from('digital_asset_preparation_pdf_artifacts')
      .insert({
        package_id: packageRow.id,
        property_id: propertyId,
        source_snapshot_id: revision.source_snapshot_id,
        source_snapshot_version: revision.source_snapshot_version,
        source_snapshot_hash: revision.source_snapshot_hash,
        source_revision_id: revision.id,
        source_revision: revision.revision,
        source_revision_hash: revision.package_hash,
        artifact_hash: artifactHash,
        storage_bucket: PREPARATION_PDF_BUCKET,
        storage_path: uploadData?.path || storagePath,
        filename,
        content_type: 'application/pdf',
        generated_by: access.email || null,
      })
      .select(DIGITAL_ASSET_PREPARATION_PDF_ARTIFACT_SELECT)
      .single();
    if (insertError) {
      if (/duplicate key|unique constraint/i.test(insertError.message || '')) {
        const concurrent = await getStoredDigitalAssetPreparationPdfArtifact(propertyId, packageId, revision.id);
        if (concurrent) {
          return res.json({
            created: false,
            idempotent: true,
            artifact: presentDigitalAssetPreparationPdfArtifact(concurrent),
          });
        }
      }
      throw insertError;
    }
    logEvent(
      propertyId,
      'digital_asset_preparation_pdf_generated',
      'owner',
      access.email || null,
      `Preparation PDF generated for package revision ${revision.revision}`,
      {
        artifact_id: created.id,
        package_id: packageRow.id,
        source_snapshot_id: revision.source_snapshot_id,
        source_snapshot_version: revision.source_snapshot_version,
        source_snapshot_hash: revision.source_snapshot_hash,
        source_revision_id: revision.id,
        source_revision: revision.revision,
        artifact_hash: artifactHash,
      },
    ).catch(() => {});
    return res.status(201).json({
      created: true,
      artifact: presentDigitalAssetPreparationPdfArtifact(created),
    });
  } catch (err) {
    console.error('[digital-asset-preparation-pdf POST]', err.message);
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.code, message: err.message, details: err.details });
    if (digitalAssetPreparationPdfArtifactsUnavailable(err)) {
      return res.status(503).json({
        error: 'PDF_ARTIFACTS_UNAVAILABLE',
        message: 'Preparation PDF artifacts are not available until migration 027 is applied.',
      });
    }
    return res.status(500).json({ error: 'Failed to generate preparation PDF artifact' });
  }
});

app.get('/api/public/deal-room/:propertyId/digital-asset-packages/:packageId/artifacts/:artifactId', async (req, res) => {
  const { propertyId, packageId, artifactId } = req.params;
  const access = await getRoomAccessContext(req, propertyId);
  if (access.mode === 'anonymous') return accessDenied(res);
  try {
    const { data: artifact, error } = await supabase
      .from('digital_asset_preparation_pdf_artifacts')
      .select(DIGITAL_ASSET_PREPARATION_PDF_ARTIFACT_SELECT)
      .eq('property_id', propertyId)
      .eq('package_id', packageId)
      .eq('id', artifactId)
      .maybeSingle();
    if (error) {
      if (digitalAssetPreparationPdfArtifactsUnavailable(error)) {
        return res.status(503).json({
          error: 'PDF_ARTIFACTS_UNAVAILABLE',
          message: 'Preparation PDF artifacts are not available until migration 027 is applied.',
        });
      }
      throw error;
    }
    if (!artifact) return res.status(404).json({ error: 'PDF_ARTIFACT_NOT_FOUND', message: 'The preparation PDF artifact was not found.' });

    const { data: file, error: downloadError } = await supabase.storage
      .from(artifact.storage_bucket || PREPARATION_PDF_BUCKET)
      .download(artifact.storage_path);
    if (downloadError || !file) {
      console.error('[digital-asset-preparation-pdf download]', downloadError?.message || 'storage object missing');
      return res.status(404).json({ error: 'PDF_ARTIFACT_FILE_NOT_FOUND', message: 'The stored preparation PDF is not available.' });
    }
    const buffer = Buffer.isBuffer(file)
      ? file
      : Buffer.from(await file.arrayBuffer());
    const digest = hashPreparationPdf(buffer, artifact.artifact_hash);
    if (digest !== artifact.artifact_hash) {
      return res.status(409).json({ error: 'PDF_ARTIFACT_HASH_MISMATCH', message: 'The stored preparation PDF failed integrity verification.' });
    }
    res.set({
      'Content-Type': artifact.content_type || 'application/pdf',
      'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${artifact.filename}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=31536000, immutable',
      ETag: `"${artifact.artifact_hash}"`,
    });
    return res.send(buffer);
  } catch (err) {
    console.error('[digital-asset-preparation-pdf GET]', err.message);
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.code, message: err.message, details: err.details });
    return res.status(500).json({ error: 'Failed to load preparation PDF artifact' });
  }
});

app.patch('/api/public/deal-room/:propertyId/digital-asset-packages/:packageId/preparation-fields', async (req, res) => {
  const { propertyId, packageId } = req.params;
  const { ownerWriteToken, fields } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');

  try {
    const saveRequestId = normalizePreparationSaveRequestId(
      req.get('Idempotency-Key')
        || req.get('X-Idempotency-Key')
        || req.body?.saveRequestId,
    );
    const updates = normalizePreparationUpdates(fields);
    const { data: packageRow, error: packageError } = await supabase
      .from('digital_asset_preparation_packages')
      .select(DIGITAL_ASSET_PACKAGE_SELECT)
      .eq('id', packageId)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (packageError) {
      if (digitalAssetPackagesUnavailable(packageError)) {
        return res.status(503).json({
          error: 'PACKAGES_UNAVAILABLE',
          message: 'Digital Asset Preparation Packages are not available until migration 025 is applied.',
        });
      }
      throw packageError;
    }
    if (!packageRow) return res.status(404).json({ error: 'Digital Asset Preparation Package not found.' });

    const existingRequestRevision = await getDigitalAssetPackageRevisionByRequestId(packageId, saveRequestId);
    if (existingRequestRevision) {
      return res.json({
        ok: true,
        created: false,
        idempotent: true,
        package: presentStoredDigitalAssetPackageRevision(packageRow, existingRequestRevision),
        revision: {
          id: existingRequestRevision.id,
          revision: existingRequestRevision.revision,
          changed_fields: existingRequestRevision.changed_fields || [],
          created_by: existingRequestRevision.created_by,
          created_at: existingRequestRevision.created_at,
          package_status: existingRequestRevision.package?.package_status || 'needs_information',
        },
      });
    }

    const sourceSnapshot = await getSelectedVerifiedAssetSnapshot(
      propertyId,
      packageRow.source_snapshot_id,
      packageRow.source_snapshot_version,
    );
    if (sourceSnapshot.snapshot_hash !== packageRow.source_snapshot_hash) {
      throw packageRouteError(
        409,
        'SOURCE_SNAPSHOT_CHANGED',
        'The package source snapshot no longer matches its persisted source hash.',
      );
    }

    const appendResult = await appendDigitalAssetPreparationRevision({
      packageRow,
      updates,
      saveRequestId,
      createdBy: access.email || null,
      getLatestRevision: getLatestDigitalAssetPackageRevision,
      getRevisionByRequestId: getDigitalAssetPackageRevisionByRequestId,
      insertRevision: values => supabase
        .from('digital_asset_preparation_package_revisions')
        .insert(values)
        .select(DIGITAL_ASSET_PACKAGE_REVISION_SELECT)
        .single(),
    });
    const { created, idempotent, revision, packagePayload } = appendResult;
    if (!created) {
      return res.json({
        ok: true,
        created: false,
        idempotent,
        package: presentStoredDigitalAssetPackageRevision(packageRow, revision),
        revision: {
          id: revision.id,
          revision: revision.revision,
          changed_fields: revision.changed_fields || [],
          created_by: revision.created_by,
          created_at: revision.created_at,
          package_status: revision.package?.package_status || 'needs_information',
        },
      });
    }

    logEvent(
      propertyId,
      'digital_asset_preparation_package_updated',
      'owner',
      access.email || null,
      `Digital Asset Preparation Package revision ${revision.revision} saved`,
      {
        package_id: packageId,
        revision: revision.revision,
        changed_fields: Object.keys(updates),
        package_status: packagePayload.package_status,
      },
    );
    return res.status(201).json({
      ok: true,
      created: true,
      package: presentStoredDigitalAssetPackageRevision(packageRow, revision),
      revision: {
        id: revision.id,
        revision: revision.revision,
        changed_fields: revision.changed_fields || [],
        created_by: revision.created_by,
        created_at: revision.created_at,
        package_status: packagePayload.package_status,
      },
    });
  } catch (err) {
    console.error('[digital-asset-prep update]', err.message);
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
        ...err.details,
      });
    }
    return res.status(500).json({ error: 'Failed to save Digital Asset Preparation Package fields' });
  }
});

app.post('/api/public/deal-room/:propertyId/digital-asset-packages', async (req, res) => {
  const { propertyId } = req.params;
  const { ownerWriteToken, snapshotId, snapshotVersion } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');

  try {
    const result = await createDigitalAssetPreparationPackage(propertyId, access, {
      snapshotId,
      snapshotVersion,
    });
    return res.status(result.created ? 201 : 200).json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error('[digital-asset-prep]', err.message);
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
        ...err.details,
      });
    }
    return res.status(500).json({ error: 'Failed to generate Digital Asset Preparation Package' });
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large — maximum size is 20MB. Please compress the file and try again.' });
  }
  if (err.message?.includes('File type not allowed')) {
    return res.status(415).json({ error: 'Unsupported file type. Accepted formats: PDF, Word, Excel, CSV, JPEG, PNG.' });
  }
  console.error('[unhandled error]', err.message);
  res.status(500).json({ error: err.message || 'Server error' });
});

// ── Startup migration: ensure workflow_pack_id column exists ─────────────────
// Migration 005 is manual-only; run it automatically here so Render/production
// gets the column on first boot without a manual Supabase SQL editor step.
async function ensureWorkflowPackIdColumn() {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS workflow_pack_id text DEFAULT 'cre_acquisition'`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS stated_revenue NUMERIC`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS stated_ebitda NUMERIC`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS checklist_items JSONB`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS owner_write_token TEXT`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS stages_config JSONB`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS metadata_values JSONB`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(64)`
    );
    // transaction_record_fields and transaction_record_approvals are NOT created
    // here. They must be applied via the committed Supabase migration:
    //   kontra-ui-clone/api/migrations/015_transaction_record.sql
    // Startup checks are kept read-only beyond the deal_rooms column additions above.
    // analytics_events — created here so it's always present when first event arrives
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id           BIGSERIAL PRIMARY KEY,
        session_id   TEXT NOT NULL,
        event_name   TEXT NOT NULL,
        workspace_id TEXT,
        properties   JSONB DEFAULT '{}',
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx ON analytics_events (event_name)`);
    await pool.end();
    console.log('[startup] deal_rooms schema columns ready (workflow_pack_id, stated_revenue, stated_ebitda, checklist_items, owner_write_token, stages_config, metadata_values, jurisdiction)');
  } catch (err) {
    // Non-fatal: Supabase service role may not allow DDL via pooler — fall back gracefully
    console.warn('[startup] workflow_pack_id column ensure skipped:', err.message);
  }
}

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    startJobSchedulers();
  }
  const server = http.createServer(app);
  attachChatServer(server);
  attachCollabServer(server);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Kontra API listening on port ${PORT}`);
    void ensureWorkflowPackIdColumn();
    if (process.env.NODE_ENV !== 'production') {
      void logBaselineSchemaHealth();
    }
  });
}

// ── Generic Deal Room — AI Assistant (/brain/ask) ────────────────────────────
// Context-aware assistant that reasons from the actual room state.
// Registered BEFORE the static demo overrides so dynamic rooms hit this route.
app.post('/api/public/deal-room/:propertyId/brain/ask', async (req, res) => {
  const { propertyId } = req.params;
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: 'question required' });

  // Keep this legacy route aligned with the canonical Operations Manager
  // handler. Without this delegation, dynamic rooms could fall through to the
  // older fact-count prompt and invent participants from generic CRE context.
  try {
    const access = await getRoomAccessContext(req, propertyId, req.body?.ownerWriteToken);
    if (access.mode === 'anonymous') return accessDenied(res);
    return res.json(await askQuestion(propertyId, String(question).slice(0, 2000)));
  } catch (err) {
    console.error('[brain/ask]', err.message);
    return res.status(500).json({ error: 'AI assistant error', answer: 'Kontra could not reach the transaction workspace. Try again in a moment.' });
  }

  try {
    const access = await getRoomAccessContext(req, propertyId, req.body?.ownerWriteToken);
    if (access.mode === 'anonymous') return accessDenied(res);

    const [
      transactionState,
      { count: docCount },
      { data: invites },
    ] = await Promise.all([
      readTransactionState(propertyId),
      supabase.from('deal_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId),
      supabase.from('deal_room_invites')
        .select('role_key, status')
        .eq('property_id', propertyId),
    ]);
    const room = transactionState.room;
    const fields = transactionState.recordState.fields || [];

    const populated = fields.filter(f => f.value !== null && f.value !== undefined
      && String(f.value).trim() && f.status !== 'not_applicable');
    const conflicts = fields.filter(f => f.status === 'conflict' || f.attention === 'source_changed');
    const needsReview = fields.filter(f => f.status === 'awaiting' && f.value !== null && f.value !== undefined);
    const inviteCount = (invites || []).length;

    const CAT_PREFIXES = {
      'Identity & Parties': ['parties.', 'ownership.owner_name'],
      'Asset / Company': ['asset.'],
      'Transaction Terms': ['transaction.'],
      'Financial Information': ['financial.'],
      'Legal & Diligence': ['legal.', 'ownership.cap_table', 'ownership.beneficial_owners', 'ownership.liens'],
    };
    const catStatus = Object.entries(CAT_PREFIXES).map(([label, prefixes]) => {
      const count = populated.filter(f => prefixes.some(p => f.field_key?.startsWith(p) || f.field_key === p)).length;
      return `${label}: ${count === 0 ? 'Not started' : count >= 2 ? 'Building' : 'Needs information'}`;
    }).join('\n');

    const systemPrompt = `You are Kontra AI, a transaction-aware assistant embedded in a deal room called Kontra. You reason specifically from the current room state below. Never give generic advice — always tie your answer to the specific room context.

ROOM NAME: ${room?.property_name || 'Unnamed transaction'}
TYPE: ${transactionState.packId || transactionState.schemaKey || room?.deal_type || 'General transaction'}
DOCUMENTS UPLOADED: ${docCount || 0}
PARTICIPANTS INVITED: ${inviteCount}
EXTRACTED FACTS: ${populated.length}
CONFLICTING / CHANGED FIELDS: ${conflicts.length}
NEEDS REVIEW: ${needsReview.length}

DIGITAL ASSET READINESS BY CATEGORY:
${catStatus}

${populated.length > 0 ? `KNOWN FACTS (up to 20):\n${populated.slice(0, 20).map(f => `• ${f.label || f.key}: ${f.value}`).join('\n')}` : '(No facts have been extracted yet — no documents have been uploaded or analyzed.)'}

${conflicts.length > 0 ? `CONFLICTS TO RESOLVE:\n${conflicts.map(f => `• ${f.label || f.key}: conflicting sources — needs coordinator review`).join('\n')}` : ''}

RULES:
- If the room is empty (0 documents, 0 facts): clearly state this room has not started, recommend uploading the most relevant first document (e.g. Letter of Intent or Purchase Agreement), and explain what Kontra will extract from it.
- If asked about digital-asset readiness or tokenization: describe which categories have facts vs. which are still empty. Never quote a percentage. Never say "eligible for tokenization", "approved", or "issuance ready".
- If there are conflicts or needs-review fields: name them specifically.
- Keep answers concise (3–6 sentences), factual, and actionable.
- Do not provide legal, regulatory, or financial advice.
- Kontra organizes and prepares transaction information — it does not issue, sell, recommend, custody, or settle digital assets.`;

    const aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      max_tokens: 450,
      temperature: 0.3,
    });

    res.json({ answer: completion.choices[0]?.message?.content || 'I could not answer from the current transaction record.' });
  } catch (err) {
    console.error('[brain/ask]', err.message);
    res.status(500).json({ error: 'AI assistant error', answer: 'Kontra could not reach the transaction workspace. Try again in a moment.' });
  }
});

// ── Generic Deal Room — Transaction-Record Fact Summary (/brain/facts) ───────
// Distinct from /brain/briefing (which is served by the operationsManager
// router for deal health / chain status). This endpoint returns a machine-
// readable summary of extracted transaction facts plus a document count so the
// CoordinatorOverview can show "N documents uploaded" and known transaction
// values without a separate /transaction-record fetch.
// Returns a lightweight computed briefing from live room data.
// Static demo rooms register their own routes above and override this.
app.get('/api/public/deal-room/:propertyId/brain/facts', async (req, res) => {
  const { propertyId } = req.params;
  const access = await getRoomAccessContext(req, propertyId, req.body?.ownerWriteToken);
  if (access.mode === 'anonymous') return accessDenied(res, 'A verified deal-room invitation or owner access token is required');
  try {
    const [transactionState, analysesResult] = await Promise.all([
      readTransactionState(propertyId),
      supabase.from('deal_analyses')
        .select('id, section, filename, analysis, processing_status, created_at, is_active, superseded_at')
        .eq('property_id', propertyId),
    ]);
    let analysisRows = analysesResult.data || [];
    if (analysesResult.error) {
      // Keep the facts endpoint usable while older workspaces are upgraded;
      // the legacy projection still deduplicates by section and timestamp.
      const legacyResult = await supabase.from('deal_analyses')
        .select('id, section, filename, analysis, created_at')
        .eq('property_id', propertyId);
      if (legacyResult.error) throw legacyResult.error;
      analysisRows = legacyResult.data || [];
    }
    const activeAnalyses = selectActiveDocumentVersions(analysisRows);
    const docCount = activeAnalyses.length;
    const fields = transactionState.recordState.fields || [];

    const conflicts   = fields.filter(f => f.status === 'conflict' || f.attention === 'source_changed');
    const needsReview = fields.filter(f => f.status === 'awaiting' && f.value !== null && f.value !== undefined);

    // Return null only when truly nothing has been uploaded or extracted yet
    if (docCount === 0 && (fields || []).length === 0) {
      return res.json(null);
    }

    const risks = conflicts.map(f => ({
      text: `${f.label || f.key} has conflicting values from different sources`,
      field_key: f.key,
    }));
    const actions = needsReview.slice(0, 4).map(f => ({
      text: `Confirm "${f.label || f.key}" extracted as "${f.value}"`,
      field_key: f.key,
    }));

    res.json({
      actions,
      risks,
      open_items: [],
      snapshot: {
        document_count: docCount,
        active_document_count: docCount,
        fact_count: (fields || []).length,
      },
      active_documents: activeAnalyses.map(analysis => ({
        id: analysis.id,
        section: analysis.section,
        filename: analysis.filename,
        processing_status: analysis.processing_status || 'complete',
      })),
      record_state: transactionState.recordState,
      // Surface the most important known values for the Overview snapshot row
      known_values: Object.fromEntries(
        (fields || [])
          .filter(f => f.value !== null && f.value !== undefined && f.status !== 'not_applicable')
          .map(f => [f.key, f.value])
      ),
    });
  } catch (err) {
    console.error('[brain/facts]', err.message);
    res.json(null);
  }
});

// ── 404 catch-all — MUST remain after all route registrations ─────────────────
// Placed here so that routes registered later in this file (transaction-record,
// brain/facts, extract, etc.) are not swallowed by the catch-all before they
// can be matched. Express evaluates handlers in registration order.
app.use('/api', (req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `${req.method} ${req.originalUrl} not found`
  });
});
if (Sentry.Handlers?.errorHandler) {
  app.use(Sentry.Handlers.errorHandler());
} else if (Sentry.errorHandler) {
  app.use(Sentry.errorHandler());
}
app.use(errorHandler);

// Kept on the Express app for focused authorization/checklist regression tests;
// these helpers do not change the public HTTP surface.
app.getRoomAccessContext = getRoomAccessContext;
app.filterChecklistItemsByRole = filterChecklistItemsByRole;
app.getChecklistItemAssignedRoles = getChecklistItemAssignedRoles;
app.getAssignedSectionsForAccess = getAssignedSectionsForAccess;
app.buildCreationMetadata = buildCreationMetadata;
app.isTokenizationTransaction = isTokenizationTransaction;
if (process.env.NODE_ENV === 'test') {
  app.setMyRoomsOtpForTest = (email, code) => {
    otpStore.set(email, { code, expiresAt: Date.now() + 60_000 });
  };
}

module.exports = app;
