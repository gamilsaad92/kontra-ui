#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = "api/migrations/035_tenant_relationships_and_submission_events.sql";
const expectedSourceSha256 = "6fd6c9d85b88f5999abf7ce75a618ac29a629aeae6cc8ca73c4e2428351718c6";
const packageOrder = [
  "01_035_tenant_relationships_and_submission_events.sql",
];
const outputDir = path.join(workspace, "generated-artifacts/phase5-staging-migration");

const source = fs.readFileSync(path.join(workspace, migrationPath));
const sourceSha256 = crypto.createHash("sha256").update(source).digest("hex");
if (sourceSha256 !== expectedSourceSha256) {
  throw new Error(
    `Migration source checksum changed: expected ${expectedSourceSha256}, got ${sourceSha256}. Review and update the package intentionally.`,
  );
}

const preamble = [
  "-- Kontra Phase 5 prepared migration package; not executed.",
  "-- Apply only to an explicitly verified isolated staging project after the documented preflight.",
  `-- Package order: ${packageOrder[0]}`,
  `-- Source: ${migrationPath}`,
  `-- Source SHA-256: ${sourceSha256}`,
  "",
].join("\n");
const packageSql = `${preamble}${source.toString("utf8").trimEnd()}\n`;
const packageSha256 = crypto.createHash("sha256").update(packageSql).digest("hex");

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, packageOrder[0]), packageSql, { mode: 0o600 });
fs.writeFileSync(
  path.join(outputDir, "MANIFEST.md"),
  [
    "# Phase 5 staging migration package",
    "",
    "Prepared only; do not execute without separate authorization.",
    "",
    "## Explicit order",
    "",
    `1. \`${packageOrder[0]}\``,
    "",
    `- Source: \`${migrationPath}\``,
    `- Source SHA-256: \`${sourceSha256}\``,
    `- Packaged SQL SHA-256: \`${packageSha256}\``,
    "- Migration 034 is not included: it is an unrelated Stripe Checkout migration and is not a 035 prerequisite.",
    "",
    "Rebuild with `node scripts/build-staging-phase5-package.mjs`. The builder refuses to package a source whose SHA-256 differs from the reviewed value above.",
    "",
  ].join("\n"),
  { mode: 0o600 },
);

console.log(`Prepared ${packageOrder.join(", ")}`);
console.log(`Source SHA-256: ${sourceSha256}`);
console.log(`Package SHA-256: ${packageSha256}`);
