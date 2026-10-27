"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const runner = require("../staging-migration-runner");
const manifest = require("../proposed-manifest.json");
const bootstrap = fs.readFileSync(path.join(__dirname, "../security-bootstrap-proposal.sql"), "utf8");
const runnerSource = fs.readFileSync(path.join(__dirname, "../staging-migration-runner.js"), "utf8");
const lockMatch = runnerSource.match(/const ADVISORY_LOCK_KEY = \[(\d+),\s*(\d+)\]/);
assert.ok(lockMatch, "runner defines an advisory-lock key");
const runnerLockKey = lockMatch.slice(1).map(Number);
const PINNED_SOURCE_COMMIT = "b6deb3dd903c4b2371c4f9e5fc10309a605d198f";
const PINNED_SOURCE_REF = "refs/remotes/kontra-pinned-source/phase2g";
const SOURCE_REPOSITORY = path.resolve(__dirname, "../../..");
const TEST_GIT_ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
Object.assign(TEST_GIT_ENV, {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_NO_LAZY_FETCH: "1",
});
const ids = new Set(manifest.migrations.map((row) => row[0]));

function sourceGit(args, options = {}) {
  return execFileSync("git", ["-C", SOURCE_REPOSITORY, ...args], {
    cwd: SOURCE_REPOSITORY,
    env: TEST_GIT_ENV,
    ...options,
  });
}

function makeDivergedSourceFixture({ includePinnedSource = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kontra-pinned-source-test-"));
  let fixtureParent = null;
  execFileSync("git", ["init", "--quiet", root], { env: TEST_GIT_ENV });
  const gitArgs = (args) => ["-C", root, ...args];
  const git = (args, options = {}) => execFileSync("git", gitArgs(args), {
    cwd: root,
    env: TEST_GIT_ENV,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  }).trim();
  git(["config", "user.name", "Kontra source verification test"]);
  git(["config", "user.email", "kontra-source-test@example.invalid"]);
  git(["remote", "add", "origin", "https://github.com/gamilsaad92/kontra-ui.git"]);
  if (includePinnedSource) {
    const sourceParent = sourceGit(["rev-parse", `${PINNED_SOURCE_COMMIT}^`], { encoding: "utf8" }).trim();
    const objectIds = new Set([
      PINNED_SOURCE_COMMIT,
      sourceParent,
      sourceGit(["rev-parse", `${PINNED_SOURCE_COMMIT}^{tree}`], { encoding: "utf8" }).trim(),
    ]);
    for (const [, relativePath] of manifest.migrations) {
      const parts = relativePath.split("/");
      for (let i = 1; i < parts.length; i++) {
        objectIds.add(sourceGit([
          "rev-parse", `${PINNED_SOURCE_COMMIT}:${parts.slice(0, i).join("/")}`,
        ], { encoding: "utf8" }).trim());
      }
      objectIds.add(sourceGit([
        "rev-parse", `${PINNED_SOURCE_COMMIT}:${relativePath}`,
      ], { encoding: "utf8" }).trim());
    }
    for (const oid of objectIds) {
      const type = sourceGit(["cat-file", "-t", oid], { encoding: "utf8" }).trim();
      const bytes = sourceGit(["cat-file", type, oid]);
      const copiedOid = git(["hash-object", "-w", "-t", type, "--stdin"], {
        input: bytes,
        encoding: "utf8",
      });
      assert.equal(copiedOid, oid);
    }
    fs.writeFileSync(path.join(root, ".git", "shallow"), `${sourceParent}\n`);
    fixtureParent = sourceParent;
  }
  const baseTree = includePinnedSource
    ? git(["rev-parse", `${PINNED_SOURCE_COMMIT}^{tree}`])
    : git(["mktree"]);
  const targetCommit = execFileSync("git", gitArgs([
    "-c", "user.name=Kontra source verification test",
    "-c", "user.email=kontra-source-test@example.invalid",
    "commit-tree",
    baseTree,
    ...(includePinnedSource ? ["-p", fixtureParent] : []),
  ]), {
    input: "Target-only fixture commit\n",
    encoding: "utf8",
    env: TEST_GIT_ENV,
  }).trim();
  git(["update-ref", "refs/heads/staging-migrations", targetCommit]);
  git(["symbolic-ref", "HEAD", "refs/heads/staging-migrations"]);
  if (includePinnedSource) {
    git(["update-ref", PINNED_SOURCE_REF, PINNED_SOURCE_COMMIT]);
  }
  const writePinnedRefWithoutObject = () => {
    const refPath = path.join(root, ".git", PINNED_SOURCE_REF);
    fs.mkdirSync(path.dirname(refPath), { recursive: true });
    fs.writeFileSync(refPath, `${PINNED_SOURCE_COMMIT}\n`);
  };
  return {
    root,
    git,
    gitArgs,
    writePinnedRefWithoutObject,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function withGitEnvironment(overrides, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  try {
    return callback();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous.get(key) === undefined) delete process.env[key];
      else process.env[key] = previous.get(key);
    }
  }
}

test("manifest pins release source, target, and disabled execution state", () => {
  assert.equal(manifest.sourceCommit, PINNED_SOURCE_COMMIT);
  assert.equal(manifest.expectedProjectRef, "jpemuoapbgzwapydqiio");
  assert.equal(manifest.expectedDatabase, "postgres");
  assert.equal(manifest.executionEnabled, false);
  assert.equal(manifest.manualApprovalRequired, true);
});

test("manifest bytes and migration files are pinned independently of manifest values", () => {
  assert.throws(() => runner.verifyManifestBytes(Buffer.from("tampered")), /manifest checksum/);
  assert.throws(
    () => runner.verifyManifestBytes(Buffer.from(JSON.stringify({ ...manifest, sourceCommit: "0".repeat(40) }))),
    /manifest checksum/
  );
  const original = Buffer.from("approved migration");
  assert.equal(runner.verifyPinnedBlobBytes(original, runner.sha256(original)), true);
  assert.throws(
    () => runner.verifyPinnedBlobBytes(Buffer.from("altered"), runner.sha256(original)),
    /does not match its manifest checksum/
  );
  const verified = runner.verifyFiles();
  assert.equal(verified.size, 50);
  assert.equal(manifest.migrations.length, 50);
  assert.throws(() => runner.verifyFiles({ ...manifest }), /Only the checksum-pinned manifest/);
});

test("diverged target checkout verifies exact pinned blobs without migration files in its worktree", () => {
  const fixture = makeDivergedSourceFixture();
  try {
    assert.equal(fixture.git(["rev-parse", "--is-bare-repository"]), "false");
    const ancestry = spawnSync("git", fixture.gitArgs([
      "merge-base", "--is-ancestor", PINNED_SOURCE_COMMIT, "refs/heads/staging-migrations",
    ]), { encoding: "utf8" });
    assert.equal(ancestry.status, 1, ancestry.stderr);
    assert.equal(runner.verifySourceCommit(fixture.root).workTree, fs.realpathSync(fixture.root));
    const migration034 = manifest.migrations.find((row) => row[0] === "api:034_durable_checkout_owner_access");
    assert.ok(migration034);
    assert.equal(fs.existsSync(path.join(fixture.root, migration034[1])), false);
    const verified = runner.verifyFiles(undefined, fixture.root);
    assert.equal(verified.size, 50);
    assert.equal(runner.sha256(verified.get(migration034[0])), migration034[2]);
  } finally {
    fixture.cleanup();
  }
});

test("missing pinned object and an unapproved source ref fail closed", () => {
  const unavailable = makeDivergedSourceFixture({ includePinnedSource: false });
  try {
    unavailable.writePinnedRefWithoutObject();
    assert.throws(() => runner.verifySourceCommit(unavailable.root), /missing or mismatched/);
    assert.throws(() => runner.verifyFiles(undefined, unavailable.root), /missing or mismatched/);
  } finally {
    unavailable.cleanup();
  }

  const corrupt = makeDivergedSourceFixture({ includePinnedSource: false });
  try {
    corrupt.writePinnedRefWithoutObject();
    const objectPath = path.join(corrupt.root, ".git", "objects",
      PINNED_SOURCE_COMMIT.slice(0, 2), PINNED_SOURCE_COMMIT.slice(2));
    fs.mkdirSync(path.dirname(objectPath), { recursive: true });
    fs.writeFileSync(objectPath, "corrupted Git object");
    assert.throws(() => runner.verifySourceCommit(corrupt.root), /missing or mismatched/);
  } finally {
    corrupt.cleanup();
  }

  const substituted = makeDivergedSourceFixture();
  try {
    substituted.git(["update-ref", PINNED_SOURCE_REF, "HEAD"]);
    assert.throws(() => runner.verifySourceCommit(substituted.root), /missing or mismatched/);
  } finally {
    substituted.cleanup();
  }
});

test("a working-tree substitute is ignored; only the pinned Git blob is returned", () => {
  const fixture = makeDivergedSourceFixture();
  try {
    const row = manifest.migrations.find((entry) => entry[0] === "api:034_durable_checkout_owner_access");
    const pathOnDisk = path.join(fixture.root, row[1]);
    fs.mkdirSync(path.dirname(pathOnDisk), { recursive: true });
    fs.writeFileSync(pathOnDisk, "untrusted working-tree replacement");
    const verified = runner.verifyFiles(undefined, fixture.root);
    assert.equal(runner.sha256(verified.get(row[0])), row[2]);
    assert.notEqual(verified.get(row[0]).toString("utf8"), "untrusted working-tree replacement");
  } finally {
    fixture.cleanup();
  }
});

test("pinned source verification rejects a non-approved repository origin", () => {
  const fixture = makeDivergedSourceFixture();
  try {
    for (const url of [
      "https://github.com/other/repository.git",
      "https://user@github.com/gamilsaad92/kontra-ui.git",
      "git@github.com:gamilsaad92/kontra-ui.git",
    ]) {
      fixture.git(["remote", "set-url", "origin", url]);
      assert.throws(() => runner.verifySourceCommit(fixture.root), /missing or mismatched/);
    }
  } finally {
    fixture.cleanup();
  }
});

test("Git environment redirects and injected config cannot change the inspected repository", () => {
  const fixture = makeDivergedSourceFixture();
  const decoy = makeDivergedSourceFixture({ includePinnedSource: false });
  try {
    const env = {
      GIT_DIR: path.join(decoy.root, ".git"),
      GIT_WORK_TREE: decoy.root,
      GIT_OBJECT_DIRECTORY: path.join(decoy.root, ".git", "missing-objects"),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(decoy.root, ".git", "objects"),
      GIT_COMMON_DIR: path.join(decoy.root, ".git"),
      GIT_CONFIG: path.join(decoy.root, "attacker-config"),
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "remote.origin.url",
      GIT_CONFIG_VALUE_0: "https://evil.example/repository.git",
      GIT_CONFIG_GLOBAL: path.join(decoy.root, "global-config"),
      GIT_CONFIG_SYSTEM: path.join(decoy.root, "system-config"),
      GIT_CONFIG_NOSYSTEM: "0",
    };
    withGitEnvironment(env, () => {
      const verified = runner.verifyFiles(undefined, fixture.root);
      assert.equal(verified.size, 50);
    });
  } finally {
    decoy.cleanup();
    fixture.cleanup();
  }
});

test("local URL rewriting and Git alternate object stores fail closed", () => {
  const rewritten = makeDivergedSourceFixture();
  try {
    rewritten.git([
      "config", "url.https://evil.example/.insteadOf",
      "https://github.com/gamilsaad92/kontra-ui.git",
    ]);
    assert.throws(() => runner.verifySourceCommit(rewritten.root), /missing or mismatched/);
  } finally {
    rewritten.cleanup();
  }

  const alternate = makeDivergedSourceFixture();
  try {
    const alternatePath = path.join(alternate.root, ".git", "objects", "info", "alternates");
    fs.mkdirSync(path.dirname(alternatePath), { recursive: true });
    fs.writeFileSync(alternatePath, `${alternate.root}/unapproved-objects\n`);
    assert.throws(() => runner.verifySourceCommit(alternate.root), /missing or mismatched/);
  } finally {
    alternate.cleanup();
  }
});

test("runner never fetches or follows a mutable migration-source branch", () => {
  assert.match(runnerSource, /const PINNED_SOURCE_COMMIT = "b6deb3dd903c4b2371c4f9e5fc10309a605d198f"/);
  assert.match(runnerSource, /const PINNED_SOURCE_REF = "refs\/remotes\/kontra-pinned-source\/phase2g"/);
  assert.doesNotMatch(runnerSource, /\bfetch\b/);
});

test("source IDs, paths, dependencies, and explicit ordering are valid", () => {
  assert.equal(ids.size, manifest.migrations.length);
  const sorted = runner.sortMigrations();
  assert.equal(sorted.length, manifest.migrations.length);
  const order = new Map(sorted.map((row, i) => [row[0], i]));
  for (const [id, , , , dependencies] of manifest.migrations) {
    for (const dep of dependencies) {
      assert.ok(ids.has(dep), `${id} -> ${dep}`);
      assert.ok(order.get(dep) < order.get(id), `${dep} before ${id}`);
    }
  }
});

test("staging URL validation rejects wrong host, role, database, and TLS mode", () => {
  const valid = "postgresql://postgres.jpemuoapbgzwapydqiio:dummy@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=verify-full";
  assert.equal(runner.validateStagingUrl(valid, {}).host, manifest.expectedHost);
  for (const [bad, message] of [
    [valid.replace(manifest.expectedHost, "prod.example.com"), /pinned staging project/],
    [valid.replace(manifest.expectedRole, "postgres.otherproject"), /pinned staging project/],
    [valid.replace("/postgres?", "/production?"), /pinned staging project/],
    [valid.replace("sslmode=verify-full", "sslmode=require"), /sslmode=verify-full/],
  ]) assert.throws(() => runner.validateStagingUrl(bad, {}), message);
});

test("importing the runner exposes no SQL executor; CLI apply remains blocked", () => {
  for (const key of Object.keys(runner)) {
    assert.doesNotMatch(key, /apply|execute|main/i);
  }
  const result = spawnSync(process.execPath, [
    path.join(__dirname, "../staging-migration-runner.js"),
    "--apply",
    "--authorize-staging",
    `--confirm-project=${manifest.expectedProjectRef}`,
    "--migration=api:002_deal_analyses",
  ], {
    cwd: path.resolve(__dirname, "../../.."),
    encoding: "utf8",
    env: { PATH: process.env.PATH, STAGING_DATABASE_URL: "not-a-real-connection-string" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /diagnostic details are redacted/);
  assert.doesNotMatch(result.stderr, /not-a-real-connection-string/);
});

test("ambiguous database variables are rejected without reading their values", () => {
  const url = "postgresql://postgres.jpemuoapbgzwapydqiio:dummy@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=verify-full";
  assert.throws(() => runner.validateStagingUrl(url, { DATABASE_URL: "present" }), /variables are present/);
});

test("session advisory lock serializes clients and connection loss releases it", async () => {
  let owner = null;
  const fakeClient = (name) => ({
    async query(sql, key) {
      assert.deepEqual(key, runnerLockKey);
      if (sql.includes("pg_try_advisory_lock")) {
        if (owner !== null) return { rows: [{ acquired: false }] };
        owner = name;
        return { rows: [{ acquired: true }] };
      }
      if (sql.includes("pg_advisory_unlock")) {
        if (owner !== name) return { rows: [{ released: false }] };
        owner = null;
        return { rows: [{ released: true }] };
      }
    },
    async end() { if (owner === name) owner = null; },
  });
  const first = fakeClient("first");
  const second = fakeClient("second");
  assert.equal(await runner.acquireMigrationLock(first), true);
  await assert.rejects(runner.acquireMigrationLock(second), /Another migration runner/);
  await first.end(); // models PostgreSQL releasing a session lock on disconnect
  assert.equal(await runner.acquireMigrationLock(second), true);
  await runner.releaseMigrationLock(second);
  assert.equal(owner, null);
});

test("incremental batches validate against the complete ledger and require dependencies", () => {
  const rows = manifest.migrations;
  const first = rows.find((row) => row[0] === "api:001_deal_rooms");
  const second = rows.find((row) => row[0] === "api:002_deal_analyses");
  const appliedFirst = [{
    migration_id: first[0], checksum: first[2], status: "applied",
    source_commit: manifest.sourceCommit, started_at: new Date(), applied_at: new Date(),
  }];
  const validated = runner.validateLedgerRows(rows, appliedFirst);
  assert.equal(runner.planPendingMigrations([second], validated)[0][0], second[0]);
  const appliedSecond = {
    migration_id: second[0], checksum: second[2], status: "applied",
    source_commit: manifest.sourceCommit, started_at: new Date(), applied_at: new Date(),
  };
  assert.equal(runner.validateLedgerRows(rows, [...appliedFirst, appliedSecond]).size, 2);
  assert.throws(
    () => runner.validateLedgerRows(rows, [appliedSecond]),
    /is applied but dependency api:001_deal_rooms is not/
  );
  const startedFirst = { ...appliedFirst[0], status: "started", applied_at: null };
  assert.throws(
    () => runner.validateLedgerRows(rows, [appliedSecond, startedFirst]),
    /Partially applied migration requires manual reconciliation/
  );
  const failedFirst = { ...appliedFirst[0], status: "failed", applied_at: null };
  assert.throws(
    () => runner.validateLedgerRows(rows, [appliedSecond, failedFirst]),
    /Inconsistent applied ledger row/
  );
  assert.throws(() => runner.planPendingMigrations([second], new Map()), /Unapplied dependency/);
  assert.throws(() => runner.validateLedgerRows(
    rows.map((row) => row[0] === second[0] ? [...row.slice(0, 4), ["missing:parent"], ...row.slice(5)] : row),
    []
  ), /Unknown dependency missing:parent/);
});

test("unknown, changed, partial, and inconsistent ledger rows are rejected", () => {
  const first = manifest.migrations.find((row) => row[0] === "api:001_deal_rooms");
  const base = {
    migration_id: first[0], checksum: first[2], status: "applied",
    source_commit: manifest.sourceCommit, started_at: new Date(), applied_at: new Date(),
  };
  assert.throws(() => runner.validateLedgerRows(manifest.migrations, [{ ...base, migration_id: "unknown" }]), /Unknown migration/);
  assert.throws(() => runner.validateLedgerRows(manifest.migrations, [{ ...base, checksum: "0".repeat(64) }]), /content or source revision mismatch/);
  assert.throws(() => runner.validateLedgerRows(manifest.migrations, [{ ...base, status: "started", applied_at: null }]), /manual reconciliation/);
  assert.throws(() => runner.validateLedgerRows(manifest.migrations, [{ ...base, applied_at: null }]), /Inconsistent applied/);
});

test("status transitions require exactly one row", () => {
  assert.doesNotThrow(() => runner.assertExactlyOneRow(1, "finalize"));
  assert.throws(() => runner.assertExactlyOneRow(0, "finalize"), /affected 0 rows/);
  assert.throws(() => runner.assertExactlyOneRow(2, "finalize"), /affected 2 rows/);
});

test("bootstrap is blocked, atomic, preflighted, and non-destructive", () => {
  assert.match(bootstrap, /BLOCKED: no database ACL metadata/);
  assert.match(bootstrap, /Do not run until an operator/);
  assert.match(bootstrap, /\\set ON_ERROR_STOP on/);
  assert.match(bootstrap, /KONTRA_BOOTSTRAP_AUTHORIZED/);
  assert.match(bootstrap, /KONTRA_ACL_REVIEWED/);
  assert.doesNotMatch(bootstrap, /\\quit/);
  assert.match(bootstrap, /RAISE EXCEPTION 'BLOCKED: staging bootstrap authorization is absent'/);
  assert.match(bootstrap, /^\s*BEGIN;/m);
  assert.match(bootstrap, /^\s*COMMIT;/m);
  assert.match(bootstrap, /pg_default_acl/);
  for (const role of ["postgres", "supabase_admin"]) {
    for (const [sqlType, privilege] of [
      ["TABLES", "ALL"], ["SEQUENCES", "ALL"],
      ["FUNCTIONS", "EXECUTE"], ["TYPES", "USAGE"],
    ]) {
      assert.match(bootstrap, new RegExp(`ALTER DEFAULT PRIVILEGES FOR ROLE ${role}\\s+REVOKE ${privilege} ON ${sqlType} FROM PUBLIC`));
      assert.match(bootstrap, new RegExp(`ALTER DEFAULT PRIVILEGES FOR ROLE ${role} IN SCHEMA public\\s+REVOKE ${privilege} ON ${sqlType} FROM PUBLIC`));
    }
  }
  assert.match(bootstrap, /AND NOT pg_has_role/);
  assert.doesNotMatch(bootstrap, /\bDROP\s+(SCHEMA|TABLE)\b/i);
});

test("bootstrap documents interruption recovery without deleting existing objects", () => {
  const proposal = fs.readFileSync(path.join(__dirname, "../README.md"), "utf8");
  assert.match(proposal, /partial bootstrap/i);
  assert.match(proposal, /manual reconciliation/i);
  assert.match(proposal, /do not drop/i);
});

test("database and query errors are redacted", () => {
  const secret = "fake-db-password-should-never-print";
  const message = runner.formatSafeError(new Error(`password=${secret}`));
  assert.doesNotMatch(message, new RegExp(secret));
});

test("self-managed modes and separate database exclusions remain explicit", () => {
  const byId = new Map(manifest.migrations.map((row) => [row[0], row]));
  for (const id of [
    "api:012_participant_security_v2",
    "api:032_document_version_state",
    "api:033_canonical_state_atomicity",
    "supa:20260127_fix_dashboard_schema",
  ]) assert.equal(byId.get(id)[3], "S");
  assert.equal(byId.get("appdb:app_identity_schema")[3], "X");
  assert.ok(byId.get("supa:20260320_rls_tenancy")[5].length);
});

test("pinned CA matches its checksum", () => {
  assert.equal(typeof runner.loadPinnedCa(), "string");
});
