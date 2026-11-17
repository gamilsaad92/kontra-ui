'use strict';

const STAGING_SCORING_POST_PATHS = new Set([
  '/api/jobs/score-assets',
  '/api/jobs/score-loans',
  '/api/jobs/score-troubled',
  '/api/risk/run',
]);

function assertValidatedStagingEnvironment(stagingEnvironment) {
  if (
    !stagingEnvironment
    || typeof stagingEnvironment !== 'object'
    || typeof stagingEnvironment.enabled !== 'boolean'
  ) {
    throw new TypeError('A validated staging environment policy is required');
  }
}

function createStagingScoringScheduler({
  nodeEnv,
  stagingEnvironment,
  schedules,
  addJob,
  setIntervalFn = setInterval,
}) {
  assertValidatedStagingEnvironment(stagingEnvironment);
  if (!Array.isArray(schedules) || typeof addJob !== 'function' || typeof setIntervalFn !== 'function') {
    throw new TypeError('A valid scoring scheduler configuration is required');
  }

  let started = false;
  return function startStagingScoringScheduler() {
    if (
      nodeEnv !== 'production'
      || stagingEnvironment.enabled !== false
      || started
      || schedules.length === 0
    ) {
      return false;
    }

    started = true;
    schedules.forEach(({ type, intervalMs }) => {
      addJob(type);
      setIntervalFn(() => addJob(type), intervalMs);
    });
    return true;
  };
}

function createStagingScoringGuard(stagingEnvironment) {
  assertValidatedStagingEnvironment(stagingEnvironment);

  return function stagingScoringGuard(req, res, next) {
    const method = String(req.method || '').toUpperCase();
    const path = String(req.path || '').replace(/\/+$/, '').toLowerCase();
    if (stagingEnvironment.enabled && method === 'POST' && STAGING_SCORING_POST_PATHS.has(path)) {
      return res.status(403).json({
        error: 'SCORING_DISABLED_IN_STAGING',
        message: 'Scoring jobs cannot be started in the isolated staging environment.',
      });
    }
    return next();
  };
}

module.exports = {
  STAGING_SCORING_POST_PATHS,
  createStagingScoringGuard,
  createStagingScoringScheduler,
};
