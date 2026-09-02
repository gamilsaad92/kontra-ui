function normalizePathSegment(segment = '') {
  return String(segment).replace(/\/?\(\?=\/\|\$\)/g, '').replace(/\\\//g, '/');
}

function cleanCombinedPath(path = '') {
  if (!path) return '/';
  const normalized = path.replace(/\/+/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) return normalized.slice(0, -1);
  return normalized;
}

function extractLayerPath(layer) {
  if (layer.route?.path) {
    return Array.isArray(layer.route.path) ? layer.route.path[0] : layer.route.path;
  }

  if (layer.regexp?.source) {
    const source = layer.regexp.source
      .replace('^', '')
      .replace('\\/?(?=\\/|$)', '')
      .replace('(?=\\/|$)', '')
      .replace('(?:\\/(?=$))?', '')
      .replace(/\\\//g, '/');
    if (source === '$') return '';
    if (source.includes('(?:') || source.includes('(?=')) return '';
    return source;
  }

  return '';
}

function collectRoutes(stack = [], basePath = '') {
  const routes = [];

  stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      const routePath = Array.isArray(layer.route.path) ? layer.route.path[0] : layer.route.path;
      const methods = Object.keys(layer.route.methods || {})
        .filter((method) => layer.route.methods[method])
        .map((method) => method.toUpperCase());

      methods.forEach((method) => {
        routes.push({
          method,
          path: cleanCombinedPath(`${basePath}${normalizePathSegment(routePath)}`),
        });
      });
      return;
    }

    if (layer.name === 'router' && layer.handle?.stack) {
      const layerPath = extractLayerPath(layer);
      const nestedBasePath = cleanCombinedPath(`${basePath}${normalizePathSegment(layerPath)}`);
      routes.push(...collectRoutes(layer.handle.stack, nestedBasePath === '/' ? '' : nestedBasePath));
    }
  });

  return routes;
}

function buildRoutesManifest(app) {
  const stack = app?._router?.stack || app?.router?.stack || [];
  const discovered = collectRoutes(stack, '');
  const deduped = new Map();

  discovered.forEach((entry) => {
    const key = `${entry.method} ${entry.path}`;
    if (!deduped.has(key)) deduped.set(key, entry);
  });

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method);
    return a.path.localeCompare(b.path);
  });
}

module.exports = { buildRoutesManifest };
