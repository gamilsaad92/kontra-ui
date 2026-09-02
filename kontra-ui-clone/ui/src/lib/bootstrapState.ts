export type BootstrapSnapshot = {
  sessionReady: boolean;
  isAuthenticated: boolean;
  orgReady: boolean;
  activeOrganizationId: string | null;
};

let snapshot: BootstrapSnapshot = {
  sessionReady: false,
  isAuthenticated: false,
  orgReady: false,
  activeOrganizationId: null,
};

const listeners = new Set<(next: BootstrapSnapshot) => void>();

export function getBootstrapSnapshot(): BootstrapSnapshot {
  return snapshot;
}

export function updateBootstrapSnapshot(next: Partial<BootstrapSnapshot>): BootstrapSnapshot {
  snapshot = {
    ...snapshot,
    ...next,
  };
  listeners.forEach((listener) => listener(snapshot));
  return snapshot;
}

export function subscribeBootstrapSnapshot(listener: (next: BootstrapSnapshot) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetBootstrapSnapshot(): BootstrapSnapshot {
  snapshot = {
    sessionReady: false,
    isAuthenticated: false,
    orgReady: false,
    activeOrganizationId: null,
  };
  listeners.forEach((listener) => listener(snapshot));
  return snapshot;
}
