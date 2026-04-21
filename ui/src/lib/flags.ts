export function isFeatureEnabled(name: string): boolean {
  const raw = import.meta.env.VITE_FEATURE_FLAGS ?? '';
  const flags = raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return flags.includes(name.toLowerCase());
}
