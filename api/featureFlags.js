const DEFAULT_FLAGS = ['trading'];

const flags = new Set(
  DEFAULT_FLAGS.concat(
    (process.env.FEATURE_FLAGS || '')
      .split(',')
      .map(f => f.trim())
      .filter(Boolean)
  )
);

const featureFlags = Object.fromEntries([...flags].map(f => [f, true]));

module.exports = {
  featureFlags,
  isFeatureEnabled: (name) => !!featureFlags[name]
};
