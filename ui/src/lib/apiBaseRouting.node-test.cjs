const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveApiBase } = require("./apiBaseRouting.mjs");

test("same-origin routing ignores configured API origins", () => {
  assert.equal(
    resolveApiBase({
      VITE_API_ROUTING_MODE: "same-origin",
      VITE_API_BASE_URL: "https://kontra-api.onrender.com",
    }),
    "",
  );
});

test("staging routing keeps every API caller on the staging API", () => {
  assert.equal(
    resolveApiBase({
      VITE_API_ROUTING_MODE: "direct",
      VITE_API_BASE_URL: "https://api-staging.kontraplatform.com/api/",
    }),
    "https://api-staging.kontraplatform.com",
  );
});

test("local development falls back to the Vite origin for its /api proxy", () => {
  assert.equal(resolveApiBase({}, "http://localhost:5173"), "http://localhost:5173");
});

test("hosted builds do not silently fall back to production API", () => {
  assert.equal(resolveApiBase({}, "https://staging.kontraplatform.com"), "");
});
