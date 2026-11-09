import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveSupabaseConfig,
  resolveSupabaseDeploymentContext,
  STAGING_SUPABASE_URL,
} from "./supabaseConfig.mjs";

const stagingKey = "synthetic-staging-anon-key-for-tests-only";
const productionUrl = "https://production-ref.supabase.co";
const productionKey = "synthetic-production-anon-key-for-tests-only";

test("staging deployments accept only the pinned staging Supabase project", () => {
  const result = resolveSupabaseConfig({
    context: "staging",
    url: STAGING_SUPABASE_URL,
    anonKey: stagingKey,
  });
  assert.equal(result.configured, true);
  assert.equal(result.url, STAGING_SUPABASE_URL);
});

test("preview deployments reject production Supabase configuration", () => {
  assert.throws(
    () => resolveSupabaseConfig({
      context: "preview",
      url: productionUrl,
      anonKey: productionKey,
    }),
    /approved staging Supabase project/,
  );
});

test("production main retains its configured Supabase project", () => {
  assert.equal(resolveSupabaseDeploymentContext({
    vercelEnv: "production",
    gitRef: "main",
    mode: "production",
  }), "production");
  const result = resolveSupabaseConfig({
    context: "production",
    url: productionUrl,
    anonKey: productionKey,
  });
  assert.equal(result.configured, true);
  assert.equal(result.url, productionUrl);
});

test("preview and staging reject missing or mismatched Supabase settings", () => {
  for (const context of ["preview", "staging"]) {
    for (const config of [
      { url: "", anonKey: "" },
      { url: STAGING_SUPABASE_URL, anonKey: "" },
      { url: productionUrl, anonKey: stagingKey },
      { url: "http://jpemuoapbgzwapydqiio.supabase.co", anonKey: stagingKey },
    ]) {
      assert.throws(
        () => resolveSupabaseConfig({ context, ...config }),
        /approved staging Supabase project/,
      );
    }
  }
});

test("unknown Vercel environments fail closed and non-main deployments are non-production", () => {
  assert.throws(
    () => resolveSupabaseDeploymentContext({ vercelEnv: "unknown", gitRef: "main" }),
    /Unrecognized Vercel deployment environment/,
  );
  assert.equal(resolveSupabaseDeploymentContext({
    vercelEnv: "production",
    gitRef: "staging/unified-prep-2026-11-07",
  }), "staging");
  assert.equal(resolveSupabaseDeploymentContext({
    vercelEnv: "preview",
    gitRef: "main",
  }), "preview");
});

test("missing production configuration remains disabled as before", () => {
  assert.deepEqual(resolveSupabaseConfig({ context: "production" }), {
    url: "",
    anonKey: "",
    configured: false,
  });
});
