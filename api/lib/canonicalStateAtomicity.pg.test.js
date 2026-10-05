'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const enabled = process.env.KONTRA_CANONICAL_ATOMICITY_PG_TEST === '1';
const describePg = enabled ? describe : describe.skip;

const apiRoot = path.resolve(__dirname, '..');
const migrationRoot = path.join(apiRoot, 'migrations');
let tempRoot;
let dataDir;
let socketDir;
let logFile;
let port;
let psqlArgs;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return (result.stdout || '').trim();
}

function runPsql(sql) {
  return run('psql', [...psqlArgs, '-c', sql]);
}

function runPsqlFile(filePath) {
  return run('psql', [...psqlArgs, '-f', filePath]);
}

function runPsqlAsync(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', [...psqlArgs], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`psql failed:\n${stderr || stdout}`));
      resolve(stdout.trim());
    });
    child.stdin.end(sql);
  });
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function parseJson(sql) {
  return JSON.parse(runPsql(sql));
}

function activate(propertyId, section, filename, sourceHash) {
  const document = {
    filename,
    analysis: {},
    uploaded_by_role: 'coordinator',
    document_hash: sourceHash,
    source_hash: sourceHash,
    processing_status: 'extracted',
    post_completion: false,
  };
  return parseJson(
    `SELECT public.kontra_activate_document_version(${sqlString(propertyId)}, ${sqlString(section)}, ${sqlJson(document)}, NULL)::text;`,
  );
}

function commit(changeSet) {
  return parseJson(
    `SELECT public.kontra_commit_canonical_change_set(${sqlJson(changeSet)})::text;`,
  );
}

function insertField(propertyId, document, {
  fieldKey = 'transaction.purchase_price',
  value = '$10,000',
  status = 'extracted',
  verified = false,
} = {}) {
  const patch = {
    field_key: fieldKey,
    field_category: 'transaction',
    display_label: 'Purchase price',
    value_text: value,
    status,
    source_doc_id: document.document_id,
    source_doc_version: document.document_id,
    source_file_hash: document.source_hash,
    extracted_by: verified ? 'coordinator@example.com' : 'ai',
    verified_by: verified ? 'owner@example.com' : null,
    verified_role: verified ? 'Workspace Owner' : null,
    verified_at: verified ? '2026-10-04T10:00:00Z' : null,
    is_required: true,
  };
  const result = commit({
    property_id: propertyId,
    required_sources: [{ id: document.document_id, source_hash: document.source_hash }],
    expected_fields: [{ field_key: fieldKey, absent: true }],
    field_changes: [{ op: 'insert', field_key: fieldKey, patch }],
    history_rows: [{
      field_key: fieldKey,
      event_type: 'extracted',
      new_value: value,
      new_status: status,
      source_doc_id: document.document_id,
    }],
  });
  if (result.status !== 'committed') throw new Error(`Field fixture insert failed: ${JSON.stringify(result)}`);
  return fieldRow(propertyId, fieldKey);
}

function fieldRow(propertyId, fieldKey = 'transaction.purchase_price') {
  const row = runPsql(
    `SELECT to_jsonb(field)::text FROM public.transaction_record_fields AS field WHERE property_id = ${sqlString(propertyId)} AND field_key = ${sqlString(fieldKey)};`,
  );
  return row ? JSON.parse(row) : null;
}

function fieldSnapshot(field) {
  const keys = [
    'id', 'field_key', 'field_category', 'display_label', 'updated_at', 'status',
    'value_text', 'value_json', 'confidence', 'source_doc_id', 'source_doc_version',
    'source_file_hash', 'source_page', 'source_excerpt', 'extracted_by',
    'verified_by', 'verified_role', 'verified_at', 'notes', 'extraction_timestamp',
    'definition_key', 'is_required', 'source_type', 'conflict_candidates',
  ];
  return Object.fromEntries(keys.map(key => [key, field[key] ?? null]));
}

function fieldUpdateSet(propertyId, document, expected, value) {
  return {
    property_id: propertyId,
    required_sources: [{ id: document.document_id, source_hash: document.source_hash }],
    expected_fields: [fieldSnapshot(expected)],
    field_changes: [{
      op: 'update',
      id: expected.id,
      patch: {
        value_text: value,
        status: 'extracted',
        source_doc_id: document.document_id,
        source_doc_version: document.document_id,
        source_file_hash: document.source_hash,
      },
    }],
    history_rows: [{
      field_id: expected.id,
      event_type: 'extracted',
      prior_value: expected.value_text,
      new_value: value,
      prior_status: expected.status,
      new_status: 'extracted',
      source_doc_id: document.document_id,
    }],
  };
}

function queryCount(propertyId, table) {
  return Number(runPsql(
    `SELECT count(*) FROM public.${table} WHERE property_id = ${sqlString(propertyId)};`,
  ));
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const chosen = server.address().port;
      server.close(error => (error ? reject(error) : resolve(chosen)));
    });
  });
}

describePg('canonical-state PostgreSQL interleavings', () => {
  jest.setTimeout(120000);

  beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kontra-canonical-atomicity-'));
    dataDir = path.join(tempRoot, 'data');
    socketDir = path.join(tempRoot, 'socket');
    logFile = path.join(tempRoot, 'postgres.log');
    port = await reservePort();
    fs.mkdirSync(socketDir);
    run('initdb', ['-D', dataDir, '-A', 'trust', '--no-locale', '-E', 'UTF8']);
    run('pg_ctl', [
      '-D', dataDir,
      '-l', logFile,
      '-o', `-F -k ${socketDir} -p ${port} -h ''`,
      '-w', 'start',
    ]);
    psqlArgs = [
      '-h', socketDir,
      '-p', String(port),
      '-U', os.userInfo().username,
      '-d', 'postgres',
      '-X', '-q', '-t', '-A',
      '-v', 'ON_ERROR_STOP=1',
    ];

    runPsql('CREATE ROLE service_role');
    runPsqlFile(path.join(migrationRoot, '002_deal_analyses.sql'));
    runPsqlFile(path.join(migrationRoot, '015_transaction_record.sql'));
    runPsqlFile(path.join(migrationRoot, '023_transaction_record_conflicts.sql'));
    runPsql(`
      ALTER TABLE public.deal_analyses
        ADD COLUMN storage_path text,
        ADD COLUMN document_hash text,
        ADD COLUMN processing_status text,
        ADD COLUMN source_hash text,
        ADD COLUMN processing_attempt integer,
        ADD COLUMN correlation_id uuid,
        ADD COLUMN failure_reason text,
        ADD COLUMN processing_started_at timestamptz,
        ADD COLUMN processing_completed_at timestamptz,
        ADD COLUMN post_completion boolean NOT NULL DEFAULT false,
        ADD COLUMN post_completion_added_at timestamptz;
      ALTER TABLE public.transaction_record_fields
        ADD COLUMN definition_key text,
        ADD COLUMN is_required boolean NOT NULL DEFAULT false,
        ADD COLUMN source_type text,
        ADD COLUMN conflict_candidates jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);
    runPsqlFile(path.join(migrationRoot, '032_document_version_state.sql'));
    runPsqlFile(path.join(migrationRoot, '033_canonical_state_atomicity.sql'));
  });

  afterAll(() => {
    try {
      if (dataDir && fs.existsSync(dataDir)) {
        spawnSync('pg_ctl', ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], { encoding: 'utf8' });
      }
    } finally {
      if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('B replacement commits document supersession, field invalidation, history, and conflict resolution together', () => {
    const propertyId = 'replace-atomic';
    const a = { ...activate(propertyId, 'purchase_agreement', 'a.pdf', 'hash-a'), source_hash: 'hash-a' };
    const field = insertField(propertyId, a, { status: 'verified', verified: true });
    const conflict = commit({
      property_id: propertyId,
      expected_conflicts: [{ field_key: 'transaction.purchase_price', absent: true }],
      conflict_changes: [{
        op: 'upsert',
        payload: {
          field_key: 'transaction.purchase_price',
          display_label: 'Purchase price',
          canonical_value: '$10,000',
          conflicting_value: '$12,000',
          canonical_source_doc_id: a.document_id,
          conflicting_source_doc_id: a.document_id,
          status: 'unresolved',
        },
      }],
    });
    expect(conflict.status).toBe('committed');

    const b = activate(propertyId, 'purchase_agreement', 'b.pdf', 'hash-b');
    expect(b.status).toBe('committed');
    expect(JSON.parse(runPsql(
      `SELECT jsonb_build_object(
        'old_active', (SELECT is_active FROM public.deal_analyses WHERE id = ${sqlString(a.document_id)}::uuid),
        'new_active', (SELECT is_active FROM public.deal_analyses WHERE id = ${sqlString(b.document_id)}::uuid),
        'field_status', (SELECT status FROM public.transaction_record_fields WHERE id = ${sqlString(field.id)}::uuid),
        'verified_by', (SELECT verified_by FROM public.transaction_record_fields WHERE id = ${sqlString(field.id)}::uuid),
        'source_events', (SELECT count(*) FROM public.transaction_record_history WHERE property_id = ${sqlString(propertyId)} AND event_type = 'source_changed'),
        'open_conflicts', (SELECT count(*) FROM public.transaction_record_conflicts WHERE property_id = ${sqlString(propertyId)} AND status = 'unresolved')
      )::text;`,
    ))).toEqual({
      old_active: false,
      new_active: true,
      field_status: 'needs_review',
      verified_by: null,
      source_events: 1,
      open_conflicts: 0,
    });
  });

  test('an extraction plan resumed after replacement is rejected as stale without writes', () => {
    const propertyId = 'stale-extraction';
    const a = { ...activate(propertyId, 'lease', 'a.pdf', 'stale-a'), source_hash: 'stale-a' };
    activate(propertyId, 'lease', 'b.pdf', 'stale-b');
    const result = commit({
      property_id: propertyId,
      required_sources: [{ id: a.document_id, source_hash: a.source_hash }],
      expected_fields: [{ field_key: 'transaction.purchase_price', absent: true }],
      field_changes: [{
        op: 'insert',
        field_key: 'transaction.purchase_price',
        patch: { field_key: 'transaction.purchase_price', value_text: '$10,000' },
      }],
      history_rows: [{ field_key: 'transaction.purchase_price', event_type: 'extracted' }],
    });
    expect(result.status).toBe('stale_source');
    expect(queryCount(propertyId, 'transaction_record_fields')).toBe(0);
    expect(queryCount(propertyId, 'transaction_record_history')).toBe(0);
  });

  test('simultaneous replacements serialize and leave exactly one active ordinary document', async () => {
    const propertyId = 'concurrent-replacements';
    activate(propertyId, 'rent_roll', 'initial.pdf', 'initial-hash');
    runPsql(`
      CREATE FUNCTION public.test_pause_racing_insert() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.filename IN ('race-a.pdf', 'race-b.pdf') THEN PERFORM pg_sleep(0.3); END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER test_pause_racing_insert
        BEFORE INSERT ON public.deal_analyses
        FOR EACH ROW EXECUTE FUNCTION public.test_pause_racing_insert();
    `);
    const results = await Promise.all([
      runPsqlAsync(`SELECT public.kontra_activate_document_version(${sqlString(propertyId)}, 'rent_roll', ${sqlJson({
        filename: 'race-a.pdf', analysis: {}, uploaded_by_role: 'coordinator', source_hash: 'race-a', processing_status: 'processing',
      })}, NULL)::text;`),
      runPsqlAsync(`SELECT public.kontra_activate_document_version(${sqlString(propertyId)}, 'rent_roll', ${sqlJson({
        filename: 'race-b.pdf', analysis: {}, uploaded_by_role: 'coordinator', source_hash: 'race-b', processing_status: 'processing',
      })}, NULL)::text;`),
    ]);
    expect(results.map(value => JSON.parse(value).status)).toEqual(['committed', 'committed']);
    expect(JSON.parse(runPsql(
      `SELECT jsonb_build_object(
        'active', count(*) FILTER (WHERE is_active),
        'total', count(*)
      )::text FROM public.deal_analyses WHERE property_id = ${sqlString(propertyId)} AND section = 'rent_roll';`,
    ))).toEqual({ active: 1, total: 3 });
  });

  test('concurrent field plans from different sections use snapshots instead of last-write-wins', async () => {
    const propertyId = 'cross-section-race';
    const a = { ...activate(propertyId, 'lease', 'lease.pdf', 'lease-hash'), source_hash: 'lease-hash' };
    const b = { ...activate(propertyId, 'financials', 'financials.pdf', 'financial-hash'), source_hash: 'financial-hash' };
    insertField(propertyId, a);
    const expected = fieldRow(propertyId);
    const results = await Promise.all([
      runPsqlAsync(`SELECT public.kontra_commit_canonical_change_set(${sqlJson(fieldUpdateSet(propertyId, a, expected, '$11,000'))})::text;`),
      runPsqlAsync(`SELECT public.kontra_commit_canonical_change_set(${sqlJson(fieldUpdateSet(propertyId, b, expected, '$12,000'))})::text;`),
    ]);
    expect(results.map(value => JSON.parse(value).status).sort()).toEqual(['committed', 'retry_snapshot']);
    expect(queryCount(propertyId, 'transaction_record_history')).toBe(2);
    expect(['$11,000', '$12,000']).toContain(fieldRow(propertyId).value_text);
  });

  test('a reconciliation planned from A cannot restore A after B invalidates its evidence', () => {
    const propertyId = 'reconcile-replacement';
    const a = { ...activate(propertyId, 'purchase_agreement', 'a.pdf', 'reconcile-a'), source_hash: 'reconcile-a' };
    const field = insertField(propertyId, a, { status: 'verified', verified: true });
    const oldSnapshot = fieldRow(propertyId);
    activate(propertyId, 'purchase_agreement', 'b.pdf', 'reconcile-b');
    const result = commit({
      property_id: propertyId,
      required_sources: [{ id: a.document_id, source_hash: a.source_hash }],
      expected_fields: [fieldSnapshot(oldSnapshot)],
      field_changes: [{
        op: 'update',
        id: field.id,
        patch: { status: 'verified', verified_by: 'owner@example.com', verified_role: 'Workspace Owner' },
      }],
    });
    expect(result.status).toBe('stale_source');
    expect(fieldRow(propertyId)).toEqual(expect.objectContaining({
      status: 'needs_review',
      verified_by: null,
    }));
  });

  test('history and conflict constraint failures roll back the entire canonical change set', () => {
    const propertyId = 'rollback-canonical';
    const document = { ...activate(propertyId, 'lease', 'lease.pdf', 'rollback-hash'), source_hash: 'rollback-hash' };
    const field = insertField(propertyId, document);
    const baselineHistory = queryCount(propertyId, 'transaction_record_history');
    runPsql(`
      DO $$
      DECLARE f public.transaction_record_fields%ROWTYPE;
      BEGIN
        SELECT * INTO f FROM public.transaction_record_fields
         WHERE property_id = ${sqlString(propertyId)} AND field_key = 'transaction.purchase_price';
        BEGIN
          PERFORM public.kontra_commit_canonical_change_set(jsonb_build_object(
            'property_id', ${sqlString(propertyId)},
            'expected_fields', jsonb_build_array(jsonb_build_object(
              'id', f.id, 'field_key', f.field_key, 'updated_at', f.updated_at,
              'status', f.status, 'value_text', f.value_text
            )),
            'field_changes', jsonb_build_array(jsonb_build_object(
              'op', 'update', 'id', f.id, 'patch', jsonb_build_object('value_text', 'history-failure')
            )),
            'history_rows', jsonb_build_array(jsonb_build_object(
              'field_id', f.id, 'event_type', 'injected_invalid_event'
            ))
          ));
          RAISE EXCEPTION 'expected history check violation' USING ERRCODE = 'P0001';
        EXCEPTION WHEN check_violation THEN NULL;
        END;

        SELECT * INTO f FROM public.transaction_record_fields
         WHERE property_id = ${sqlString(propertyId)} AND field_key = 'transaction.purchase_price';
        BEGIN
          PERFORM public.kontra_commit_canonical_change_set(jsonb_build_object(
            'property_id', ${sqlString(propertyId)},
            'expected_fields', jsonb_build_array(jsonb_build_object(
              'id', f.id, 'field_key', f.field_key, 'updated_at', f.updated_at,
              'status', f.status, 'value_text', f.value_text
            )),
            'field_changes', jsonb_build_array(jsonb_build_object(
              'op', 'update', 'id', f.id, 'patch', jsonb_build_object('value_text', 'conflict-failure')
            )),
            'expected_conflicts', jsonb_build_array(jsonb_build_object(
              'field_key', 'transaction.injected', 'absent', true
            )),
            'history_rows', jsonb_build_array(jsonb_build_object(
              'field_id', f.id, 'event_type', 'manual_edit'
            )),
            'conflict_changes', jsonb_build_array(jsonb_build_object(
              'op', 'upsert',
              'payload', jsonb_build_object(
                'field_key', 'transaction.injected',
                'display_label', 'Injected conflict',
                'canonical_value', 'old',
                'conflicting_value', 'new',
                'status', 'injected_invalid_status'
              )
            ))
          ));
          RAISE EXCEPTION 'expected conflict check violation' USING ERRCODE = 'P0001';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
      END;
      $$;
    `);
    expect(fieldRow(propertyId).value_text).toBe('$10,000');
    expect(queryCount(propertyId, 'transaction_record_history')).toBe(baselineHistory);
    expect(queryCount(propertyId, 'transaction_record_conflicts')).toBe(0);
  });

  test('a property-lock timeout is returned as a database failure', async () => {
    const propertyId = 'lock-timeout';
    const blocker = spawn('psql', [...psqlArgs], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    blocker.stderr.setEncoding('utf8').on('data', chunk => {
      stderr += chunk;
      if (stderr.includes('LOCK_HELD')) blocker.emit('test-lock-ready');
    });
    const lockReady = new Promise((resolve, reject) => {
      blocker.once('test-lock-ready', resolve);
      blocker.once('error', reject);
      blocker.once('close', code => {
        if (code !== 0) reject(new Error(stderr));
      });
    });
    blocker.stdin.end(`
      BEGIN;
      SELECT pg_advisory_xact_lock(hashtextextended('kontra:canonical-state:${propertyId}', 0));
      DO $$ BEGIN RAISE NOTICE 'LOCK_HELD'; END $$;
      SELECT pg_sleep(6.2);
      COMMIT;
    `);
    await lockReady;
    runPsql(`
      DO $$
      DECLARE timed_out boolean := false;
      BEGIN
        BEGIN
          PERFORM public.kontra_commit_canonical_change_set(
            jsonb_build_object('property_id', ${sqlString(propertyId)})
          );
        EXCEPTION WHEN lock_not_available THEN
          timed_out := true;
        END;
        IF NOT timed_out THEN RAISE EXCEPTION 'property lock timeout was not returned'; END IF;
      END;
      $$;
    `);
    await new Promise((resolve, reject) => blocker.once('close', code => (
      code === 0 ? resolve() : reject(new Error(stderr))
    )));
  });

  test('system verification rows stay inactive and room retention uses the guarded atomic delete', () => {
    const systemId = runPsql(`
      INSERT INTO public.deal_analyses (property_id, section, filename, analysis, uploaded_by_role)
      VALUES ('system-version', 'cross_document_verification', 'verification.json', '{}'::jsonb, 'verification_engine')
      RETURNING id::text;
    `);
    expect(runPsql(`SELECT is_active::text FROM public.deal_analyses WHERE id = ${sqlString(systemId)}::uuid;`)).toBe('false');

    const propertyId = 'retention-operation';
    const document = { ...activate(propertyId, 'lease', 'lease.pdf', 'retention-hash'), source_hash: 'retention-hash' };
    const field = insertField(propertyId, document);
    const approval = commit({
      property_id: propertyId,
      expected_fields: [fieldSnapshot(field)],
      approval_rows: [{
        field_id: field.id,
        action: 'approved',
        actor_email: 'owner@example.com',
        actor_role: 'Workspace Owner',
      }],
    });
    expect(approval.status).toBe('committed');
    commit({
      property_id: propertyId,
      expected_conflicts: [{ field_key: 'transaction.purchase_price', absent: true }],
      conflict_changes: [{
        op: 'upsert',
        payload: {
          field_key: 'transaction.purchase_price',
          display_label: 'Purchase price',
          canonical_value: '$10,000',
          conflicting_value: '$12,000',
          status: 'unresolved',
        },
      }],
    });

    runPsql(`
      DO $$
      DECLARE direct_delete_blocked boolean := false;
      BEGIN
        BEGIN
          DELETE FROM public.deal_analyses WHERE property_id = ${sqlString(propertyId)};
        EXCEPTION WHEN insufficient_privilege THEN direct_delete_blocked := true;
        END;
        IF NOT direct_delete_blocked THEN RAISE EXCEPTION 'ordinary document delete was not blocked'; END IF;
      END;
      $$;
    `);
    const deletion = commit({ property_id: propertyId, operation: 'room_retention_delete' });
    expect(deletion.status).toBe('committed');
    expect(deletion.operation).toBe('room_retention_delete');
    expect(queryCount(propertyId, 'deal_analyses')).toBe(0);
    expect(queryCount(propertyId, 'transaction_record_fields')).toBe(0);
    expect(queryCount(propertyId, 'transaction_record_history')).toBe(0);
    expect(queryCount(propertyId, 'transaction_record_approvals')).toBe(0);
    expect(queryCount(propertyId, 'transaction_record_conflicts')).toBe(0);
  });
});