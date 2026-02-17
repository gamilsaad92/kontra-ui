import { actionRegistry } from "./actionRegistry";
import { routeCatalog } from "./routes";

describe("actionRegistry contract", () => {
  it("contains unique ids", () => {
    const ids = actionRegistry.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

   it("defines required fields for clickable actions", () => {
    const invalid = actionRegistry.filter(
      (item) => !item.label || !item.route || !item.uiPath || item.requiredApis.length === 0
    );
    expect(invalid).toEqual([]);
 });
  
  it("maps required routes to route catalog", () => {
    const routeSet = new Set(routeCatalog);
    const missing = actionRegistry.flatMap((item) =>
      (item.requiredRoutes ?? []).filter((route) => !routeSet.has(route as never)).map((route) => `${item.id}:${route}`)
    );
    expect(missing).toEqual([]);
  });
});
