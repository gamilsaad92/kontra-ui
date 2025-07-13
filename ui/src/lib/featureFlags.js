const flags = (import.meta.env.VITE_FEATURE_FLAGS || '')
  .split(',')
  .map(f => f.trim())
  .filter(Boolean);

export const featureFlags = Object.fromEntries(flags.map(f => [f, true]));

export const isFeatureEnabled = (name) => !!featureFlags[name];
