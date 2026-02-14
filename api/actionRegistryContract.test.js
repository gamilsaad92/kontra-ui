const fs = require('fs');
const path = require('path');
const { app } = require('./testUtils/app');
const { buildRoutesManifest } = require('./src/dev/routesManifest');

function extractRequiredApis() {
  const registryPath = path.resolve(__dirname, '../ui/src/app/actionRegistry.ts');
  const text = fs.readFileSync(registryPath, 'utf8');
  const matches = text.match(/"(GET|POST|PATCH|PUT|DELETE|HEAD)\s+\/api[^\"]+"/g) || [];
  return Array.from(new Set(matches.map((value) => value.replaceAll('"', '').trim())));
}

describe('UI Action Contract route coverage', () => {
  it('ensures all action registry required APIs exist in backend routes', () => {
    const requiredApis = extractRequiredApis();
    const backendRoutes = buildRoutesManifest(app).map((entry) => `${entry.method} ${entry.path}`);

    const missing = requiredApis.filter((api) => {
      if (backendRoutes.includes(api)) return false;
      const [method, endpoint] = api.split(' ');
      if (endpoint.includes('/:')) {
        const pattern = new RegExp(`^${method} ${endpoint.replace(/:[^/]+/g, '[^/]+')}$`);
        return !backendRoutes.some((route) => pattern.test(route));
      }
      return true;
    });

    expect(missing).toEqual([]);
  });
});
