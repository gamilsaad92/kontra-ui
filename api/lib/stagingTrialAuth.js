'use strict';

function stagingDemoRouteGuard(enabled) {
  return function guardStagingDemoRoute(req, res, next) {
    if (enabled) {
      return res.status(404).json({ error: 'not_found' });
    }
    return next();
  };
}

function parseAllowedTesterEmails(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function stagingTrialAuth(enabled, supabase, allowedTesterEmails) {
  const allowedEmails = parseAllowedTesterEmails(allowedTesterEmails);

  return async function requireStagingTrialAuth(req, res, next) {
    if (!enabled) return next();

    if (allowedEmails.size === 0) {
      return res.status(503).json({
        error: 'staging_testers_not_configured',
        message: 'Trial-room creation is disabled until approved staging testers are configured.',
      });
    }

    const authorization = String(req.headers?.authorization || '');
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1].trim()) {
      return res.status(401).json({
        error: 'staging_auth_required',
        message: 'Sign in with a staging account before creating a trial room.',
      });
    }

    if (typeof supabase?.auth?.getUser !== 'function') {
      return res.status(503).json({ error: 'staging_auth_unavailable' });
    }

    try {
      const { data, error } = await supabase.auth.getUser(match[1].trim());
      const user = data?.user;
      if (error || !user?.id || !user.email) {
        return res.status(401).json({
          error: 'staging_auth_required',
          message: 'A valid staging sign-in is required to create a trial room.',
        });
      }
      const normalizedEmail = String(user.email).trim().toLowerCase();
      if (!allowedEmails.has(normalizedEmail)) {
        return res.status(403).json({
          error: 'staging_tester_not_approved',
          message: 'This staging account is not approved to create trial rooms.',
        });
      }

      req.stagingTrialUser = { ...user, email: normalizedEmail };
      return next();
    } catch {
      return res.status(503).json({ error: 'staging_auth_unavailable' });
    }
  };
}

module.exports = {
  parseAllowedTesterEmails,
  stagingDemoRouteGuard,
  stagingTrialAuth,
};
