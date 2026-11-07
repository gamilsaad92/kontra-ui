'use strict';

const DEFAULT_TRUSTED_ORIGINS = Object.freeze([
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://kontra.vercel.app',
  'https://kontra-ui.vercel.app',
  'https://kontraui.com',
  'https://www.kontraui.com',
  'https://kontraplatform.com',
  'https://www.kontraplatform.com',
  'https://staging.kontraplatform.com',
]);

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  if (raw === 'null' || /[\s,]/.test(raw)) return null;

  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || raw !== url.origin
      || url.pathname !== '/'
      || url.search
      || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeConfiguredOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim().replace(/\/$/, '');
  return normalizeOrigin(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
}

function createTrustedOriginSet({
  corsOrigins = '',
  frontendUrl = '',
  vercelUrl = '',
  replitDevDomain = '',
} = {}) {
  const configured = [
    ...String(corsOrigins).split(','),
    frontendUrl,
    vercelUrl,
    replitDevDomain,
  ];
  const origins = new Set(DEFAULT_TRUSTED_ORIGINS);
  for (const value of configured) {
    const origin = normalizeConfiguredOrigin(value);
    if (origin) origins.add(origin);
  }
  return origins;
}

function isTrustedOrigin(origin, trustedOrigins) {
  const normalized = normalizeOrigin(origin);
  return Boolean(normalized && trustedOrigins instanceof Set && trustedOrigins.has(normalized));
}

function createCorsOriginCallback(trustedOrigins) {
  return function corsOriginCallback(origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, isTrustedOrigin(origin, trustedOrigins));
  };
}

function hasCookie(req, cookieName) {
  return String(req.headers?.cookie || '')
    .split(';')
    .some((part) => part.slice(0, part.indexOf('=')).trim() === cookieName);
}

function createOwnerCookieOriginGuard({
  trustedOrigins,
  cookieName = 'kontra_owner_session',
  requireOrigin = false,
} = {}) {
  return function ownerCookieOriginGuard(req, res, next) {
    const cookiePresent = hasCookie(req, cookieName);
    if (!cookiePresent && !requireOrigin) return next();

    const origin = req.headers?.origin;
    if (!origin) {
      if (requireOrigin || (cookiePresent && UNSAFE_METHODS.has(req.method))) {
        return res.status(403).json({ error: 'TRUSTED_ORIGIN_REQUIRED' });
      }
      return next();
    }

    if (!isTrustedOrigin(origin, trustedOrigins)) {
      return res.status(403).json({ error: 'UNTRUSTED_ORIGIN' });
    }
    return next();
  };
}

module.exports = {
  DEFAULT_TRUSTED_ORIGINS,
  createTrustedOriginSet,
  createOwnerCookieOriginGuard,
  createCorsOriginCallback,
  isTrustedOrigin,
  normalizeOrigin,
};
