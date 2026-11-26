'use strict';

const DEFERRED_PREFIXES = Object.freeze([
  // Keep the duplicate /api/orgs router and legacy invites deferred. The
  // verified /api/me bootstrap routes are canonical and ready for staging.
  { module: 'institutional_tenancy', prefixes: ['/api/orgs', '/api/invites'] },
  {
    module: 'lending_and_servicing',
    prefixes: [
      '/api/loans',
      '/api/copilot',
      '/api/my-loans',
      '/api/my-applications',
      '/api/applications',
      '/api/loan-applications',
      '/api/draws',
      '/api/collections',
      '/api/tasks',
      '/api/decision-history',
      '/api/portfolio-summary',
      '/api/query-loans',
      '/api/underwriter-chat',
      '/api/ask',
      '/api/chatops',
      '/api/smart-recommendations',
      '/api/saved-loan-queries',
    ],
  },
  { module: 'portfolio_and_dashboard', prefixes: ['/api/dashboard', '/api/dashboard-layout', '/api/portfolio', '/api/servicing'] },
  { module: 'institutional_reporting', prefixes: ['/api/reports', '/api/investor-reports'] },
  { module: 'mobile_lending', prefixes: ['/api/mobile'] },
  { module: 'external_identity_integrations', prefixes: ['/api/sso'] },
]);

function requestPath(req) {
  return String(req.originalUrl || req.url || '').split('?')[0];
}

function prefixMatches(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function getDeferredModule(path) {
  for (const entry of DEFERRED_PREFIXES) {
    if (entry.prefixes.some((prefix) => prefixMatches(path, prefix))) return entry.module;
  }
  return null;
}

function createDeferredTask531Modules({ enabled = false } = {}) {
  return function deferredTask531Modules(req, res, next) {
    if (!enabled) return next();
    const module = getDeferredModule(requestPath(req));
    if (!module) return next();
    return res.status(501).json({
      code: 'TASK531_MODULE_DEFERRED',
      module,
      message: 'This module is deferred from the current Deal Room staging release.',
    });
  };
}

module.exports = { createDeferredTask531Modules, getDeferredModule };
