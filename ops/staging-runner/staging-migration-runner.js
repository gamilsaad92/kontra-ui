#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");

const ROOT = path.resolve(__dirname, "../..");
const MANIFEST_PATH = path.join(__dirname, "proposed-manifest.json");
const PINNED_SOURCE_COMMIT = "b6deb3dd903c4b2371c4f9e5fc10309a605d198f";
const PINNED_SOURCE_REPOSITORY = "https://github.com/gamilsaad92/kontra-ui.git";
const PINNED_SOURCE_REF = "refs/remotes/kontra-pinned-source/phase2g";
const PINNED_MANIFEST_ENTRY_COUNT = 50;
const PINNED_MANIFEST_SHA256 = "d25a5929489a621f31dbdeee39d762d98a0a8ecb167a8594f5aa2e75d6a7403d";
const ADVISORY_LOCK_KEY = [1263488596, 1296641874];
const EXECUTION_TOKEN = Symbol("approved-migration-execution");
const GIT_ENV = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))
);
Object.assign(GIT_ENV, {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_NO_LAZY_FETCH: "1",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
});
const manifestBytes = fs.readFileSync(MANIFEST_PATH);
verifyManifestBytes(manifestBytes);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
if (manifest.sourceCommit !== PINNED_SOURCE_COMMIT) {
  throw new Error("Manifest names an unexpected source commit.");
}
if (!Array.isArray(manifest.migrations) || manifest.migrations.length !== PINNED_MANIFEST_ENTRY_COUNT) {
  throw new Error("Pinned manifest has an unexpected migration entry count.");
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function verifyManifestBytes(bytes, expectedHash = PINNED_MANIFEST_SHA256) {
  if (sha256(bytes) !== expectedHash) throw new Error("Pinned manifest checksum mismatch.");
  return true;
}

function verifyPinnedBlobBytes(sourceBytes, expectedHash) {
  const sourceHash = sha256(sourceBytes);
  if (sourceHash !== expectedHash) {
    throw new Error("Pinned Git source blob does not match its manifest checksum.");
  }
  return true;
}

function isApprovedRepositoryUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const approved = new URL(PINNED_SOURCE_REPOSITORY);
    const pathWithoutGitSuffix = url.pathname.replace(/\.git$/, "");
    return url.protocol === "https:"
      && url.hostname === approved.hostname
      && !url.port
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && pathWithoutGitSuffix === approved.pathname.replace(/\.git$/, "");
  } catch {
    return false;
  }
}

function execGit(context, args, options = {}) {
  const { execFileSync } = require("node:child_process");
  return execFileSync("git", [...context.prefix, ...args], {
    ...options,
    cwd: context.workTree,
    env: GIT_ENV,
  });
}

function createGitContext(repositoryRoot) {
  const { execFileSync } = require("node:child_process");
  const workTree = fs.realpathSync(repositoryRoot);
  const discoveredGitDir = execFileSync("git", ["-C", workTree, "rev-parse", "--absolute-git-dir"], {
    cwd: workTree,
    encoding: "utf8",
    env: GIT_ENV,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  const gitDir = fs.realpathSync(discoveredGitDir);
  const context = {
    workTree,
    gitDir,
    prefix: ["--git-dir", gitDir, "--work-tree", workTree],
  };
  const actualTopLevel = execGit(context, ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (fs.realpathSync(actualTopLevel) !== workTree) {
    throw new Error("Git worktree does not match the requested repository root.");
  }

  const commonDir = fs.realpathSync(execGit(context, [
    "rev-parse", "--path-format=absolute", "--git-common-dir",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  const objectsDir = path.resolve(execGit(context, [
    "rev-parse", "--path-format=absolute", "--git-path", "objects",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  const expectedObjectsDir = path.join(commonDir, "objects");
  if (objectsDir !== expectedObjectsDir || fs.lstatSync(objectsDir).isSymbolicLink()) {
    throw new Error("Git object storage is redirected from the repository's common object directory.");
  }
  const alternatesPath = execGit(context, [
    "rev-parse", "--path-format=absolute", "--git-path", "objects/info/alternates",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  if (fs.existsSync(alternatesPath)) {
    throw new Error("Git alternate object databases are not permitted.");
  }
  return context;
}

function verifySourceCommit(repositoryRoot = ROOT) {
  try {
    const context = createGitContext(repositoryRoot);
    const remoteUrls = execGit(context, ["remote", "get-url", "--all", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().split(/\r?\n/).filter(Boolean);
    if (remoteUrls.length !== 1 || !isApprovedRepositoryUrl(remoteUrls[0])) {
      throw new Error("Unapproved source repository.");
    }
    const approvedRefCommit = execGit(context, ["rev-parse", "--verify", `${PINNED_SOURCE_REF}^{commit}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (approvedRefCommit !== PINNED_SOURCE_COMMIT) {
      throw new Error("Pinned source ref does not resolve to the approved commit.");
    }
    const objectType = execGit(context, ["cat-file", "-t", PINNED_SOURCE_COMMIT], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (objectType !== "commit") {
      throw new Error("Pinned source object is not a commit.");
    }
    execGit(context, ["cat-file", "-e", `${PINNED_SOURCE_COMMIT}^{tree}`], {
      stdio: "ignore",
    });
    return context;
  } catch {
    throw new Error("Pinned source repository, ref, or commit object is missing or mismatched.");
  }
}

function verifyFiles(input = manifest, repositoryRoot = ROOT) {
  if (input !== manifest) throw new Error("Only the checksum-pinned manifest may be verified.");
  if (input.migrations.length !== PINNED_MANIFEST_ENTRY_COUNT) {
    throw new Error("Pinned manifest has an unexpected migration entry count.");
  }
  const gitContext = verifySourceCommit(repositoryRoot);
  const ids = new Set();
  const paths = new Set();
  const verifiedFiles = new Map();
  for (const row of input.migrations) {
    const [id, relativePath, expectedHash, mode, dependencies] = row;
    if (ids.has(id)) throw new Error(`Duplicate migration ID: ${id}`);
    if (paths.has(relativePath)) throw new Error(`Duplicate migration path: ${relativePath}`);
    ids.add(id);
    paths.add(relativePath);
    if (!["M", "S", "X"].includes(mode)) throw new Error(`Invalid transaction mode for ${id}`);
    if (!Array.isArray(dependencies)) throw new Error(`Invalid dependencies for ${id}`);
    if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
      throw new Error(`Unsafe manifest path: ${relativePath}`);
    }
    let sourceBytes;
    try {
      sourceBytes = execGit(gitContext, ["show", `${PINNED_SOURCE_COMMIT}:${relativePath}`], {
        maxBuffer: 8 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      throw new Error(`Migration source blob is missing at the pinned commit: ${id}`);
    }
    verifyPinnedBlobBytes(sourceBytes, expectedHash);
    verifiedFiles.set(id, sourceBytes);
  }
  for (const [id, , , , dependencies] of input.migrations) {
    for (const dependency of dependencies) {
      if (!ids.has(dependency)) throw new Error(`Unknown dependency ${dependency} in ${id}`);
    }
  }
  return verifiedFiles;
}

function sortMigrations(input = manifest) {
  const byId = new Map(input.migrations.map((row) => [row[0], row]));
  const temporary = new Set();
  const permanent = new Set();
  const result = [];

  function visit(id) {
    if (permanent.has(id)) return;
    if (temporary.has(id)) throw new Error(`Dependency cycle at ${id}`);
    const row = byId.get(id);
    if (!row) throw new Error(`Unknown migration dependency ${id}`);
    temporary.add(id);
    for (const dependency of row[4]) visit(dependency);
    temporary.delete(id);
    permanent.add(id);
    result.push(row);
  }

  for (const id of byId.keys()) visit(id);
  return result;
}

function validateStagingUrl(raw, env = process.env) {
  if (!raw) throw new Error("STAGING_DATABASE_URL is required.");
  const url = new URL(raw);
  if (
    url.protocol !== "postgres:" && url.protocol !== "postgresql:"
  ) throw new Error("Only PostgreSQL URLs are accepted.");
  const expectedUser = manifest.expectedRole;
  if (
    url.hostname !== manifest.expectedHost ||
    Number(url.port) !== manifest.expectedPort ||
    decodeURIComponent(url.pathname.slice(1)) !== manifest.expectedDatabase ||
    decodeURIComponent(url.username) !== expectedUser
  ) throw new Error("Database target does not match the pinned staging project.");
  if (url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("STAGING_DATABASE_URL must specify sslmode=verify-full.");
  }
  if (env.DATABASE_URL || env.APP_DATABASE_URL || env.PRODUCTION_DATABASE_URL) {
    throw new Error("Ambiguous or production database variables are present; refusing to continue.");
  }
  return {
    host: url.hostname,
    port: Number(url.port),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

function loadPinnedCa() {
  const caPath = path.join(ROOT, manifest.caFile);
  const pinPath = `${caPath}.sha256`;
  const pem = fs.readFileSync(caPath, "utf8");
  const pin = fs.readFileSync(pinPath, "utf8").trim().split(/\s+/)[0].toLowerCase();
  if (sha256(pem) !== pin || pin !== manifest.caSha256) {
    throw new Error("Pinned Supabase CA checksum mismatch.");
  }
  return pem;
}

function requireManualAuthorization(args) {
  if (!args.includes("--apply")) throw new Error("Read-only mode. Pass --apply only after approval.");
  if (!args.includes("--authorize-staging")) throw new Error("Manual staging authorization is required.");
  if (!args.includes(`--confirm-project=${manifest.expectedProjectRef}`)) {
    throw new Error("Type the exact pinned staging project reference to authorize.");
  }
  if (manifest.executionEnabled !== true) {
    throw new Error("Manifest execution is disabled pending separate approval.");
  }
  return EXECUTION_TOKEN;
}

function selectMigrations(args, orderedRows = sortMigrations()) {
  const requested = args
    .filter((arg) => arg.startsWith("--migration="))
    .map((arg) => arg.slice("--migration=".length));
  if (!requested.length) throw new Error("Select at least one exact migration ID with --migration=<id>.");
  if (new Set(requested).size !== requested.length) throw new Error("Duplicate migration selection.");
  const byId = new Map(orderedRows.map((row) => [row[0], row]));
  return requested.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error(`Unknown migration selection: ${id}`);
    if (row[3] === "X" || row[5].length) throw new Error(`Migration ${id} is blocked from this runner.`);
    return row;
  }).sort((a, b) => orderedRows.indexOf(a) - orderedRows.indexOf(b));
}

function validateLedgerRows(allRows, ledgerRows) {
  const byId = new Map(allRows.map((row) => [row[0], row]));
  for (const [id, , , , dependencies] of allRows) {
    for (const dependency of dependencies) {
      if (!byId.has(dependency)) {
        throw new Error(`Unknown dependency ${dependency} in migration ${id}.`);
      }
    }
  }
  const applied = new Map();
  for (const row of ledgerRows) {
    const expected = byId.get(row.migration_id);
    if (!expected) throw new Error(`Unknown migration in ledger: ${row.migration_id}`);
    if (row.checksum !== expected[2] || row.source_commit !== PINNED_SOURCE_COMMIT) {
      throw new Error(`Ledger content or source revision mismatch for ${row.migration_id}.`);
    }
    if (row.status === "started") {
      if (row.applied_at !== null) throw new Error(`Inconsistent started ledger row: ${row.migration_id}`);
      throw new Error(`Partially applied migration requires manual reconciliation: ${row.migration_id}`);
    }
    if (row.status !== "applied" || !row.applied_at || !row.started_at) {
      throw new Error(`Inconsistent applied ledger row: ${row.migration_id}`);
    }
    applied.set(row.migration_id, row);
  }
  for (const migrationId of applied.keys()) {
    const migration = byId.get(migrationId);
    for (const dependency of migration[4]) {
      if (!applied.has(dependency)) {
        throw new Error(
          `Inconsistent applied history: ${migrationId} is applied but dependency ${dependency} is not.`
        );
      }
    }
  }
  return applied;
}

function planPendingMigrations(selectedRows, applied) {
  const completed = new Set(applied.keys());
  const pending = [];
  for (const row of selectedRows) {
    const [id, , , mode, dependencies, blockers] = row;
    if (mode === "X" || blockers.length) throw new Error(`Migration ${id} is blocked from this runner.`);
    if (mode !== "M" && mode !== "S") throw new Error(`Unsupported transaction mode for ${id}.`);
    if (completed.has(id)) continue;
    if (dependencies.some((dependency) => !completed.has(dependency))) {
      throw new Error(`Unapplied dependency blocks ${id}.`);
    }
    pending.push(row);
    completed.add(id);
  }
  return pending;
}

function assertExactlyOneRow(rowCount, operation) {
  if (rowCount !== 1) throw new Error(`${operation} affected ${rowCount} rows; manual reconciliation is required.`);
}

function openClient(connection, ca) {
  const requireFromApi = createRequire(path.join(ROOT, "api/package.json"));
  const { Client } = requireFromApi("pg");
  return new Client({
    ...connection,
    ssl: { ca, rejectUnauthorized: true, servername: connection.host },
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
  });
}

async function acquireMigrationLock(client) {
  const result = await client.query(
    "SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired",
    ADVISORY_LOCK_KEY
  );
  if (result.rows[0]?.acquired !== true) {
    throw new Error("Another migration runner holds the staging migration lock.");
  }
  return true;
}

async function releaseMigrationLock(client) {
  const result = await client.query(
    "SELECT pg_advisory_unlock($1::integer, $2::integer) AS released",
    ADVISORY_LOCK_KEY
  );
  if (result.rows[0]?.released !== true) {
    throw new Error("Migration lock ownership was lost; stop for manual reconciliation.");
  }
}

function assertAuthorizedForSql(authorization) {
  if (authorization !== EXECUTION_TOKEN || manifest.executionEnabled !== true) {
    throw new Error("Migration execution is not authorized by the pinned manifest.");
  }
}

async function readAndValidateLedger(client, allRows) {
  const ledger = "kontra_internal.migration_ledger";
  const existingLedger = await client.query(
    `SELECT migration_id, checksum, status, source_commit, started_at, applied_at
       FROM ${ledger} ORDER BY migration_id`
  );
  return validateLedgerRows(allRows, existingLedger.rows);
}

async function executeSelectedMigrations(client, allRows, selectedRows, sourceFiles, authorization) {
  assertAuthorizedForSql(authorization);
  const ledger = "kontra_internal.migration_ledger";
  const applied = await readAndValidateLedger(client, allRows);
  const pending = planPendingMigrations(selectedRows, applied);
  for (const [id, , expectedHash, mode] of pending) {

    const sourceBytes = sourceFiles.get(id);
    if (!sourceBytes || sha256(sourceBytes) !== expectedHash) {
      throw new Error(`Verified source bytes are unavailable for ${id}.`);
    }
    const sql = sourceBytes.toString("utf8");
    if (mode === "S") {
      const insert = await client.query(
        `INSERT INTO ${ledger} (migration_id, checksum, status, source_commit) VALUES ($1,$2,'started',$3)`,
        [id, expectedHash, PINNED_SOURCE_COMMIT]
      );
      assertExactlyOneRow(insert.rowCount, `Starting ${id}`);
      // The source owns its transaction. A failure leaves "started"; never retry automatically.
      await client.query(sql);
      const update = await client.query(
        `UPDATE ${ledger} SET status='applied', applied_at=now() WHERE migration_id=$1 AND checksum=$2 AND status='started'`,
        [id, expectedHash]
      );
      assertExactlyOneRow(update.rowCount, `Finalizing ${id}`);
    } else {
      await client.query("BEGIN");
      try {
        await client.query(sql);
        const insert = await client.query(
          `INSERT INTO ${ledger} (migration_id, checksum, status, source_commit, applied_at) VALUES ($1,$2,'applied',$3,now()) RETURNING migration_id`,
          [id, expectedHash, PINNED_SOURCE_COMMIT]
        );
        assertExactlyOneRow(insert.rowCount, `Recording ${id}`);
        await client.query("COMMIT");
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch {}
        throw error;
      }
    }
    applied.set(id, { migration_id: id, checksum: expectedHash, source_commit: PINNED_SOURCE_COMMIT, status: "applied", started_at: true, applied_at: true });
  }
}

async function main(args = process.argv.slice(2)) {
  const verifiedSourceFiles = verifyFiles();
  const ordered = sortMigrations();
  if (args.includes("--plan")) {
    console.log(`Verified ${ordered.length} manifest entries; execution is disabled.`);
    return;
  }

  const authorization = requireManualAuthorization(args);
  const selected = selectMigrations(args, ordered);
  const connection = validateStagingUrl(process.env.STAGING_DATABASE_URL);
  const ca = loadPinnedCa();
  const client = openClient(connection, ca);
  let connected = false;
  let locked = false;
  let failed = false;
  try {
    await client.connect();
    connected = true;
    await client.query("BEGIN READ ONLY");
    const identity = await client.query("SELECT current_database() AS db, current_user AS role");
    if (
      identity.rows[0]?.db !== manifest.expectedDatabase ||
      identity.rows[0]?.role !== "postgres"
    ) throw new Error("Connected database identity does not match staging preflight.");
    await client.query("ROLLBACK");
    // Session-level locks remain owned by this dedicated client across transactions.
    await acquireMigrationLock(client);
    locked = true;
    // No ledger read occurs until after the lock is held.
    await client.query("SELECT 1 FROM kontra_internal.migration_ledger LIMIT 0");
    await executeSelectedMigrations(client, manifest.migrations, selected, verifiedSourceFiles, authorization);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    let cleanupFailed = false;
    if (locked) {
      try { await releaseMigrationLock(client); } catch { cleanupFailed = true; }
    }
    if (connected) {
      try { await client.end(); } catch { cleanupFailed = true; }
    }
    if (cleanupFailed && !failed) {
      throw new Error("Migration cleanup failed; connection loss releases server session locks. Verify state manually.");
    }
  }
}

function formatSafeError() {
  return "Migration runner stopped; diagnostic details are redacted.";
}

module.exports = {
  sha256,
  verifyManifestBytes,
  verifyPinnedBlobBytes,
  verifySourceCommit,
  verifyFiles,
  sortMigrations,
  validateStagingUrl,
  loadPinnedCa,
  selectMigrations,
  validateLedgerRows,
  planPendingMigrations,
  assertExactlyOneRow,
  acquireMigrationLock,
  releaseMigrationLock,
  formatSafeError,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(formatSafeError(error));
    process.exitCode = 1;
  });
}
