"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const runner = require("../staging-migration-runner");

const localUrl = process.env.KONTRA_LOCAL_PG_TEST_URL;
const skipReason = localUrl ? false : "Set KONTRA_LOCAL_PG_TEST_URL to a disposable loopback database named kontra_test_*.";
const runnerSource = fs.readFileSync(path.join(__dirname, "../staging-migration-runner.js"), "utf8");
const lockMatch = runnerSource.match(/const ADVISORY_LOCK_KEY = \[(\d+),\s*(\d+)\]/);
if (!lockMatch) throw new Error("Could not read the actual runner advisory-lock key.");
const lockKey = lockMatch.slice(1).join(",");

function localArgs(raw) {
  const url = new URL(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error("Local PostgreSQL tests reject non-loopback hosts.");
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database.startsWith("kontra_test_")) {
    throw new Error("Local PostgreSQL tests require a disposable kontra_test_* database.");
  }
  if (url.password) throw new Error("Local test URL must not contain a password; use isolated trust auth.");
  return ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", hostname, "-p", url.port || "5432",
    "-U", decodeURIComponent(url.username), "-d", database];
}

function psql(sql, expectSuccess = true, variables = {}) {
  const args = localArgs(localUrl);
  for (const [name, value] of Object.entries(variables)) args.push("-v", `${name}=${value}`);
  const result = spawnSync("psql", args, { input: sql, encoding: "utf8" });
  if (expectSuccess) assert.equal(result.status, 0, `local psql operation failed: ${result.stderr}`);
  else assert.notEqual(result.status, 0, `operation was expected to fail: ${result.stderr}`);
  return result;
}

function waitForOutput(child, expected, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let output = "";
    if (child.exitCode !== null) return reject(new Error(`psql exited before acquiring the lock (${child.exitCode})`));
    const timer = setTimeout(() => reject(new Error("psql session did not acquire the lock in time")), timeoutMs);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes(expected)) {
        clearTimeout(timer);
        resolve(output);
      }
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      if (!output.includes(expected)) {
        clearTimeout(timer);
        reject(new Error(`psql lock session exited unexpectedly (${code})`));
      }
    });
  });
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", resolve));
}

test("local PostgreSQL serializes session locks and releases after connection loss", { skip: skipReason }, async () => {
  const args = localArgs(localUrl);
  const first = spawn("psql", [...args], { stdio: ["pipe", "pipe", "pipe"] });
  try {
    first.stdin.end(
      "SELECT pg_backend_pid();\n" +
      `SELECT pg_advisory_lock(${lockKey});\n` +
      "SELECT 'LOCK_HELD';\n" +
      "SELECT pg_sleep(60);\n"
    );
    const output = await waitForOutput(first, "LOCK_HELD");
    const pid = output.split(/\s+/).find((part) => /^\d+$/.test(part));
    assert.ok(pid, "read local backend PID");
    const competing = psql(`SELECT pg_try_advisory_lock(${lockKey}) AS acquired;`);
    assert.match(competing.stdout, /^f\s*$/m);
    psql(`SELECT pg_terminate_backend(${pid});`);
    await waitForExit(first);
    const afterLoss = psql(`SELECT pg_try_advisory_lock(${lockKey}) AS acquired;`);
    assert.match(afterLoss.stdout, /^t\s*$/m);
  } finally {
    if (first.exitCode === null) first.kill("SIGKILL");
  }
});

test("local PostgreSQL enforces bootstrap gates, revokes default ACLs, and recovers safely", { skip: skipReason }, () => {
  for (const role of ["postgres", "anon", "authenticated", "service_role", "supabase_admin"]) {
    psql(`DO $role$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN EXECUTE 'CREATE ROLE ${role}'; END IF; END $role$;`);
  }

  const source = fs.readFileSync(path.join(__dirname, "../security-bootstrap-proposal.sql"), "utf8");
  assert.match(source, /\\if :\{\?KONTRA_BOOTSTRAP_AUTHORIZED\}/);
  assert.match(source, /\\if :\{\?KONTRA_ACL_REVIEWED\}/);
  psql("GRANT USAGE, CREATE ON SCHEMA public TO postgres, supabase_admin;");

  const grants = [];
  for (const role of ["postgres", "supabase_admin"]) {
    for (const scope of ["", " IN SCHEMA public"]) {
      grants.push(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${role}${scope} GRANT SELECT ON TABLES TO PUBLIC;`,
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${role}${scope} GRANT USAGE ON SEQUENCES TO PUBLIC;`,
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${role}${scope} GRANT EXECUTE ON FUNCTIONS TO PUBLIC;`,
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${role}${scope} GRANT USAGE ON TYPES TO PUBLIC;`
      );
    }
  }
  psql(grants.join("\n"));
  const aclSnapshotSql = `
    SELECT COALESCE(json_agg(x ORDER BY object_owner, schema_name, object_kind, grantee, privilege_type)::text, '[]')
    FROM (
      SELECT owner.rolname AS object_owner,
             COALESCE(ns.nspname, '') AS schema_name,
             d.defaclobjtype AS object_kind,
             CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
             acl.privilege_type,
             acl.is_grantable
      FROM pg_catalog.pg_default_acl d
      JOIN pg_catalog.pg_roles owner ON owner.oid = d.defaclrole
      LEFT JOIN pg_catalog.pg_namespace ns ON ns.oid = d.defaclnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) acl
      LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid = acl.grantee
      WHERE owner.rolname IN ('postgres', 'supabase_admin')
    ) x;
  `;
  const aclBefore = psql(aclSnapshotSql).stdout.trim();
  const schemaAbsent = () => assert.match(psql("SELECT to_regnamespace('kontra_internal') IS NULL;").stdout, /^t\s*$/m);
  const approvals = { KONTRA_BOOTSTRAP_AUTHORIZED: "on", KONTRA_ACL_REVIEWED: "on" };

  const absentApproval = psql(source, false);
  assert.notEqual(absentApproval.status, 0);
  schemaAbsent();
  assert.equal(psql(aclSnapshotSql).stdout.trim(), aclBefore);
  psql(source, false, { KONTRA_BOOTSTRAP_AUTHORIZED: "off", KONTRA_ACL_REVIEWED: "on" });
  schemaAbsent();
  assert.equal(psql(aclSnapshotSql).stdout.trim(), aclBefore);
  psql(source, false, { KONTRA_BOOTSTRAP_AUTHORIZED: "on" });
  schemaAbsent();
  assert.equal(psql(aclSnapshotSql).stdout.trim(), aclBefore);
  psql(source, false, { KONTRA_BOOTSTRAP_AUTHORIZED: "on", KONTRA_ACL_REVIEWED: "off" });
  schemaAbsent();
  assert.equal(psql(aclSnapshotSql).stdout.trim(), aclBefore);

  const interrupted = source.replace(/COMMIT;\s*$/i, "SELECT 1 / 0;\nCOMMIT;\n");
  psql(interrupted, false, approvals);
  schemaAbsent();
  assert.equal(psql(aclSnapshotSql).stdout.trim(), aclBefore);

  psql(source, true, approvals);
  assert.match(psql("SELECT to_regclass('kontra_internal.migration_ledger') IS NOT NULL;").stdout, /^t\s*$/m);

  const objects = [];
  const checks = [];
  for (const owner of ["postgres", "supabase_admin"]) {
    objects.push(
      `SET ROLE ${owner};
       CREATE TABLE public.phase2g_${owner}_table (id integer);
       CREATE SEQUENCE public.phase2g_${owner}_sequence;
       CREATE FUNCTION public.phase2g_${owner}_function() RETURNS integer LANGUAGE sql IMMUTABLE AS 'SELECT 1';
       CREATE TYPE public.phase2g_${owner}_type AS ENUM ('ok');
       RESET ROLE;`
    );
    for (const role of ["anon", "authenticated", "service_role"]) {
      checks.push(
        `NOT has_table_privilege('${role}', 'public.phase2g_${owner}_table', 'SELECT')`,
        `NOT has_sequence_privilege('${role}', 'public.phase2g_${owner}_sequence', 'USAGE')`,
        `NOT has_function_privilege('${role}', 'public.phase2g_${owner}_function()', 'EXECUTE')`,
        `NOT has_type_privilege('${role}', 'public.phase2g_${owner}_type', 'USAGE')`
      );
    }
  }
  psql(objects.join("\n"));
  assert.equal(psql(`SELECT ${checks.join(" AND ")};`).stdout.trim(), "t");

  psql(source, false, approvals); // Existing schema is a hard stop, not a cue to drop/recreate.
  assert.match(psql("SELECT to_regclass('kontra_internal.migration_ledger') IS NOT NULL;").stdout, /^t\s*$/m);
});
