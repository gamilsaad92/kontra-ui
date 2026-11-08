const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveApiBase } = require("./apiBaseRouting.mjs");

test("same-origin routing ignores configured API origins", () => {
  assert.equal(
    resolveApiBase({
      VITE_API_ROUTING_MODE: "same-origin",
      VITE_API_BASE_URL: "https://kontra-api.onrender.com",
      VITE_API_URL: "https://kontra-api.onrender.com",
    }),
    "",
  );
});

test("direct staging routing is limited to local development", () => {
  assert.equal(
    resolveApiBase({
      VITE_API_ROUTING_MODE: "direct",
      DEV: true,
      VITE_API_BASE_URL: "https://api-staging.kontraplatform.com/api/",
    }),
    "https://api-staging.kontraplatform.com",
  );
});

test("production builds reject direct routing even with a staging URL", () => {
  assert.throws(() => resolveApiBase({
    VITE_API_ROUTING_MODE: "direct",
    VITE_API_URL: "https://api-staging.kontraplatform.com",
  }), /only in local development/);
});

test("unknown routing modes fail closed", () => {
  assert.throws(() => resolveApiBase({
    VITE_API_ROUTING_MODE: "preview",
    VITE_API_URL: "https://kontra-api.onrender.com",
  }), /must be same-origin/);
});

test("local development rejects production and unknown direct targets", () => {
  assert.throws(() => resolveApiBase({
    VITE_API_ROUTING_MODE: "direct",
    DEV: true,
    VITE_API_URL: "https://kontra-api.onrender.com",
  }), /cannot target production/);
});

test("local development falls back to the Vite origin for its /api proxy", () => {
  assert.equal(resolveApiBase({ DEV: true }, "http://localhost:5173"), "");
});

test("hosted builds do not silently fall back to production API", () => {
  assert.throws(() => resolveApiBase({}, "https://staging.kontraplatform.com"), /must be same-origin/);
});
