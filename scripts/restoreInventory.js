#!/usr/bin/env node
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const detectedOldCommit = execSync('git rev-list -n 1 --before="2026-02-12 23:59:59" HEAD', { encoding: 'utf8' }).trim();
const OLD_COMMIT = process.env.UI_OLD || detectedOldCommit || execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const NAV_FILE = 'ui/src/routes.jsx';
const ROUTE_FILE = 'ui/src/app/routes.ts';

function readGitFile(ref, filePath) {
  try {
    return execSync(`git show ${ref}:${filePath}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function readCurrent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function extractPaths(source) {
  return Array.from(new Set([...source.matchAll(/path:\s*['\"]([^'\"]+)['\"]/g)].map((m) => m[1])));
}

function extractNavItems(source) {
  return [...source.matchAll(/label:\s*['\"]([^'\"]+)['\"],\s*\n\s*path:\s*['\"]([^'\"]+)['\"]/g)].map((m) => ({
    id: m[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    label: m[1],
    route: m[2],
    oldFileHint: NAV_FILE,
  }));
}

const oldNavSource = readGitFile(OLD_COMMIT, NAV_FILE);
const currentNavSource = readCurrent(NAV_FILE);
const oldRouteSource = readGitFile(OLD_COMMIT, ROUTE_FILE);
const currentRouteSource = readCurrent(ROUTE_FILE);

const oldNavItems = extractNavItems(oldNavSource);
const currentNavRoutes = new Set(extractNavItems(currentNavSource).map((i) => i.route));
const removedNavItems = oldNavItems.filter((item) => !currentNavRoutes.has(item.route));

const oldRoutes = new Set([...extractPaths(oldNavSource), ...extractPaths(oldRouteSource)]);
const currentRoutes = new Set([...extractPaths(currentNavSource), ...extractPaths(currentRouteSource)]);
const removedRoutes = [...oldRoutes].filter((route) => !currentRoutes.has(route)).sort();
const changedRoutes = [...currentRoutes].filter((route) => !oldRoutes.has(route)).sort();

const output = {
  generatedAt: new Date().toISOString(),
  oldCommit: OLD_COMMIT,
  removedNavItems,
  removedRoutes,
  changedRoutes,
};

fs.writeFileSync('docs/restore_inventory.json', `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated docs/restore_inventory.json using old commit ${OLD_COMMIT}`);
