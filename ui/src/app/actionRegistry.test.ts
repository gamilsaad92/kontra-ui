import { actionRegistry } from "./actionRegistry";

const requiredRoutes = [
  "/dashboard",
  "/portfolio/loans",
  "/portfolio/projects",
  "/servicing/overview",
  "/servicing/loans",
  "/servicing/draws",
  "/servicing/inspections",
  "/servicing/borrower-financials",
  "/servicing/escrow",
  "/servicing/management",
  "/servicing/ai-validation",
  "/servicing/payments",
  "/markets/pools",
  "/markets/tokens",
  "/markets/trades",
  "/markets/exchange",
  "/governance/compliance",
  "/governance/policy/packs",
  "/governance/policy/rules",
  "/governance/policy/findings",
  "/governance/legal",
  "/governance/document-review",
  "/governance/risk",
  "/organizations",
  "/analytics",
  "/reports",
  "/settings/sso",
];

describe("actionRegistry coverage", () => {
  it("contains a unique id per action", () => {
    const ids = actionRegistry.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all primary clickable routes", () => {
    const routes = new Set(actionRegistry.map((item) => item.route));
    const missing = requiredRoutes.filter((route) => !routes.has(route));
    expect(missing).toEqual([]);
  });

  it("defines at least one API per action", () => {
    const missing = actionRegistry.filter((item) => item.requiredApis.length === 0).map((item) => item.id);
    expect(missing).toEqual([]);
  });
});
