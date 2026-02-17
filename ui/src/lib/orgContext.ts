const ORG_STORAGE_KEY = "kontra_org_id";
const LEGACY_KEYS = ["kontra:orgId"];

let currentOrgId: string | null = null;

export function setOrgId(orgId?: string | number | null): void {
  currentOrgId = orgId === null || orgId === undefined || orgId === "" ? null : String(orgId);

  if (typeof window !== "undefined") {
    if (currentOrgId) {
      window.localStorage.setItem(ORG_STORAGE_KEY, currentOrgId);
      LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } else {
        window.localStorage.removeItem(ORG_STORAGE_KEY);
      LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key));
    }
  }
}

export function getOrgId(): string | null {
  if (currentOrgId) {
    return currentOrgId;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const fromStorage =
    window.localStorage.getItem(ORG_STORAGE_KEY) ||
    LEGACY_KEYS.map((key) => window.localStorage.getItem(key)).find((value) => Boolean(value));

  return fromStorage && fromStorage.trim() ? fromStorage : null;
}

export function requireOrgId(): string {
  const orgId = getOrgId();
  if (!orgId) {
    const error = new Error("Select an organization to continue") as Error & {
      code?: string;
      status?: number;
    };
    error.code = "ORG_CONTEXT_MISSING";
    error.status = 400;
    throw error;
  }

  return orgId;
}
