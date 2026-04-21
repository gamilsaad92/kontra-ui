const API_BASE = process.env.WIRING_API_BASE_URL || "http://localhost:10000";
const ORG_ID = process.env.WIRING_ORG_ID || "dev-org";

const blockerAndHighApis = [
  "GET /api/dashboard/summary",
  "GET /api/portfolio/loans",
  "GET /api/portfolio/assets",
  "GET /api/servicing/payments",
  "GET /api/servicing/inspections",
  "GET /api/servicing/draws",
  "GET /api/markets/pools",
  "GET /api/governance/compliance-items",
  "GET /api/reports/reports",
  "GET /api/orgs",
];

const normalizePath = (definition) => {
  const [method, ...parts] = definition.split(" ");
  return { method: method.toUpperCase(), path: parts.join(" ") };
};

const failures = [];
for (const endpoint of blockerAndHighApis) {
  const { method, path } = normalizePath(endpoint);
  try {
    const response = await fetch(`${API_BASE}${path}`, { method, headers: { "X-Org-Id": ORG_ID } });
    if ([404, 501].includes(response.status)) {
      failures.push(`${endpoint} -> ${response.status}`);
      continue;
    }
    const body = await response.clone().json().catch(() => null);
    if (body?.code === "ORG_CONTEXT_MISSING") {
      failures.push(`${endpoint} -> ORG_CONTEXT_MISSING`);
    }
  } catch (error) {
    failures.push(`${endpoint} -> ${error instanceof Error ? error.message : "CORS/Network blocked"}`);
  }
}

if (failures.length > 0) {
  console.error("Wiring gate failed:\n" + failures.join("\n"));
  process.exit(1);
}

console.log("Wiring gate passed");
